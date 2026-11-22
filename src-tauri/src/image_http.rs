//! 千问 Token Plan 图像生成代理（wan2.7-image / wan2.7-image-pro / qwen-image-3.0-pro）。
//!
//! 走百炼原生多模态生成同步接口（`/api/v1/services/aigc/multimodal-generation/generation`）：
//! 1. API Key 只在 Rust 侧从本机保险箱读取，不返回前端；
//! 2. 接入地址限定千问 / 阿里云域名；
//! 3. 生成结果返回的临时 OSS 图片链接（仅 24 小时有效）立即下载保存到 `$APPDATA/artworks/`。

use std::fs;
use std::path::PathBuf;
use std::time::Duration;

use base64::Engine as _;
use reqwest::{Client, Url};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

use crate::speech::{is_allowed_host, resolve_api_key};
use crate::speech_http::{endpoint, secure_audio_url, validate_base_url};

const IMAGE_GEN_PATH: &str = "/api/v1/services/aigc/multimodal-generation/generation";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(120);
const MAX_IMAGE_BYTES: usize = 20 * 1024 * 1024;
const MAX_UPLOAD_BYTES: usize = 6 * 1024 * 1024;

#[derive(Deserialize, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct ImageGenerateArgs {
    pub prompt: String,
    pub model: String,
    #[serde(default)]
    pub size: Option<String>,
    #[serde(default)]
    pub base_url: Option<String>,
    #[serde(default)]
    pub provider_id: Option<String>,
    #[serde(default)]
    pub reference_image_path: Option<String>,
    #[serde(default)]
    pub reference_image_data_url: Option<String>,
}

#[derive(Serialize, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GeneratedImage {
    pub path: String,
    pub mime_type: String,
}

pub(crate) fn get_artworks_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let mut path = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法获取应用数据目录：{e}"))?;
    path.push("artworks");
    fs::create_dir_all(&path).map_err(|e| format!("创建画作目录失败：{e}"))?;
    Ok(path)
}

pub(crate) fn validate_artwork_path(app: &AppHandle, raw_path: &str) -> Result<PathBuf, String> {
    let trimmed = raw_path.trim();
    if trimmed.is_empty() {
        return Err("图片路径为空".into());
    }
    let path = PathBuf::from(trimmed);
    if !path.is_absolute() {
        return Err("图片路径必须为绝对路径".into());
    }
    let artworks_dir = get_artworks_dir(app)?;
    let root = artworks_dir
        .canonicalize()
        .unwrap_or_else(|_| artworks_dir.clone());
    let canonical = path
        .canonicalize()
        .map_err(|e| format!("读取本地图片失败：{e}"))?;
    if !canonical.starts_with(&root) {
        return Err("图片路径不在允许的画作目录内".into());
    }
    Ok(canonical)
}

pub(crate) fn remove_artwork_file_if_in_sandbox(app: &AppHandle, raw_path: &str) {
    if let Ok(path) = validate_artwork_path(app, raw_path) {
        let _ = fs::remove_file(path);
    }
}

pub fn image_body(
    model: &str,
    prompt: &str,
    size: Option<&str>,
    reference_data_url: Option<&str>,
) -> Value {
    let mut content = Vec::new();
    if let Some(img) = reference_data_url.map(str::trim).filter(|s| !s.is_empty()) {
        content.push(json!({ "image": img }));
    }
    content.push(json!({ "text": prompt }));

    let chosen_size = size
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("1K");

    json!({
        "model": model,
        "input": {
            "messages": [
                {
                    "role": "user",
                    "content": content
                }
            ]
        },
        "parameters": {
            "n": 1,
            "size": chosen_size,
            "watermark": false
        }
    })
}

pub fn parse_image_url(value: &Value) -> Result<String, String> {
    if let Some(items) = value["output"]["choices"][0]["message"]["content"].as_array() {
        for item in items {
            if let Some(url) = item["image"].as_str().map(str::trim).filter(|s| !s.is_empty()) {
                return Ok(url.to_string());
            }
        }
        let reason: String = items
            .iter()
            .filter_map(|item| item["text"].as_str())
            .collect::<Vec<_>>()
            .join(" ")
            .trim()
            .to_string();
        if !reason.is_empty() {
            return Err(format!("画画模型没有返回图片：{reason}"));
        }
    }

    if let Some(url) = value["output"]["results"][0]["url"]
        .as_str()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        return Ok(url.to_string());
    }

    if let Some(url) = value["data"][0]["url"]
        .as_str()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        return Ok(url.to_string());
    }

    if let Some(msg) = value["message"].as_str().map(str::trim).filter(|s| !s.is_empty()) {
        return Err(format!("画画模型没有返回图片：{msg}"));
    }

    Err("画画模型没有返回图片".into())
}

