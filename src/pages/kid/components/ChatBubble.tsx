import { useState } from 'react';
import Markdown from '@/components/Markdown';
import { resolveArtworkSrc } from '@/lib/kidImage';
import type { KidCompanion } from '../KidContext';

export function CompanionAvatar({ companion, size = 56 }: { companion?: KidCompanion; size?: number }) {
  if (!companion || !companion.member.avatar) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-full text-2xl shadow-sm"
        style={{
          width: size,
          height: size,
          backgroundColor: companion ? `${companion.meta.color}22` : '#FEF3C7',
          boxShadow: companion ? `0 0 0 3px ${companion.meta.color}33` : undefined,
        }}
        aria-hidden
      >
        {companion?.meta.emoji || '🌈'}
      </div>
    );
  }
  return (
    <img
      src={companion.member.avatar}
      alt={companion.member.name}
      className="shrink-0 rounded-full bg-white object-cover shadow-sm"
      style={{ width: size, height: size, boxShadow: `0 0 0 3px ${companion.meta.color}33` }}
      draggable={false}
    />
  );
}

interface ChatBubbleProps {
  isKid: boolean;
  speakerName: string;
  content: string;
  imageUrl?: string;
  companion?: KidCompanion;
  fontSize: number;
  pending?: boolean;
  isError?: boolean;
  onReadAloud?: () => void;
}

export function ChatBubble({ isKid, speakerName, content, imageUrl, companion, fontSize, pending, isError, onReadAloud }: ChatBubbleProps) {
  const [zoomed, setZoomed] = useState(false);

  if (isKid) {
    return (
      <>
        <div className="flex justify-end" data-testid="kid-bubble">
          <div
            className="max-w-[78%] whitespace-pre-wrap break-words rounded-[28px] rounded-br-lg bg-amber-400 px-5 py-3 font-medium text-white shadow-sm"
            style={{ fontSize, lineHeight: 1.6 }}
          >
            {imageUrl && (
              <img
                src={resolveArtworkSrc(imageUrl)}
                alt="发送的图片"
                onClick={() => setZoomed(true)}
                className="mb-2 block max-h-60 w-auto cursor-zoom-in rounded-2xl bg-white/20 object-contain"
              />
            )}
            {content}
          </div>
        </div>
        {zoomed && imageUrl && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-6"
            onClick={() => setZoomed(false)}
          >
            <div
              className="flex max-h-[90vh] max-w-3xl flex-col items-end gap-3 rounded-3xl bg-white p-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setZoomed(false)}
                className="flex h-12 items-center rounded-2xl bg-slate-100 px-5 text-sm font-bold text-slate-600"
              >
                关闭
              </button>
              <img
                src={resolveArtworkSrc(imageUrl)}
                alt="发送的图片大图"
                className="max-h-[75vh] w-auto rounded-2xl object-contain"
              />
            </div>
          </div>
        )}
      </>
    );
  }
  const color = companion?.meta.color || '#F59E0B';
  return (
    <div className="flex items-end gap-3" data-testid="companion-bubble" data-speaker={speakerName}>
      <CompanionAvatar companion={companion} size={52} />
      <div className="flex min-w-0 max-w-[78%] flex-col gap-1">
        <span className="pl-2 text-sm font-semibold" style={{ color }}>{speakerName}</span>
        <div
          className={`rounded-[28px] rounded-bl-lg border-2 bg-white px-5 py-3 text-slate-700 shadow-sm ${isError ? 'border-rose-200 bg-rose-50' : ''}`}
          style={{ borderColor: isError ? undefined : `${color}40` }}
        >
          {pending && !content ? (
            <span className="inline-flex gap-1 py-2" aria-label="正在想">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-3 w-3 animate-bounce rounded-full" style={{ background: color, animationDelay: `${i * 150}ms` }} />
              ))}
            </span>
          ) : (
            <Markdown content={content} fontSize={fontSize} />
          )}
        </div>
      </div>
      {onReadAloud && content && !pending && !isError && (
        <button
          type="button"
          onClick={onReadAloud}
          aria-label="再读一遍"
          className="mb-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-xl shadow-sm"
        >
          🔊
        </button>
      )}
    </div>
  );
}
