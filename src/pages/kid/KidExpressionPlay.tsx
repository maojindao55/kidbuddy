import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { getExpressionTarget, type ExpressionTarget, type ExpressionTask } from '@/config/expressionTargets';
import {
  DTT_OUTCOME_LABEL,
  DTT_PROMPT_LEVELS,
  DTT_WAIT_MS,
  computeDttStats,
  dttCorrection,
  dttMasteryHint,
  dttPraise,
  dttToAchievement,
  type DttOutcome,
  type DttPromptLevel,
} from '@/config/dtt';
import {
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
    emoji: '💬',
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

interface TrialSpec {
  key: string;
  taskIndex: number;
  repeatIndex: number;
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function buildTrials(tasks: ExpressionTask[], repeats: number): TrialSpec[] {
  const out: TrialSpec[] = [];
  tasks.forEach((task, taskIndex) => {
    for (let r = 1; r <= repeats; r += 1) out.push({ key: `${task.id}#${r}`, taskIndex, repeatIndex: r });
  });
  return out;
}

function makeRound(spec: TrialSpec, tasks: ExpressionTask[]): ExpressionRound {
  const task = tasks[spec.taskIndex];
  return {
    taskId: spec.key,
    ask: task.ask,
    answer: '',
    checks: task.checks,
    checksHit: [],
    achievement: null,
    outcome: null,
    promptLevel: null,
    repeatIndex: spec.repeatIndex,
  };
}

function outcomeMark(round: ExpressionRound): { text: string; tone: string } {
  if (round.outcome === 'correct') {
    return round.promptLevel === 'independent'
      ? { text: '独立正确', tone: 'bg-emerald-100 text-emerald-700' }
      : {
          text: `提示后正确 · ${DTT_PROMPT_LEVELS.find((p) => p.value === round.promptLevel)?.short ?? ''}`,
          tone: 'bg-amber-100 text-amber-700',
        };
  }
  if (round.outcome === 'incorrect') return { text: '错误', tone: 'bg-rose-100 text-rose-700' };
  if (round.outcome === 'no_response') return { text: '无反应', tone: 'bg-slate-200 text-slate-600' };
  return { text: '未判定', tone: 'bg-slate-100 text-slate-400' };
}

export default function KidExpressionPlay() {
  const { targetId } = useParams();
  const target = getExpressionTarget(targetId);
  const [replayKey, setReplayKey] = useState(0);
  if (!target) return <Navigate to="/expression" replace />;
  return <DttSession key={`${target.id}-${replayKey}`} target={target} onExit={() => setReplayKey((k) => k + 1)} />;
}

function DttSession({ target, onExit }: { target: ExpressionTarget; onExit: () => void }) {
  const navigate = useNavigate();
  const { profile, memory, voice, setVoicePrefs } = useKid();
  const readAloud = useReadAloud();
  const listRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  const tasks = target.tasks;
  const [repeats, setRepeats] = useState(2);
  const [trials, setTrials] = useState<TrialSpec[]>(() => buildTrials(tasks, 2));
  const [rounds, setRounds] = useState<ExpressionRound[]>(() => buildTrials(tasks, 2).map((s) => makeRound(s, tasks)));
  const roundsRef = useRef(rounds);
  const [idx, setIdx] = useState(0);
  /** 每起一个试次 +1，用来重启 3 秒等待窗 */
  const [trialSeq, setTrialSeq] = useState(0);
  const [phase, setPhase] = useState<'run' | 'review' | 'saved'>('run');
  /** 当前试次阶段：等反应 → 待判定 → 出结果 */
  const [trialStage, setTrialStage] = useState<'await' | 'judge' | 'feedback'>('await');
  const [waitExpired, setWaitExpired] = useState(false);
  const [lastJudge, setLastJudge] = useState<{ outcome: DttOutcome; promptLevel: DttPromptLevel } | null>(null);
  const [showPromptPicker, setShowPromptPicker] = useState(false);
  const [answerDraft, setAnswerDraft] = useState('');
  const [lines, setLines] = useState<Line[]>([]);

  const [three, setThree] = useState({ did: '', achieved: '', stuck: '' });
  const [threeDirty, setThreeDirty] = useState(false);
  const [score, setScore] = useState<Score | null>(null);
  const [highlight, setHighlight] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [saved, setSaved] = useState<ExpressionSession | null>(null);
  const [showExport, setShowExport] = useState(false);

  const student = readStudent(memory.nickname || '小朋友');
  const by = readSubject();
  const fontSize = profile.band === 'preschool' ? 21 : 18;

  const spec = trials[Math.min(idx, trials.length - 1)];
  const currentTask = tasks[spec.taskIndex];
  const stats = computeDttStats(rounds.map((r) => ({ outcome: r.outcome ?? null, promptLevel: r.promptLevel ?? null })));
  const locked = rounds.some((r) => r.achievement !== null);

  const pushCoach = useCallback(
    (text: string) => {
      setLines((prev) => [...prev, { id: newId('coach'), isKid: false, text }]);
      if (voice.autoReadAloud && readAloud.supported) {
        readAloud.speakNow(text, COACH.member.id, undefined, 'zh-CN');
      }
    },
    [readAloud, voice.autoReadAloud],
  );

  /** 起一个试次：说一遍指令，开 3 秒等待窗 */
  const startTrial = useCallback(
    (trialSpec: TrialSpec) => {
      const task = tasks[trialSpec.taskIndex];
      setTrialStage('await');
      setWaitExpired(false);
      setShowPromptPicker(false);
      setAnswerDraft('');
      pushCoach(`第 ${trialSpec.repeatIndex} 遍：${task.ask}`);
      setTrialSeq((n) => n + 1);
    },
    [pushCoach, tasks],
  );

  /** 等待窗由试次序号驱动：每个新试次重新计时 3 秒 */
  useEffect(() => {
    if (phase !== 'run' || trialStage !== 'await') return;
    setWaitExpired(false);
    const id = window.setTimeout(() => setWaitExpired(true), DTT_WAIT_MS);
    return () => window.clearTimeout(id);
  }, [trialSeq, trialStage, phase]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    pushCoach(target.opener);
    startTrial(trials[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [lines]);

  const persistRounds = (next: ExpressionRound[]) => {
    roundsRef.current = next;
    setRounds(next);
    if (!threeDirty) setThree(composeThreeLines({ rounds: next, targetId: target.id, by }, target));
  };

  const changeRepeats = (value: number) => {
    if (locked) return;
    setRepeats(value);
    const nextTrials = buildTrials(tasks, value);
    setTrials(nextTrials);
    const nextRounds = nextTrials.map((s) => makeRound(s, tasks));
    persistRounds(nextRounds);
    setIdx(0);
    setLines([]);
    startTrial(nextTrials[0]);
  };

  /** 孩子说完了：先把原话记下来，进入待判定 */
  const submitAnswer = (text: string) => {
    if (trialStage !== 'await') return;
    const trimmed = text.trim();
    if (!trimmed) return;
    setLines((prev) => [...prev, { id: newId('kid'), isKid: true, text: trimmed }]);
    setAnswerDraft(trimmed);
    const next = roundsRef.current.map((r, i) => (i === idx ? { ...r, answer: trimmed } : r));
    roundsRef.current = next;
    setRounds(next);
    setTrialStage('judge');
  };

  const judge = (outcome: DttOutcome, promptLevel: DttPromptLevel) => {
    const achievement = dttToAchievement({ outcome, promptLevel });
    const next = roundsRef.current.map((r, i) =>
      i === idx ? { ...r, outcome, promptLevel, achievement, answer: r.answer || answerDraft } : r,
    );
    persistRounds(next);
    setLastJudge({ outcome, promptLevel });
    setShowPromptPicker(false);
    setTrialStage('feedback');
    pushCoach(outcome === 'correct' ? dttPraise(promptLevel, idx) : dttCorrection(outcome));
  };

  const enterReview = () => {
    readAloud.cancel();
    const source = roundsRef.current;
    setThree(composeThreeLines({ rounds: source, targetId: target.id, by }, target));
    setScore(suggestScore(source));
    setHighlight(pickHighlight(source));
    setPhase('review');
  };

  const advance = () => {
    if (idx + 1 >= trials.length) {
      enterReview();
      return;
    }
    const nextIdx = idx + 1;
    setIdx(nextIdx);
    startTrial(trials[nextIdx]);
  };

  /** 同一道题再来一遍：在当前试次后面插一个同题试次 */
  const retry = () => {
    const used = roundsRef.current.filter((r) => r.taskId.startsWith(`${currentTask.id}#`)).length;
    const spec2: TrialSpec = { key: `${currentTask.id}#${used + 1}`, taskIndex: spec.taskIndex, repeatIndex: used + 1 };
    const nextTrials = [...trials];
    nextTrials.splice(idx + 1, 0, spec2);
    setTrials(nextTrials);
    const nextRounds = [...roundsRef.current];
    nextRounds.splice(idx + 1, 0, makeRound(spec2, tasks));
    persistRounds(nextRounds);
    setIdx(idx + 1);
    startTrial(spec2);
  };

  const overrideAchievement = (taskId: string, achievement: Achievement) => {
    const next = roundsRef.current.map((r) => {
      if (r.taskId !== taskId) return r;
      if (achievement === 'independent') {
        return { ...r, achievement, outcome: 'correct' as DttOutcome, promptLevel: 'independent' as DttPromptLevel };
      }
      if (achievement === 'failed') {
        return { ...r, achievement, outcome: 'incorrect' as DttOutcome };
      }
      return {
        ...r,
        achievement,
        outcome: 'correct' as DttOutcome,
        promptLevel: r.promptLevel && r.promptLevel !== 'independent' ? r.promptLevel : ('verbal' as DttPromptLevel),
      };
    });
    persistRounds(next);
  };

  const toggleCheck = (round: ExpressionRound, check: string) => {
    const has = round.checksHit.includes(check);
    const next = roundsRef.current.map((r) =>
      r.taskId === round.taskId ? { ...r, checksHit: has ? r.checksHit.filter((c) => c !== check) : [...r.checksHit, check] } : r,
    );
    persistRounds(next);
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

  // ======================= 评审页 =======================
  if (phase === 'review') {
    const mastery = dttMasteryHint(stats);
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-8" data-testid="expression-review">
        <div className="mx-auto w-full max-w-4xl space-y-4 py-3">
          <div className="rounded-[28px] bg-gradient-to-r from-rose-400 to-orange-400 p-5 text-white shadow-lg">
            <h1 className="text-2xl font-extrabold">填写这节课的记录</h1>
            <p className="mt-1 text-sm opacity-95">
              {target.id} {target.name} · DTT 已判定 {stats.total}/{rounds.length} 试次 · 独立正确 {stats.independentCorrect}（
              {Math.round(stats.independentRate * 100)}%）· 最长连续独立 {stats.maxIndependentStreak} 次
            </p>
          </div>

          {mastery && (
            <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800" data-testid="dtt-mastery-hint">
              📈 {mastery}
            </div>
          )}

          <div className="rounded-[28px] bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-extrabold text-slate-800">一、逐试次回看</h2>
              <span className="text-xs text-slate-400">判定不准可以直接改，三行草稿会跟着变</span>
            </div>
            <div className="space-y-3">
              {rounds.map((r, i) => {
                const mark = outcomeMark(r);
                return (
                  <div key={r.taskId} className="rounded-2xl border-2 border-slate-100 p-3.5">
                    <div className="flex flex-wrap items-start gap-2">
                      <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">第 {i + 1} 试次</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${mark.tone}`}>{mark.text}</span>
                      <span className="min-w-0 flex-1 text-sm font-bold text-slate-700">{r.ask}</span>
                    </div>
                    <div className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-slate-700">
                      {r.answer.trim() ? `原话：「${r.answer.trim()}」` : '（这一试次没有记录到原话）'}
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
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {(['independent', 'prompted', 'failed'] as Achievement[]).map((a) => (
                        <button
                          key={a}
                          type="button"
                          data-testid={`judge-${a}`}
                          onClick={() => overrideAchievement(r.taskId, a)}
                          className={`flex h-12 items-center gap-1.5 rounded-xl border-2 px-3 text-xs font-bold ${
                            r.achievement === a
                              ? a === 'independent'
                                ? 'border-emerald-500 bg-emerald-500 text-white'
                                : a === 'prompted'
                                  ? 'border-amber-400 bg-amber-400 text-white'
                                  : 'border-rose-500 bg-rose-500 text-white'
                              : 'border-slate-200 bg-white text-slate-500'
                          }`}
                        >
                          {a === 'independent' ? '✅ 独立正确' : a === 'prompted' ? '🟡 提示后正确' : '❌ 错误 / 无反应'}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-[28px] bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-extrabold text-slate-800">二、目标达成得分</h2>
              <button
                type="button"
                onClick={() => setScore(suggestScore(roundsRef.current))}
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
              建议分按独立正确率给：≥80% 记 2，50%-80% 记 1，其余记 0。口径：{SCORE_RUBRIC} 分数由你确认，系统不替你判断。
            </p>
          </div>

          <div className="rounded-[28px] bg-white p-4 shadow-sm">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-extrabold text-slate-800">三、课堂记录三行</h2>
              <button
                type="button"
                onClick={() => {
                  setThree(composeThreeLines({ rounds: roundsRef.current, targetId: target.id, by }, target));
                  setThreeDirty(false);
                }}
                className="h-12 rounded-xl bg-slate-100 px-3 text-xs font-bold text-slate-600"
              >
                按当前判定重算草稿
              </button>
            </div>
            <p className="mb-3 text-xs text-slate-400">草稿会跟着判定自动更新；你一旦手动改过某一行，就不再自动覆盖。</p>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-bold text-slate-500">今天做了什么</span>
                <textarea
                  value={three.did}
                  onChange={(e) => {
                    setThreeDirty(true);
                    setThree((p) => ({ ...p, did: e.target.value }));
                  }}
                  rows={3}
                  className="mt-1 w-full rounded-xl border-2 border-slate-200 p-2.5 text-sm outline-none focus:border-rose-400"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-slate-500">做到了什么</span>
                <textarea
                  value={three.achieved}
                  onChange={(e) => {
                    setThreeDirty(true);
                    setThree((p) => ({ ...p, achieved: e.target.value }));
                  }}
                  rows={3}
                  className="mt-1 w-full rounded-xl border-2 border-slate-200 p-2.5 text-sm outline-none focus:border-rose-400"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-slate-500">卡在哪</span>
                <textarea
                  value={three.stuck}
                  onChange={(e) => {
                    setThreeDirty(true);
                    setThree((p) => ({ ...p, stuck: e.target.value }));
                  }}
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
              <span className="text-xs font-bold text-slate-500">{by === '家长' ? '下次课调整' : '本周家庭任务 / 下次调整'}</span>
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
            <button type="button" onClick={() => setPhase('run')} className="h-14 flex-1 rounded-2xl bg-white text-base font-bold text-slate-600 shadow-sm">
              回去再练几个试次
            </button>
            <button type="button" onClick={save} data-testid="save-session" className="h-14 flex-[2] rounded-2xl bg-rose-500 text-base font-extrabold text-white shadow-sm">
              保存这份记录
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ======================= 已保存 =======================
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

  // ======================= 试次执行 =======================
  const feedbackCorrect = lastJudge?.outcome === 'correct';

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="expression-play" data-target={target.id} data-trial={idx + 1}>
      <div className="flex shrink-0 items-center gap-3 px-4 pb-2">
        <Link to="/expression" aria-label="返回说说小课堂" className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-2xl shadow-sm">
          ←
        </Link>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-3xl" aria-hidden>💬</div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-extrabold text-slate-800">
            {target.id} {target.name}
          </h1>
          <div className="text-xs text-slate-500">
            试次 {Math.min(idx + 1, trials.length)} / {trials.length} · 连续独立正确 {stats.currentStreak} 次 · {by}带练 · {student}
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

      <div className="grid min-h-0 flex-1 gap-4 px-4 pb-2 lg:grid-cols-2">
        {/* 左：DTT 操作台 */}
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto rounded-[32px] bg-white p-4 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-rose-50 px-3 py-2">
            <span className="text-xs font-bold text-rose-600">每道题练几遍</span>
            <div className="flex overflow-hidden rounded-xl border-2 border-rose-200">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => changeRepeats(n)}
                  disabled={locked}
                  data-testid={`repeats-${n}`}
                  className={`h-12 px-4 text-sm font-bold ${
                    repeats === n ? 'bg-rose-500 text-white' : locked ? 'bg-white text-slate-300' : 'bg-white text-slate-500'
                  }`}
                >
                  {n} 遍
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border-2 border-rose-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-400">
                第 {Math.min(idx + 1, trials.length)} 试次 · 第 {spec.repeatIndex} 遍
              </span>
              <span className="text-xs font-bold text-slate-400">2 分标准：{target.standard2}</span>
            </div>
            <div className="mt-2 text-xl font-extrabold leading-relaxed text-slate-800" data-testid="dtt-instruction">
              {currentTask.ask}
            </div>
            <div className="mt-2 rounded-xl bg-amber-50 p-2.5 text-sm text-amber-800">
              <span className="font-bold">辅助从轻到重：</span>
              {DTT_PROMPT_LEVELS.filter((p) => p.value !== 'independent')
                .map((p) => p.short)
                .join(' → ')}
              （给了就要往下退）
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {readAloud.supported && (
                <button
                  type="button"
                  onClick={() => readAloud.speakNow(currentTask.ask, COACH.member.id, undefined, 'zh-CN')}
                  className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl bg-sky-500 px-3 text-sm font-bold text-white"
                >
                  🔊 再说一遍指令
                </button>
              )}
              <button
                type="button"
                onClick={enterReview}
                data-testid="finish-practice"
                className="flex h-12 flex-1 items-center justify-center rounded-xl bg-slate-800 px-3 text-sm font-bold text-white"
              >
                提前收尾，去填记录 →
              </button>
            </div>
          </div>

          {trialStage === 'await' && (
            <>
              <div
                className={`rounded-2xl p-3 text-sm font-bold ${waitExpired ? 'bg-amber-100 text-amber-800' : 'bg-slate-50 text-slate-500'}`}
                data-testid="dtt-wait"
              >
                {waitExpired
                  ? '已等满 3 秒没开口 —— 现在给一级辅助，然后再等他一次。'
                  : '说完就闭嘴，等 3 秒。他不开口不要重复指令。'}
              </div>
              <button
                type="button"
                onClick={() => judge('no_response', 'independent')}
                data-testid="judge-no-response"
                className="flex h-12 items-center justify-center rounded-xl border-2 border-slate-300 bg-white text-sm font-bold text-slate-600"
              >
                ⏳ 等不到反应，记为无反应
              </button>
            </>
          )}

          {trialStage === 'judge' && (
            <div className="rounded-2xl border-2 border-slate-200 p-3" data-testid="dtt-judge">
              <div className="mb-2 text-xs font-bold text-slate-500">按刚才这一次反应判定，别掺上次的印象</div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => judge('correct', 'independent')}
                  data-testid="judge-independent"
                  className="flex h-14 flex-1 items-center justify-center rounded-xl bg-emerald-500 px-3 text-sm font-bold text-white"
                >
                  ✅ 独立正确
                </button>
                <button
                  type="button"
                  onClick={() => setShowPromptPicker((v) => !v)}
                  data-testid="judge-prompted"
                  className="flex h-14 flex-1 items-center justify-center rounded-xl bg-amber-400 px-3 text-sm font-bold text-white"
                >
                  🟡 提示后正确
                </button>
                <button
                  type="button"
                  onClick={() => judge('incorrect', 'independent')}
                  data-testid="judge-failed"
                  className="flex h-14 flex-1 items-center justify-center rounded-xl bg-rose-500 px-3 text-sm font-bold text-white"
                >
                  ❌ 错误
                </button>
              </div>
              {showPromptPicker && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {DTT_PROMPT_LEVELS.filter((p) => p.value !== 'independent').map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => judge('correct', p.value)}
                      data-testid={`prompt-${p.value}`}
                      className="flex h-12 flex-1 items-center justify-center rounded-xl border-2 border-amber-300 bg-amber-50 px-3 text-xs font-bold text-amber-800"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {trialStage === 'feedback' && lastJudge && (
            <div
              className={`rounded-2xl border-2 p-3.5 ${feedbackCorrect ? 'border-emerald-300 bg-emerald-50' : 'border-slate-300 bg-slate-50'}`}
              data-testid="dtt-feedback"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg">{feedbackCorrect ? (lastJudge.promptLevel === 'independent' ? '⭐⭐' : '⭐') : '↩️'}</span>
                <span className={`text-sm font-extrabold ${feedbackCorrect ? 'text-emerald-800' : 'text-slate-700'}`}>
                  {feedbackCorrect
                    ? lastJudge.promptLevel === 'independent'
                      ? '独立正确'
                      : `提示后正确（${DTT_PROMPT_LEVELS.find((p) => p.value === lastJudge.promptLevel)?.label}）`
                    : DTT_OUTCOME_LABEL[lastJudge.outcome]}
                </span>
              </div>
              <div className="mt-1 text-xs leading-relaxed text-slate-500">
                {feedbackCorrect ? '结果出现要立刻给，超过 2 秒就不算即时强化了。' : '不批评、不追问原因，退回上一级辅助重来。'}
              </div>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {!feedbackCorrect && (
                  <button
                    type="button"
                    onClick={retry}
                    data-testid="dtt-retry"
                    className="flex h-12 flex-1 items-center justify-center rounded-xl bg-white text-sm font-bold text-slate-700 shadow-sm"
                  >
                    🔁 同一道题再来一遍
                  </button>
                )}
                <button
                  type="button"
                  onClick={advance}
                  data-testid="dtt-next"
                  className="flex h-12 flex-1 items-center justify-center rounded-xl bg-slate-800 text-sm font-bold text-white"
                >
                  {idx + 1 >= trials.length ? '练习结束，去填记录 →' : '下一试次 →'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 右：对话记录 */}
        <div className="flex min-h-0 flex-col rounded-[32px] bg-white/85 shadow-md">
          <div className="border-b-2 border-slate-100 px-4 py-2 text-xs font-bold text-slate-400">孩子原话照录进记录，不改写、不补全</div>
          <div ref={listRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            {lines.map((m) => (
              <ChatBubble
                key={m.id}
                isKid={m.isKid}
                speakerName={m.isKid ? student : COACH.member.name}
                content={m.text}
                companion={m.isKid ? undefined : COACH}
                fontSize={fontSize}
                onReadAloud={!m.isKid && readAloud.supported ? () => readAloud.speakNow(m.text, COACH.member.id, undefined, 'zh-CN') : undefined}
              />
            ))}
          </div>
        </div>
      </div>

      <KidInputBar
        disabled={trialStage !== 'await'}
        placeholder={trialStage === 'await' ? '按住说话，或者打字记下他的回答…' : '这一试次已记录'}
        speechLang="zh-CN"
        onSend={submitAnswer}
      />
    </div>
  );
}