pub fn describe_image_http_error(status: u16, body: &str) -> String {
    let parsed: Value = serde_json::from_str(body).unwrap_or(Value::Null);
    let code = parsed["code"].as_str().unwrap_or_default();
    let message = parsed["message"].as_str().unwrap_or_default();
    if status == 401 || status == 403 || code == "InvalidApiKey" {
        return format!("API Key 无效，或这个 Key 没有开通画画模型服务（HTTP {status}）");
    }
    match (code.is_empty(), message.is_empty()) {
        (false, false) => format!("{code}: {message}"),
        (true, false) => message.to_string(),
        _ => format!("画画服务请求失败（HTTP {status}）"),
    }
}

pub fn detect_image_format(content_type: Option<&str>, bytes: &[u8]) -> (&'static str, &'static str) {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        return ("png", "image/png");
    }
    if bytes.len() >= 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF {
        return ("jpg", "image/jpeg");
    }
    if bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        return ("webp", "image/webp");
    }
    let ct = content_type.unwrap_or("").to_ascii_lowercase();
    if ct.contains("jpeg") || ct.contains("jpg") {
        return ("jpg", "image/jpeg");
    }
    if ct.contains("webp") {
        return ("webp", "image/webp");
    }
    ("png", "image/png")
}

pub fn parse_image_data_url(data_url: &str) -> Result<(&'static str, &'static str, Vec<u8>), String> {
    let trimmed = data_url.trim();
    let (meta, b64) = trimmed
        .split_once(',')
        .ok_or_else(|| "图片数据格式无效".to_string())?;
    if !meta.ends_with(";base64") {
        return Err("只支持 base64 编码的图片数据".into());
    }
    let mime = meta
        .strip_prefix("data:")
        .and_then(|s| s.strip_suffix(";base64"))
        .map(str::to_ascii_lowercase)
        .unwrap_or_default();
    let (ext, normalized_mime) = match mime.as_str() {
        "image/png" => ("png", "image/png"),
        "image/jpeg" | "image/jpg" => ("jpg", "image/jpeg"),
        "image/webp" => ("webp", "image/webp"),
        _ => return Err("不支持的图片格式，请使用 PNG、JPG 或 WebP".into()),
    };
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(b64.trim())
        .map_err(|_| "图片 base64 解码失败".to_string())?;
    if bytes.is_empty() {
        return Err("图片数据为空".into());
    }
    if bytes.len() > MAX_UPLOAD_BYTES {
        return Err("参考图片太大了（超过 6MB）".into());
    }
    Ok((ext, normalized_mime, bytes))
}

fn mime_from_path(path: &PathBuf) -> &'static str {
    match path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        _ => "image/png",
    }
}

fn client() -> Result<Client, String> {
    Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .build()
        .map_err(|e| e.to_string())
}

pub(crate) async fn generate_and_download(
    client: &Client,
    base: &Url,
    api_key: &str,
    body: &Value,
    require_https: bool,
) -> Result<(Vec<u8>, &'static str, &'static str), String> {
    let url = endpoint(base, IMAGE_GEN_PATH)?;
    let response = client
        .post(url)
        .bearer_auth(api_key.trim())
        .json(body)
        .send()
        .await
        .map_err(|e| format!("连接画画服务失败：{e}"))?;

    let status = response.status().as_u16();
    let text = response.text().await.map_err(|e| e.to_string())?;
    if !(200..300).contains(&status) {
        return Err(describe_image_http_error(status, &text));
    }

    let value: Value = serde_json::from_str(&text).map_err(|_| "画画服务返回的内容无法解析".to_string())?;
    let raw_image_url = parse_image_url(&value)?;

    if raw_image_url.starts_with("data:image/") {
        let (ext, mime, bytes) = parse_image_data_url(&raw_image_url)?;
        return Ok((bytes, ext, mime));
    }

    let parsed_url = Url::parse(&raw_image_url).map_err(|_| "画画服务返回的图片地址无效".to_string())?;
    let download_url = if !require_https {
        parsed_url
    } else if parsed_url.scheme() == "https" {
        parsed_url
    } else {
        let host = parsed_url.host_str().unwrap_or_default().to_ascii_lowercase();
        if parsed_url.scheme() == "http" && is_allowed_host(&host) {
            secure_audio_url(parsed_url, true)?
        } else {
            return Err("画画服务返回的图片地址不是 https".into());
        }
    };

    let img_resp = client
        .get(download_url)
        .send()
        .await
        .map_err(|e| format!("下载生成的图片失败：{e}"))?;
    if !img_resp.status().is_success() {
        return Err(format!("下载生成的图片失败（HTTP {}）", img_resp.status().as_u16()));
    }
    let content_type = img_resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(str::to_string);
    let bytes = img_resp.bytes().await.map_err(|e| e.to_string())?;
    if bytes.is_empty() {
        return Err("下载到的图片为空".into());
    }
    if bytes.len() > MAX_IMAGE_BYTES {
        return Err("生成的图片过大".into());
    }
    let (ext, mime) = detect_image_format(content_type.as_deref(), &bytes);
    Ok((bytes.to_vec(), ext, mime))
}

