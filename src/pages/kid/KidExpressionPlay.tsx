import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { getExpressionTarget, type ExpressionTarget } from '@/config/expressionTargets';
import {
  ACHIEVEMENT_LABEL,
  SCORE_LABEL,
  SCORE_RUBRIC,
  addSession,
  composeThreeLines,
  loadBook,
  nextSessionNo,
  pickHighlight,
  sessionFileName,
  suggestScore,
  todayIso,
  type Achievement,
  type ExpressionRound,
  type ExpressionSession,
  type ExpressionSubject,
  type Score,
} from '@/config/kidExpression';
import { ChatBubble } from './components/ChatBubble';
import { KidInputBar } from './components/KidInputBar';
import { RecordExportSheet } from './components/RecordExportSheet';
import { useKid, type KidCompanion } from './KidContext';
import { useReadAloud } from './hooks/useReadAloud';

const COACH: KidCompanion = {
  member: {
    id: 'expression-coach',
    kind: 'llm',
    name: '说说老师',
    description: '语言表达练习教练',
    source: 'builtin',
    providerId: '',
    model: '',
    customPrompt: '',
  },
  meta: {
    catchphrase: '你讲，我听。',
    greeting: '我们开始吧。',
    color: '#F97316',
    emoji: '🗣️',
  },
};

const STUDENT_KEY = 'kidbuddy.expression.student';
const SUBJECT_KEY = 'kidbuddy.expression.by';

function readStudent(fallback: string): string {
  try {
    return localStorage.getItem(STUDENT_KEY) || fallback;
  } catch {
    return fallback;
  }
}

function readSubject(): ExpressionSubject {
  try {
    return localStorage.getItem(SUBJECT_KEY) === '家长' ? '家长' : '教师';
  } catch {
    return '教师';
  }
}

interface Line {
  id: string;
  isKid: boolean;
  text: string;
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function AchievementButtons({ value, onChange }: { value: Achievement | null; onChange: (v: Achievement) => void }) {
  const options: Achievement[] = ['independent', 'prompted', 'failed'];
  const style: Record<Achievement, string> = {
    independent: value === 'independent' ? 'bg-emerald-500 text-white' : 'bg-white text-emerald-700 border-emerald-300',
    prompted: value === 'prompted' ? 'bg-amber-400 text-white' : 'bg-white text-amber-700 border-amber-300',
    failed: value === 'failed' ? 'bg-rose-500 text-white' : 'bg-white text-rose-700 border-rose-300',
  };
  const emoji: Record<Achievement, string> = { independent: '✅', prompted: '🟡', failed: '❌' };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          data-testid={`judge-${o}`}
          onClick={() => onChange(o)}
          className={`flex h-12 items-center gap-1.5 rounded-xl border-2 px-3 text-xs font-bold ${style[o]}`}
        >
          <span aria-hidden>{emoji[o]}</span>
          {ACHIEVEMENT_LABEL[o]}
        </button>
      ))}
    </div>
  );
}

