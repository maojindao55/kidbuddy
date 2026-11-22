/**
 * 儿童端每个聊天（单个伙伴或小伙伴乐园）的本地记录，只保留最近的消息。
 */

export interface KidChatMessage {
  id: string;
  /** 'kid' 为孩子，其余为伙伴 id */
  speakerId: string;
  speakerName: string;
  content: string;
  /** 孩子发送的图片本地路径或预览 data URL */
  imageUrl?: string;
  createdAt: number;
  isError?: boolean;
}

export const MAX_KID_CHAT_MESSAGES = 60;
const HISTORY_PREFIX = 'kid_chat:';
const MAX_INLINE_IMAGE_LEN = 200_000;

export function normalizeKidChat(raw: unknown): KidChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m): m is KidChatMessage =>
      Boolean(m) && typeof m.id === 'string' && typeof m.speakerId === 'string'
      && typeof m.speakerName === 'string' && typeof m.content === 'string')
    .map((m) => ({
      ...m,
      createdAt: Number(m.createdAt) || 0,
      ...(typeof m.imageUrl === 'string' && m.imageUrl ? { imageUrl: m.imageUrl } : {}),
    }))
    .slice(-MAX_KID_CHAT_MESSAGES);
}

export function loadKidChat(chatId: string): KidChatMessage[] {
  try {
    const raw = localStorage.getItem(HISTORY_PREFIX + chatId);
    return normalizeKidChat(raw ? JSON.parse(raw) : []);
  } catch {
    return [];
  }
}

export function saveKidChat(chatId: string, messages: KidChatMessage[]): void {
  try {
    const kept = messages
      .filter((m) => !m.isError && (m.content.trim() || m.imageUrl))
      .slice(-MAX_KID_CHAT_MESSAGES)
      .map((m) =>
        m.imageUrl?.startsWith('data:') && m.imageUrl.length > MAX_INLINE_IMAGE_LEN
          ? { ...m, imageUrl: undefined }
          : m,
      );
    localStorage.setItem(HISTORY_PREFIX + chatId, JSON.stringify(kept));
  } catch {
    // ignore
  }
}

export function clearKidChats(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(HISTORY_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    // ignore
  }
}

export function newKidMessageId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