/// 生成插画并立即下载落盘到 `$APPDATA/artworks/`
#[tauri::command]
pub async fn image_http_generate(
    app: AppHandle,
    args: ImageGenerateArgs,
) -> Result<GeneratedImage, String> {
    let prompt = args.prompt.trim();
    if prompt.is_empty() {
        return Err("画画描述不能为空".into());
    }
    if prompt.chars().count() > 2000 {
        return Err("画画描述太长啦，请简短一些".into());
    }
    let model = args.model.trim();
    if model.is_empty() {
        return Err("请先选择绘本插画模型".into());
    }

    let base = validate_base_url(args.base_url.as_deref())?;
    let api_key = resolve_api_key(&app, args.provider_id.as_deref())?;

    let ref_data_url: Option<String> = if let Some(raw_data) = args
        .reference_image_data_url
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        let (_, mime, bytes) = parse_image_data_url(raw_data)?;
        Some(format!(
            "data:{mime};base64,{}",
            base64::engine::general_purpose::STANDARD.encode(&bytes)
        ))
    } else if let Some(ref_path) = args
        .reference_image_path
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        let valid_path = validate_artwork_path(&app, ref_path)?;
        let bytes = fs::read(&valid_path).map_err(|e| format!("读取参考图片失败：{e}"))?;
        if bytes.is_empty() {
            return Err("参考图片为空".into());
        }
        if bytes.len() > MAX_UPLOAD_BYTES {
            return Err("参考图片过大（超过 6MB）".into());
        }
        let (_, mime) = detect_image_format(Some(mime_from_path(&valid_path)), &bytes);
        Some(format!(
            "data:{mime};base64,{}",
            base64::engine::general_purpose::STANDARD.encode(&bytes)
        ))
    } else {
        None
    };

    let body = image_body(model, prompt, args.size.as_deref(), ref_data_url.as_deref());
    let (bytes, ext, mime) = generate_and_download(&client()?, &base, &api_key, &body, true).await?;

    let dir = get_artworks_dir(&app)?;
    let dest = dir.join(format!("{}.{}", Uuid::new_v4(), ext));
    fs::write(&dest, &bytes).map_err(|e| format!("保存生成的图片失败：{e}"))?;

    Ok(GeneratedImage {
        path: dest.to_string_lossy().to_string(),
        mime_type: mime.to_string(),
    })
}

/// 将前端涂鸦画布 data URL 保存到 `$APPDATA/artworks/`
#[tauri::command]
pub fn artwork_save_data_url(app: AppHandle, data_url: String) -> Result<String, String> {
    let (ext, _, bytes) = parse_image_data_url(&data_url)?;
    let dir = get_artworks_dir(&app)?;
    let dest = dir.join(format!("sketch-{}.{}", Uuid::new_v4(), ext));
    fs::write(&dest, &bytes).map_err(|e| format!("保存涂鸦失败：{e}"))?;
    Ok(dest.to_string_lossy().to_string())
}

