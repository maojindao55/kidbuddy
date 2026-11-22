import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { KID_COMPANION_IDS, getCompanionMeta, type AIMember, type CompanionMeta } from '@/config/aiMembers';
import { loadAgeProfile, type AgeProfile, type KidGameId } from '@/config/ageProfile';
import { loadKidMemory, type KidMemory } from '@/config/kidMemory';
import { loadVoicePrefs, resolveVoicePrefs, saveVoicePrefs, type KidVoicePrefs, type ResolvedVoicePrefs } from '@/config/kidPrefs';
import {
  applyGameResult,
  applyMessage,
  loadRewardStats,
  saveRewardStats,
  type BadgeDefinition,
  type KidRewardStats,
} from '@/config/kidRewards';
import {
  addUsageSeconds,
  getTimeStatus,
  grantBonusMinutes,
  loadDailyUsage,
  loadTimeLimitConfig,
  type TimeStatus,
} from '@/config/kidTimeLimit';
import { getSpeechRecognizer, getSpeechSynthesizer, type SpeechRecognizer, type SpeechSynthesizer } from '@/lib/speech';
import { hasConfiguredAiService } from '@/lib/tokenPlanSetup';
import { useAIMemberStore } from '@/store/aiMemberStore';

export interface KidCompanion {
  member: AIMember;
  meta: CompanionMeta;
}

interface KidContextValue {
  profile: AgeProfile;
  memory: KidMemory;
  refreshMemory: () => void;
  companions: KidCompanion[];
  companionsLoading: boolean;
  rewards: KidRewardStats;
  recordMessage: (companionIds: string[]) => void;
  recordGame: (result: { gameId: KidGameId; levelId: string; levelNumber: number; stars: number }) => number;
  celebration: BadgeDefinition[];
  dismissCelebration: () => void;
  voice: ResolvedVoicePrefs;
  setVoicePrefs: (prefs: KidVoicePrefs) => void;
  recognizer: SpeechRecognizer;
  synthesizer: SpeechSynthesizer;
  aiConfigured: boolean;
  aiConfigChecked: boolean;
  refreshAiStatus: () => Promise<void>;
  timeStatus: TimeStatus;
  extendTodayTime: (minutes: number) => void;
}

const KidContext = createContext<KidContextValue | null>(null);

export function KidProvider({ children }: { children: ReactNode }) {
  const [profile] = useState(loadAgeProfile);
  const [memory, setMemory] = useState(loadKidMemory);
  const [rewards, setRewards] = useState(loadRewardStats);
  const [celebration, setCelebration] = useState<BadgeDefinition[]>([]);
  const [voicePrefs, setVoicePrefsState] = useState(() => loadVoicePrefs(profile.band));
  const [aiConfigured, setAiConfigured] = useState(false);
  const [aiConfigChecked, setAiConfigChecked] = useState(false);
  const [timeConfig, setTimeConfig] = useState(loadTimeLimitConfig);
  const [dailyUsage, setDailyUsage] = useState(() => loadDailyUsage());
  const recognizer = useMemo(getSpeechRecognizer, []);
  const synthesizer = useMemo(getSpeechSynthesizer, []);

  const members = useAIMemberStore((s) => s.members);
  const loading = useAIMemberStore((s) => s.loading);
  const loadMembers = useAIMemberStore((s) => s.load);
  const [loadedOnce, setLoadedOnce] = useState(false);

  const refreshAiStatus = useCallback(async () => {
    const ok = await hasConfiguredAiService();
    setAiConfigured(ok);
    setAiConfigChecked(true);
  }, []);

  useEffect(() => {
    loadMembers().finally(() => setLoadedOnce(true));
    void refreshAiStatus();
  }, [loadMembers, refreshAiStatus]);

  const timeStatus = useMemo(() => getTimeStatus(timeConfig, dailyUsage), [timeConfig, dailyUsage]);

  // 每 15 秒统计可见使用时长；超限后不再累加，跨天自动归零
  useEffect(() => {
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      const cfg = loadTimeLimitConfig();
      const current = loadDailyUsage();
      setTimeConfig(cfg);
      if (getTimeStatus(cfg, current).isExceeded) {
        setDailyUsage(current);
        return;
      }
      setDailyUsage(addUsageSeconds(15));
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const extendTodayTime = useCallback((minutes: number) => {
    setTimeConfig(loadTimeLimitConfig());
    setDailyUsage(grantBonusMinutes(minutes));
  }, []);

  const companions = useMemo(
    () =>
      KID_COMPANION_IDS.flatMap((id) => {
        const member = members[id];
        const meta = getCompanionMeta(id);
        return member && meta && member.enabled !== false ? [{ member, meta }] : [];
      }),
    [members],
  );

  const commitRewards = useCallback((next: KidRewardStats, newBadges: BadgeDefinition[]) => {
    saveRewardStats(next);
    setRewards(next);
    if (newBadges.length) setCelebration((prev) => [...prev, ...newBadges]);
  }, []);

  const recordMessage = useCallback(
    (companionIds: string[]) => {
      const { stats, newBadges } = applyMessage(loadRewardStats(), companionIds);
      commitRewards(stats, newBadges);
    },
    [commitRewards],
  );

  const recordGame = useCallback(
    (result: { gameId: KidGameId; levelId: string; levelNumber: number; stars: number }) => {
      const { stats, newBadges, starsGained } = applyGameResult(loadRewardStats(), result);
      commitRewards(stats, newBadges);
      return starsGained;
    },
    [commitRewards],
  );

  const voice = useMemo(
    () => resolveVoicePrefs(profile, voicePrefs, { canRecognize: recognizer.supported, canSpeak: synthesizer.supported }),
    [profile, voicePrefs, recognizer, synthesizer],
  );

  const setVoicePrefs = useCallback(
    (prefs: KidVoicePrefs) => {
      setVoicePrefsState((prev) => {
        const next = { ...prev, ...prefs };
        saveVoicePrefs(profile.band, next);
        return next;
      });
    },
    [profile.band],
  );

  const refreshMemory = useCallback(() => setMemory(loadKidMemory()), []);
  const dismissCelebration = useCallback(() => setCelebration([]), []);

  const value: KidContextValue = {
    profile,
    memory,
    refreshMemory,
    companions,
    companionsLoading: loading || !loadedOnce,
    rewards,
    recordMessage,
    recordGame,
    celebration,
    dismissCelebration,
    voice,
    setVoicePrefs,
    recognizer,
    synthesizer,
    aiConfigured,
    aiConfigChecked,
    refreshAiStatus,
    timeStatus,
    extendTodayTime,
  };

  return <KidContext.Provider value={value}>{children}</KidContext.Provider>;
}

export function useKid(): KidContextValue {
  const ctx = useContext(KidContext);
  if (!ctx) throw new Error('useKid must be used inside KidProvider');
  return ctx;
}
