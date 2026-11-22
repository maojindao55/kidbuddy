import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { countAnimatedSlides, getArtStyle, parseBookPages, type KidStorybookRecord } from '@/config/kidArt';
import { deleteKidStorybook, listKidStorybooks, resolveArtworkSrc } from '@/lib/kidImage';

export default function KidStorybooks() {
  const [books, setBooks] = useState<KidStorybookRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    void listKidStorybooks()
      .then(setBooks)
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    setConfirmDeleteId(null);
    await deleteKidStorybook(id);
    setBooks((prev) => prev.filter((b) => b.id !== id));
  };

  return (
    <div className="flex-1 overflow-y-auto px-5 pb-8 pt-2" data-testid="kid-books-page">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-800">📖 绘本魔法屋</h1>
            <p className="text-base text-slate-500">和故事精灵一起编出属于你的有声插画绘本</p>
          </div>
        </div>

        <Link
          to="/books/new"
          data-testid="create-book-cta"
          className="flex items-center gap-4 rounded-[32px] bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 p-6 text-white shadow-lg transition active:scale-[0.99]"
        >
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-4xl" aria-hidden>
            ✨
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-2xl font-extrabold">一起创作新绘本</div>
            <div className="mt-1 text-base opacity-95">选主角、挑画风、说剧情，4 页就能装订成一本有声绘本！</div>
          </div>
          <span className="text-3xl font-extrabold" aria-hidden>→</span>
        </Link>

        <div>
          <h2 className="mb-4 text-2xl font-extrabold text-slate-800">📚 我的绘本书架（{books.length}）</h2>
          {loading ? (
            <p className="py-8 text-center text-lg text-slate-400">正在整理书架……</p>
          ) : books.length === 0 ? (
            <div className="rounded-[32px] bg-white/80 p-10 text-center shadow-sm">
              <div className="text-5xl" aria-hidden>🧚📖</div>
              <p className="mt-3 text-lg font-bold text-slate-600">书架还是空的，快来和故事精灵编第一本绘本吧！</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {books.map((book) => {
                const pages = parseBookPages(book.pagesJson);
                const styleMeta = getArtStyle(book.style);
                const animStats = countAnimatedSlides(book);
                return (
                  <div key={book.id} className="flex flex-col overflow-hidden rounded-[28px] bg-white shadow-md">
                    <Link to={`/books/${book.id}`} className="group relative block overflow-hidden bg-amber-50">
                      {book.coverPath ? (
                        <img
                          src={resolveArtworkSrc(book.coverPath)}
                          alt={book.title}
                          className="h-52 w-full object-cover transition group-hover:scale-[1.02]"
                        />
                      ) : (
                        <div className="flex h-52 items-center justify-center text-5xl">📖</div>
                      )}
                      {animStats.animated > 0 && (
                        <span className="absolute right-3 top-3 rounded-full bg-emerald-500/90 px-2.5 py-0.5 text-xs font-extrabold text-white shadow">
                          🎬 动画 {animStats.animated}/{animStats.total}
                        </span>
                      )}
                    </Link>
                    <div className="flex flex-1 flex-col gap-2 p-4">
                      <Link to={`/books/${book.id}`} className="text-xl font-extrabold text-slate-800 hover:text-amber-600">
                        《{book.title}》
                      </Link>
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">
                          作者：{book.author || '小朋友'}
                        </span>
                        <span>{styleMeta.emoji} {styleMeta.label}</span>
                        <span>· {pages.length} 页</span>
                      </div>
                      <div className="mt-auto flex gap-2 pt-2">
                        <Link
                          to={`/books/${book.id}`}
                          className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-amber-400 text-base font-bold text-white"
                        >
                          📖 打开阅读
                        </Link>
                        <button
                          type="button"
                          onClick={() => void handleDelete(book.id)}
                          className={`flex h-12 items-center justify-center rounded-2xl px-4 text-sm font-bold ${
                            confirmDeleteId === book.id ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {confirmDeleteId === book.id ? '确认删' : '删除'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