/// 读取本地画作为 base64 data URL（用于前端离线合成导出长图，避免 Canvas 跨域污染）
#[tauri::command]
pub fn artwork_read_data_url(app: AppHandle, path: String) -> Result<String, String> {
    let valid_path = validate_artwork_path(&app, &path)?;
    let bytes = fs::read(&valid_path).map_err(|e| format!("读取图片失败：{e}"))?;
    if bytes.is_empty() {
        return Err("图片文件为空".into());
    }
    if bytes.len() > MAX_IMAGE_BYTES {
        return Err("图片文件过大".into());
    }
    let (_, mime) = detect_image_format(Some(mime_from_path(&valid_path)), &bytes);
    Ok(format!(
        "data:{mime};base64,{}",
        base64::engine::general_purpose::STANDARD.encode(&bytes)
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use wiremock::matchers::{header, method, path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    #[test]
    fn image_body_text_and_reference() {
        let t2i = image_body("wan2.7-image", "一只戴草帽的小恐龙", None, None);
        assert_eq!(t2i["model"], "wan2.7-image");
        assert_eq!(t2i["input"]["messages"][0]["role"], "user");
        assert_eq!(
            t2i["input"]["messages"][0]["content"],
            json!([{ "text": "一只戴草帽的小恐龙" }])
        );
        assert_eq!(t2i["parameters"]["n"], 1);
        assert_eq!(t2i["parameters"]["size"], "1K");
        assert_eq!(t2i["parameters"]["watermark"], false);

        let i2i = image_body(
            "qwen-image-3.0-pro",
            "把涂鸦变成森林探险绘本",
            Some("2K"),
            Some("data:image/png;base64,AAAA"),
        );
        assert_eq!(
            i2i["input"]["messages"][0]["content"],
            json!([
                { "image": "data:image/png;base64,AAAA" },
                { "text": "把涂鸦变成森林探险绘本" }
            ])
        );
        assert_eq!(i2i["parameters"]["size"], "2K");
    }

    #[test]
    fn parses_image_urls_and_errors() {
        let choice = json!({
            "output": {
                "choices": [{
                    "message": {
                        "role": "assistant",
                        "content": [{ "type": "image", "image": "https://oss.example/pic.png" }]
                    }
                }]
            }
        });
        assert_eq!(parse_image_url(&choice).unwrap(), "https://oss.example/pic.png");

        let legacy = json!({ "output": { "results": [{ "url": "https://oss.example/old.png" }] } });
        assert_eq!(parse_image_url(&legacy).unwrap(), "https://oss.example/old.png");

        let refused = json!({
            "output": {
                "choices": [{
                    "message": {
                        "content": [{ "text": "无法生成不安全内容" }]
                    }
                }]
            }
        });
        let err = parse_image_url(&refused).unwrap_err();
        assert!(err.contains("无法生成不安全内容"), "{err}");

        assert!(parse_image_url(&json!({ "output": {} })).is_err());
    }

    #[test]
    fn parses_and_detects_image_formats() {
        let png_bytes = b"\x89PNG\r\n\x1a\nhello";
        assert_eq!(detect_image_format(None, png_bytes), ("png", "image/png"));
        let jpg_bytes = [0xFF, 0xD8, 0xFF, 0xE0];
        assert_eq!(detect_image_format(None, &jpg_bytes), ("jpg", "image/jpeg"));

        let b64 = base64::engine::general_purpose::STANDARD.encode(png_bytes);
        let (ext, mime, decoded) = parse_image_data_url(&format!("data:image/png;base64,{b64}")).unwrap();
        assert_eq!((ext, mime), ("png", "image/png"));
        assert_eq!(decoded, png_bytes);
        assert!(parse_image_data_url("data:text/plain;base64,AAAA").is_err());
    }

    #[tokio::test]
    async fn generate_and_download_roundtrip_with_wiremock() {
        let server = MockServer::start().await;
        let img_url = format!("{}/files/out.png", server.uri());
        let png_bytes = b"\x89PNG\r\n\x1a\nfake-png-data".to_vec();

        Mock::given(method("POST"))
            .and(path(IMAGE_GEN_PATH))
            .and(header("authorization", "Bearer sk-sp-good"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "output": {
                    "choices": [{
                        "message": {
                            "role": "assistant",
                            "content": [{ "type": "image", "image": img_url }]
                        }
                    }]
                }
            })))
            .mount(&server)
            .await;

        Mock::given(method("GET"))
            .and(path("/files/out.png"))
            .respond_with(
                ResponseTemplate::new(200)
                    .insert_header("content-type", "image/png")
                    .set_body_bytes(png_bytes.clone()),
            )
            .mount(&server)
            .await;

        let base = Url::parse(&server.uri()).unwrap();
        let body = image_body("wan2.7-image", "小柴犬去月球", None, None);
        let (bytes, ext, mime) = generate_and_download(&client().unwrap(), &base, "sk-sp-good", &body, false)
            .await
            .unwrap();
        assert_eq!(bytes, png_bytes);
        assert_eq!((ext, mime), ("png", "image/png"));

        // 验证 401 错误映射
        Mock::given(method("POST"))
            .and(path(IMAGE_GEN_PATH))
            .and(header("authorization", "Bearer sk-sp-bad"))
            .respond_with(ResponseTemplate::new(401).set_body_json(json!({
                "code": "InvalidApiKey",
                "message": "Invalid API-key provided."
            })))
            .mount(&server)
            .await;

        let err = generate_and_download(&client().unwrap(), &base, "sk-sp-bad", &body, false)
            .await
            .unwrap_err();
        assert!(err.contains("API Key 无效"), "{err}");
    }
}
