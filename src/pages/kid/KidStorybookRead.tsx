import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { countAnimatedSlides, parseBookPages, type KidStorybookRecord } from '@/config/kidArt';
import {
  animateStorybookSlide,
  animateWholeStorybook,
  exportStorybookPdf,
  exportStorybookPoster,
  generateKidImage,
  listKidStorybooks,
  resolveArtworkSrc,
  saveKidStorybook,
  translateStorybookToBilingual,
} from '@/lib/kidImage';
import { exportStorybookMovie } from '@/lib/storybookMovie';
import { moduleVoiceKey } from '@/config/speechConfig';
import { toSpeakableText } from '@/lib/speech';
import { useKid } from './KidContext';
import { StorybookCinemaModal } from './components/StorybookCinemaModal';

type BookLangMode = 'zh' | 'bilingual' | 'en';
const STORYBOOK_VOICE_SCOPE = moduleVoiceKey('storybook');

export default function KidStorybookRead() {
  const { bookId } = useParams();
  const { synthesizer } = useKid();
  const [book, setBook] = useState<KidStorybookRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageIdx, setPageIdx] = useState(0); // 0 = 封面，1..N = 内页
  const [langMode, setLangMode] = useState<BookLangMode>('zh');
  const [translating, setTranslating] = useState(false);
  const [autoPlaying, setAutoPlaying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [redrawing, setRedrawing] = useState(false);
  const [animatingSlide, setAnimatingSlide] = useState<number | null>(null);
  const [animatingWhole, setAnimatingWhole] = useState(false);
  const [animateWholeStatus, setAnimateWholeStatus] = useState('');
  const [exportingMovie, setExportingMovie] = useState(false);
  const [movieStatus, setMovieStatus] = useState('');
  const [cinemaOpen, setCinemaOpen] = useState(false);
  const [showVideoView, setShowVideoView] = useState(true);
  const [editingPage, setEditingPage] = useState(false);
  const [draftZh, setDraftZh] = useState('');
  const [draftEn, setDraftEn] = useState('');
  const [noticeMsg, setNoticeMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const playGenRef = useRef(0);
  const cancelWholeRef = useRef(false);
  const movieAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    void listKidStorybooks()
      .then((list) => setBook(list.find((b) => b.id === bookId) || null))
      .finally(() => setLoading(false));
  }, [bookId]);

  const stopPlayback = () => {
    playGenRef.current += 1;
    setAutoPlaying(false);
    synthesizer.cancel();
  };

  useEffect(() => {
    return () => {
      stopPlayback();
      cancelWholeRef.current = true;
      movieAbortRef.current?.abort();
    };
  }, []);

  const pages = book ? parseBookPages(book.pagesJson) : [];
  const hasBilingual = pages.some((p) => Boolean(p.bilingualText?.trim()));
  const totalSlides = 1 + pages.length;

  useEffect(() => {
    if (cinemaOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        stopPlayback();
        setEditingPage(false);
        setPageIdx((i) => Math.max(0, i - 1));
      } else if (e.key === 'ArrowRight') {
        stopPlayback();
        setEditingPage(false);
        setPageIdx((i) => Math.min(totalSlides - 1, i + 1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalSlides, cinemaOpen]);

  const speakSlide = async (idx: number, gen: number) => {
    if (!book || playGenRef.current !== gen) return;
    if (idx === 0) {
      const spoken = toSpeakableText(`${book.title}。作者：${book.author || '小朋友'}和故事精灵。`);
      if (spoken) await synthesizer.speak(spoken, { lang: 'zh-CN', speakerId: 'kid-story-fairy', gameId: STORYBOOK_VOICE_SCOPE });
      return;
    }
    const p = pages[idx - 1];
    if (!p) return;
    const en = p.bilingualText ? toSpeakableText(p.bilingualText) : '';
    const zh = toSpeakableText(p.storyText);

    if (langMode === 'en' && en) {
      await synthesizer.speak(en, { lang: 'en-US', speakerId: 'kid-story-fairy', gameId: STORYBOOK_VOICE_SCOPE });
    } else if (langMode === 'bilingual' && en) {
      await synthesizer.speak(en, { lang: 'en-US', speakerId: 'kid-story-fairy', gameId: STORYBOOK_VOICE_SCOPE });
      if (playGenRef.current !== gen) return;
      if (zh) await synthesizer.speak(zh, { lang: 'zh-CN', speakerId: 'kid-story-fairy', gameId: STORYBOOK_VOICE_SCOPE });
    } else if (zh) {
      await synthesizer.speak(zh, { lang: 'zh-CN', speakerId: 'kid-story-fairy', gameId: STORYBOOK_VOICE_SCOPE });
    }
  };

  const startAutoPlay = async () => {
    if (!book || !synthesizer.supported) return;
    if (autoPlaying) {
      stopPlayback();
      return;
    }
    const gen = ++playGenRef.current;
    setAutoPlaying(true);

    for (let i = pageIdx; i < totalSlides; i += 1) {
      if (playGenRef.current !== gen) return;
      setPageIdx(i);
      await speakSlide(i, gen);
      if (playGenRef.current !== gen) return;
      if (i + 1 < totalSlides) {
        await new Promise((r) => setTimeout(r, 450));
      }
    }
    if (playGenRef.current === gen) {
      setAutoPlaying(false);
    }
  };

  const handleGenerateBilingual = async () => {
    if (!book || translating) return;
    stopPlayback();
    setTranslating(true);
    setErrorMsg('');
    setNoticeMsg('');
    try {
      const updated = await translateStorybookToBilingual(book);
      setBook(updated);
      setLangMode('bilingual');
      setNoticeMsg('已生成中英双语版绘本！点击朗读可听英文与中文双语配音。');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setTranslating(false);
    }
  };

  const cycleLangMode = () => {
    stopPlayback();
    setLangMode((prev) => (prev === 'zh' ? 'bilingual' : prev === 'bilingual' ? 'en' : 'zh'));
  };

  const handleExport = async () => {
    if (!book || exporting) return;
    setExporting(true);
    setNoticeMsg('');
    setErrorMsg('');
    try {
      await exportStorybookPoster(book);
      setNoticeMsg('已导出高清绘本长图！');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '导出失败');
    } finally {
      setExporting(false);
    }
  };

  const handleExportPdf = async () => {
    if (!book || exporting) return;
    setExporting(true);
    setNoticeMsg('');
    setErrorMsg('');
    try {
      await exportStorybookPdf(book);
      setNoticeMsg('已导出 A4 可打印 PDF 绘本！');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'PDF 导出失败');
    } finally {
      setExporting(false);
    }
  };

  const handleAnimateCurrentSlide = async () => {
    if (!book || animatingSlide !== null || animatingWhole) return;
    stopPlayback();
    setAnimatingSlide(pageIdx);
    setNoticeMsg('');
    setErrorMsg('');
    try {
      const updated = await animateStorybookSlide(book, pageIdx);
      setBook(updated);
      setShowVideoView(true);
      setNoticeMsg(pageIdx === 0 ? '封面已经施展完动画魔法啦！' : `第 ${pageIdx} 页已经变成动态画面啦！`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setAnimatingSlide(null);
    }
  };

  const handleAnimateWholeBook = async () => {
    if (!book || animatingWhole || animatingSlide !== null) return;
    stopPlayback();
    cancelWholeRef.current = false;
    setAnimatingWhole(true);
    setAnimateWholeStatus('准备施展整本动画魔法…');
    setNoticeMsg('');
    setErrorMsg('');
    try {
      const updated = await animateWholeStorybook(book, {
        onProgress: ({ current, total, label }) => {
          setAnimateWholeStatus(`正在生成第 ${current}/${total} 幕（${label}）动画，每页约需 30–60 秒…`);
        },
        shouldCancel: () => cancelWholeRef.current,
        onBookUpdated: (nextBook) => setBook(nextBook),
      });
      setBook(updated);
      setShowVideoView(true);
      if (cancelWholeRef.current) {
        setNoticeMsg('已暂停整本动画制作，已生成的页面都已自动保存。');
      } else {
        setNoticeMsg('整本绘本动画已全部制作完成！点「影院播放」连看整部作品吧！');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setAnimatingWhole(false);
      setAnimateWholeStatus('');
    }
  };

  const handleExportMovie = async () => {
    if (!book || exportingMovie) return;
    stopPlayback();
    const ctrl = new AbortController();
    movieAbortRef.current = ctrl;
    setExportingMovie(true);
    setMovieStatus('准备录制绘本有声动画…');
    setNoticeMsg('');
    setErrorMsg('');
    try {
      const res = await exportStorybookMovie(book, {
        langMode,
        onProgress: setMovieStatus,
        signal: ctrl.signal,
      });
      setNoticeMsg(
        res.hasAudio
          ? `已导出带配音与字幕的完整动画视频（.${res.ext}）！`
          : `已导出完整运镜字幕动画视频（.${res.ext}）！`,
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      movieAbortRef.current = null;
      setExportingMovie(false);
      setMovieStatus('');
    }
  };

  const handleRedrawCurrentPage = async () => {
    if (!book || pageIdx <= 0 || redrawing) return;
    const target = pages[pageIdx - 1];
    if (!target) return;
    stopPlayback();
    setRedrawing(true);
    setNoticeMsg('');
    setErrorMsg('');
    try {
      const img = await generateKidImage({
        subject: target.imagePrompt || target.storyText,
        style: book.style,
        isContinuation: true,
        heroDesc: book.heroDesc,
        referenceImagePath: book.coverPath,
      });
      const updatedPages = pages.map((p) =>
        p.pageNumber === target.pageNumber ? { ...p, imagePath: img.path, videoPath: undefined } : p,
      );
      const updated: KidStorybookRecord = {
        ...book,
        pagesJson: JSON.stringify(updatedPages),
        updatedAt: Date.now(),
      };
      await saveKidStorybook(updated);
      setBook(updated);
      setNoticeMsg(`已重新绘制第 ${target.pageNumber} 页插画！`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '重画失败');
    } finally {
      setRedrawing(false);
    }
  };

  const openEditCurrentPage = () => {
    if (pageIdx <= 0) return;
    const target = pages[pageIdx - 1];
    if (!target) return;
    stopPlayback();
    setDraftZh(target.storyText);
    setDraftEn(target.bilingualText || '');
    setEditingPage(true);
    setErrorMsg('');
  };

  const saveEditedCurrentPage = async () => {
    if (!book || pageIdx <= 0) return;
    const target = pages[pageIdx - 1];
    if (!target) return;
    const cleanZh = draftZh.trim();
    if (!cleanZh) {
      setErrorMsg('故事文字不能为空哦');
      return;
    }
    const updatedPages = pages.map((p) =>
      p.pageNumber === target.pageNumber
        ? { ...p, storyText: cleanZh, bilingualText: draftEn.trim() || undefined }
        : p,
    );
    const updated: KidStorybookRecord = {
      ...book,
      pagesJson: JSON.stringify(updatedPages),
      updatedAt: Date.now(),
    };
    await saveKidStorybook(updated);
    setBook(updated);
    setEditingPage(false);
    setNoticeMsg(`已保存第 ${target.pageNumber} 页文字修改！`);
  };

  if (loading) return <p className="p-8 text-center text-lg text-slate-500">正在打开绘本……</p>;
  if (!book) return <Navigate to="/books" replace />;

  const currentPage = pageIdx > 0 ? pages[pageIdx - 1] : null;
  const currentVideoPath = pageIdx === 0 ? book.coverVideoPath || undefined : currentPage?.videoPath;
  const animCounts = countAnimatedSlides(book);
  const allSlidesAnimated = animCounts.animated >= animCounts.total;
  const langLabel = langMode === 'zh' ? '🌐 中文' : langMode === 'bilingual' ? '🌐 中英双语' : '🌐 纯英文';

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 pb-6 pt-1" data-testid="storybook-reader">
      {/* 顶部栏：标题 + 核心播放/创作/导出动作 */}
      <div className="mx-auto mb-3 w-full max-w-5xl space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/books" aria-label="返回书架" className="flex h-12 items-center gap-1 rounded-2xl bg-white px-4 text-base font-bold text-slate-700 shadow-sm">
            ← 书架
          </Link>
          <div className="min-w-0 flex-1 truncate px-2 text-xl font-extrabold text-slate-800">
            《{book.title}》
          </div>
          {animCounts.animated > 0 && (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-700">
              🎬 AI动画 {animCounts.animated}/{animCounts.total}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="open-cinema-btn"
            onClick={() => {
              stopPlayback();
              setCinemaOpen(true);
            }}
            className="flex h-12 items-center gap-1.5 whitespace-nowrap rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 px-4 text-sm font-extrabold text-white shadow-sm"
          >
            🍿 影院播放
          </button>
          {!allSlidesAnimated && (
            <button
              type="button"
              data-testid="animate-all-book-btn"
              disabled={animatingWhole || animatingSlide !== null}
              onClick={() => void handleAnimateWholeBook()}
              className="flex h-12 items-center gap-1.5 whitespace-nowrap rounded-2xl bg-emerald-500 px-4 text-sm font-bold text-white shadow-sm disabled:opacity-50"
            >
              {animatingWhole ? '🎬 制作整本中…' : `✨ 整本动画 (${animCounts.animated}/${animCounts.total})`}
            </button>
          )}
          <button
            type="button"
            data-testid="export-movie-btn"
            disabled={exportingMovie || exporting}
            onClick={() => void handleExportMovie()}
            className="flex h-12 items-center gap-1.5 whitespace-nowrap rounded-2xl bg-purple-500 px-4 text-sm font-bold text-white shadow-sm disabled:opacity-50"
          >
            {exportingMovie ? '🎥 录制中…' : '🎥 导出动画视频'}
          </button>
          {hasBilingual ? (
            <button
              type="button"
              data-testid="toggle-bilingual-mode"
              onClick={cycleLangMode}
              className="flex h-12 items-center gap-1.5 whitespace-nowrap rounded-2xl bg-violet-100 px-3.5 text-sm font-bold text-violet-700 shadow-sm"
            >
              {langLabel}
            </button>
          ) : (
            <button
              type="button"
              data-testid="generate-bilingual-btn"
              disabled={translating}
              onClick={() => void handleGenerateBilingual()}
              className="flex h-12 items-center gap-1.5 whitespace-nowrap rounded-2xl bg-violet-500 px-3.5 text-sm font-bold text-white shadow-sm disabled:opacity-50"
            >
              {translating ? '🌐 翻译中…' : '🌐 生成英文双语版'}
            </button>
          )}
          {synthesizer.supported && (
            <button
              type="button"
              onClick={() => void startAutoPlay()}
              className={`flex h-12 items-center gap-1.5 whitespace-nowrap rounded-2xl px-3.5 text-sm font-bold shadow-sm ${
                autoPlaying ? 'bg-rose-400 text-white' : 'bg-sky-500 text-white'
              }`}
            >
              {autoPlaying ? '⏹️ 停止朗读' : '🔊 朗读'}
            </button>
          )}
          <button
            type="button"
            disabled={exporting}
            onClick={() => void handleExport()}
            className="flex h-12 items-center gap-1.5 whitespace-nowrap rounded-2xl bg-white px-3.5 text-sm font-bold text-amber-700 shadow-sm disabled:opacity-50"
          >
            {exporting ? '导出中…' : '📤 长图'}
          </button>
          <button
            type="button"
            data-testid="export-pdf-btn"
            disabled={exporting}
            onClick={() => void handleExportPdf()}
            className="flex h-12 items-center gap-1.5 whitespace-nowrap rounded-2xl bg-white px-3.5 text-sm font-bold text-emerald-700 shadow-sm disabled:opacity-50"
          >
            {exporting ? '生成中…' : '🖨️ PDF'}
          </button>
        </div>
      </div>

      {/* 进行中进度条（整本 AI 动画 / 视频录制导出） */}
      {(animatingWhole || exportingMovie) && (
        <div className="mx-auto mb-2 flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-800">
          <span>⏳ {animatingWhole ? animateWholeStatus : movieStatus}</span>
          <button
            type="button"
            onClick={() => {
              if (animatingWhole) cancelWholeRef.current = true;
              if (exportingMovie) movieAbortRef.current?.abort();
            }}
            className="flex h-12 items-center rounded-xl bg-white px-4 text-xs font-bold text-rose-600 shadow-sm"
          >
            停止
          </button>
        </div>
      )}

      {noticeMsg && (
        <div className="mx-auto mb-2 w-full max-w-5xl rounded-2xl bg-emerald-50 px-4 py-2 text-center text-sm font-bold text-emerald-700">
          {noticeMsg}
        </div>
      )}
      {errorMsg && (
        <div className="mx-auto mb-2 w-full max-w-5xl rounded-2xl bg-rose-50 px-4 py-2 text-center text-sm font-bold text-rose-600">
          {errorMsg}
        </div>
      )}

      {/* 书页卡片 */}
      <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col items-center justify-center rounded-[36px] bg-white p-6 shadow-lg">
        {pageIdx === 0 ? (
          <div className="flex w-full flex-col items-center gap-4 text-center">
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              <span className="rounded-full bg-amber-100 px-4 py-1 text-sm font-extrabold text-amber-700">
                封面
              </span>
              <div className="flex flex-wrap gap-2">
                {currentVideoPath ? (
                  <button
                    type="button"
                    onClick={() => setShowVideoView((v) => !v)}
                    className="flex h-12 items-center gap-1.5 rounded-2xl bg-emerald-500 px-4 text-sm font-bold text-white shadow-sm"
                  >
                    {showVideoView ? '🖼️ 看封面图' : '🎬 播放封面动画'}
                  </button>
                ) : (
                  <button
                    type="button"
                    data-testid="animate-slide-btn"
                    disabled={animatingSlide !== null || animatingWhole}
                    onClick={() => void handleAnimateCurrentSlide()}
                    className="flex h-12 items-center gap-1.5 rounded-2xl bg-emerald-500 px-4 text-sm font-bold text-white shadow-sm disabled:opacity-50"
                  >
                    {animatingSlide === 0 ? '🎬 动画生成中…' : '🎬 让封面动起来'}
                  </button>
                )}
              </div>
            </div>
            {currentVideoPath && showVideoView ? (
              <video
                key={currentVideoPath}
                src={resolveArtworkSrc(currentVideoPath)}
                controls
                autoPlay
                loop
                playsInline
                className="max-h-[42vh] w-auto rounded-3xl shadow-md"
              />
            ) : (
              book.coverPath && (
                <img
                  src={resolveArtworkSrc(book.coverPath)}
                  alt={book.title}
                  className="max-h-[42vh] w-auto rounded-3xl object-contain shadow-md"
                />
              )
            )}
            <h1 className="text-3xl font-extrabold text-slate-800">《{book.title}》</h1>
            <div className="text-lg font-bold text-amber-600">作者：{book.author || '小朋友'} & 故事精灵</div>
          </div>
        ) : currentPage ? (
          <div className="flex w-full flex-col items-center gap-4 text-center">
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              <span className="rounded-full bg-sky-100 px-4 py-1 text-sm font-extrabold text-sky-700">
                第 {currentPage.pageNumber} 页 / 共 {pages.length} 页
              </span>
              <div className="flex flex-wrap gap-2">
                {currentVideoPath ? (
                  <button
                    type="button"
                    onClick={() => setShowVideoView((v) => !v)}
                    className="flex h-12 items-center gap-1.5 rounded-2xl bg-emerald-500 px-4 text-sm font-bold text-white shadow-sm"
                  >
                    {showVideoView ? '🖼️ 看插画' : '🎬 播放动画'}
                  </button>
                ) : (
                  <button
                    type="button"
                    data-testid="animate-slide-btn"
                    disabled={animatingSlide !== null || animatingWhole || redrawing}
                    onClick={() => void handleAnimateCurrentSlide()}
                    className="flex h-12 items-center gap-1.5 rounded-2xl bg-emerald-500 px-4 text-sm font-bold text-white shadow-sm disabled:opacity-50"
                  >
                    {animatingSlide === pageIdx ? '🎬 动画生成中…' : '🎬 让这页动起来'}
                  </button>
                )}
                <button
                  type="button"
                  data-testid="reader-redraw-page"
                  disabled={redrawing || animatingSlide !== null}
                  onClick={() => void handleRedrawCurrentPage()}
                  className="flex h-12 items-center gap-1.5 rounded-2xl bg-amber-100 px-4 text-sm font-bold text-amber-800 disabled:opacity-50"
                >
                  {redrawing ? '🎨 重画中…' : '🎨 重画这页'}
                </button>
                <button
                  type="button"
                  data-testid="reader-edit-page"
                  disabled={redrawing}
                  onClick={openEditCurrentPage}
                  className="flex h-12 items-center gap-1.5 rounded-2xl bg-slate-100 px-4 text-sm font-bold text-slate-700 disabled:opacity-50"
                >
                  ✏️ 改文字
                </button>
              </div>
            </div>
            {currentVideoPath && showVideoView ? (
              <video
                key={currentVideoPath}
                src={resolveArtworkSrc(currentVideoPath)}
                controls
                autoPlay
                loop
                playsInline
                className="max-h-[40vh] w-auto rounded-3xl shadow-md"
              />
            ) : (
              <img
                src={resolveArtworkSrc(currentPage.imagePath)}
                alt={`第 ${currentPage.pageNumber} 页`}
                className="max-h-[40vh] w-auto rounded-3xl object-contain shadow-md"
              />
            )}
            {editingPage ? (
              <div className="w-full max-w-2xl space-y-2.5 text-left" data-testid="reader-page-editor">
                <textarea
                  value={draftZh}
                  onChange={(e) => setDraftZh(e.target.value)}
                  rows={3}
                  placeholder="修改这一页的中文故事…"
                  className="w-full rounded-2xl border-2 border-amber-300 bg-white px-4 py-2.5 text-lg text-slate-700 outline-none focus:border-amber-400"
                />
                {(hasBilingual || draftEn) && (
                  <textarea
                    value={draftEn}
                    onChange={(e) => setDraftEn(e.target.value)}
                    rows={2}
                    placeholder="可选：修改这一页的英文句子…"
                    className="w-full rounded-2xl border-2 border-sky-200 bg-white px-4 py-2 text-base text-slate-700 outline-none focus:border-sky-400"
                  />
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingPage(false)}
                    className="flex h-12 items-center rounded-2xl bg-slate-100 px-5 text-base font-bold text-slate-600"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    data-testid="reader-save-page"
                    onClick={() => void saveEditedCurrentPage()}
                    className="flex h-12 items-center gap-1.5 rounded-2xl bg-amber-400 px-5 text-base font-bold text-white shadow-sm"
                  >
                    💾 保存修改
                  </button>
                </div>
              </div>
            ) : (
              <div className="max-w-2xl space-y-2.5">
                {(langMode === 'zh' || langMode === 'bilingual' || !currentPage.bilingualText) && (
                  <p className="text-2xl font-medium leading-relaxed text-slate-800">
                    {currentPage.storyText}
                  </p>
                )}
                {(langMode === 'en' || langMode === 'bilingual') && currentPage.bilingualText && (
                  <p
                    data-testid="bilingual-page-text"
                    className={`rounded-2xl bg-sky-50/80 px-4 py-2 font-semibold leading-relaxed text-sky-800 ${
                      langMode === 'en' ? 'text-2xl' : 'text-lg'
                    }`}
                  >
                    {currentPage.bilingualText}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* 底部翻页控制 */}
      <div className="mx-auto mt-4 flex w-full max-w-4xl items-center justify-between gap-4">
        <button
          type="button"
          disabled={pageIdx <= 0}
          onClick={() => {
            stopPlayback();
            setEditingPage(false);
            setPageIdx((i) => Math.max(0, i - 1));
          }}
          className="flex h-14 items-center gap-2 rounded-2xl bg-white px-6 text-lg font-extrabold text-slate-700 shadow-sm disabled:opacity-40"
        >
          ← 上一页
        </button>
        <div className="text-base font-bold text-slate-500">
          {pageIdx === 0 ? '封面' : `第 ${pageIdx} 页`} · {pageIdx + 1} / {totalSlides}
        </div>
        <button
          type="button"
          disabled={pageIdx >= totalSlides - 1}
          onClick={() => {
            stopPlayback();
            setEditingPage(false);
            setPageIdx((i) => Math.min(totalSlides - 1, i + 1));
          }}
          className="flex h-14 items-center gap-2 rounded-2xl bg-amber-400 px-6 text-lg font-extrabold text-white shadow-sm disabled:opacity-40"
        >
          下一页 →
        </button>
      </div>

      {cinemaOpen && (
        <StorybookCinemaModal
          book={book}
          langMode={langMode}
          synthesizer={synthesizer}
          initialSlideIdx={pageIdx}
          onClose={() => setCinemaOpen(false)}
        />
      )}
    </div>
  );
}
