/**
 * 每日护眼使用时长限制（本地 localStorage，零外部运行时依赖）。
 */

export interface TimeLimitConfig {
  enabled: boolean;
  dailyMinutes: number;
}

export interface DailyUsage {
  date: string;
  usedSeconds: number;
  bonusMinutes: number;
}

export interface TimeStatus {
  enabled: boolean;
  limitSeconds: number;
  usedSeconds: number;
  remainingSeconds: number;
  isExceeded: boolean;
  percentUsed: number;
}

export const TIME_LIMIT_PRESETS = [15, 20, 30, 45, 60] as const;
export const DEFAULT_TIME_LIMIT_CONFIG: TimeLimitConfig = {
  enabled: true,
  dailyMinutes: 30,
};

const CONFIG_KEY = 'kid_time_limit';
const USAGE_KEY = 'kid_daily_usage';

function clampDailyMinutes(value: unknown): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_TIME_LIMIT_CONFIG.dailyMinutes;
  return Math.max(5, Math.min(180, n));
}

function nonNegInt(value: unknown): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function todayDateKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function loadTimeLimitConfig(): TimeLimitConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return { ...DEFAULT_TIME_LIMIT_CONFIG };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      enabled: typeof parsed?.enabled === 'boolean' ? parsed.enabled : DEFAULT_TIME_LIMIT_CONFIG.enabled,
      dailyMinutes: clampDailyMinutes(parsed?.dailyMinutes),
    };
  } catch {
    return { ...DEFAULT_TIME_LIMIT_CONFIG };
  }
}

export function saveTimeLimitConfig(config: TimeLimitConfig): void {
  try {
    localStorage.setItem(
      CONFIG_KEY,
      JSON.stringify({
        enabled: Boolean(config.enabled),
        dailyMinutes: clampDailyMinutes(config.dailyMinutes),
      }),
    );
  } catch {
    // ignore storage errors
  }
}

export function loadDailyUsage(now: Date = new Date()): DailyUsage {
  const today = todayDateKey(now);
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    if (!raw) return { date: today, usedSeconds: 0, bonusMinutes: 0 };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed?.date !== today) {
      return { date: today, usedSeconds: 0, bonusMinutes: 0 };
    }
    return {
      date: today,
      usedSeconds: nonNegInt(parsed.usedSeconds),
      bonusMinutes: nonNegInt(parsed.bonusMinutes),
    };
  } catch {
    return { date: today, usedSeconds: 0, bonusMinutes: 0 };
  }
}

export function saveDailyUsage(usage: DailyUsage): void {
  try {
    localStorage.setItem(
      USAGE_KEY,
      JSON.stringify({
        date: usage.date,
        usedSeconds: nonNegInt(usage.usedSeconds),
        bonusMinutes: nonNegInt(usage.bonusMinutes),
      }),
    );
  } catch {
    // ignore storage errors
  }
}

export function addUsageSeconds(deltaSec: number, now: Date = new Date()): DailyUsage {
  const current = loadDailyUsage(now);
  const delta = nonNegInt(deltaSec);
  const next: DailyUsage = {
    ...current,
    usedSeconds: current.usedSeconds + delta,
  };
  saveDailyUsage(next);
  return next;
}

export function grantBonusMinutes(minutes: number, now: Date = new Date()): DailyUsage {
  const current = loadDailyUsage(now);
  const add = Math.max(1, Math.floor(Number(minutes) || 0));
  const next: DailyUsage = {
    ...current,
    bonusMinutes: current.bonusMinutes + add,
  };
  saveDailyUsage(next);
  return next;
}

export function resetTodayUsage(now: Date = new Date()): DailyUsage {
  const next: DailyUsage = { date: todayDateKey(now), usedSeconds: 0, bonusMinutes: 0 };
  saveDailyUsage(next);
  return next;
}

export function getTimeStatus(config: TimeLimitConfig, usage: DailyUsage): TimeStatus {
  const limitSeconds = (clampDailyMinutes(config.dailyMinutes) + nonNegInt(usage.bonusMinutes)) * 60;
  const usedSeconds = nonNegInt(usage.usedSeconds);
  const remainingSeconds = config.enabled ? Math.max(0, limitSeconds - usedSeconds) : Infinity;
  const isExceeded = config.enabled && usedSeconds >= limitSeconds;
  const percentUsed = limitSeconds > 0 ? Math.min(100, Math.round((usedSeconds / limitSeconds) * 100)) : 100;
  return {
    enabled: config.enabled,
    limitSeconds,
    usedSeconds,
    remainingSeconds,
    isExceeded,
    percentUsed,
  };
}
