import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { CheckCircle2, ChevronDown, Eye, EyeOff, KeyRound, Volume2 } from 'lucide-react';
import { kidGames } from '@/config/aiGame';
import { KID_COMPANION_IDS, builtinAIMembers, companionMeta } from '@/config/aiMembers';
import { ENGLISH_BUDDY } from '@/config/kidEnglish';
import { loadKidModel, saveKidModel } from '@/config/kidModel';
import { providerPresets, type Provider } from '@/config/providers';
import {
  DIALOG_ENDPOINT,
  SPEECH_ENDPOINTS,
  SPEECH_MODELS,
  TOKEN_PLAN_BASE,
  customVoice,
  defaultModel,
  gameVoiceKey,
  inheritedVoice,
  loadSpeechConfig,
  moduleVoiceKey,
  saveSpeechConfig,
  voiceCatalog,
  voiceForSpeaker,
  withCustomVoice,
  type SpeechConfig,
  type SpeechEngine,
} from '@/config/speechConfig';
import {
  DEFAULT_TOKEN_PLAN_IMAGE_MODEL,
  DEFAULT_TOKEN_PLAN_TEXT_MODEL,
  TOKEN_PLAN_DEFAULT_HOST,
  TOKEN_PLAN_HOSTS,
  TOKEN_PLAN_IMAGE_MODELS,
  TOKEN_PLAN_PROVIDER_ID,
  TOKEN_PLAN_TEXT_MODELS,
  TOKEN_PLAN_VIDEO_MODELS,
  deriveTokenPlanEndpoints,
  loadImageConfig,
  saveImageConfig,
  type KidImageConfig,
} from '@/config/tokenPlan';
import { synthesizeCloud } from '@/lib/speech/qwenSpeech';
import {
  applyTokenPlanQuickSetup,
  importExistingTokenPlanKey,
  loadTokenPlanSetupSnapshot,
  type ActiveServiceSummary,
  type ImportableKeySource,
  type SavedTokenPlanConfig,
} from '@/lib/tokenPlanSetup';
import { useProviderStore, type ProviderTestResult } from '@/store/providerStore';
import { isTauri } from '@/utils/isTauri';
import { StyledSelect, ToggleSwitch } from './FormControls';

const CUSTOM_SENTINEL = '__custom__';
const INPUT_CLASS =
  'h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100';
const MODULE_VOICE_ENTRIES = [
  {
    id: 'draw',
    key: moduleVoiceKey('draw'),
    emoji: '🎨',
    label: '魔法绘画屋',
    hostId: 'kid-drawing-bunny',
    sample: '哇，这幅画太有想象力啦！画画兔已经帮你存进画廊咯！',
  },
  {
    id: 'storybook',
    key: moduleVoiceKey('storybook'),
    emoji: '📖',
    label: '绘本朗读',
    hostId: 'kid-story-fairy',
    sample: '很久很久以前，有一本属于你的神奇绘本正在翻开第一页。',
  },
] as const;

