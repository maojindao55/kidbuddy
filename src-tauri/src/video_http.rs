//! 千问 Token Plan 图生视频代理（wan3.0-video / happyhorse-1.1-i2v）。
//!
//! 走百炼原生异步视频合成接口：
//! 1. `POST /api/v1/services/aigc/video-generation/video-synthesis`（请求头带 `X-DashScope-Async: enable`）
//! 2. `GET /api/v1/tasks/{task_id}` 轮询任务状态，完成后下载 MP4 落盘到 `$APPDATA/artworks/`

use std::fs;
use std::time::{Duration, Instant};

use base64::Engine as _;
use reqwest::{Client, Url};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::AppHandle;
use uuid::Uuid;

use crate::image_http::{detect_image_format, get_artworks_dir, validate_artwork_path};
use crate::speech::{is_allowed_host, resolve_api_key};
use crate::speech_http::{endpoint, secure_audio_url, validate_base_url};

const VIDEO_GEN_PATH: &str = "/api/v1/services/aigc/video-generation/video-synthesis";
const HTTP_TIMEOUT: Duration = Duration::from_secs(40);
const POLL_INTERVAL: Duration = Duration::from_secs(3);
const MAX_POLL_DURATION: Duration = Duration::from_secs(240);
const MAX_INPUT_IMAGE_BYTES: usize = 6 * 1024 * 1024;
const MAX_VIDEO_BYTES: usize = 60 * 1024 * 1024;

#[derive(Deserialize, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct VideoAnimateArgs {
    pub prompt: String,
    pub model: String,
    pub image_path: String,
    #[serde(default)]
    pub base_url: Option<String>,
    #[serde(default)]
    pub provider_id: Option<String>,
}

#[derive(Serialize, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GeneratedVideo {
    pub path: String,
    pub mime_type: String,
}

pub fn video_body(model: &str, prompt: &str, first_frame_data_url: &str) -> Value {
    json!({
        "model": model,
        "input": {
            "prompt": prompt,
            "media": [
                {
                    "type": "first_frame",
                    "url": first_frame_data_url
                }
            ]
        },
        "parameters": {
            "resolution": "720P",
            "duration": 5,
            "watermark": false
        }
    })
}

pub fn parse_task_id(value: &Value) -> Result<String, String> {
    let id = value["output"]["task_id"]
        .as_str()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| {
            let msg = value["message"].as_str().map(str::trim).unwrap_or("");
            if msg.is_empty() {
                "动画魔法服务没有返回任务编号".to_string()
            } else {
                format!("创建动画任务失败：{msg}")
            }
        })?;
    validate_task_id(id)?;
    Ok(id.to_string())
}

pub fn validate_task_id(task_id: &str) -> Result<(), String> {
    if task_id.is_empty()
        || task_id.len() > 128
        || !task_id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err("动画任务编号格式无效".into());
    }
    Ok(())
}

pub fn parse_video_url(value: &Value) -> Option<String> {
    if let Some(url) = value["output"]["video_url"]
        .as_str()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        return Some(url.to_string());
    }
    if let Some(url) = value["output"]["results"][0]["url"]
        .as_str()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        return Some(url.to_string());
    }
    if let Some(items) = value["output"]["choices"][0]["message"]["content"].as_array() {
        for item in items {
            if let Some(url) = item["video"]
                .as_str()
                .or_else(|| item["url"].as_str())
                .map(str::trim)
                .filter(|s| !s.is_empty())
            {
                return Some(url.to_string());
            }
        }
    }
    None
}

pub fn describe_video_http_error(status: u16, body: &str) -> String {
    let parsed: Value = serde_json::from_str(body).unwrap_or(Value::Null);
    let code = parsed["code"].as_str().unwrap_or_default();
    let message = parsed["message"].as_str().unwrap_or_default();
    if status == 401 || status == 403 || code == "InvalidApiKey" {
        return format!("API Key 无效，或这个 Key 没有开通图生视频服务（HTTP {status}）");
    }
    match (code.is_empty(), message.is_empty()) {
        (false, false) => format!("{code}: {message}"),
        (true, false) => message.to_string(),
        _ => format!("动画魔法服务请求失败（HTTP {status}）"),
    }
}

