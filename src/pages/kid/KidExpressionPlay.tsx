import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  MODALITY_LABEL,
  SESSION_TASK_COUNT,
  fillSlots,
  materialLine,
  pickSessionTasks,
  recordTaskUsage,
  resolvePicks,
  type ExpressionTarget,
  type ExpressionTask,
  type MaterialSlot,
} from '@/config/expressionTargets';
import { EXPRESSION_MODULE, type LessonModule } from '@/config/lessonModules';
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
  composeThreeLines,
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

/** 练习台的「教练」气泡：名字、颜色、表情跟随模块 */
function coachFor(module: LessonModule): KidCompanion {
  return {
    member: {
      id: 'expression-coach',
      kind: 'llm',
      name: module.coachName,
      description: `${module.title}练习教练`,
      source: 'builtin',
      providerId: '',
      model: '',
      customPrompt: '',
    },
    meta: {
      catchphrase: '你讲，我听。',
      greeting: '我们开始吧。',
      color: module.accentColor,
      emoji: module.emoji,
    },
  };
}

// 存储键按模块前缀走：语言表达是 kidbuddy.expression.*，认知是 kidbuddy.cognition.*，
// 这样两个模块各自记自己的教具、轮换和学生名，互不污染。
const rotationKey = (scope: string) => `${scope}.rotation`;
const materialKey = (scope: string) => `${scope}.materials`;
const studentKey = (scope: string) => `${scope}.student`;
const subjectKey = (scope: string) => `${scope}.by`;

/** 这个孩子在这个目标上最近练过哪几道题，越靠后越新 */
function readRotation(scope: string, student: string, targetId: string): string[] {
  try {
    const raw = localStorage.getItem(rotationKey(scope));
    if (!raw) return [];
    const all = JSON.parse(raw) as Record<string, string[]>;
    return all[`${student}::${targetId}`] ?? [];
  } catch {
    return [];
  }
}

function writeRotation(scope: string, student: string, targetId: string, usedIds: string[]): void {
  try {
    const raw = localStorage.getItem(rotationKey(scope));
    const all = raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
    const key = `${student}::${targetId}`;
    all[key] = recordTaskUsage(all[key] ?? [], usedIds);
    localStorage.setItem(rotationKey(scope), JSON.stringify(all));
  } catch {
    // 存不进去最多下次重复抽同一批题，不影响这节课
  }
}

/** 按目标记住上次选的教具，换个教室不用重新选 */
function readPicks(scope: string, targetId: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(materialKey(scope));
    if (!raw) return {};
    const all = JSON.parse(raw) as Record<string, Record<string, string>>;
    return all[targetId] ?? {};
  } catch {
    return {};
  }
}

function writePicks(scope: string, targetId: string, picks: Record<string, string>): void {
  try {
    const raw = localStorage.getItem(materialKey(scope));
    const all = raw ? (JSON.parse(raw) as Record<string, Record<string, string>>) : {};
    all[targetId] = picks;
    localStorage.setItem(materialKey(scope), JSON.stringify(all));
  } catch {
    // 存不进去不影响这节课，下次重新选一遍
  }
}

/** 把题干、提示、判定项里的 {key} 一次性换成今天实际用的教具 */
function fillTasks(tasks: ExpressionTask[], materials: MaterialSlot[], picks: Record<string, string>): ExpressionTask[] {
  return tasks.map((task) => ({
    ...task,
    ask: fillSlots(task.ask, materials, picks),
    hint: fillSlots(task.hint, materials, picks),
    checks: task.checks.map((c) => fillSlots(c, materials, picks)),
  }));
}

function readStudent(scope: string, fallback: string): string {
  try {
    return localStorage.getItem(studentKey(scope)) || fallback;
  } catch {
    return fallback;
  }
}

