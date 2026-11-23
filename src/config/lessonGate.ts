/**
 * 「说说小课堂」课堂入口门禁。
 *
 * 这个模块是老师带孩子做 DTT 回合教学的操作台：抽题、教具、打分、生成记录，
 * 孩子自己点进去会打乱课堂节奏，也容易把没上完的一节课存成记录。
 * 所以入口要求长按 1.5 秒 + 家长验证，验证通过后一段时间内不用重复验证。
 *
 * 解锁状态放 sessionStorage：关掉应用就重新锁上，避免第二天被孩子直接摸进去。
 */

/** 一节课通常 15–25 分钟，解锁窗口给到 30 分钟 */
export const LESSON_UNLOCK_MS = 30 * 60 * 1000;
const UNLOCK_KEY = 'lesson_unlocked_until';

function storage(): Storage | null {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  } catch {
    return null;
  }
}

export function unlockLessonArea(now = Date.now()): void {
  storage()?.setItem(UNLOCK_KEY, String(now + LESSON_UNLOCK_MS));
}

export function lockLessonArea(): void {
  storage()?.removeItem(UNLOCK_KEY);
}

export function isLessonAreaUnlocked(now = Date.now()): boolean {
  const until = Number(storage()?.getItem(UNLOCK_KEY) || 0);
  return Number.isFinite(until) && until > now;
}

/** 剩余解锁分钟数，0 表示已锁定 */
export function lessonUnlockLeftMinutes(now = Date.now()): number {
  const until = Number(storage()?.getItem(UNLOCK_KEY) || 0);
  if (!Number.isFinite(until) || until <= now) return 0;
  return Math.ceil((until - now) / 60000);
}
