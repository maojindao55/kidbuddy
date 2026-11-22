/**
 * 千问 Token Plan「一码通」配置与绘本生图配置。
 *
 * 零外部运行时依赖（仅读写 localStorage），便于 node 直接 transpile 单测。
 */
import type { Provider } from './providers';

export const TOKEN_PLAN_PROVIDER_ID = 'qwen-token-plan';
export const TOKEN_PLAN_DEFAULT_HOST = 'https://token-plan.maas.qianwenaiapi.com';

export const TOKEN_PLAN_HOSTS = [
  { value: 'https://token-plan.maas.qianwenaiapi.com', label: '千问 AI 平台 · Token Plan' },
  { value: 'https://token-plan.cn-beijing.maas.aliyuncs.com', label: '阿里云百炼（北京）· Token Plan' },
] as const;

export interface TokenPlanModelOption {
  value: string;
  label: string;
  hint?: string;
}

export const DEFAULT_TOKEN_PLAN_TEXT_MODEL = 'qwen3.8-flash';

export const TOKEN_PLAN_TEXT_MODELS: TokenPlanModelOption[] = [
  { value: 'qwen3.8-flash', label: 'qwen3.8-flash（推荐：响应快、支持视觉理解）' },
  { value: 'qwen3.7-plus', label: 'qwen3.7-plus（均衡旗舰、支持视觉理解）' },
  { value: 'qwen3.8-max', label: 'qwen3.8-max（高表现、支持视觉理解）' },
  { value: 'qwen4-max', label: 'qwen4-max（最新主力旗舰）' },
  { value: 'qwen4-max-preview', label: 'qwen4-max-preview（抢先版）' },
  { value: 'auto', label: 'auto（智能自动路由）' },
  { value: 'qwen3.6-flash', label: 'qwen3.6-flash（轻量快速）' },
  { value: 'qwen3.7-max', label: 'qwen3.7-max（深度推理）' },
  { value: 'deepseek-v4.1-flash', label: 'deepseek-v4.1-flash（DeepSeek 快速版）' },
  { value: 'deepseek-v4-pro', label: 'deepseek-v4-pro（DeepSeek 专业版）' },
  { value: 'glm-5.3', label: 'glm-5.3（智谱 GLM）' },
  { value: 'glm-5.2', label: 'glm-5.2（智谱 GLM）' },
];

export const DEFAULT_TOKEN_PLAN_IMAGE_MODEL = 'wan2.7-image';

export const TOKEN_PLAN_IMAGE_MODELS: TokenPlanModelOption[] = [
  { value: 'wan2.7-image', label: 'wan2.7-image（推荐：支持绘本角色一致性）' },
  { value: 'wan2.7-image-pro', label: 'wan2.7-image-pro（高清专业绘本插画）' },
  { value: 'qwen-image-3.0-pro', label: 'qwen-image-3.0-pro（千问图像 3.0 Pro）' },
];

export const DEFAULT_TOKEN_PLAN_VIDEO_MODEL = 'wan3.0-video';

export const TOKEN_PLAN_VIDEO_MODELS: TokenPlanModelOption[] = [
  { value: 'wan3.0-video', label: 'wan3.0-video（推荐：通义万相 3.0 全能动效视频）' },
  { value: 'happyhorse-1.1-i2v', label: 'happyhorse-1.1-i2v（自然流畅动作图生视频）' },
];

export const TOKEN_PLAN_SPEECH_DEFAULTS = {
  ttsModel: 'qwen-audio-3.0-tts-plus',
  asrModel: 'qwen-audio-3.0-asr-flash',
  dialogModel: 'qwen-audio-3.0-realtime-plus',
} as const;

export interface TokenPlanEndpoints {
  httpBase: string;
  chatBaseUrl: string;
  dialogEndpoint: string;
}

