/**
 * 千问 Token Plan 一键配置与服务就绪状态检测（桥接 ProviderStore / Vault / SpeechConfig / KidModel / ImageConfig）。
 */
import { invoke } from '@tauri-apps/api/core';
import { loadKidModel, pickCompanionModel, saveKidModel } from '@/config/kidModel';
import { loadSpeechConfig, SPEECH_SECRET_NAME, saveSpeechConfig } from '@/config/speechConfig';
import {
  DEFAULT_TOKEN_PLAN_IMAGE_MODEL,
  DEFAULT_TOKEN_PLAN_TEXT_MODEL,
  TOKEN_PLAN_DEFAULT_HOST,
  TOKEN_PLAN_PROVIDER_ID,
  TOKEN_PLAN_SPEECH_DEFAULTS,
  buildTokenPlanProvider,
  deriveTokenPlanEndpoints,
  loadImageConfig,
  saveImageConfig,
  type TokenPlanEndpoints,
} from '@/config/tokenPlan';
import { useProviderStore, type ProviderTestResult } from '@/store/providerStore';
import { isTauri } from '@/utils/isTauri';

export interface TokenPlanQuickSetupInput {
  baseUrl: string;
  apiKey?: string;
  textModel: string;
  imageModel: string;
  enableRealtimeDialog: boolean;
  testConnection?: boolean;
}

export interface TokenPlanQuickSetupResult {
  endpoints: TokenPlanEndpoints;
  testResult: ProviderTestResult | null;
  hasKey: boolean;
}

export interface ActiveServiceSummary {
  providerId: string;
  providerName: string;
  model: string;
}

export interface ImportableKeySource {
  secretName: string;
  label: string;
  baseUrl?: string;
}

export interface SavedTokenPlanConfig {
  textModel: string;
  imageModel: string;
  ttsModel: string;
  dialogModel: string;
  dialogEnabled: boolean;
}

export interface TokenPlanSetupSnapshot {
  baseUrl: string;
  textModel: string;
  imageModel: string;
  enableRealtimeDialog: boolean;
  hasKey: boolean;
  aiConfigured: boolean;
  activeSummary: ActiveServiceSummary | null;
  importableKeySource: ImportableKeySource | null;
  savedConfig: SavedTokenPlanConfig | null;
}

const TOKEN_PLAN_SECRET_NAME = `provider:${TOKEN_PLAN_PROVIDER_ID}`;