fn client() -> Result<Client, String> {
    Client::builder()
        .timeout(HTTP_TIMEOUT)
        .build()
        .map_err(|e| e.to_string())
}

pub(crate) async fn animate_and_download(
    client: &Client,
    base: &Url,
    api_key: &str,
    body: &Value,
    poll_interval: Duration,
    max_wait: Duration,
    require_https: bool,
) -> Result<Vec<u8>, String> {
    let create_url = endpoint(base, VIDEO_GEN_PATH)?;
    let create_resp = client
        .post(create_url)
        .bearer_auth(api_key.trim())
        .header("X-DashScope-Async", "enable")
        .json(body)
        .send()
        .await
        .map_err(|e| format!("连接动画魔法服务失败：{e}"))?;

    let create_status = create_resp.status().as_u16();
    let create_text = create_resp.text().await.map_err(|e| e.to_string())?;
    if !(200..300).contains(&create_status) {
        return Err(describe_video_http_error(create_status, &create_text));
    }

    let create_json: Value =
        serde_json::from_str(&create_text).map_err(|_| "动画任务响应无法解析".to_string())?;
    let task_id = parse_task_id(&create_json)?;

    let poll_url = endpoint(base, &format!("/api/v1/tasks/{task_id}"))?;
    let deadline = Instant::now() + max_wait;

    let raw_video_url = loop {
        let resp = client
            .get(poll_url.clone())
            .bearer_auth(api_key.trim())
            .send()
            .await
            .map_err(|e| format!("查询动画生成进度失败：{e}"))?;
        let status = resp.status().as_u16();
        let text = resp.text().await.map_err(|e| e.to_string())?;
        if !(200..300).contains(&status) {
            return Err(describe_video_http_error(status, &text));
        }

        let val: Value =
            serde_json::from_str(&text).map_err(|_| "动画进度响应无法解析".to_string())?;
        let task_status = val["output"]["task_status"]
            .as_str()
            .unwrap_or("UNKNOWN")
            .to_ascii_uppercase();

        match task_status.as_str() {
            "SUCCEEDED" => {
                break parse_video_url(&val)
                    .ok_or_else(|| "动画生成成功，但没有返回视频地址".to_string())?;
            }
            "FAILED" | "CANCELED" => {
                let reason = val["output"]["message"]
                    .as_str()
                    .or_else(|| val["message"].as_str())
                    .map(str::trim)
                    .filter(|s| !s.is_empty())
                    .unwrap_or("模型未能生成视频");
                return Err(format!("动画魔法施展失败：{reason}"));
            }
            _ => {
                if Instant::now() >= deadline {
                    return Err("动画生成时间较长，请稍后再试一次".into());
                }
                tokio::time::sleep(poll_interval).await;
            }
        }
    };

    let parsed_url =
        Url::parse(&raw_video_url).map_err(|_| "动画服务返回的视频地址无效".to_string())?;
    let download_url = if !require_https || parsed_url.scheme() == "https" {
        parsed_url
    } else {
        let host = parsed_url
            .host_str()
            .unwrap_or_default()
            .to_ascii_lowercase();
        if parsed_url.scheme() == "http" && is_allowed_host(&host) {
            secure_audio_url(parsed_url, true)?
        } else {
            return Err("动画服务返回的视频地址不是 https".into());
        }
    };

    let video_resp = client
        .get(download_url)
        .send()
        .await
        .map_err(|e| format!("下载动画视频失败：{e}"))?;
    if !video_resp.status().is_success() {
        return Err(format!(
            "下载动画视频失败（HTTP {}）",
            video_resp.status().as_u16()
        ));
    }
    let bytes = video_resp.bytes().await.map_err(|e| e.to_string())?;
    if bytes.is_empty() {
        return Err("下载到的动画视频为空".into());
    }
    if bytes.len() > MAX_VIDEO_BYTES {
        return Err("生成的动画视频过大".into());
    }
    Ok(bytes.to_vec())
}

