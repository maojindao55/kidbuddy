import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { AGE_PROFILES, getAgeProfile, loadAgeBand, saveAgeBand, type AgeBand } from '@/config/ageProfile';
import { buildChildSafetyRules } from '@/config/childPrompt';
import { MAX_INTERESTS, loadKidMemory, saveKidMemory, type KidMemory } from '@/config/kidMemory';
import {
  TIME_LIMIT_PRESETS,
  getTimeStatus,
  grantBonusMinutes,
  loadDailyUsage,
  loadTimeLimitConfig,
  resetTodayUsage,
  saveTimeLimitConfig,
} from '@/config/kidTimeLimit';
import { ToggleSwitch } from './FormControls';

export default function ChildTab() {
  const [memory, setMemory] = useState<KidMemory>(loadKidMemory);
  const [nicknameDraft, setNicknameDraft] = useState(() => loadKidMemory().nickname || '');
  const [interestDraft, setInterestDraft] = useState('');
  const [profileSavedMsg, setProfileSavedMsg] = useState('');

  const [ageBand, setAgeBand] = useState<AgeBand>(loadAgeBand);
  const [timeConfig, setTimeConfig] = useState(loadTimeLimitConfig);
  const [dailyUsage, setDailyUsage] = useState(() => loadDailyUsage());
  const [rulesOpen, setRulesOpen] = useState(false);

  const timeStatus = getTimeStatus(timeConfig, dailyUsage);
  const activeProfile = getAgeProfile(ageBand);

  const saveNickname = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = nicknameDraft.trim().slice(0, 6);
    const next: KidMemory = { ...memory, nickname: cleaned || undefined };
    saveKidMemory(next);
    setMemory(next);
    setNicknameDraft(cleaned);
    setProfileSavedMsg('已更新宝贝昵称');
  };

  const addInterest = (e: React.FormEvent) => {
    e.preventDefault();
    const token = interestDraft.trim().slice(0, 8);
    if (!token) return;
    const nextInterests = [token, ...memory.interests.filter((x) => x !== token)].slice(0, MAX_INTERESTS);
    const next: KidMemory = { ...memory, interests: nextInterests };
    saveKidMemory(next);
    setMemory(next);
    setInterestDraft('');
  };

  const removeInterest = (item: string) => {
    const next: KidMemory = { ...memory, interests: memory.interests.filter((x) => x !== item) };
    saveKidMemory(next);
    setMemory(next);
  };

  const updateTimeConfig = (next: { enabled: boolean; dailyMinutes: number }) => {
    saveTimeLimitConfig(next);
    setTimeConfig(loadTimeLimitConfig());
  };

  return (
    <div className="space-y-6">
      {/* 宝贝档案 */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-extrabold text-slate-800">宝贝档案与兴趣记忆</h2>
        <p className="mt-1 text-xs text-slate-500">仅保存在本机，伙伴会用昵称打招呼，偶尔聊聊宝贝喜欢的主题。</p>

        <form onSubmit={saveNickname} className="mt-4 flex flex-wrap items-center gap-2">
          <input
            type="text"
            maxLength={6}
            value={nicknameDraft}
            onChange={(e) => {
              setNicknameDraft(e.target.value);
              setProfileSavedMsg('');
            }}
            placeholder="宝贝小名（如：乐乐，最多 6 个字）"
            className="h-10 w-64 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
          />
          <button
            type="submit"
            className="h-10 rounded-xl bg-orange-500 px-4 text-sm font-bold text-white hover:bg-orange-600"
          >
            保存昵称
          </button>
          {profileSavedMsg && <span className="text-xs font-semibold text-emerald-600">{profileSavedMsg}</span>}
        </form>

        <div className="mt-4">
          <div className="text-xs font-bold text-slate-500">兴趣标签（最多 {MAX_INTERESTS} 个）</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {memory.interests.length === 0 ? (
              <span className="text-xs text-slate-400">暂无记录，孩子聊天提到喜欢的事物时也会自动记住。</span>
            ) : (
              memory.interests.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200"
                >
                  {item}
                  <button
                    type="button"
                    aria-label={`删除 ${item}`}
                    onClick={() => removeInterest(item)}
                    className="text-amber-500 hover:text-rose-500"
                  >
                    ×
                  </button>
                </span>
              ))
            )}
          </div>
          <form onSubmit={addInterest} className="mt-3 flex gap-2">
            <input
              type="text"
              maxLength={8}
              value={interestDraft}
              onChange={(e) => setInterestDraft(e.target.value)}
              placeholder="添加兴趣，如：恐龙、太空"
              className="h-9 w-56 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            />
            <button type="submit" className="h-9 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">
              + 添加
            </button>
          </form>
        </div>
      </section>

      {/* 年龄分层 */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-extrabold text-slate-800">年龄与表达难度</h2>
        <p className="mt-1 text-xs text-slate-500">决定伙伴每次回复字数、默认语音/打字方式、每轮回复人数与小游戏难度。</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(Object.keys(AGE_PROFILES) as AgeBand[]).map((band) => {
            const p = AGE_PROFILES[band];
            const active = ageBand === band;
            return (
              <button
                key={band}
                type="button"
                data-testid={`parent-age-${band}`}
                onClick={() => {
                  setAgeBand(band);
                  saveAgeBand(band);
                }}
                className={`rounded-2xl border-2 p-4 text-left transition ${
                  active ? 'border-orange-400 bg-orange-50/50' : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-base font-extrabold text-slate-800">{p.label}</span>
                  {band === 'school' && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                      5–10 岁推荐主档
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{p.languageGuide}</p>
                <div className="mt-2.5 flex flex-wrap gap-2 text-[11px] text-slate-500">
                  <span className="rounded-lg bg-white px-2 py-0.5 ring-1 ring-slate-200">≤ {p.maxReplyChars} 字/条</span>
                  <span className="rounded-lg bg-white px-2 py-0.5 ring-1 ring-slate-200">
                    {p.defaultInputMode === 'voice' ? '默认按住说话' : '默认打字/语音可选'}
                  </span>
                  <span className="rounded-lg bg-white px-2 py-0.5 ring-1 ring-slate-200">
                    {p.autoReadAloud ? '默认自动朗读' : '朗读可选'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 每日护眼时长限制 */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-extrabold text-slate-800">每日护眼使用时长</h2>
            <p className="mt-1 text-xs text-slate-500">达到今日上限后，儿童端会自动锁定并提醒宝宝休息眼睛，需家长验证后才可延长。</p>
          </div>
          <div className="flex items-center gap-2.5 text-sm font-bold text-slate-700">
            <ToggleSwitch
              label="启用每日护眼使用时长"
              testId="time-limit-toggle"
              checked={timeConfig.enabled}
              onChange={(enabled) => updateTimeConfig({ ...timeConfig, enabled })}
            />
            <span>{timeConfig.enabled ? '已开启' : '已关闭'}</span>
          </div>
        </div>

        <div className={`mt-4 space-y-4 ${timeConfig.enabled ? '' : 'opacity-50'}`}>
          <div className="flex flex-wrap gap-2">
            {TIME_LIMIT_PRESETS.map((min) => (
              <button
                key={min}
                type="button"
                disabled={!timeConfig.enabled}
                onClick={() => updateTimeConfig({ ...timeConfig, dailyMinutes: min })}
                className={`h-9 rounded-xl px-3.5 text-xs font-bold transition ${
                  timeConfig.dailyMinutes === min
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {min} 分钟/天
              </button>
            ))}
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600">
              <span>今日已用 {Math.floor(timeStatus.usedSeconds / 60)} 分 {timeStatus.usedSeconds % 60} 秒</span>
              <span>
                今日上限 {Math.round(timeStatus.limitSeconds / 60)} 分钟
                {dailyUsage.bonusMinutes > 0 ? `（含延长 +${dailyUsage.bonusMinutes} 分钟）` : ''}
              </span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full transition-all ${timeStatus.isExceeded ? 'bg-rose-400' : 'bg-orange-500'}`}
                style={{ width: `${timeStatus.percentUsed}%` }}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDailyUsage(grantBonusMinutes(15))}
                className="h-8 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                + 今日延长 15 分钟
              </button>
              <button
                type="button"
                onClick={() => setDailyUsage(resetTodayUsage())}
                className="h-8 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                重置今日已用计时
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 内置儿童安全守则 */}
      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setRulesOpen((v) => !v)}
          className="flex w-full items-center justify-between px-6 py-4 text-left"
        >
          <div>
            <div className="text-base font-extrabold text-slate-800">内置儿童安全守则（强制前置 · 不可由孩子修改）</div>
            <div className="text-xs text-slate-400">每次对话自动置于系统指令最前面，防止泄露隐私与引导危险行为</div>
          </div>
          <ChevronDown
            aria-hidden="true"
            className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${rulesOpen ? 'rotate-180' : ''}`}
          />
        </button>
        {rulesOpen && (
          <pre className="whitespace-pre-wrap border-t border-slate-100 px-6 py-4 text-xs leading-relaxed text-slate-600">
            {buildChildSafetyRules(activeProfile)}
          </pre>
        )}
      </section>
    </div>
  );
}