/** 检测本地是否已经配好可用的模型服务（有启用模型且保险箱中有 Key） */
export async function hasConfiguredAiService(): Promise<boolean> {
  if (!isTauri) {
    try {
      const raw = localStorage.getItem('custom_providers');
      if (!raw) return false;
      const list = JSON.parse(raw) as Array<{ enabled?: boolean; models?: unknown[] }>;
      return Array.isArray(list) && list.some((p) => p.enabled !== false && Array.isArray(p.models) && p.models.length > 0);
    } catch {
      return false;
    }
  }

  try {
    const providers = await invoke<Array<{ enabled: boolean; models: string[]; apiKeyRef: string }>>('list_providers');
    for (const p of providers) {
      if (!p.enabled || !p.models?.length || !p.apiKeyRef) continue;
      const hasSecret = await invoke<boolean>('secret_has', { name: p.apiKeyRef });
      if (hasSecret) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** 一键把本机保险箱中已有的千问密钥复制到 Token Plan 专用条目 */
export async function importExistingTokenPlanKey(fromSecretName: string): Promise<boolean> {
  if (!isTauri || !fromSecretName) return false;
  try {
    return await invoke<boolean>('secret_copy', {
      fromName: fromSecretName,
      toName: TOKEN_PLAN_SECRET_NAME,
    });
  } catch {
    return false;
  }
}

export async function loadTokenPlanSetupSnapshot(): Promise<TokenPlanSetupSnapshot> {
  const store = useProviderStore.getState();
  if (!store.loaded) {
    await store.load();
  }
  const allProviders = Object.values(useProviderStore.getState().providers);
  const tpProvider = useProviderStore.getState().get(TOKEN_PLAN_PROVIDER_ID);
  const kidModel = loadKidModel();
  const speech = loadSpeechConfig();
  const image = loadImageConfig();

  let baseUrl = TOKEN_PLAN_DEFAULT_HOST;
  if (tpProvider?.baseURL) {
    try {
      baseUrl = deriveTokenPlanEndpoints(tpProvider.baseURL).httpBase;
    } catch {
      baseUrl = TOKEN_PLAN_DEFAULT_HOST;
    }
  } else if (speech.httpBase) {
    baseUrl = speech.httpBase;
  }

  let hasKey = false;
  let activeSummary: ActiveServiceSummary | null = null;
  let importableKeySource: ImportableKeySource | null = null;

  if (isTauri) {
    try {
      hasKey = await invoke<boolean>('secret_has', { name: TOKEN_PLAN_SECRET_NAME });
    } catch {
      hasKey = false;
    }

    // 查找所有真实有密钥的启用服务商，解析当前实际生效的对话服务
    const readyProviders = [];
    for (const p of allProviders) {
      if (p.enabled === false || !p.models?.length || !p.apiKeyRef) continue;
      try {
        if (await invoke<boolean>('secret_has', { name: p.apiKeyRef })) {
          readyProviders.push(p);
        }
      } catch {
        // ignore secret check failure
      }
    }

    const picked = pickCompanionModel({}, kidModel, readyProviders);
    if (picked) {
      const matched = readyProviders.find((p) => p.id === picked.providerId) || allProviders.find((p) => p.id === picked.providerId);
      if (matched) {
        activeSummary = {
          providerId: matched.id,
          providerName: matched.name,
          model: picked.model,
        };
      }
    }

    // 若 Token Plan 本身未配密钥，检查是否有可复用的旧千问/语音密钥
    if (!hasKey) {
      const candidateProvider = readyProviders.find(
        (p) => p.id !== TOKEN_PLAN_PROVIDER_ID && p.baseURL.toLowerCase().includes('token-plan'),
      );
      if (candidateProvider) {
        let candidateHost: string | undefined;
        try {
          candidateHost = deriveTokenPlanEndpoints(candidateProvider.baseURL).httpBase;
        } catch {
          candidateHost = undefined;
        }
        importableKeySource = {
          secretName: candidateProvider.apiKeyRef,
          label: candidateProvider.name,
          baseUrl: candidateHost,
        };
      } else {
        try {
          const hasSpeechKey = await invoke<boolean>('secret_has', { name: SPEECH_SECRET_NAME });
          if (hasSpeechKey) {
            importableKeySource = {
              secretName: SPEECH_SECRET_NAME,
              label: '语音服务密钥',
            };
          }
        } catch {
          // ignore
        }
      }
    }
  } else {
    // 浏览器预览模式下，仅当 Token Plan 服务商已保存过时才视为已配置
    hasKey = Boolean(tpProvider);
    const picked = pickCompanionModel({}, kidModel, allProviders.filter((p) => p.enabled !== false && p.models.length > 0));
    if (picked) {
      const matched = allProviders.find((p) => p.id === picked.providerId);
      if (matched) {
        activeSummary = {
          providerId: matched.id,
          providerName: matched.name,
          model: picked.model,
        };
      }
    }
  }

  const aiConfigured = hasKey || activeSummary !== null;
  const textModel =
    (kidModel?.providerId === TOKEN_PLAN_PROVIDER_ID ? kidModel.model : '') ||
    tpProvider?.models?.[0] ||
    DEFAULT_TOKEN_PLAN_TEXT_MODEL;
  const imageModel = image.model || DEFAULT_TOKEN_PLAN_IMAGE_MODEL;
  const enableRealtimeDialog = speech.dialog.enabled;

  const savedConfig: SavedTokenPlanConfig | null = hasKey
    ? {
        textModel,
        imageModel,
        ttsModel: speech.tts.model,
        dialogModel: speech.dialog.model,
        dialogEnabled: speech.dialog.enabled,
      }
    : null;

  return {
    baseUrl,
    textModel,
    imageModel,
    enableRealtimeDialog,
    hasKey,
    aiConfigured,
    activeSummary,
    importableKeySource,
    savedConfig,
  };
}

/** 一键保存千问 Token Plan 配置：同时写入 Provider、保险箱密钥、伙伴默认模型、语音引擎和绘本生图配置 */
export async function applyTokenPlanQuickSetup(input: TokenPlanQuickSetupInput): Promise<TokenPlanQuickSetupResult> {
  const endpoints = deriveTokenPlanEndpoints(input.baseUrl);
  const textModel = input.textModel.trim() || DEFAULT_TOKEN_PLAN_TEXT_MODEL;
  const imageModel = input.imageModel.trim() || DEFAULT_TOKEN_PLAN_IMAGE_MODEL;
  const trimmedKey = input.apiKey?.trim() || '';

  const store = useProviderStore.getState();
  if (!store.loaded) {
    await store.load();
  }

  let hasKey = false;

  if (isTauri) {
    if (!trimmedKey) {
      hasKey = await invoke<boolean>('secret_has', { name: TOKEN_PLAN_SECRET_NAME });
      if (!hasKey) {
        return {
          endpoints,
          hasKey: false,
          testResult: {
            ok: false,
            latencyMs: 0,
            errorClass: 'auth',
            message: '请先输入千问 Token Plan 的 API Key（sk-sp-...）',
          },
        };
      }
    }
  }

  const provider = buildTokenPlanProvider({ baseUrl: endpoints.httpBase, textModel });
  await store.upsert(provider);

  if (isTauri && trimmedKey) {
    await invoke('secret_set', { name: TOKEN_PLAN_SECRET_NAME, value: trimmedKey });
    hasKey = true;
  } else if (!isTauri) {
    hasKey = true;
  }

  saveKidModel({ providerId: TOKEN_PLAN_PROVIDER_ID, model: textModel });

  const prevSpeech = loadSpeechConfig();
  saveSpeechConfig({
    ...prevSpeech,
    providerId: TOKEN_PLAN_PROVIDER_ID,
    httpBase: endpoints.httpBase,
    tts: {
      ...prevSpeech.tts,
      engine: 'tokenplan',
      model: TOKEN_PLAN_SPEECH_DEFAULTS.ttsModel,
    },
    asr: {
      ...prevSpeech.asr,
      engine: 'tokenplan',
      model: TOKEN_PLAN_SPEECH_DEFAULTS.asrModel,
    },
    dialog: {
      ...prevSpeech.dialog,
      enabled: input.enableRealtimeDialog,
      model: TOKEN_PLAN_SPEECH_DEFAULTS.dialogModel,
      endpoint: endpoints.dialogEndpoint,
    },
  });

  const prevImage = loadImageConfig();
  saveImageConfig({
    ...prevImage,
    providerId: TOKEN_PLAN_PROVIDER_ID,
    httpBase: endpoints.httpBase,
    model: imageModel,
  });

  let testResult: ProviderTestResult | null = null;
  if (input.testConnection !== false && isTauri) {
    testResult = await invoke<ProviderTestResult>('provider_test', {
      providerId: TOKEN_PLAN_PROVIDER_ID,
    });
  }

  return { endpoints, testResult, hasKey };
}