function PracticeSession({ target, onExit }: { target: ExpressionTarget; onExit: () => void }) {
  const navigate = useNavigate();
  const { profile, memory, voice, setVoicePrefs } = useKid();
  const readAloud = useReadAloud();
  const listRef = useRef<HTMLDivElement>(null);
  const askedRef = useRef(false);

  const tasks = target.tasks;
  const [idx, setIdx] = useState(0);
  const [rounds, setRounds] = useState<ExpressionRound[]>(() =>
    tasks.map((t) => ({ taskId: t.id, ask: t.ask, answer: '', checks: t.checks, checksHit: [], achievement: null })),
  );
  const [lines, setLines] = useState<Line[]>([]);
  /** rounds 的同步镜像：连续快速判定时不能依赖闭包里的旧值，否则后一次会覆盖前一次 */
  const roundsRef = useRef(rounds);
  const [phase, setPhase] = useState<'practice' | 'review' | 'saved'>('practice');
  const [three, setThree] = useState({ did: '', achieved: '', stuck: '' });
  /** 用户手动改过三行就不再自动覆盖 */
  const [threeDirty, setThreeDirty] = useState(false);
  const [score, setScore] = useState<Score | null>(null);
  const [highlight, setHighlight] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [saved, setSaved] = useState<ExpressionSession | null>(null);
  const [showExport, setShowExport] = useState(false);

  const student = readStudent(memory.nickname || '小朋友');
  const by = readSubject();
  const fontSize = profile.band === 'preschool' ? 21 : 18;
  const currentTask = tasks[Math.min(idx, tasks.length - 1)];

  const pushCoach = (text: string) => {
    setLines((prev) => [...prev, { id: newId('coach'), isKid: false, text }]);
    if (voice.autoReadAloud && readAloud.supported) {
      readAloud.speakNow(text, COACH.member.id, undefined, 'zh-CN');
    }
  };

  useEffect(() => {
    if (askedRef.current) return;
    askedRef.current = true;
    pushCoach(target.opener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [lines]);

  const handleSend = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || phase !== 'practice') return;
    setLines((prev) => [...prev, { id: newId('kid'), isKid: true, text: trimmed }]);
    const nextRounds = rounds.map((r, i) => (i === idx ? { ...r, answer: trimmed } : r));
    roundsRef.current = nextRounds;
    setRounds(nextRounds);
    const next = idx + 1;
    if (next < tasks.length) {
      setIdx(next);
      pushCoach(tasks[next].ask);
    } else {
      enterReview(nextRounds);
    }
  };

  const enterReview = (source: ExpressionRound[] = roundsRef.current) => {
    readAloud.cancel();
    setThree(composeThreeLines({ rounds: source, targetId: target.id, by }, target));
    setScore(suggestScore(source));
    setHighlight(pickHighlight(source));
    setPhase('review');
  };

  const applyRounds = (next: ExpressionRound[]) => {
    roundsRef.current = next;
    setRounds(next);
    // 判定变了，三行草稿跟着变；用户自己改过就尊重他的文字
    if (!threeDirty) setThree(composeThreeLines({ rounds: next, targetId: target.id, by }, target));
  };

  const updateRound = (taskId: string, patch: Partial<ExpressionRound>) => {
    applyRounds(roundsRef.current.map((r) => (r.taskId === taskId ? { ...r, ...patch } : r)));
  };

  const toggleCheck = (round: ExpressionRound, check: string) => {
    const has = round.checksHit.includes(check);
    updateRound(round.taskId, { checksHit: has ? round.checksHit.filter((c) => c !== check) : [...round.checksHit, check] });
  };

  const save = () => {
    const book = loadBook();
    const session: ExpressionSession = {
      id: newId('session'),
      student,
      date: todayIso(),
      sessionNo: nextSessionNo(book, student),
      topic: target.name,
      targetId: target.id,
      by,
      rounds,
      score,
      threeLines: three,
      highlight,
      nextStep,
      createdAt: Date.now(),
    };
    addSession(book, session);
    setSaved(session);
    setPhase('saved');
  };

  if (phase === 'review') {
    const counts = rounds.reduce(
      (acc, r) => {
        if (r.achievement) acc[r.achievement] += 1;
        return acc;
      },
      { independent: 0, prompted: 0, failed: 0 } as Record<Achievement, number>,
    );
    const judged = counts.independent + counts.prompted + counts.failed;

    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-8" data-testid="expression-review">
        <div className="mx-auto w-full max-w-4xl space-y-4 py-3">
          <div className="rounded-[28px] bg-gradient-to-r from-rose-400 to-orange-400 p-5 text-white shadow-lg">
            <h1 className="text-2xl font-extrabold">填写这节课的记录</h1>
            <p className="mt-1 text-sm opacity-95">
              {target.id} {target.name} · 共 {rounds.length} 轮 · 已判定 {judged} 轮
            </p>
          </div>

          <div className="rounded-[28px] bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-extrabold text-slate-800">一、逐轮判定</h2>
              <button
                type="button"
                onClick={() => applyRounds(roundsRef.current.map((r) => ({ ...r, achievement: r.answer.trim() ? 'independent' : r.achievement })))}
                className="h-12 rounded-xl bg-slate-100 px-3 text-xs font-bold text-slate-600"
              >
                把已作答的轮次都标为「独立做到」
              </button>
            </div>
            <div className="space-y-3">
              {rounds.map((r, i) => (
                <div key={r.taskId} className="rounded-2xl border-2 border-slate-100 p-3.5">
                  <div className="text-sm font-bold text-slate-700">
                    第{i + 1}轮 · {r.ask}
                  </div>
                  <div className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-slate-700">
                    {r.answer.trim() ? `原话：「${r.answer.trim()}」` : '（这一轮没有作答）'}
                  </div>
                  {r.checks.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {r.checks.map((c) => {
                        const hit = r.checksHit.includes(c);
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => toggleCheck(r, c)}
                            className={`flex h-12 items-center rounded-xl border-2 px-3 text-xs font-bold ${
                              hit ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-400'
                            }`}
                          >
                            {hit ? '✓ ' : '○ '}
                            {c}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="mt-2.5">
                    <AchievementButtons value={r.achievement} onChange={(v) => updateRound(r.taskId, { achievement: v })} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-extrabold text-slate-800">二、目标达成得分</h2>
              <button
                type="button"
                onClick={() => setScore(suggestScore(rounds))}
                className="h-12 rounded-xl bg-slate-100 px-3 text-xs font-bold text-slate-600"
              >
                按当前判定重新建议
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {([0, 1, 2] as Score[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  data-testid={`score-${s}`}
                  onClick={() => setScore(s)}
                  className={`flex h-14 min-w-[9rem] flex-1 flex-col items-center justify-center rounded-2xl border-2 text-sm font-bold ${
                    score === s ? 'border-rose-400 bg-rose-50 text-rose-700' : 'border-slate-200 bg-white text-slate-500'
                  }`}
                >
                  <span className="text-lg">{s} 分</span>
                  <span className="text-xs font-medium">{SCORE_LABEL[s]}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              建议分按独立完成率给：≥80% 记 2，50%-80% 记 1，其余记 0。口径：{SCORE_RUBRIC} 分数由你确认，系统不替你判断。
            </p>
          </div>

          <div className="rounded-[28px] bg-white p-4 shadow-sm">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-extrabold text-slate-800">三、课堂记录三行</h2>
              <button
                type="button"
                onClick={() => {
                  setThree(composeThreeLines({ rounds, targetId: target.id, by }, target));
                  setThreeDirty(false);
                }}
                className="h-12 rounded-xl bg-slate-100 px-3 text-xs font-bold text-slate-600"
              >
                按当前判定重算草稿
              </button>
            </div>
            <p className="mb-3 text-xs text-slate-400">
              草稿会跟着上面的判定自动更新；你一旦手动改过某一行，就不再自动覆盖。
            </p>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-bold text-slate-500">今天做了什么</span>
                <textarea
                  value={three.did}
                  onChange={(e) => { setThreeDirty(true); setThree((p) => ({ ...p, did: e.target.value })); }}
                  rows={3}
                  className="mt-1 w-full rounded-xl border-2 border-slate-200 p-2.5 text-sm outline-none focus:border-rose-400"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-slate-500">做到了什么</span>
                <textarea
                  value={three.achieved}
                  onChange={(e) => { setThreeDirty(true); setThree((p) => ({ ...p, achieved: e.target.value })); }}
                  rows={3}
                  className="mt-1 w-full rounded-xl border-2 border-slate-200 p-2.5 text-sm outline-none focus:border-rose-400"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-slate-500">卡在哪</span>
                <textarea
                  value={three.stuck}
                  onChange={(e) => { setThreeDirty(true); setThree((p) => ({ ...p, stuck: e.target.value })); }}
                  rows={3}
                  className="mt-1 w-full rounded-xl border-2 border-slate-200 p-2.5 text-sm outline-none focus:border-rose-400"
                />
              </label>
            </div>
          </div>

          <div className="rounded-[28px] bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-extrabold text-slate-800">
              四、{by === '家长' ? '下次课调整（教师备课用）' : '家长沟通要点'}
            </h2>
            <label className="block">
              <span className="text-xs font-bold text-slate-500">
                {by === '家长' ? '家长课不写这段，导出时自动换成家庭训练指导八项' : '可以告诉家长的一句进步'}
              </span>
              <textarea
                value={highlight}
                onChange={(e) => setHighlight(e.target.value)}
                rows={2}
                placeholder="取孩子自己说的一句话，不要写「表现不错」"
                className="mt-1 w-full rounded-xl border-2 border-slate-200 p-2.5 text-sm outline-none focus:border-rose-400"
              />
            </label>
            <label className="mt-3 block">
              <span className="text-xs font-bold text-slate-500">
                {by === '家长' ? '下次课调整' : '本周家庭任务 / 下次调整'}
              </span>
              <textarea
                value={nextStep}
                onChange={(e) => setNextStep(e.target.value)}
                rows={2}
                placeholder="一句话说清下周练什么、怎么练"
                className="mt-1 w-full rounded-xl border-2 border-slate-200 p-2.5 text-sm outline-none focus:border-rose-400"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2 pb-4">
            <button type="button" onClick={() => setPhase('practice')} className="h-14 flex-1 rounded-2xl bg-white text-base font-bold text-slate-600 shadow-sm">
              回去再说几句
            </button>
            <button type="button" onClick={save} data-testid="save-session" className="h-14 flex-[2] rounded-2xl bg-rose-500 text-base font-extrabold text-white shadow-sm">
              保存这份记录
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'saved' && saved) {
    return (
      <div className="flex flex-1 items-center justify-center px-4" data-testid="expression-saved">
        <div className="w-full max-w-lg rounded-[32px] bg-white p-6 text-center shadow-lg">
          <div className="text-4xl">🎉</div>
          <h1 className="mt-2 text-2xl font-extrabold text-slate-800">记录已保存</h1>
          <p className="mt-2 text-sm text-slate-500">
            第{saved.sessionNo}课时 · {saved.date} · {saved.targetId} {target.name}
            {saved.score === null ? '（未打分）' : ` · ${saved.score} 分`}
          </p>
          <p className="mt-1 break-all rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">{sessionFileName(saved)}</p>
          <div className="mt-5 flex flex-col gap-2">
            <button type="button" onClick={() => setShowExport(true)} className="flex h-14 items-center justify-center rounded-2xl bg-slate-800 text-base font-bold text-white">
              导出成课堂记录 .md
            </button>
            <button type="button" onClick={() => navigate('/expression')} className="flex h-14 items-center justify-center rounded-2xl bg-rose-500 text-base font-bold text-white">
              回说说小课堂
            </button>
            <button type="button" onClick={onExit} className="flex h-12 items-center justify-center rounded-2xl bg-slate-100 text-sm font-bold text-slate-500">
              再练一次
            </button>
          </div>
        </div>
        {showExport && <RecordExportSheet session={saved} onClose={() => setShowExport(false)} />}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="expression-play" data-target={target.id}>
      <div className="flex shrink-0 items-center gap-3 px-4 pb-2">
        <Link to="/expression" aria-label="返回说说小课堂" className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-2xl shadow-sm">
          ←
        </Link>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-3xl" aria-hidden>🗣️</div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-extrabold text-slate-800">
            {target.id} {target.name}
          </h1>
          <div className="text-xs text-slate-500">
            第 {Math.min(idx + 1, tasks.length)} / {tasks.length} 轮 · {by}带练 · {student}
          </div>
        </div>
        {readAloud.supported && (
          <button
            type="button"
            onClick={() => {
              if (voice.autoReadAloud) readAloud.cancel();
              setVoicePrefs({ autoReadAloud: !voice.autoReadAloud });
            }}
            className={`flex h-12 items-center gap-1.5 rounded-full px-4 text-sm font-bold shadow-sm ${
              voice.autoReadAloud ? 'bg-sky-400 text-white' : 'bg-white text-slate-500'
            }`}
          >
            <span aria-hidden>{voice.autoReadAloud ? '🔊' : '🔈'}</span>
            <span>{voice.autoReadAloud ? '自动朗读' : '朗读关'}</span>
          </button>
        )}
      </div>

      <div className="grid min-h-0 flex-1 gap-4 px-4 pb-2 lg:grid-cols-[0.95fr_1.15fr]">
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto rounded-[32px] bg-white p-4 shadow-md">
          <div className="rounded-2xl bg-rose-50 p-4">
            <div className="text-xs font-bold text-rose-600">本课目标 · 2 分标准</div>
            <div className="mt-1 text-sm font-bold text-slate-700">{target.standard2}</div>
            <div className="mt-2 text-xs text-slate-500">常见 1 分：{target.onePenalty}</div>
          </div>

          <div className="rounded-2xl border-2 border-rose-200 bg-white p-4">
            <div className="text-xs font-bold text-slate-400">第 {Math.min(idx + 1, tasks.length)} 轮 · 现在说这个</div>
            <div className="mt-2 text-lg font-extrabold leading-relaxed text-slate-800">{currentTask.ask}</div>
            <div className="mt-3 rounded-xl bg-amber-50 p-2.5 text-sm text-amber-800">
              <span className="font-bold">不会说时给这句：</span>
              {currentTask.hint}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {readAloud.supported && (
                <button
                  type="button"
                  onClick={() => readAloud.speakNow(currentTask.ask, COACH.member.id, undefined, 'zh-CN')}
                  className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl bg-sky-500 px-3 text-sm font-bold text-white"
                >
                  🔊 再念一遍题目
                </button>
              )}
              <button
                type="button"
                onClick={() => enterReview()}
                data-testid="finish-practice"
                className="flex h-12 flex-1 items-center justify-center rounded-xl bg-slate-800 px-3 text-sm font-bold text-white"
              >
                练完了，去填写记录 →
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">
            <div className="font-bold text-slate-600">判定参照</div>
            <div className="mt-1">
              待勾选要素：
              {currentTask.checks.map((c) => (
                <span key={c} className="ml-1 inline-block rounded bg-white px-1.5 py-0.5">{c}</span>
              ))}
            </div>
            <div className="mt-1.5">要素在最后一步统一勾选，不必边聊边判断。</div>
          </div>
        </div>

        <div className="flex min-h-0 flex-col rounded-[32px] bg-white/85 shadow-md">
          <div ref={listRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            {lines.map((m) => (
              <ChatBubble
                key={m.id}
                isKid={m.isKid}
                speakerName={m.isKid ? student : COACH.member.name}
                content={m.text}
                companion={m.isKid ? undefined : COACH}
                fontSize={fontSize}
                onReadAloud={
                  !m.isKid && readAloud.supported
                    ? () => readAloud.speakNow(m.text, COACH.member.id, undefined, 'zh-CN')
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      </div>

      <KidInputBar
        placeholder="按住说话，或者打字说给我听…"
        speechLang="zh-CN"
        onSend={handleSend}
      />
    </div>
  );
}

export default function KidExpressionPlay() {
  const { targetId } = useParams();
  const [replayKey, setReplayKey] = useState(0);
  const target = getExpressionTarget(targetId);
  if (!target) return <Navigate to="/expression" replace />;
  return <PracticeSession key={`${target.id}-${replayKey}`} target={target} onExit={() => setReplayKey((k) => k + 1)} />;
}
