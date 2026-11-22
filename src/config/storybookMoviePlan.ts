/**
 * 绘本影院模式 & 有声动画视频合成的时间线与运镜规划。
 *
 * 保持零外部运行时依赖，便于 node 直接 transpile 单测。
 */
import type { KidStorybookRecord, StorybookPage } from './kidArt';

export type MovieLangMode = 'zh' | 'bilingual' | 'en';

export interface KenBurnsPreset {
  id: string;
  startScale: number;
  endScale: number;
  startX: number;
  endX: number;
  startY: number;
  endY: number;
}

export const KEN_BURNS_PRESETS: KenBurnsPreset[] = [
  { id: 'zoom-in', startScale: 1.0, endScale: 1.08, startX: 0, endX: 0, startY: 0, endY: -0.015 },
  { id: 'pan-right', startScale: 1.06, endScale: 1.08, startX: -0.025, endX: 0.025, startY: 0, endY: 0 },
  { id: 'pan-left', startScale: 1.08, endScale: 1.05, startX: 0.025, endX: -0.025, startY: -0.01, endY: 0.01 },
  { id: 'zoom-out', startScale: 1.09, endScale: 1.01, startX: 0.01, endX: -0.01, startY: 0.01, endY: -0.01 },
  { id: 'drift-up', startScale: 1.05, endScale: 1.09, startX: 0, endX: 0.015, startY: 0.02, endY: -0.02 },
];

export interface MovieNarrationSegment {
  text: string;
  lang: 'zh-CN' | 'en-US';
}

export interface StorybookMovieSlide {
  index: number;
  label: string;
  isCover: boolean;
  imagePath: string;
  videoPath?: string;
  primarySubtitle: string;
  secondarySubtitle?: string;
  narrationSegments: MovieNarrationSegment[];
  fallbackDurationMs: number;
  preset: KenBurnsPreset;
}

export function interpolateKenBurns(
  preset: KenBurnsPreset,
  progress: number,
): { scale: number; offsetX: number; offsetY: number } {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  // smoothstep ease-in-out
  const t = clamped * clamped * (3 - 2 * clamped);
  return {
    scale: preset.startScale + (preset.endScale - preset.startScale) * t,
    offsetX: preset.startX + (preset.endX - preset.startX) * t,
    offsetY: preset.startY + (preset.endY - preset.startY) * t,
  };
}

export function estimateNarrationDurationMs(text: string, minMs = 4200, maxMs = 12000): number {
  const clean = (text || '').trim();
  if (!clean) return minMs;
  const cjkCount = (clean.match(/[\u4e00-\u9fff]/g) || []).length;
  const latinCount = clean.length - cjkCount;
  const estimated = cjkCount * 240 + latinCount * 85 + 1200;
  return Math.min(maxMs, Math.max(minMs, Math.round(estimated)));
}

function parseRawPages(pagesJson: string): StorybookPage[] {
  try {
    const raw = JSON.parse(pagesJson);
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (p): p is StorybookPage => Boolean(p) && typeof p.storyText === 'string' && typeof p.imagePath === 'string',
    );
  } catch {
    return [];
  }
}

export function buildStorybookMovieSlides(
  book: KidStorybookRecord,
  langMode: MovieLangMode,
): StorybookMovieSlide[] {
  const coverNarration = `${book.title}。作者：${book.author || '小朋友'}和故事精灵。`;
  const slides: StorybookMovieSlide[] = [
    {
      index: 0,
      label: '封面',
      isCover: true,
      imagePath: book.coverPath,
      videoPath: book.coverVideoPath?.trim() || undefined,
      primarySubtitle: `《${book.title}》`,
      secondarySubtitle: `作者：${book.author || '小朋友'} & 故事精灵`,
      narrationSegments: [{ text: coverNarration, lang: 'zh-CN' }],
      fallbackDurationMs: Math.max(4500, estimateNarrationDurationMs(coverNarration)),
      preset: KEN_BURNS_PRESETS[0],
    },
  ];

  const pages = parseRawPages(book.pagesJson);
  for (let i = 0; i < pages.length; i += 1) {
    const page = pages[i];
    const zh = (page.storyText || '').trim();
    const en = (page.bilingualText || '').trim();
    const pageNum = Number(page.pageNumber) || i + 1;

    let primarySubtitle = zh;
    let secondarySubtitle: string | undefined;
    const narrationSegments: MovieNarrationSegment[] = [];

    if (langMode === 'en' && en) {
      primarySubtitle = en;
      narrationSegments.push({ text: en, lang: 'en-US' });
    } else if (langMode === 'bilingual' && en) {
      primarySubtitle = zh;
      secondarySubtitle = en;
      narrationSegments.push({ text: en, lang: 'en-US' });
      if (zh) narrationSegments.push({ text: zh, lang: 'zh-CN' });
    } else if (zh) {
      narrationSegments.push({ text: zh, lang: 'zh-CN' });
    }

    const combinedText = narrationSegments.map((s) => s.text).join(' ');
    slides.push({
      index: i + 1,
      label: `第 ${pageNum} 页`,
      isCover: false,
      imagePath: page.imagePath,
      videoPath: typeof page.videoPath === 'string' && page.videoPath.trim() ? page.videoPath : undefined,
      primarySubtitle,
      secondarySubtitle,
      narrationSegments,
      fallbackDurationMs: estimateNarrationDurationMs(combinedText, 4800, 14000),
      preset: KEN_BURNS_PRESETS[(i + 1) % KEN_BURNS_PRESETS.length],
    });
  }

  return slides;
}

export function pickSupportedVideoMime(isTypeSupported: (mime: string) => boolean): {
  mimeType: string;
  ext: 'mp4' | 'webm';
} {
  const candidates: Array<{ mimeType: string; ext: 'mp4' | 'webm' }> = [
    { mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', ext: 'mp4' },
    { mimeType: 'video/mp4', ext: 'mp4' },
    { mimeType: 'video/webm;codecs=vp9,opus', ext: 'webm' },
    { mimeType: 'video/webm;codecs=vp8,opus', ext: 'webm' },
    { mimeType: 'video/webm', ext: 'webm' },
  ];
  for (const item of candidates) {
    try {
      if (isTypeSupported(item.mimeType)) return item;
    } catch {
      // skip invalid mime query
    }
  }
  return { mimeType: '', ext: 'webm' };
}