/**
 * 根据用户输入的基础地址派生文本、HTTP 语音/生图、实时语音三端接入地址。
 * 兼容根域名、带尾部斜杠、带 `/compatible-mode/v1`、或省略协议的域名。
 */
export function deriveTokenPlanEndpoints(rawBase?: string): TokenPlanEndpoints {
  const input = (rawBase ?? '').trim();
  const candidate = input || TOKEN_PLAN_DEFAULT_HOST;

  if (/\s/.test(candidate)) {
    throw new Error('服务地址格式不正确，不能包含空格');
  }

  let normalized = candidate;
  if (candidate.includes('://')) {
    if (!/^(https|wss):\/\//i.test(candidate)) {
      throw new Error('服务地址必须使用 https:// 协议');
    }
    normalized = candidate.replace(/^wss:\/\//i, 'https://');
  } else {
    normalized = `https://${candidate}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error('服务地址格式不正确，请输入有效的 https:// 域名');
  }

  const host = parsed.host;
  const hostname = parsed.hostname;
  if (!host || !hostname || (hostname !== 'localhost' && !hostname.includes('.'))) {
    throw new Error('服务地址域名无效，请检查后重试');
  }

  return {
    httpBase: `https://${host}`,
    chatBaseUrl: `https://${host}/compatible-mode/v1`,
    dialogEndpoint: `wss://${host}/api-ws/v1/realtime`,
  };
}

export interface KidImageConfig {
  providerId: string;
  httpBase: string;
  model: string;
  videoModel: string;
}

export const DEFAULT_IMAGE_CONFIG: KidImageConfig = {
  providerId: TOKEN_PLAN_PROVIDER_ID,
  httpBase: TOKEN_PLAN_DEFAULT_HOST,
  model: DEFAULT_TOKEN_PLAN_IMAGE_MODEL,
  videoModel: DEFAULT_TOKEN_PLAN_VIDEO_MODEL,
};

const IMAGE_CONFIG_KEY = 'kid_image_config';

export function normalizeImageConfig(raw: unknown): KidImageConfig {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v.trim() : fallback);
  return {
    providerId: typeof value.providerId === 'string' ? value.providerId.trim() : DEFAULT_IMAGE_CONFIG.providerId,
    httpBase: str(value.httpBase, DEFAULT_IMAGE_CONFIG.httpBase),
    model: str(value.model, DEFAULT_IMAGE_CONFIG.model),
    videoModel: str(value.videoModel, DEFAULT_IMAGE_CONFIG.videoModel),
  };
}

export function loadImageConfig(): KidImageConfig {
  try {
    const raw = localStorage.getItem(IMAGE_CONFIG_KEY);
    return normalizeImageConfig(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_IMAGE_CONFIG };
  }
}

export function saveImageConfig(config: KidImageConfig): void {
  try {
    localStorage.setItem(IMAGE_CONFIG_KEY, JSON.stringify(normalizeImageConfig(config)));
  } catch {
    // ignore storage errors
  }
}

/** 构造供 providerStore 落库的千问 Token Plan Provider 记录 */
export function buildTokenPlanProvider(input: { baseUrl?: string; textModel?: string }): Provider {
  const { chatBaseUrl } = deriveTokenPlanEndpoints(input.baseUrl);
  const chosenModel = input.textModel?.trim() || DEFAULT_TOKEN_PLAN_TEXT_MODEL;
  const models = Array.from(new Set([chosenModel, ...TOKEN_PLAN_TEXT_MODELS.map((m) => m.value)]));
  return {
    id: TOKEN_PLAN_PROVIDER_ID,
    name: '千问 Token Plan',
    baseURL: chatBaseUrl,
    apiKeyRef: `provider:${TOKEN_PLAN_PROVIDER_ID}`,
    models,
    source: 'user',
    enabled: true,
    description: '千问 Token Plan 一码通（文本对话 / 语音识别与朗读 / 实时语音 / 绘本插画）',
  };
}
