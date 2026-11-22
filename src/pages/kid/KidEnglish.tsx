import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ENGLISH_BUDDY, ENGLISH_SCENES, loadEnglishProgress } from '@/config/kidEnglish';
import { StarRow } from './components/StarRow';
import { useReadAloud } from './hooks/useReadAloud';

export default function KidEnglish() {
  const [progress] = useState(loadEnglishProgress);
  const readAloud = useReadAloud();
  const completedCount = Object.keys(progress.completedScenes).length;

  return (
    <div className="flex-1 overflow-y-auto px-5 pb-8 pt-2" data-testid="kid-english-page">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* 顶部冒险岛横幅 */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-[32px] bg-gradient-to-r from-emerald-400 to-teal-500 p-6 text-white shadow-lg">
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-4xl" aria-hidden>
              {ENGLISH_BUDDY.emoji}
            </span>
            <div>
              <h1 className="text-3xl font-extrabold">Sunny 英语冒险岛</h1>
              <p className="mt-1 text-base opacity-95">
                跟着提示句开口说英语，和 {ENGLISH_BUDDY.name} 闯过 6 大情景关卡！
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="rounded-2xl bg-white/20 px-4 py-2 text-center">
              <div className="text-2xl font-extrabold">{completedCount} / {ENGLISH_SCENES.length}</div>
              <div className="text-xs opacity-90">已通关情景</div>
            </div>
            <div className="rounded-2xl bg-white/20 px-4 py-2 text-center">
              <div className="text-2xl font-extrabold">{progress.wordsSpoken.length}</div>
              <div className="text-xs opacity-90">开口单词数</div>
            </div>
          </div>
        </div>

        {/* 6 大情景任务卡片 */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ENGLISH_SCENES.map((scene) => {
            const done = progress.completedScenes[scene.id];
            return (
              <Link
                key={scene.id}
                to={`/english/${scene.id}`}
                data-testid={`english-scene-${scene.id}`}
                className="flex flex-col gap-3 rounded-[32px] border-4 bg-white p-5 shadow-md transition active:scale-[0.98]"
                style={{ borderColor: `${scene.accent}44` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded-2xl text-4xl"
                    style={{ backgroundColor: scene.bg }}
                    aria-hidden
                  >
                    {scene.emoji}
                  </div>
                  <span
                    className="rounded-full px-3 py-1 text-xs font-extrabold"
                    style={{ backgroundColor: scene.bg, color: scene.accent }}
                  >
                    {scene.levelLabel}
                  </span>
                </div>
                <div>
                  <div className="text-2xl font-extrabold text-slate-800">{scene.title}</div>
                  <div className="text-sm font-bold" style={{ color: scene.accent }}>
                    {scene.englishTitle}
                  </div>
                </div>
                <p className="text-sm text-slate-500">{scene.setting}</p>
                <div className="mt-auto flex items-center justify-between pt-2">
                  <StarRow count={done?.stars ?? 0} size={20} />
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                    {done ? '再去练练 →' : `${scene.missions.length} 个小任务 →`}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* 我的英语词袋 */}
        <div className="rounded-[32px] bg-white/90 p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-extrabold text-slate-800">🎒 我的英语词袋（{progress.wordsSpoken.length}）</h2>
            <span className="text-xs text-slate-400">点任意单词可以再听一遍发音</span>
          </div>
          {progress.wordsSpoken.length === 0 ? (
            <p className="py-4 text-center text-base text-slate-400">
              还没收集到英文单词，挑一个情景开口说第一句英语吧！
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {progress.wordsSpoken.map((word) => (
                <button
                  key={word}
                  type="button"
                  onClick={() => readAloud.speakNow(word, ENGLISH_BUDDY.id, undefined, 'en-US')}
                  className="flex h-12 items-center gap-1.5 rounded-full border-2 border-emerald-200 bg-emerald-50 px-4 text-base font-bold text-emerald-700 transition hover:bg-emerald-100"
                >
                  <span>🔊</span>
                  <span>{word}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