/// 将静态画作生成 5 秒动态视频并下载落盘到 `$APPDATA/artworks/`
#[tauri::command]
pub async fn video_http_animate(
    app: AppHandle,
    args: VideoAnimateArgs,
) -> Result<GeneratedVideo, String> {
    let prompt = args.prompt.trim();
    if prompt.is_empty() {
        return Err("动画描述不能为空".into());
    }
    if prompt.chars().count() > 1000 {
        return Err("动画描述太长啦，请简短一些".into());
    }
    let model = args.model.trim();
    if model.is_empty() {
        return Err("请先选择图生视频模型".into());
    }

    let valid_path = validate_artwork_path(&app, &args.image_path)?;
    let img_bytes = fs::read(&valid_path).map_err(|e| format!("读取画作图片失败：{e}"))?;
    if img_bytes.is_empty() {
        return Err("画作图片为空".into());
    }
    if img_bytes.len() > MAX_INPUT_IMAGE_BYTES {
        return Err("画作图片过大（超过 6MB）".into());
    }
    let (_, mime) = detect_image_format(None, &img_bytes);
    let data_url = format!(
        "data:{mime};base64,{}",
        base64::engine::general_purpose::STANDARD.encode(&img_bytes)
    );

    let base = validate_base_url(args.base_url.as_deref())?;
    let api_key = resolve_api_key(&app, args.provider_id.as_deref())?;
    let body = video_body(model, prompt, &data_url);

    let bytes = animate_and_download(
        &client()?,
        &base,
        &api_key,
        &body,
        POLL_INTERVAL,
        MAX_POLL_DURATION,
        true,
    )
    .await?;

    let dir = get_artworks_dir(&app)?;
    let dest = dir.join(format!("anim-{}.mp4", Uuid::new_v4()));
    fs::write(&dest, &bytes).map_err(|e| format!("保存动画视频失败：{e}"))?;

    Ok(GeneratedVideo {
        path: dest.to_string_lossy().to_string(),
        mime_type: "video/mp4".into(),
    })
}

