import { useEffect, useMemo, useRef, useState } from 'react';
import type { KidStorybookRecord } from '@/config/kidArt';
import { moduleVoiceKey } from '@/config/speechConfig';
import { buildStorybookMovieSlides, type MovieLangMode } from '@/config/storybookMoviePlan';
import { resolveArtworkSrc } from '@/lib/kidImage';
import { toSpeakableText, type SpeechSynthesizer } from '@/lib/speech';

const STORYBOOK_VOICE_SCOPE = moduleVoiceKey('storybook');

interface StorybookCinemaModalProps {
  book: KidStorybookRecord;
  langMode: MovieLangMode;
  synthesizer: SpeechSynthesizer;
  initialSlideIdx?: number;
  onClose: () => void;
}

export function StorybookCinemaModal({
  book,
  langMode,
  synthesizer,
  initialSlideIdx = 0,
  onClose,
}: StorybookCinemaModalProps) {
  const slides = useMemo(() => buildStorybookMovieSlides(book, langMode), [book, langMode]);
  const [slideIdx, setSlideIdx] = useState(() => Math.min(slides.length - 1, Math.max(0, initialSlideIdx)));
  const [playing, setPlaying] = useState(true);
  const [narrationOn, setNarrationOn] = useState(synthesizer.supported);
  const [motionGo, setMotionGo] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const genRef = useRef(0);

  const slide = slides[slideIdx] || slides[0];

  // 触发 Ken Burns 平滑运镜过渡
  useEffect(() => {
    setMotionGo(false);
    const raf = requestAnimationFrame(() => setMotionGo(true));
    return () => cancelAnimationFrame(raf);
  }, [slideIdx, playing]);

  // 同步控制内嵌 AI 视频播放与暂停
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (playing) {
      void vid.play().catch(() => undefined);
    } else {
      vid.pause();
    }
  }, [playing, slideIdx]);

  // 主连播引擎：逐页朗读 + 自动翻页
  useEffect(() => {
    const gen = ++genRef.current;
    if (!playing || !slide) {
      synthesizer.cancel();
      return () => {
        genRef.current += 1;
      };
    }

    const runSlide = async () => {
      if (narrationOn && synthesizer.supported && slide.narrationSegments.length > 0) {
        for (const seg of slide.narrationSegments) {
          if (genRef.current !== gen) return;
          const spoken = toSpeakableText(seg.text);
          if (spoken) {
            await synthesizer.speak(spoken, {
              lang: seg.lang,
              speakerId: 'kid-story-fairy',
              gameId: STORYBOOK_VOICE_SCOPE,
            });
          }
        }
        if (genRef.current !== gen) return;
        await new Promise((r) => setTimeout(r, 600));
      } else {
        await new Promise((r) => setTimeout(r, slide.fallbackDurationMs));
      }

      if (genRef.current !== gen) return;
      if (slideIdx + 1 < slides.length) {
        setSlideIdx((i) => i + 1);
      } else {
        setPlaying(false);
      }
    };

    void runSlide();
    return () => {
      genRef.current += 1;
      synthesizer.cancel();
    };
  }, [slideIdx, playing, narrationOn, slide, slides.length, synthesizer]);

  // 键盘快捷键：Esc 关闭，左右翻页，空格暂停/继续
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        setSlideIdx((i) => Math.max(0, i - 1));
      } else if (e.key === 'ArrowRight') {
        setSlideIdx((i) => Math.min(slides.length - 1, i + 1));
      } else if (e.code === 'Space') {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, slides.length]);

  const kb = slide.preset;
  const kbTransform = motionGo
    ? `translate3d(${kb.endX * 100}%, ${kb.endY * 100}%, 0) scale(${kb.endScale})`
    : `translate3d(${kb.startX * 100}%, ${kb.startY * 100}%, 0) scale(${kb.startScale})`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="storybook-cinema-modal"
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 p-4 text-white sm:p-6"
    >
      {/* 顶部影院条 */}
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 pb-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="rounded-full bg-amber-400/20 px-3.5 py-1 text-sm font-extrabold text-amber-300">
            🍿 绘本小影院
          </span>
          <h2 className="truncate text-lg font-extrabold sm:text-2xl">《{book.title}》</h2>
          <span className="shrink-0 text-sm font-bold text-slate-300">
            {slide.label} · {slideIdx + 1} / {slides.length}
          </span>
        </div>
        <button
          type="button"
          data-testid="cinema-close-btn"
          onClick={onClose}
          className="flex h-12 shrink-0 items-center gap-1.5 rounded-2xl bg-white/15 px-5 text-base font-bold text-white hover:bg-white/25"
        >
          ✕ 退出影院
        </button>
      </div>

      {/* 主银幕 */}
      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col items-center justify-center gap-4">
        <div className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden rounded-[32px] border-2 border-amber-300/30 bg-slate-900 shadow-2xl">
          {slide.videoPath ? (
            <video
              key={slide.videoPath}
              ref={videoRef}
              src={resolveArtworkSrc(slide.videoPath)}
              autoPlay={playing}
              loop
              muted
              playsInline
              className="h-full w-full object-contain"
            />
          ) : slide.imagePath ? (
            <img
              key={`${slide.index}-${slide.imagePath}`}
              src={resolveArtworkSrc(slide.imagePath)}
              alt={slide.label}
              className="h-full w-full object-contain transition-transform ease-in-out"
              style={{
                transform: kbTransform,
                transitionDuration: playing ? `${Math.max(4500, slide.fallbackDurationMs)}ms` : '300ms',
              }}
            />
          ) : (
            <div className="text-6xl">📖</div>
          )}

          {slide.videoPath && (
            <span className="absolute right-4 top-4 rounded-full bg-emerald-500/90 px-3 py-1 text-xs font-extrabold text-white shadow">
              🎬 AI 动态画面
            </span>
          )}
        </div>

        {/* 字幕条 */}
        <div className="w-full rounded-3xl bg-white/10 px-6 py-4 text-center backdrop-blur">
          <p className="text-xl font-bold leading-relaxed text-white sm:text-2xl">{slide.primarySubtitle}</p>
          {slide.secondarySubtitle && (
            <p className="mt-1 text-base font-semibold text-sky-300 sm:text-lg">{slide.secondarySubtitle}</p>
          )}
        </div>

        {/* 分镜进度条 */}
        <div className="flex w-full max-w-xl items-center gap-2">
          {slides.map((item, idx) => (
            <button
              key={item.index}
              type="button"
              aria-label={`跳到${item.label}`}
              onClick={() => {
                setSlideIdx(idx);
                setPlaying(true);
              }}
              className={`flex h-12 flex-1 items-center justify-center gap-1 rounded-2xl text-xs font-bold transition ${
                idx === slideIdx
                  ? 'bg-amber-400 text-slate-950 shadow'
                  : idx < slideIdx
                    ? 'bg-white/25 text-white'
                    : 'bg-white/10 text-slate-300'
              }`}
            >
              <span>{item.videoPath ? '🎬' : '🖼️'}</span>
              <span>{item.isCover ? '封面' : `${item.index}`}</span>
            </button>
          ))}
        </div>

        {/* 播放控制栏 */}
        <div className="flex flex-wrap items-center justify-center gap-3 pb-1">
          <button
            type="button"
            disabled={slideIdx <= 0}
            onClick={() => setSlideIdx((i) => Math.max(0, i - 1))}
            className="flex h-12 items-center rounded-2xl bg-white/15 px-5 text-base font-bold text-white disabled:opacity-35"
          >
            ← 上一幕
          </button>
          <button
            type="button"
            data-testid="cinema-play-pause-btn"
            onClick={() => {
              if (!playing && slideIdx >= slides.length - 1) {
                setSlideIdx(0);
                setPlaying(true);
              } else {
                setPlaying((p) => !p);
              }
            }}
            className="flex h-14 min-w-40 items-center justify-center gap-2 rounded-2xl bg-amber-400 px-6 text-lg font-extrabold text-slate-950 shadow-lg"
          >
            {playing ? '⏸️ 暂停' : slideIdx >= slides.length - 1 ? '🔁 从头再看' : '▶️ 继续播放'}
          </button>
          <button
            type="button"
            disabled={slideIdx >= slides.length - 1}
            onClick={() => setSlideIdx((i) => Math.min(slides.length - 1, i + 1))}
            className="flex h-12 items-center rounded-2xl bg-white/15 px-5 text-base font-bold text-white disabled:opacity-35"
          >
            下一幕 →
          </button>
          {synthesizer.supported && (
            <button
              type="button"
              onClick={() => {
                if (narrationOn) synthesizer.cancel();
                setNarrationOn((v) => !v);
              }}
              className={`flex h-12 items-center gap-1.5 rounded-2xl px-4 text-sm font-bold ${
                narrationOn ? 'bg-sky-500 text-white' : 'bg-white/15 text-slate-300'
              }`}
            >
              {narrationOn ? '🔊 旁白开' : '🔇 旁白关'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