export default function SetupTab() {
  const providers = useProviderStore((s) => s.providers);
  const loadProviders = useProviderStore((s) => s.load);
  const upsertProvider = useProviderStore((s) => s.upsert);
  const removeProvider = useProviderStore((s) => s.remove);
  const setProviderSecret = useProviderStore((s) => s.setSecret);
  const testProviderConn = useProviderStore((s) => s.testConnection);

  // 一键配置状态
  const [baseUrl, setBaseUrl] = useState(TOKEN_PLAN_DEFAULT_HOST);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [activeSummary, setActiveSummary] = useState<ActiveServiceSummary | null>(null);
  const [importableKeySource, setImportableKeySource] = useState<ImportableKeySource | null>(null);
  const [savedConfig, setSavedConfig] = useState<SavedTokenPlanConfig | null>(null);
  const [textModel, setTextModel] = useState(DEFAULT_TOKEN_PLAN_TEXT_MODEL);
  const [customTextMode, setCustomTextMode] = useState(false);
  const [imageModel, setImageModel] = useState(DEFAULT_TOKEN_PLAN_IMAGE_MODEL);
  const [customImageMode, setCustomImageMode] = useState(false);
  const [enableRealtimeDialog, setEnableRealtimeDialog] = useState(true);

  const [saving, setSaving] = useState(false);
  const [importingKey, setImportingKey] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [testResult, setTestResult] = useState<ProviderTestResult | null>(null);
  const [saveNotice, setSaveNotice] = useState('');
  const [previewing, setPreviewing] = useState('');
  const [previewError, setPreviewError] = useState('');

  // 高级设置
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [speechConfig, setSpeechConfig] = useState<SpeechConfig>(loadSpeechConfig);
  const [imageConfig, setImageConfig] = useState<KidImageConfig>(loadImageConfig);
  const [kidModelValue, setKidModelValue] = useState(() => {
    const saved = loadKidModel();
    return saved ? `${saved.providerId}::${saved.model}` : '';
  });

  // 新增其他服务商表单
  const [otherPresetId, setOtherPresetId] = useState('deepseek');
  const [otherName, setOtherName] = useState('DeepSeek');
  const [otherBaseUrl, setOtherBaseUrl] = useState('https://api.deepseek.com/v1');
  const [otherModels, setOtherModels] = useState('deepseek-chat');
  const [otherKey, setOtherKey] = useState('');
  const [otherStatus, setOtherStatus] = useState('');
  const [otherBusy, setOtherBusy] = useState(false);

  const refreshState = async () => {
    await loadProviders();
    const snap = await loadTokenPlanSetupSnapshot();
    setBaseUrl(snap.baseUrl);
    setTextModel(snap.textModel);
    setCustomTextMode(!TOKEN_PLAN_TEXT_MODELS.some((m) => m.value === snap.textModel));
    setImageModel(snap.imageModel);
    setCustomImageMode(!TOKEN_PLAN_IMAGE_MODELS.some((m) => m.value === snap.imageModel));
    setEnableRealtimeDialog(snap.enableRealtimeDialog);
    setHasKey(snap.hasKey);
    setActiveSummary(snap.activeSummary);
    setImportableKeySource(snap.importableKeySource);
    setSavedConfig(snap.savedConfig);
    setSpeechConfig(loadSpeechConfig());
    setImageConfig(loadImageConfig());
    const km = loadKidModel();
    setKidModelValue(km ? `${km.providerId}::${km.model}` : '');
  };

  useEffect(() => {
    void refreshState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const derivedEndpoints = useMemo(() => {
    try {
      return { ok: true as const, value: deriveTokenPlanEndpoints(baseUrl) };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : '地址格式无效' };
    }
  }, [baseUrl]);

  const handleQuickSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSetupError('');
    setTestResult(null);
    setSaveNotice('');
    try {
      const res = await applyTokenPlanQuickSetup({
        baseUrl,
        apiKey,
        textModel,
        imageModel,
        enableRealtimeDialog,
        testConnection: true,
      });
      setHasKey(res.hasKey);
      if (res.testResult) {
        setTestResult(res.testResult);
      } else {
        setSaveNotice('已保存配置（非桌面端预览环境跳过在线连通性检测）。');
      }
      if (!res.testResult || res.testResult.ok) {
        setApiKey('');
      }
      await refreshState();
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleImportExistingKey = async () => {
    if (!importableKeySource) return;
    setImportingKey(true);
    setSetupError('');
    setTestResult(null);
    setSaveNotice('');
    try {
      const copied = await importExistingTokenPlanKey(importableKeySource.secretName);
      if (!copied) {
        setSetupError('未能导入现有密钥，请手动粘贴千问 Token Plan API Key。');
        return;
      }
      const nextHost = importableKeySource.baseUrl || baseUrl;
      const res = await applyTokenPlanQuickSetup({
        baseUrl: nextHost,
        textModel,
        imageModel,
        enableRealtimeDialog,
        testConnection: true,
      });
      setHasKey(res.hasKey);
      if (res.testResult) {
        setTestResult(res.testResult);
      }
      await refreshState();
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : String(err));
    } finally {
      setImportingKey(false);
    }
  };

  const previewVoice = async (key: string, text: string, voice: string) => {
    setPreviewError('');
    if (!isTauri) {
      setPreviewError('浏览器预览不支持云端语音试听，请在桌面应用中使用。');
      return;
    }
    setPreviewing(key);
    try {
      const bytes = await synthesizeCloud(text, voice, loadSpeechConfig());
      const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch (err) {
      setPreviewError(`试听失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPreviewing('');
    }
  };

  const updateSpeech = (patch: (prev: SpeechConfig) => SpeechConfig) => {
    setSpeechConfig((prev) => {
      const next = patch(prev);
      saveSpeechConfig(next);
      return next;
    });
  };

  const changeEngine = (kind: 'tts' | 'asr', engine: SpeechEngine) => {
    updateSpeech((prev) => {
      const sameFamily = prev[kind].engine === engine;
      const model = sameFamily ? prev[kind].model : defaultModel(kind, engine);
      return kind === 'tts'
        ? { ...prev, tts: { ...prev.tts, engine, model, voice: sameFamily ? prev.tts.voice : '' } }
        : { ...prev, asr: { ...prev.asr, engine, model } };
    });
  };

  const handleSaveOtherProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtherBusy(true);
    setOtherStatus('');
    try {
      const models = otherModels
        .split(/[,，\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (!otherName.trim() || !otherBaseUrl.trim() || models.length === 0) {
        setOtherStatus('请填写名称、接口地址和至少一个模型名。');
        return;
      }
      const id = otherPresetId === 'custom' ? `custom-${Date.now()}` : otherPresetId;
      const provider: Provider = {
        id,
        name: otherName.trim(),
        baseURL: otherBaseUrl.trim().replace(/\/$/, ''),
        apiKeyRef: `provider:${id}`,
        models,
        source: 'user',
        enabled: true,
      };
      await upsertProvider(provider);
      if (isTauri && otherKey.trim()) {
        await setProviderSecret(id, otherKey.trim());
      }
      if (isTauri && otherKey.trim()) {
        const ping = await testProviderConn({
          id,
          baseURL: provider.baseURL,
          apiKey: otherKey.trim(),
          models,
        });
        setOtherStatus(ping.ok ? `已保存并连通成功（${ping.latencyMs}ms）` : `已保存，但连通测试失败：${ping.message || ping.errorClass}`);
      } else {
        setOtherStatus('已保存模型服务。');
      }
      setOtherKey('');
      await refreshState();
    } catch (err) {
      setOtherStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setOtherBusy(false);
    }
  };

  const companionName = (id: string) => builtinAIMembers.find((m) => m.id === id)?.name || id;
  const currentCatalog = voiceCatalog(speechConfig.tts.model);
  const dialogCatalog = voiceCatalog(speechConfig.dialog.model);

  const allModelOptions = Object.values(providers)
    .filter((p) => p.enabled !== false && p.models.length > 0)
    .flatMap((p) => p.models.map((m) => ({ value: `${p.id}::${m}`, label: `${p.name} / ${m}` })));

  return (
    <div className="space-y-6">
      {/* 主卡片：千问 Token Plan 一键配置 */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-extrabold text-slate-800">千问 Token Plan · 一键配置</h2>
              {hasKey ? (
                <span
                  data-testid="setup-status-badge"
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-bold text-emerald-700"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  已配置
                </span>
              ) : activeSummary ? (
                <span
                  data-testid="setup-status-badge"
                  className="inline-flex items-center rounded-full bg-sky-100 px-3 py-0.5 text-xs font-bold text-sky-700"
                >
                  可切换
                </span>
              ) : (
                <span
                  data-testid="setup-status-badge"
                  className="inline-flex items-center rounded-full bg-amber-100 px-3 py-0.5 text-xs font-bold text-amber-800"
                >
                  待配置
                </span>
              )}
            </div>
            <p className="mt-1.5 text-sm text-slate-500">
              只需粘贴 1 个千问 Token Plan Key（
              <span className="inline-block rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-medium text-slate-600">
                sk-sp-...
              </span>
              ），自动配齐故事聊天、语音朗读/识别、1v1 实时语音和绘本生图模型。
            </p>
          </div>
        </div>

        {/* 未配置 Token Plan 但已有其他服务商时的清晰说明 */}
        {!hasKey && activeSummary && (
          <div
            data-testid="active-fallback-banner"
            className="mt-4 rounded-2xl border border-sky-200 bg-sky-50/70 px-4 py-3 text-xs leading-relaxed text-sky-800"
          >
            当前对话正在使用已配置的「<span className="font-bold">{activeSummary.providerName}</span> /{' '}
            <span className="font-mono font-semibold">{activeSummary.model}</span>」；你可以继续在下方高级设置中管理，或在此填入千问 Token Plan Key 一键统一接管语音与绘本。
          </div>
        )}

        {/* 仅当 Token Plan 本身已保存 Key 时展示实际生效配置摘要 */}
        {hasKey && savedConfig && (
          <div
            data-testid="tp-saved-summary"
            className="mt-4 grid grid-cols-2 gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3.5 text-xs md:grid-cols-4"
          >
            <div>
              <div className="text-slate-400">对话文本模型</div>
              <div className="mt-0.5 truncate font-bold text-slate-700">{savedConfig.textModel}</div>
            </div>
            <div>
              <div className="text-slate-400">语音朗读 / 识别</div>
              <div className="mt-0.5 truncate font-bold text-slate-700">{savedConfig.ttsModel}</div>
            </div>
            <div>
              <div className="text-slate-400">1v1 实时语音对话</div>
              <div className="mt-0.5 truncate font-bold text-slate-700">
                {savedConfig.dialogEnabled ? savedConfig.dialogModel : '已关闭'}
              </div>
            </div>
            <div>
              <div className="text-slate-400">绘本插画模型（预置）</div>
              <div className="mt-0.5 truncate font-bold text-slate-700">{savedConfig.imageModel}</div>
            </div>
          </div>
        )}

        <form onSubmit={handleQuickSave} className="mt-5 space-y-4">
          {/* 接入地址 */}
          <div>
            <label className="block text-sm font-bold text-slate-700" htmlFor="tp-host-select">
              接入线路
            </label>
            <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
              <StyledSelect
                id="tp-host-select"
                value={TOKEN_PLAN_HOSTS.some((h) => h.value === baseUrl) ? baseUrl : CUSTOM_SENTINEL}
                onChange={(e) => {
                  if (e.target.value !== CUSTOM_SENTINEL) setBaseUrl(e.target.value);
                }}
              >
                {TOKEN_PLAN_HOSTS.map((h) => (
                  <option key={h.value} value={h.value}>{h.label}</option>
                ))}
                <option value={CUSTOM_SENTINEL}>自定义地址</option>
              </StyledSelect>
              <input
                type="text"
                data-testid="tp-base-url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={TOKEN_PLAN_DEFAULT_HOST}
                className={INPUT_CLASS}
              />
            </div>
            {derivedEndpoints.ok ? (
              <div className="mt-2 space-y-1 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <span className="shrink-0 font-semibold text-slate-400">对话接口</span>
                  <span className="min-w-0 truncate font-mono text-slate-600">{derivedEndpoints.value.chatBaseUrl}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="shrink-0 font-semibold text-slate-400">实时语音</span>
                  <span className="min-w-0 truncate font-mono text-slate-600">{derivedEndpoints.value.dialogEndpoint}</span>
                </div>
              </div>
            ) : (
              <p className="mt-1.5 text-xs text-rose-500">{derivedEndpoints.error}</p>
            )}
          </div>

          {/* 已有密钥一键导入提示 */}
          {!hasKey && importableKeySource && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-amber-900">
                <KeyRound className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                <span>
                  检测到本机保险箱已有「<span className="font-bold">{importableKeySource.label}</span>」密钥，可直接复用。
                </span>
              </div>
              <button
                type="button"
                data-testid="tp-import-key"
                disabled={importingKey}
                onClick={handleImportExistingKey}
                className="h-8 shrink-0 rounded-xl bg-amber-500 px-3.5 text-xs font-bold text-white transition hover:bg-amber-600 disabled:opacity-50"
              >
                {importingKey ? '导入中…' : '一键导入复用'}
              </button>
            </div>
          )}

          {/* API Key */}
          <div>
            <label className="block text-sm font-bold text-slate-700" htmlFor="tp-api-key">
              Token Plan API Key
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                id="tp-api-key"
                data-testid="tp-api-key"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={hasKey ? '••••••••••••（已加密保存，留空保持不变）' : '粘贴你的 sk-sp-... 密钥'}
                className={`${INPUT_CLASS} min-w-0 flex-1`}
              />
              <button
                type="button"
                aria-label={showKey ? '隐藏密钥' : '显示密钥'}
                onClick={() => setShowKey((v) => !v)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {hasKey ? '密钥已加密存储在本地保险箱（Vault），不会明文落盘或上传。' : '密钥将通过 Rust 保险箱加密存储在本机。'}
            </p>
          </div>

          {/* 文本模型 & 生图模型 */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-bold text-slate-700" htmlFor="tp-text-model">
                故事与聊天文本模型
              </label>
              <StyledSelect
                id="tp-text-model"
                data-testid="tp-text-model"
                wrapperClassName="mt-1.5"
                value={customTextMode ? CUSTOM_SENTINEL : textModel}
                onChange={(e) => {
                  if (e.target.value === CUSTOM_SENTINEL) {
                    setCustomTextMode(true);
                  } else {
                    setCustomTextMode(false);
                    setTextModel(e.target.value);
                  }
                }}
              >
                {TOKEN_PLAN_TEXT_MODELS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
                <option value={CUSTOM_SENTINEL}>自定义模型 ID...</option>
              </StyledSelect>
              {customTextMode && (
                <input
                  type="text"
                  value={textModel}
                  onChange={(e) => setTextModel(e.target.value)}
                  placeholder="输入模型 ID，如 qwen4-max"
                  className={`${INPUT_CLASS} mt-2 w-full`}
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700" htmlFor="tp-image-model">
                绘本插画模型（用于绘本共创）
              </label>
              <StyledSelect
                id="tp-image-model"
                data-testid="tp-image-model"
                wrapperClassName="mt-1.5"
                value={customImageMode ? CUSTOM_SENTINEL : imageModel}
                onChange={(e) => {
                  if (e.target.value === CUSTOM_SENTINEL) {
                    setCustomImageMode(true);
                  } else {
                    setCustomImageMode(false);
                    setImageModel(e.target.value);
                  }
                }}
              >
                {TOKEN_PLAN_IMAGE_MODELS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
                <option value={CUSTOM_SENTINEL}>自定义模型 ID...</option>
              </StyledSelect>
              {customImageMode && (
                <input
                  type="text"
                  value={imageModel}
                  onChange={(e) => setImageModel(e.target.value)}
                  placeholder="输入生图模型 ID，如 wan2.7-image"
                  className={`${INPUT_CLASS} mt-2 w-full`}
                />
              )}
            </div>
          </div>

          {/* 实时语音对话开关 */}
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5">
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-700">启用 1v1 实时语音对话</div>
              <div className="mt-0.5 text-xs text-slate-400">
                按住/长按空格直连 qwen-audio-3.0-realtime-plus；朗读与识别默认使用云端语音
              </div>
            </div>
            <ToggleSwitch
              label="启用 1v1 实时语音对话"
              testId="tp-toggle-dialog"
              checked={enableRealtimeDialog}
              onChange={setEnableRealtimeDialog}
            />
          </div>

          {/* 反馈提示 */}
          {setupError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {setupError}
            </div>
          )}
          {saveNotice && (
            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
              {saveNotice}
            </div>
          )}
          {testResult && (
            <div
              data-testid="tp-test-result"
              className={`rounded-2xl border px-4 py-3 text-sm ${
                testResult.ok
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-rose-200 bg-rose-50 text-rose-700'
              }`}
            >
              {testResult.ok
                ? `✓ 连接成功！模型 ${testResult.modelEcho || textModel} 响应正常（耗时 ${testResult.latencyMs} ms）。`
                : `✗ 测试未通过（${testResult.errorClass || 'error'}）：${testResult.message || '请检查 Key 和接入线路'}`}
            </div>
          )}
          {previewError && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
              {previewError}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="submit"
              data-testid="tp-save-test"
              disabled={saving || !derivedEndpoints.ok}
              className="flex h-11 items-center gap-2 rounded-2xl bg-orange-500 px-6 text-sm font-extrabold text-white shadow-sm transition hover:bg-orange-600 disabled:opacity-50"
            >
              {saving ? '正在保存并测试…' : '保存并测试连接'}
            </button>
            <button
              type="button"
              disabled={Boolean(previewing) || !hasKey}
              title={!hasKey ? '请先填入并保存 Token Plan Key 后试听云端朗读' : undefined}
              onClick={() => previewVoice('default', '你好呀小朋友，我是你的故事精灵，我们今天一起编故事吧！', voiceForSpeaker(speechConfig))}
              className="flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Volume2 className="h-4 w-4 text-slate-500" aria-hidden="true" />
              <span>{previewing === 'default' ? '正在合成…' : '试听伙伴朗读'}</span>
            </button>
          </div>
        </form>
      </section>

      {/* 可折叠高级设置 */}
      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          data-testid="toggle-advanced-setup"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="flex w-full items-center justify-between px-6 py-4 text-left"
        >
          <div>
            <div className="text-base font-extrabold text-slate-800">高级设置：语音音色与其他模型服务</div>
            <div className="text-xs text-slate-400">自定义伙伴音色 ID、百炼实时语音引擎、或接入 DeepSeek / OpenAI / Ollama 等服务</div>
          </div>
          <ChevronDown
            aria-hidden="true"
            className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${advancedOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {advancedOpen && (
          <div className="space-y-6 border-t border-slate-100 p-6">
            {/* 语音微调 */}
            <div className="space-y-4">
              <h3 className="text-sm font-extrabold text-slate-700">语音引擎与音色微调</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="mb-1.5 text-xs font-bold text-slate-500">朗读引擎（TTS）</div>
                  <div className="flex rounded-xl bg-slate-100 p-1">
                    {(['tokenplan', 'qwen'] as SpeechEngine[]).map((eng) => (
                      <button
                        key={eng}
                        type="button"
                        onClick={() => changeEngine('tts', eng)}
                        className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition ${
                          speechConfig.tts.engine === eng ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
                        }`}
                      >
                        {eng === 'tokenplan' ? 'Token Plan' : '百炼实时'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 text-xs font-bold text-slate-500">识别引擎（ASR）</div>
                  <div className="flex rounded-xl bg-slate-100 p-1">
                    {(['tokenplan', 'qwen'] as SpeechEngine[]).map((eng) => (
                      <button
                        key={eng}
                        type="button"
                        onClick={() => changeEngine('asr', eng)}
                        className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition ${
                          speechConfig.asr.engine === eng ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
                        }`}
                      >
                        {eng === 'tokenplan' ? 'Token Plan' : '百炼实时'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-bold text-slate-500">朗读模型</label>
                    <StyledSelect
                      wrapperClassName="mt-1"
                      className="!h-9 !text-xs"
                      value={speechConfig.tts.model}
                      onChange={(e) => updateSpeech((prev) => ({ ...prev, tts: { ...prev.tts, model: e.target.value, voice: '' } }))}
                    >
                      {SPEECH_MODELS[speechConfig.tts.engine].tts.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </StyledSelect>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500">语速（{speechConfig.tts.rate.toFixed(1)}x）</label>
                    <input
                      type="range"
                      min={0.5}
                      max={2}
                      step={0.1}
                      value={speechConfig.tts.rate}
                      onChange={(e) => updateSpeech((prev) => ({ ...prev, tts: { ...prev.tts, rate: Number(e.target.value) } }))}
                      className="mt-3 w-full accent-orange-500"
                    />
                  </div>
                </div>

                {speechConfig.tts.engine === 'tokenplan' && (
                  <div>
                    <label className="text-xs font-bold text-slate-500">儿童语气指令（Token Plan）</label>
                    <input
                      type="text"
                      maxLength={200}
                      value={speechConfig.tts.instruction}
                      onChange={(e) => updateSpeech((prev) => ({ ...prev, tts: { ...prev.tts, instruction: e.target.value } }))}
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                    />
                  </div>
                )}

                {(speechConfig.tts.engine === 'qwen' || speechConfig.asr.engine === 'qwen') && (
                  <div>
                    <label className="text-xs font-bold text-slate-500">百炼实时 WebSocket 地址</label>
                    <StyledSelect
                      wrapperClassName="mt-1"
                      className="!h-9 !text-xs"
                      value={speechConfig.endpoint}
                      onChange={(e) => updateSpeech((prev) => ({ ...prev, endpoint: e.target.value }))}
                    >
                      {SPEECH_ENDPOINTS.map((ep) => (
                        <option key={ep.value} value={ep.value}>{ep.label} · {ep.value}</option>
                      ))}
                    </StyledSelect>
                  </div>
                )}

                <div className="space-y-2 pt-1">
                  <div className="text-xs font-bold text-slate-500">伙伴、功能模块与小游戏专属音色（支持下拉或输入复刻音色 ID）</div>
                  {KID_COMPANION_IDS.map((id) => {
                    const val = customVoice(speechConfig, id);
                    const fallback = inheritedVoice(speechConfig, id);
                    return (
                      <div key={id} className="flex flex-wrap items-center gap-2">
                        <span className="w-36 shrink-0 text-xs font-semibold text-slate-700">
                          {companionMeta[id].emoji} {companionName(id)}
                        </span>
                        <input
                          list={`voice-list-${speechConfig.tts.model}`}
                          value={val}
                          onChange={(e) => updateSpeech((prev) => withCustomVoice(prev, id, e.target.value))}
                          placeholder={`默认：${fallback}`}
                          className="h-8 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-orange-400"
                        />
                        <button
                          type="button"
                          disabled={Boolean(previewing)}
                          onClick={() => previewVoice(id, companionMeta[id].greeting, voiceForSpeaker(speechConfig, id))}
                          className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                        >
                          {previewing === id ? '合成中…' : '试听'}
                        </button>
                      </div>
                    );
                  })}
                  {(() => {
                    const sunnyId = ENGLISH_BUDDY.id;
                    const val = customVoice(speechConfig, sunnyId);
                    const fallback = inheritedVoice(speechConfig, sunnyId);
                    return (
                      <div key={sunnyId} className="flex flex-wrap items-center gap-2">
                        <span className="w-36 shrink-0 text-xs font-semibold text-slate-700">
                          {ENGLISH_BUDDY.emoji} {ENGLISH_BUDDY.name}（英语）
                        </span>
                        <input
                          list={`voice-list-${speechConfig.tts.model}`}
                          value={val}
                          onChange={(e) => updateSpeech((prev) => withCustomVoice(prev, sunnyId, e.target.value))}
                          placeholder={`默认：${fallback}`}
                          className="h-8 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-orange-400"
                        />
                        <button
                          type="button"
                          disabled={Boolean(previewing)}
                          onClick={() =>
                            previewVoice(sunnyId, "Hi friend! I'm Sunny. Let's speak English together!", voiceForSpeaker(speechConfig, sunnyId))
                          }
                          className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                        >
                          {previewing === sunnyId ? '合成中…' : '试听'}
                        </button>
                      </div>
                    );
                  })()}
                  {MODULE_VOICE_ENTRIES.map((mod) => {
                    const val = customVoice(speechConfig, mod.key);
                    return (
                      <div key={mod.key} className="flex flex-wrap items-center gap-2">
                        <span className="w-36 shrink-0 text-xs font-semibold text-slate-700">
                          {mod.emoji} {mod.label}
                        </span>
                        <input
                          list={`voice-list-${speechConfig.tts.model}`}
                          value={val}
                          onChange={(e) => updateSpeech((prev) => withCustomVoice(prev, mod.key, e.target.value))}
                          placeholder={`跟随 ${companionName(mod.hostId)}`}
                          className="h-8 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-orange-400"
                        />
                        <button
                          type="button"
                          disabled={Boolean(previewing)}
                          onClick={() => previewVoice(mod.key, mod.sample, voiceForSpeaker(speechConfig, mod.hostId, mod.key))}
                          className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                        >
                          {previewing === mod.key ? '合成中…' : '试听'}
                        </button>
                      </div>
                    );
                  })}
                  {kidGames.map((game) => {
                    const key = gameVoiceKey(game.id);
                    const val = customVoice(speechConfig, key);
                    return (
                      <div key={key} className="flex flex-wrap items-center gap-2">
                        <span className="w-36 shrink-0 text-xs font-semibold text-slate-700">
                          {game.emoji} {game.name}
                        </span>
                        <input
                          list={`voice-list-${speechConfig.tts.model}`}
                          value={val}
                          onChange={(e) => updateSpeech((prev) => withCustomVoice(prev, key, e.target.value))}
                          placeholder={`跟随 ${companionName(game.hostCompanionId)}`}
                          className="h-8 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-orange-400"
                        />
                        <button
                          type="button"
                          disabled={Boolean(previewing)}
                          onClick={() =>
                            previewVoice(
                              key,
                              companionMeta[game.hostCompanionId as keyof typeof companionMeta]?.greeting ?? '',
                              voiceForSpeaker(speechConfig, game.hostCompanionId, game.id),
                            )
                          }
                          className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                        >
                          {previewing === key ? '合成中…' : '试听'}
                        </button>
                      </div>
                    );
                  })}
                  <datalist id={`voice-list-${speechConfig.tts.model}`}>
                    {currentCatalog.options.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </datalist>
                </div>
              </div>

              {/* 实时语音音色 */}
              {speechConfig.dialog.enabled && (
                <div className="space-y-2 rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs font-bold text-slate-500">
                    1v1 实时对话音色（{speechConfig.dialog.model} · {speechConfig.dialog.endpoint || DIALOG_ENDPOINT}）
                  </div>
                  {KID_COMPANION_IDS.map((id) => (
                    <div key={id} className="flex items-center gap-2">
                      <span className="w-36 shrink-0 text-xs font-semibold text-slate-700">
                        {companionMeta[id].emoji} {companionName(id)}
                      </span>
                      <input
                        list="voice-list-dialog"
                        value={customVoice(speechConfig, id, speechConfig.dialog.model)}
                        onChange={(e) =>
                          updateSpeech((prev) => withCustomVoice(prev, id, e.target.value, prev.dialog.model))
                        }
                        placeholder={`默认：${dialogCatalog.companions[id] || dialogCatalog.fallback}`}
                        className="h-8 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-orange-400"
                      />
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <span className="w-36 shrink-0 text-xs font-semibold text-slate-700">
                      {ENGLISH_BUDDY.emoji} {ENGLISH_BUDDY.name}（英语）
                    </span>
                    <input
                      list="voice-list-dialog"
                      value={customVoice(speechConfig, ENGLISH_BUDDY.id, speechConfig.dialog.model)}
                      onChange={(e) =>
                        updateSpeech((prev) => withCustomVoice(prev, ENGLISH_BUDDY.id, e.target.value, prev.dialog.model))
                      }
                      placeholder={`默认：${dialogCatalog.companions[ENGLISH_BUDDY.id] || dialogCatalog.fallback}`}
                      className="h-8 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-orange-400"
                    />
                  </div>
                  <datalist id="voice-list-dialog">
                    {dialogCatalog.options.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </datalist>
                </div>
              )}
            </div>

            {/* 动画魔法视频模型 */}
            <div className="space-y-2 border-t border-slate-100 pt-5">
              <h3 className="text-sm font-extrabold text-slate-700">魔法画室 · 动画生成模型（让画动起来）</h3>
              <div>
                <label className="text-xs font-bold text-slate-500" htmlFor="tp-video-model">
                  图生视频模型
                </label>
                <StyledSelect
                  id="tp-video-model"
                  wrapperClassName="mt-1"
                  className="!h-9 !text-xs"
                  value={imageConfig.videoModel}
                  onChange={(e) => {
                    const next: KidImageConfig = { ...imageConfig, videoModel: e.target.value };
                    setImageConfig(next);
                    saveImageConfig(next);
                  }}
                >
                  {TOKEN_PLAN_VIDEO_MODELS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </StyledSelect>
              </div>
            </div>

            {/* 切换默认伙伴模型 & 其他模型服务 */}
            <div className="space-y-4 border-t border-slate-100 pt-5">
              <h3 className="text-sm font-extrabold text-slate-700">其他 OpenAI 兼容模型服务</h3>
              <div>
                <label className="text-xs font-bold text-slate-500">当前伙伴默认对话模型</label>
                <StyledSelect
                  wrapperClassName="mt-1"
                  className="!h-9 !text-xs"
                  value={kidModelValue}
                  onChange={(e) => {
                    const v = e.target.value;
                    setKidModelValue(v);
                    if (!v) {
                      saveKidModel(null);
                    } else {
                      const [providerId, ...rest] = v.split('::');
                      saveKidModel({ providerId, model: rest.join('::') });
                    }
                  }}
                >
                  <option value="">自动选择第一个可用服务</option>
                  {allModelOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </StyledSelect>
              </div>

              {Object.values(providers).length > 0 && (
                <div className="space-y-2">
                  {Object.values(providers).map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs">
                      <div className="min-w-0">
                        <div className="font-bold text-slate-800">{p.name} <span className="font-normal text-slate-400">({p.id})</span></div>
                        <div className="truncate text-slate-400">{p.baseURL} · 模型：{p.models.slice(0, 3).join(', ')}{p.models.length > 3 ? ` 等 ${p.models.length} 个` : ''}</div>
                      </div>
                      {p.id !== TOKEN_PLAN_PROVIDER_ID && (
                        <button
                          type="button"
                          onClick={async () => {
                            await removeProvider(p.id);
                            if (isTauri) {
                              await invoke('secret_delete', { name: p.apiKeyRef }).catch(() => undefined);
                            }
                            await refreshState();
                          }}
                          className="shrink-0 rounded-lg bg-rose-50 px-2.5 py-1 font-semibold text-rose-600 hover:bg-rose-100"
                        >
                          删除
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleSaveOtherProvider} className="space-y-2.5 rounded-2xl bg-slate-50 p-4">
                <div className="text-xs font-bold text-slate-600">添加自定义模型服务</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <StyledSelect
                    className="!h-9 !text-xs"
                    value={otherPresetId}
                    onChange={(e) => {
                      const preset = providerPresets.find((p) => p.id === e.target.value);
                      setOtherPresetId(e.target.value);
                      if (preset) {
                        setOtherName(preset.name);
                        setOtherBaseUrl(preset.baseURL);
                      }
                    }}
                  >
                    {providerPresets.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </StyledSelect>
                  <input
                    type="text"
                    value={otherName}
                    onChange={(e) => setOtherName(e.target.value)}
                    placeholder="显示名称"
                    className="h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-xs outline-none focus:border-orange-400"
                  />
                </div>
                <input
                  type="text"
                  value={otherBaseUrl}
                  onChange={(e) => setOtherBaseUrl(e.target.value)}
                  placeholder={`Base URL（如 ${TOKEN_PLAN_BASE}/compatible-mode/v1）`}
                  className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs outline-none focus:border-orange-400"
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    type="text"
                    value={otherModels}
                    onChange={(e) => setOtherModels(e.target.value)}
                    placeholder="模型列表，逗号分隔"
                    className="h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-xs outline-none focus:border-orange-400"
                  />
                  <input
                    type="password"
                    value={otherKey}
                    onChange={(e) => setOtherKey(e.target.value)}
                    placeholder="API Key"
                    className="h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-xs outline-none focus:border-orange-400"
                  />
                </div>
                {otherStatus && <p className="text-xs text-slate-600">{otherStatus}</p>}
                <button
                  type="submit"
                  disabled={otherBusy}
                  className="h-9 rounded-xl bg-slate-800 px-4 text-xs font-bold text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {otherBusy ? '保存中…' : '保存自定义服务'}
                </button>
              </form>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