function readSubject(scope: string): ExpressionSubject {
  try {
    return localStorage.getItem(subjectKey(scope)) === '家长' ? '家长' : '教师';
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
  // 跳过要先判：它没有 outcome，落到最后会显示成「未判定」，容易被误当成漏做
  if (round.skipped) return { text: '已跳过（不计分）', tone: 'bg-slate-100 text-slate-500' };
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

/** 语言表达的练习台入口；认知模块复用同一个页面，只换 module */
export default function KidExpressionPlay() {
  return <LessonPlayPage module={EXPRESSION_MODULE} />;
}

export function LessonPlayPage({ module }: { module: LessonModule }) {
  const { targetId } = useParams();
  const target = module.getTarget(targetId);
  const [replayKey, setReplayKey] = useState(0);
  if (!target) return <Navigate to={module.basePath} replace />;
  return (
    <DttSession
      key={`${target.id}-${replayKey}`}
      target={target}
      module={module}
      onExit={() => setReplayKey((k) => k + 1)}
    />
  );
}

function DttSession({
  target,
  module,
  onExit,
}: {
  target: ExpressionTarget;
  module: LessonModule;
  onExit: () => void;
}) {
  const navigate = useNavigate();
  const { profile, memory, voice, setVoicePrefs } = useKid();
  const readAloud = useReadAloud();
  const coach = coachFor(module);
  const listRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  const scope = module.storagePrefix;
  const student = readStudent(scope, memory.nickname || '小朋友');
  const by = readSubject(scope);

  const [picks, setPicks] = useState<Record<string, string>>(() =>
    resolvePicks(target.materials, readPicks(scope, target.id)),
  );
  const [showMaterials, setShowMaterials] = useState(true);
  /** 本节抽到的题（题库有 8 道，一节只练 4 道，按「多久没练过」轮换） */
  const [drawnIds, setDrawnIds] = useState<string[]>(() =>
    pickSessionTasks(target.tasks, SESSION_TASK_COUNT, readRotation(scope, student, target.id)).map((t) => t.id),
  );
  const drawnTasks = useMemo(() => {
    const byId = new Map(target.tasks.map((t) => [t.id, t]));
    return drawnIds.map((id) => byId.get(id)).filter((t): t is ExpressionTask => Boolean(t));
  }, [target, drawnIds]);
  const tasks = useMemo(() => fillTasks(drawnTasks, target.materials, picks), [drawnTasks, target, picks]);
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

  const fontSize = profile.band === 'preschool' ? 21 : 18;

  const spec = trials[Math.min(idx, trials.length - 1)];
  const currentTask = tasks[spec.taskIndex];
  const stats = computeDttStats(rounds.filter((r) => !r.skipped).map((r) => ({ outcome: r.outcome ?? null, promptLevel: r.promptLevel ?? null })));

  const pushCoach = useCallback(
    (text: string) => {
      setLines((prev) => [...prev, { id: newId('coach'), isKid: false, text }]);
      if (voice.autoReadAloud && readAloud.supported) {
        readAloud.speakNow(text, coach.member.id, undefined, 'zh-CN');
      }
    },
    [readAloud, voice.autoReadAloud],
  );

  /**
   * 起一个试次：说一遍指令，开 3 秒等待窗。
   * 第二个参数用于「刚换掉题库」的场景——那时 tasks 还是上一次渲染的值，
   * 不显式传进来会念出上一批题。
   */
  const startTrial = useCallback(
    (trialSpec: TrialSpec, taskList: ExpressionTask[] = tasks) => {
      const task = taskList[trialSpec.taskIndex];
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

  /**
   * 改每道题的遍数：已判定和已跳过的试次原样保留，只重建没做过的部分。
   * 之前这里是整节课清空重来——孩子状态好想多练两轮，代价是把已做的记录全丢了。
   */
  const changeRepeats = (value: number) => {
    setRepeats(value);
    const nextTrials = buildTrials(tasks, value);
    const kept = new Map(roundsRef.current.filter((r) => r.achievement !== null || r.skipped).map((r) => [r.taskId, r]));
    const nextRounds = nextTrials.map((s) => kept.get(s.key) ?? makeRound(s, tasks));
    setTrials(nextTrials);
    persistRounds(nextRounds);
    const firstOpen = nextRounds.findIndex((r) => r.achievement === null && !r.skipped);
    const nextIdx = firstOpen === -1 ? nextRounds.length - 1 : firstOpen;
    setIdx(nextIdx);
    startTrial(nextTrials[nextIdx]);
  };

  /**
   * 换教具：只重建还没做的试次，已经判定的保持当时的题干不动——
   * 记录要反映当时真实用的东西，不能被后来的替换改掉。
   */
  const changeMaterial = (slotKey: string, name: string) => {
    const nextPicks = { ...picks, [slotKey]: name };
    setPicks(nextPicks);
    writePicks(scope, target.id, nextPicks);
    // 只重填本节抽到的那几道，试次下标是按这一批算的
    const nextTasks = fillTasks(drawnTasks, target.materials, nextPicks);
    const nextRounds = trials.map((s, i) => {
      const old = roundsRef.current[i];
      if (old && (old.achievement !== null || old.skipped)) return old;
      return makeRound(s, nextTasks);
    });
    persistRounds(nextRounds);
    const current = nextRounds[idx];
    if (current && current.achievement === null && !current.skipped) {
      pushCoach(`换成「${name}」，我们重新来：第 ${spec.repeatIndex} 遍：${nextTasks[spec.taskIndex].ask}`);
      setTrialStage('await');
      setWaitExpired(false);
      setShowPromptPicker(false);
      setAnswerDraft('');
      setTrialSeq((n) => n + 1);
    }
  };

  /** 换一批：还没开始判定时，从题库里另外抽几道 */
  const redraw = () => {
    if (roundsRef.current.some((r) => r.achievement !== null || r.skipped)) return;
    const nextDrawn = pickSessionTasks(target.tasks, SESSION_TASK_COUNT, [
      ...readRotation(scope, student, target.id),
      ...drawnIds,
    ]);
    const nextTasks = fillTasks(nextDrawn, target.materials, picks);
    const nextTrials = buildTrials(nextTasks, repeats);
    setDrawnIds(nextDrawn.map((t) => t.id));
    setTrials(nextTrials);
    persistRounds(nextTrials.map((s) => makeRound(s, nextTasks)));
    setIdx(0);
    setLines([]);
    pushCoach('换一批题，我们重新开始。');
    startTrial(nextTrials[0], nextTasks);
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

  /**
   * 这题先跳过：教具凑不出来、孩子这会儿不配合、场地做不了。
   * 记 skipped 而不是「没做到」，后面所有统计都排除它，分数不会被凭空拉低。
   */
  const skipCurrent = () => {
    const next = roundsRef.current.map((r, i) => (i === idx ? { ...r, skipped: true, achievement: null, outcome: null } : r));
    persistRounds(next);
    pushCoach('这题先跳过，我们换下一个。');
    advance();
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
    const book = module.loadBook();
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
      materials: picks,
      createdAt: Date.now(),
    };
    module.addSession(book, session);
    writeRotation(scope, student, target.id, drawnIds);
    setSaved(session);
    setPhase('saved');
  };

  // ======================= 评审页 =======================
  if (phase === 'review') {
    const mastery = dttMasteryHint(stats);
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-8" data-testid="expression-review">
        <div className="mx-auto w-full max-w-4xl space-y-4 py-3">
          <div className={`rounded-[28px] bg-gradient-to-r ${module.headerGradient} p-5 text-white shadow-lg`}>
            <h1 className="text-2xl font-extrabold">填写这节课的记录</h1>
            <p className="mt-1 text-sm opacity-95">
              {target.id} {target.name} · DTT 已判定 {stats.total}/{rounds.filter((r) => !r.skipped).length} 试次
              {rounds.some((r) => r.skipped) ? `（跳过 ${rounds.filter((r) => r.skipped).length} 题不计分）` : ''} · 独立正确{' '}
              {stats.independentCorrect}（{Math.round(stats.independentRate * 100)}%）· 最长连续独立 {stats.maxIndependentStreak} 次
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
                                  : `${module.accent.ring} ${module.accent.solid} text-white`
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
                    score === s ? `${module.accent.ring} ${module.accent.soft} ${module.accent.textStrong}` : 'border-slate-200 bg-white text-slate-500'
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
                  className={`mt-1 w-full rounded-xl border-2 border-slate-200 p-2.5 text-sm outline-none ${module.accent.focusRing}`}
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
                  className={`mt-1 w-full rounded-xl border-2 border-slate-200 p-2.5 text-sm outline-none ${module.accent.focusRing}`}
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
                  className={`mt-1 w-full rounded-xl border-2 border-slate-200 p-2.5 text-sm outline-none ${module.accent.focusRing}`}
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
                className={`mt-1 w-full rounded-xl border-2 border-slate-200 p-2.5 text-sm outline-none ${module.accent.focusRing}`}
              />
            </label>
            <label className="mt-3 block">
              <span className="text-xs font-bold text-slate-500">{by === '家长' ? '下次课调整' : '本周家庭任务 / 下次调整'}</span>
              <textarea
                value={nextStep}
                onChange={(e) => setNextStep(e.target.value)}
                rows={2}
                placeholder="一句话说清下周练什么、怎么练"
                className={`mt-1 w-full rounded-xl border-2 border-slate-200 p-2.5 text-sm outline-none ${module.accent.focusRing}`}
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2 pb-4">
            <button type="button" onClick={() => setPhase('run')} className="h-14 flex-1 rounded-2xl bg-white text-base font-bold text-slate-600 shadow-sm">
              回去再练几个试次
            </button>
            <button type="button" onClick={save} data-testid="save-session" className={`h-14 flex-[2] rounded-2xl ${module.accent.solid} text-base font-extrabold text-white shadow-sm`}>
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
            <button type="button" onClick={() => navigate(module.basePath)} className={`flex h-14 items-center justify-center rounded-2xl ${module.accent.solid} text-base font-bold text-white`}>
              回{module.title}
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
        <Link to={module.basePath} aria-label={`返回${module.title}`} className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-2xl shadow-sm">
          ←
        </Link>
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${module.accent.icon} text-3xl`} aria-hidden>{module.emoji}</div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-extrabold text-slate-800">
            {target.id} {target.name}
          </h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <span
              className={`rounded px-1.5 py-0.5 text-[11px] font-extrabold ${
                target.modality === 'receptive' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {MODALITY_LABEL[target.modality]}
            </span>
            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-bold text-violet-700">
              VB-MAPP {target.vbMapp.tag}
            </span>
          </div>
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
          {/* 教具：上课前选一次，全课题干自动替换，不用现场改词 */}
          {target.materials.length > 0 && (
            <div className="rounded-2xl bg-sky-50 px-3 py-2" data-testid="material-picker">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-sky-700">今天用什么教具</span>
                <button
                  type="button"
                  onClick={() => setShowMaterials((v) => !v)}
                  data-testid="material-toggle"
                  className="h-12 px-2 text-xs font-bold text-sky-600 underline"
                >
                  {showMaterials ? '收起' : '展开'}
                </button>
              </div>
              {showMaterials ? (
                target.materials.map((slot) => (
                  <div key={slot.key} className="mt-2">
                    <div className="text-[11px] font-bold text-slate-500">{slot.label}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {slot.options.map((opt) => (
                        <button
                          key={opt.name}
                          type="button"
                          onClick={() => changeMaterial(slot.key, opt.name)}
                          data-testid={`material-${slot.key}-${opt.name}`}
                          title={opt.note ?? ''}
                          className={`h-12 rounded-full px-3 text-xs font-bold ${
                            picks[slot.key] === opt.name ? 'bg-sky-500 text-white' : 'bg-white text-slate-600 shadow-sm'
                          }`}
                        >
                          {opt.name}
                        </button>
                      ))}
                    </div>
                    <div className="mt-1 text-[11px] leading-snug text-slate-400">都没有？{slot.fallback}</div>
                  </div>
                ))
              ) : (
                <div className="mt-1 truncate text-xs font-bold text-slate-500">{materialLine(target.materials, picks)}</div>
              )}
            </div>
          )}

          <div className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl ${module.accent.soft} px-3 py-2`}>
            <span className={`text-xs font-bold ${module.accent.text}`}>每道题练几遍</span>
            <div className={`flex overflow-hidden rounded-xl border-2 ${module.accent.softBorder}`}>
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => changeRepeats(n)}
                  data-testid={`repeats-${n}`}
                  className={`h-12 px-4 text-sm font-bold ${
                    repeats === n ? `${module.accent.solid} text-white` : 'bg-white text-slate-500'
                  }`}
                >
                  {n} 遍
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-violet-50 px-3 py-2" data-testid="task-pool">
            <span className="text-xs font-bold text-violet-700">
              本节抽到 {drawnIds.length} 道 / 题库共 {target.tasks.length} 道
            </span>
            <button
              type="button"
              onClick={redraw}
              data-testid="redraw-tasks"
              className="h-12 rounded-xl bg-white px-3 text-xs font-bold text-violet-600 shadow-sm"
            >
              换一批
            </button>
          </div>

          <div className={`rounded-2xl border-2 ${module.accent.softBorder} bg-white p-4`}>
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
            {target.modality === 'receptive' && (
              <div className="mt-2 rounded-xl bg-slate-100 p-2.5 text-sm font-bold text-slate-700">
                这条看动作，不要求开口：他没出声、但两步都做对了，就记独立正确。
              </div>
            )}
            <div className="mt-2 rounded-xl bg-emerald-50 p-2.5 text-sm text-emerald-800">
              <span className="font-bold">本次达标：</span>
              {target.sessionSuccess}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {readAloud.supported && (
                <button
                  type="button"
                  onClick={() => readAloud.speakNow(currentTask.ask, coach.member.id, undefined, 'zh-CN')}
                  className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl bg-sky-500 px-3 text-sm font-bold text-white"
                >
                  🔊 再说一遍指令
                </button>
              )}
              <button
                type="button"
                onClick={skipCurrent}
                data-testid="skip-trial"
                className="flex h-12 flex-1 items-center justify-center rounded-xl border-2 border-slate-300 bg-white px-3 text-sm font-bold text-slate-600"
              >
                这题跳过 →
              </button>
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
                  ? '已等满 3 秒没反应 —— 现在给一级辅助，然后再等他一次。'
                  : '说完就闭嘴，等 3 秒。他没反应不要重复指令。'}
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
                  className={`flex h-14 flex-1 items-center justify-center rounded-xl ${module.accent.solid} px-3 text-sm font-bold text-white`}
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
                <button
                  type="button"
                  onClick={retry}
                  data-testid="dtt-retry"
                  className="flex h-12 flex-1 items-center justify-center rounded-xl bg-white text-sm font-bold text-slate-700 shadow-sm"
                >
                  {feedbackCorrect ? '🔁 再做一遍巩固' : '🔁 同一道题再来一遍'}
                </button>
                <button
                  type="button"
                  onClick={skipCurrent}
                  data-testid="skip-trial-feedback"
                  className="flex h-12 items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-3 text-sm font-bold text-slate-500"
                >
                  跳过
                </button>
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
                speakerName={m.isKid ? student : coach.member.name}
                content={m.text}
                companion={m.isKid ? undefined : coach}
                fontSize={fontSize}
                onReadAloud={!m.isKid && readAloud.supported ? () => readAloud.speakNow(m.text, coach.member.id, undefined, 'zh-CN') : undefined}
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
