/**
 * 家长验证入口与家长密码（4 位 PIN + 算术题兜底）。
 */

export interface ArithmeticChallenge {
  question: string;
  answer: number;
}

export const PARENT_UNLOCK_MS = 30 * 60 * 1000;
const UNLOCK_KEY = 'parent_unlocked_until';
const PIN_HASH_KEY = 'parent_pin_hash';
const PIN_SALT = 'bg-kid-pin-v1';

/** 两位数乘一位数，例如 37 × 6，学龄前孩子基本算不出来 */
export function createArithmeticChallenge(random: () => number = Math.random): ArithmeticChallenge {
  const a = 12 + Math.floor(random() * 88);
  const b = 3 + Math.floor(random() * 7);
  return { question: `${a} × ${b} = ?`, answer: a * b };
}

export function checkChallengeAnswer(challenge: ArithmeticChallenge, input: string): boolean {
  const normalized = (input || '').replace(/[\s,，]/g, '').replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0));
  return /^\d+$/.test(normalized) && Number(normalized) === challenge.answer;
}

export function normalizePinInput(raw: string): string {
  return (raw || '')
    .replace(/\s+/g, '')
    .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0));
}

export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

function hashPin(pin: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  const input = `${PIN_SALT}:${pin}:${PIN_SALT}`;
  for (let round = 0; round < 3; round += 1) {
    for (let i = 0; i < input.length; i += 1) {
      const code = input.charCodeAt(i) + round * 31;
      h1 ^= code;
      h1 = Math.imul(h1, 0x01000193) >>> 0;
      h2 = Math.imul(h2 ^ code, 0x85ebca6b) >>> 0;
    }
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

function pinStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function hasParentPin(): boolean {
  return Boolean(pinStorage()?.getItem(PIN_HASH_KEY));
}

export function setParentPin(rawPin: string): boolean {
  const pin = normalizePinInput(rawPin);
  if (!isValidPin(pin)) return false;
  pinStorage()?.setItem(PIN_HASH_KEY, hashPin(pin));
  return true;
}

export function clearParentPin(): void {
  pinStorage()?.removeItem(PIN_HASH_KEY);
}

export function verifyParentPin(rawInput: string): boolean {
  const stored = pinStorage()?.getItem(PIN_HASH_KEY);
  if (!stored) return false;
  const pin = normalizePinInput(rawInput);
  return isValidPin(pin) && hashPin(pin) === stored;
}

function storage(): Storage | null {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  } catch {
    return null;
  }
}

export function unlockParentArea(now = Date.now()): void {
  storage()?.setItem(UNLOCK_KEY, String(now + PARENT_UNLOCK_MS));
}

export function lockParentArea(): void {
  storage()?.removeItem(UNLOCK_KEY);
}

export function isParentAreaUnlocked(now = Date.now()): boolean {
  const until = Number(storage()?.getItem(UNLOCK_KEY) || 0);
  return Number.isFinite(until) && until > now;
}
