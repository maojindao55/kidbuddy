import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  DEFAULT_ART_STYLE,
  KID_ART_STYLES,
  STORYBOOK_THEMES,
  STORYBOOK_TOTAL_PAGES,
  type ArtStyleId,
  type KidArtworkRecord,
  type KidStorybookRecord,
  type StorybookPage,
} from '@/config/kidArt';
import {
  generateKidImage,
  listKidArtworks,
  planStorybookCover,
  planStorybookPage,
  resolveArtworkSrc,
  saveKidStorybook,
} from '@/lib/kidImage';
import { moduleVoiceKey } from '@/config/speechConfig';
import { useKid } from './KidContext';
import { KidInputBar } from './components/KidInputBar';
import { useReadAloud } from './hooks/useReadAloud';

const STORYBOOK_VOICE_SCOPE = moduleVoiceKey('storybook');

export default function KidStorybookCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialArtwork = (location.state as { fromArtwork?: KidArtworkRecord } | null)?.fromArtwork || null;
  const { memory, voice } = useKid();
  const readAloud = useReadAloud();
  const authorName = memory.nickname || '小作家';

  // 阶段 1：设定主角与封面
  const [phase, setPhase] = useState<'setup' | 'pages'>('setup');
  const [selectedCoverArtwork, setSelectedCoverArtwork] = useState<KidArtworkRecord | null>(initialArtwork);
  const [artworks, setArtworks] = useState<KidArtworkRecord[]>([]);
  const [heroName, setHeroName] = useState(() =>
    initialArtwork ? initialArtwork.title.slice(0, 12) : STORYBOOK_THEMES[0].heroName,
  );
  const [idea, setIdea] = useState(() => (initialArtwork ? initialArtwork.title : STORYBOOK_THEMES[0].idea));
  const [style, setStyle] = useState<ArtStyleId>(() =>
    initialArtwork && KID_ART_STYLES.some((s) => s.id === initialArtwork.style)
      ? (initialArtwork.style as ArtStyleId)
      : DEFAULT_ART_STYLE,
  );

  useEffect(() => {
    void listKidArtworks().then(setArtworks);
  }, []);

  // 绘本运行时状态
  const [bookId] = useState(() => `book-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  const [createdAt] = useState(() => Date.now());
  const [title, setTitle] = useState('');
  const [heroDesc, setHeroDesc] = useState('');
  const [coverPath, setCoverPath] = useState('');
  const [pages, setPages] = useState<StorybookPage[]>([]);
  const [fairyPrompt, setFairyPrompt] = useState('');
  const [choices, setChoices] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [busyMessage, setBusyMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const persistBook = async (nextPages: StorybookPage[], status: 'draft' | 'completed', nextTitle = title, nextHeroDesc = heroDesc, nextCover = coverPath) => {
    const record: KidStorybookRecord = {
      id: bookId,
      title: nextTitle || `${heroName || '小主角'}的故事`,
      author: authorName,
      style,
      heroName: heroName.trim() || '小主角',
      heroDesc: nextHeroDesc,
      coverPath: nextCover,
      pagesJson: JSON.stringify(nextPages),
      status,
      createdAt,
      updatedAt: Date.now(),
    };
    await saveKidStorybook(record);
  };

  const handleStartCover = async () => {
    if (!idea.trim() || busy) return;
    setBusy(true);
    setErrorMsg('');
    setBusyMessage('故事精灵正在构思书名和主角形象……');
    try {
      const plan = await planStorybookCover({
        idea: idea.trim(),
        heroName: heroName.trim() || '小主角',
        style,
      });
      setTitle(plan.title);
      setHeroDesc(plan.heroDesc);

      let chosenCoverPath = selectedCoverArtwork?.imagePath || '';
      if (!chosenCoverPath) {
        setBusyMessage(`正在画《${plan.title}》的封面与主角定妆照……`);
        const img = await generateKidImage({
          subject: plan.coverImagePrompt,
          style,
        });
        chosenCoverPath = img.path;
      }

      setCoverPath(chosenCoverPath);
      setFairyPrompt(plan.firstQuestion);
      setChoices(plan.choices);
      await persistBook([], 'draft', plan.title, plan.heroDesc, chosenCoverPath);
      setPhase('pages');
      if (voice.autoReadAloud) {
        readAloud.speakNow(plan.firstQuestion, 'kid-story-fairy', STORYBOOK_VOICE_SCOPE);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      setBusyMessage('');
    }
  };

  const handleCreateNextPage = async (kidIdea: string) => {
    const trimmed = kidIdea.trim();
    if (!trimmed || busy || pages.length >= STORYBOOK_TOTAL_PAGES) return;
    readAloud.cancel();
    setBusy(true);
    setErrorMsg('');
    const nextNum = pages.length + 1;
    setBusyMessage(`故事精灵正在把你的想法写进第 ${nextNum} 页……`);

    try {
      const plan = await planStorybookPage({
        title,
        heroName,
        heroDesc,
        pageNumber: nextNum,
        priorPages: pages.map((p) => ({ pageNumber: p.pageNumber, storyText: p.storyText })),
        kidIdea: trimmed,
      });

      setBusyMessage(`正在为第 ${nextNum} 页绘制插画（保持主角形象一致）……`);
      const img = await generateKidImage({
        subject: plan.imagePrompt,
        style,
        isContinuation: true,
        heroDesc,
        referenceImagePath: coverPath,
      });

      const newPage: StorybookPage = {
        pageNumber: nextNum,
        storyText: plan.storyText,
        imagePrompt: plan.imagePrompt,
        imagePath: img.path,
      };
      const updated = [...pages, newPage];
      setPages(updated);
      setFairyPrompt(plan.nextPrompt);
      setChoices(nextNum >= STORYBOOK_TOTAL_PAGES ? [] : plan.choices);

      const status = updated.length >= STORYBOOK_TOTAL_PAGES ? 'completed' : 'draft';
      await persistBook(updated, status);

      if (voice.autoReadAloud) {
        readAloud.speakNow(`${plan.storyText}。${plan.nextPrompt}`, 'kid-story-fairy', STORYBOOK_VOICE_SCOPE);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      setBusyMessage('');
    }
  };

  const handleRedrawLastPage = async () => {
    if (busy || pages.length === 0) return;
    const target = pages[pages.length - 1];
    setBusy(true);
    setErrorMsg('');
    setBusyMessage(`正在重画第 ${target.pageNumber} 页插画……`);
    try {
      const img = await generateKidImage({
        subject: target.imagePrompt || target.storyText,
        style,
        isContinuation: true,
        heroDesc,
        referenceImagePath: coverPath,
      });
      const updated = pages.map((p, i) => (i === pages.length - 1 ? { ...p, imagePath: img.path } : p));
      setPages(updated);
      await persistBook(updated, updated.length >= STORYBOOK_TOTAL_PAGES ? 'completed' : 'draft');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      setBusyMessage('');
    }
  };

  const handleFinishBook = async () => {
    await persistBook(pages, 'completed');
    navigate(`/books/${bookId}`);
  };

  if (phase === 'setup') {
    return (
      <div className="flex-1 overflow-y-auto px-5 pb-8 pt-2" data-testid="storybook-setup">
        <div className="mx-auto max-w-4xl space-y-5">
          <div className="flex items-center gap-3">
            <Link to="/books" aria-label="返回书架" className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl shadow-sm">
              ←
            </Link>
            <div>
              <h1 className="text-3xl font-extrabold text-slate-800">✨ 一起编一本新绘本</h1>
              <p className="text-base text-slate-500">先定好主角和画风，生成专属封面就可以开始编故事啦</p>
            </div>
          </div>

          <div className="rounded-[32px] bg-white p-6 shadow-md space-y-5">
            {selectedCoverArtwork && (
              <div
                data-testid="selected-artwork-cover-banner"
                className="flex flex-wrap items-center gap-4 rounded-2xl border-2 border-purple-200 bg-purple-50/70 p-3.5"
              >
                <img
                  src={resolveArtworkSrc(selectedCoverArtwork.imagePath)}
                  alt={selectedCoverArtwork.title}
                  className="h-16 w-16 rounded-xl bg-white object-cover shadow-sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-extrabold text-purple-800">
                    🎨 已选用魔法画廊作品作为绘本主角封面：《{selectedCoverArtwork.title}》
                  </div>
                  <div className="text-xs text-purple-600">接下来的 4 页插画会参考这幅作品的主角样子来画哦！</div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCoverArtwork(null)}
                  className="flex h-12 shrink-0 items-center rounded-2xl bg-white px-4 text-sm font-bold text-slate-600 shadow-sm"
                >
                  ✕ 改用新封面
                </button>
              </div>
            )}

            {artworks.length > 0 && (
              <div>
                <div className="mb-2 text-sm font-bold text-slate-500">🎨 或者从你的魔法画廊挑一幅作品直接当主角封面：</div>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {artworks.slice(0, 8).map((art) => {
                    const picked = selectedCoverArtwork?.id === art.id;
                    return (
                      <button
                        key={art.id}
                        type="button"
                        onClick={() => {
                          setSelectedCoverArtwork(picked ? null : art);
                          if (!picked) {
                            setHeroName(art.title.slice(0, 12));
                            setIdea(art.title);
                            if (KID_ART_STYLES.some((s) => s.id === art.style)) {
                              setStyle(art.style as ArtStyleId);
                            }
                          }
                        }}
                        className={`flex h-28 w-28 shrink-0 flex-col overflow-hidden rounded-2xl border-2 text-left transition ${
                          picked ? 'border-purple-500 bg-purple-50 shadow-sm' : 'border-slate-200 bg-white'
                        }`}
                      >
                        <img
                          src={resolveArtworkSrc(art.imagePath)}
                          alt={art.title}
                          className="h-20 w-full object-cover"
                        />
                        <span className="w-full truncate px-2 py-1 text-[11px] font-bold text-slate-700">{art.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <div className="mb-2.5 text-lg font-extrabold text-slate-800">1. 选一个故事灵感（或者自己写）</div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {STORYBOOK_THEMES.map((t) => {
                  const selected = idea === t.idea;
                  return (
                    <button
                      key={t.title}
                      type="button"
                      onClick={() => {
                        setHeroName(t.heroName);
                        setIdea(t.idea);
                      }}
                      className={`flex min-h-16 flex-col items-start gap-1 rounded-2xl border-2 p-3.5 text-left transition ${
                        selected ? 'border-amber-400 bg-amber-50' : 'border-slate-100 bg-slate-50/70'
                      }`}
                    >
                      <span className="text-lg font-extrabold text-slate-800">{t.emoji} {t.title}</span>
                      <span className="line-clamp-2 text-xs text-slate-500">{t.idea}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-base font-bold text-slate-700" htmlFor="hero-name-input">
                  2. 主角叫什么名字？
                </label>
                <input
                  id="hero-name-input"
                  type="text"
                  maxLength={16}
                  value={heroName}
                  onChange={(e) => setHeroName(e.target.value)}
                  placeholder="例如：小柴犬波波"
                  className="h-12 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-base text-slate-700 outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-base font-bold text-slate-700" htmlFor="hero-idea-input">
                  3. 故事想讲什么？
                </label>
                <input
                  id="hero-idea-input"
                  type="text"
                  maxLength={120}
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  placeholder="一句话说出你的故事想法"
                  className="h-12 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-base text-slate-700 outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div>
              <div className="mb-2 text-base font-bold text-slate-700">4. 挑一个绘本画风</div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {KID_ART_STYLES.map((item) => {
                  const active = style === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setStyle(item.id)}
                      className={`flex h-14 items-center justify-center gap-2 rounded-2xl border-2 px-3 text-base font-bold transition ${
                        active ? 'bg-white text-slate-800 shadow-sm' : 'border-transparent bg-slate-100 text-slate-600'
                      }`}
                      style={{ borderColor: active ? item.accent : undefined, backgroundColor: active ? item.bg : undefined }}
                    >
                      <span aria-hidden>{item.emoji}</span>
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {errorMsg && (
              <div className="rounded-2xl border-2 border-rose-200 bg-rose-50 px-4 py-3 text-base text-rose-600">
                {errorMsg}
              </div>
            )}

            <button
              type="button"
              data-testid="generate-cover-btn"
              disabled={busy || !idea.trim()}
              onClick={() => void handleStartCover()}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 text-xl font-extrabold text-white shadow-md transition active:scale-[0.99] disabled:opacity-50"
            >
              {busy
                ? `🧚 ${busyMessage}`
                : selectedCoverArtwork
                  ? '✨ 使用这幅画当封面，开始编绘本！'
                  : '✨ 生成主角封面，开始编绘本！'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 阶段 2：左图右聊共创 4 页
  const currentPage = pages[pages.length - 1];
  const finished = pages.length >= STORYBOOK_TOTAL_PAGES;

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="storybook-workshop">
      {/* 顶栏进度 */}
      <div className="flex shrink-0 items-center gap-3 px-4 pb-2">
        <Link to="/books" aria-label="返回书架" className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-xl shadow-sm">
          ←
        </Link>
        {coverPath && (
          <img src={resolveArtworkSrc(coverPath)} alt={title} className="h-12 w-12 rounded-xl object-cover shadow-sm" />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-xl font-extrabold text-slate-800">《{title}》</div>
          <div className="text-sm text-slate-500">
            主角：{heroName} · 进度 {pages.length} / {STORYBOOK_TOTAL_PAGES} 页
          </div>
        </div>
        <div className="flex gap-1.5">
          {Array.from({ length: STORYBOOK_TOTAL_PAGES }, (_, idx) => (
            <span
              key={idx}
              className={`h-3 w-8 rounded-full ${idx < pages.length ? 'bg-amber-400' : 'bg-white/80'}`}
            />
          ))}
        </div>
      </div>

      {/* 主体：左画布右共创 */}
      <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-4 pb-3 lg:grid-cols-[1.15fr_1fr]">
        {/* 左侧画布 */}
        <div className="flex flex-col gap-3 rounded-[32px] bg-white p-5 shadow-md">
          {busy ? (
            <div className="flex min-h-72 flex-1 flex-col items-center justify-center gap-3 rounded-2xl bg-amber-50/70 p-6 text-center">
              <div className="text-5xl animate-bounce" aria-hidden>🧚🎨</div>
              <div className="text-xl font-extrabold text-slate-700">{busyMessage || '正在创作中…'}</div>
            </div>
          ) : currentPage ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-extrabold text-amber-700">
                  第 {currentPage.pageNumber} 页
                </span>
                <div className="flex gap-2">
                  {readAloud.supported && (
                    <button
                      type="button"
                      onClick={() => readAloud.speakNow(currentPage.storyText, 'kid-story-fairy', STORYBOOK_VOICE_SCOPE)}
                      className="flex h-12 items-center gap-1.5 rounded-2xl bg-sky-50 px-4 text-sm font-bold text-sky-600"
                    >
                      🔊 读这一页
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleRedrawLastPage()}
                    className="flex h-12 items-center gap-1.5 rounded-2xl bg-slate-100 px-4 text-sm font-bold text-slate-600"
                  >
                    🎨 重画这一页
                  </button>
                </div>
              </div>
              <div className="overflow-hidden rounded-2xl bg-amber-50/40">
                <img
                  src={resolveArtworkSrc(currentPage.imagePath)}
                  alt={`第 ${currentPage.pageNumber} 页`}
                  className="mx-auto max-h-72 w-auto object-contain"
                />
              </div>
              <p className="text-xl font-medium leading-relaxed text-slate-800">{currentPage.storyText}</p>
            </>
          ) : (
            <>
              <span className="self-start rounded-full bg-purple-100 px-3 py-1 text-sm font-extrabold text-purple-700">
                绘本封面已画好
              </span>
              <div className="overflow-hidden rounded-2xl bg-amber-50/40">
                <img
                  src={resolveArtworkSrc(coverPath)}
                  alt={title}
                  className="mx-auto max-h-72 w-auto object-contain"
                />
              </div>
              <p className="text-lg text-slate-600">
                主角设定：{heroDesc}。现在来在右边写出第 1 页的故事吧！
              </p>
            </>
          )}
        </div>

        {/* 右侧故事精灵共创区 */}
        <div className="flex flex-col justify-between gap-4 rounded-[32px] bg-white/90 p-5 shadow-md">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-purple-100 text-2xl" aria-hidden>
                🧚
              </div>
              <div className="rounded-3xl rounded-tl-md bg-purple-50 px-4 py-3 text-lg font-medium text-slate-700">
                {fairyPrompt}
              </div>
            </div>

            {errorMsg && (
              <div className="rounded-2xl border-2 border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                {errorMsg}
              </div>
            )}

            {!finished && choices.length > 0 && (
              <div className="space-y-2.5">
                <div className="text-sm font-bold text-slate-400">
                  👉 选一个第 {pages.length + 1} 页的剧情点子，或者在下面自己说：
                </div>
                {choices.map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    disabled={busy}
                    onClick={() => void handleCreateNextPage(choice)}
                    className="flex min-h-12 w-full items-center gap-2 rounded-2xl border-2 border-amber-200 bg-amber-50/70 px-4 py-2 text-left text-base font-bold text-slate-700 transition hover:bg-amber-100 disabled:opacity-50"
                  >
                    <span aria-hidden>✨</span>
                    <span>{choice}</span>
                  </button>
                ))}
              </div>
            )}

            {finished && (
              <div className="rounded-3xl bg-amber-50 p-5 text-center space-y-4">
                <div className="text-4xl" aria-hidden>🎉📖⭐</div>
                <div className="text-2xl font-extrabold text-slate-800">
                  太棒啦！《{title}》全部 4 页都写完啦！
                </div>
                <button
                  type="button"
                  data-testid="finish-storybook-btn"
                  onClick={() => void handleFinishBook()}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 text-xl font-extrabold text-white shadow-md"
                >
                  📖 装订成书，去有声阅读！
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {!finished && (
        <KidInputBar
          disabled={busy}
          placeholder={`说说第 ${pages.length + 1} 页接下来发生什么…`}
          onSend={(text) => void handleCreateNextPage(text)}
        />
      )}
    </div>
  );
}