/// 读取本地动画视频原始字节，用于前端创建同源 blob URL 合成完整绘本动画（避免 Canvas 跨域污染）
#[tauri::command]
pub fn artwork_read_video_bytes(
    app: AppHandle,
    path: String,
) -> Result<tauri::ipc::Response, String> {
    let valid_path = validate_artwork_path(&app, &path)?;
    let bytes = fs::read(&valid_path).map_err(|e| format!("读取动画视频失败：{e}"))?;
    if bytes.is_empty() {
        return Err("动画视频文件为空".into());
    }
    if bytes.len() > MAX_VIDEO_BYTES {
        return Err("动画视频文件过大".into());
    }
    Ok(tauri::ipc::Response::new(bytes))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;
    use wiremock::matchers::{header, method, path};
    use wiremock::{Mock, MockServer, Request, Respond, ResponseTemplate};

    struct SequenceResponder {
        calls: Arc<AtomicUsize>,
        video_url: String,
    }

    impl Respond for SequenceResponder {
        fn respond(&self, _req: &Request) -> ResponseTemplate {
            let n = self.calls.fetch_add(1, Ordering::SeqCst);
            if n == 0 {
                ResponseTemplate::new(200).set_body_json(json!({
                    "output": { "task_id": "task-123", "task_status": "RUNNING" }
                }))
            } else {
                ResponseTemplate::new(200).set_body_json(json!({
                    "output": {
                        "task_id": "task-123",
                        "task_status": "SUCCEEDED",
                        "video_url": self.video_url
                    }
                }))
            }
        }
    }

    #[test]
    fn builds_body_and_parses_video_responses() {
        let body = video_body("wan3.0-video", "蝴蝶飞舞", "data:image/png;base64,AAA");
        assert_eq!(body["model"], "wan3.0-video");
        assert_eq!(body["input"]["prompt"], "蝴蝶飞舞");
        assert_eq!(body["input"]["media"][0]["type"], "first_frame");
        assert_eq!(body["parameters"]["duration"], 5);
        assert_eq!(body["parameters"]["resolution"], "720P");

        assert_eq!(
            parse_task_id(&json!({ "output": { "task_id": "abc_123" } })).unwrap(),
            "abc_123"
        );
        assert!(parse_task_id(&json!({ "output": { "task_id": "../bad" } })).is_err());

        assert_eq!(
            parse_video_url(&json!({ "output": { "video_url": "https://cdn.example/a.mp4" } })),
            Some("https://cdn.example/a.mp4".into())
        );
        assert_eq!(
            parse_video_url(&json!({ "output": { "results": [{ "url": "https://cdn.example/b.mp4" }] } })),
            Some("https://cdn.example/b.mp4".into())
        );
    }

    #[tokio::test]
    async fn animate_polls_and_downloads_mp4_with_wiremock() {
        let server = MockServer::start().await;
        let video_url = format!("{}/files/out.mp4", server.uri());
        let mp4_bytes = b"\x00\x00\x00\x18ftypmp42fake-mp4".to_vec();

        Mock::given(method("POST"))
            .and(path(VIDEO_GEN_PATH))
            .and(header("authorization", "Bearer sk-sp-good"))
            .and(header("x-dashscope-async", "enable"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "output": { "task_id": "task-123", "task_status": "PENDING" }
            })))
            .mount(&server)
            .await;

        let calls = Arc::new(AtomicUsize::new(0));
        Mock::given(method("GET"))
            .and(path("/api/v1/tasks/task-123"))
            .and(header("authorization", "Bearer sk-sp-good"))
            .respond_with(SequenceResponder {
                calls: calls.clone(),
                video_url,
            })
            .mount(&server)
            .await;

        Mock::given(method("GET"))
            .and(path("/files/out.mp4"))
            .respond_with(ResponseTemplate::new(200).set_body_bytes(mp4_bytes.clone()))
            .mount(&server)
            .await;

        let base = Url::parse(&server.uri()).unwrap();
        let body = video_body("happyhorse-1.1-i2v", "小恐龙挥手", "data:image/png;base64,AAA");
        let downloaded = animate_and_download(
            &client().unwrap(),
            &base,
            "sk-sp-good",
            &body,
            Duration::from_millis(10),
            Duration::from_secs(5),
            false,
        )
        .await
        .unwrap();

        assert_eq!(downloaded, mp4_bytes);
        assert_eq!(calls.load(Ordering::SeqCst), 2);
    }

    #[tokio::test]
    async fn animate_reports_failed_task() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path(VIDEO_GEN_PATH))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "output": { "task_id": "task-fail", "task_status": "PENDING" }
            })))
            .mount(&server)
            .await;

        Mock::given(method("GET"))
            .and(path("/api/v1/tasks/task-fail"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "output": { "task_status": "FAILED", "message": "content blocked" }
            })))
            .mount(&server)
            .await;

        let base = Url::parse(&server.uri()).unwrap();
        let body = video_body("wan3.0-video", "x", "data:image/png;base64,AAA");
        let err = animate_and_download(
            &client().unwrap(),
            &base,
            "sk-sp-good",
            &body,
            Duration::from_millis(10),
            Duration::from_secs(2),
            false,
        )
        .await
        .unwrap_err();
        assert!(err.contains("content blocked"), "{err}");
    }
}
