import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  EXPRESSION_STAGES,
  EXPRESSION_TARGETS_BY_STAGE,
  MODALITY_LABEL,
  isStageBand,
  stageGroups,
  suggestNextTarget,
  tierOf,
  type ExpressionBand,
  type ExpressionTier,
  type ExpressionTarget,
} from '@/config/expressionTargets';
import {
  SCORE_LABEL,
  STABILITY_LABEL,
  historyLine,
  loadBook,
  nextSessionNo,
  sessionsOf,
  targetStat,
  type ExpressionBook,
  type ExpressionSession,
  type ExpressionSubject,
  type StabilityStatus,
} from '@/config/kidExpression';
import { RecordExportSheet } from './components/RecordExportSheet';
import { useKid } from './KidContext';

const STUDENT_KEY = 'kidbuddy.expression.student';
const SUBJECT_KEY = 'kidbuddy.expression.by';
const STAGE_KEY = 'kidbuddy.expression.stage';

function readStudent(fallback: string): string {
  try {
    return localStorage.getItem(STUDENT_KEY) || fallback;
  } catch {
    return fallback;
  }
}

function readStage(): ExpressionBand | 'all' {
  try {
    const raw = localStorage.getItem(STAGE_KEY);
    return isStageBand(raw) ? raw : 'all';
  } catch {
    return 'all';
  }
}

function readSubject(): ExpressionSubject {
  try {
    return localStorage.getItem(SUBJECT_KEY) === '家长' ? '家长' : '教师';
  } catch {
    return '教师';
  }
}

const statusStyle: Record<StabilityStatus, string> = {
  none: 'bg-slate-100 text-slate-500',
  progressing: 'bg-sky-100 text-sky-700',
  pending: 'bg-amber-100 text-amber-700',
  stable: 'bg-emerald-100 text-emerald-700',
};

function ScoreChip({ score }: { score: number | null }) {
  if (score === null) return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">未打分</span>;
  const color = score === 2 ? 'bg-emerald-100 text-emerald-700' : score === 1 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700';
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${color}`}>{score} 分 · {SCORE_LABEL[score as 0 | 1 | 2]}</span>;
}

const tierStyle: Record<ExpressionTier, string> = {
  入门: 'bg-emerald-50 text-emerald-700',
  进阶: 'bg-sky-50 text-sky-700',
  挑战: 'bg-violet-50 text-violet-700',
};

function TargetCard({
  target,
  recommended,
  book,
  student,
}: {
  target: ExpressionTarget;
  recommended: boolean;
  book: ExpressionBook;
  student: string;
}) {
  const stat = targetStat(book, student, target.id);
  const tier = tierOf(target.difficulty);
  return (
    <Link
      to={`/expression/${target.id}`}
      data-testid={`expression-target-${target.id}`}
      className={`flex flex-col gap-2.5 rounded-[28px] border-4 bg-white p-4 shadow-md transition active:scale-[0.98] ${
        recommended ? 'border-rose-300 ring-4 ring-rose-100' : 'border-rose-100'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              data-testid={`expression-step-${target.id}`}
              title={`全表第 ${target.difficulty} 级（共 ${EXPRESSION_TARGETS_BY_STAGE.length} 个目标），数字越小越容易`}
              className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-rose-500 px-1.5 text-xs font-extrabold text-white"
            >
              {target.difficulty}
            </span>
            <span className="rounded-lg bg-rose-100 px-2 py-0.5 text-xs font-extrabold text-rose-700">{target.id}</span>
            <span className="text-lg font-extrabold text-slate-800">{target.name}</span>
            <span
              data-testid={`expression-modality-${target.id}`}
              title={target.modality === 'receptive' ? '听者反应：看动作对不对，不要求开口' : '表达：要把话说出来'}
              className={`rounded px-1.5 py-0.5 text-[11px] font-extrabold ${
                target.modality === 'receptive' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {MODALITY_LABEL[target.modality]}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${tierStyle[tier]}`}>{tier}</span>
          </div>
          <p className="mt-1 text-sm leading-snug text-slate-500">{target.summary}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${statusStyle[stat.status]}`}>
          {STABILITY_LABEL[stat.status]}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ScoreChip score={stat.last} />
        <span className="text-xs text-slate-400">已练 {stat.attempts} 次</span>
        <span
          data-testid={`expression-vbmapp-${target.id}`}
          className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-bold text-violet-700"
          title={target.vbMapp.milestone}
        >
          VB-MAPP {target.vbMapp.tag}
        </span>
      </div>
      <div className="rounded-xl bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-500">{historyLine(stat)}</div>
      <div className="mt-auto flex items-start justify-between gap-2 pt-1">
        <span className="line-clamp-2 min-w-0 flex-1 text-xs leading-snug text-slate-400">2 分标准：{target.standard2}</span>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
            recommended ? 'bg-rose-500 text-white' : 'bg-rose-50 text-rose-600'
          }`}
        >
          {recommended ? '建议从这里练 →' : '开始 →'}
        </span>
      </div>
    </Link>
  );
}

export default function KidExpression() {
  const { memory } = useKid();
  const [book] = useState<ExpressionBook>(loadBook);
  const [student, setStudent] = useState(() => readStudent(memory.nickname || '小朋友'));
  const [subject, setSubject] = useState<ExpressionSubject>(readSubject);
  const [exporting, setExporting] = useState<ExpressionSession | null>(null);
  const [stage, setStage] = useState<ExpressionBand | 'all'>(readStage);

  const mine = sessionsOf(book, student);
  const stableIds = EXPRESSION_TARGETS_BY_STAGE.filter(
    (t) => targetStat(book, student, t.id).status === 'stable',
  ).map((t) => t.id);
  const stableCount = stableIds.length;
  const pendingCount = EXPRESSION_TARGETS_BY_STAGE.filter(
    (t) => targetStat(book, student, t.id).status === 'pending',
  ).length;
  const nextTarget = suggestNextTarget(stableIds);
  const groups = stageGroups(stage);

  const changeStage = (value: ExpressionBand | 'all') => {
    setStage(value);
    try {
      localStorage.setItem(STAGE_KEY, value);
    } catch {
      /* 忽略 */
    }
  };

  const changeStudent = (value: string) => {
    setStudent(value);
    try {
      localStorage.setItem(STUDENT_KEY, value);
    } catch {
      /* 忽略 */
    }
  };

  const changeSubject = (value: ExpressionSubject) => {
    setSubject(value);
    try {
      localStorage.setItem(SUBJECT_KEY, value);
    } catch {
      /* 忽略 */
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-5 pb-8 pt-2" data-testid="kid-expression-page">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-[32px] bg-gradient-to-r from-rose-400 to-orange-400 p-6 text-white shadow-lg">
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-4xl" aria-hidden>💬</span>
            <div>
              <h1 className="text-3xl font-extrabold">说说小课堂</h1>
              <p className="mt-1 text-base opacity-95">练表达与听指令：开口要东西、听两步指令、说清一件事——每次练完留一份可统计的记录。</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="rounded-2xl bg-white/20 px-4 py-2 text-center">
              <div className="text-2xl font-extrabold">{mine.length}</div>
              <div className="text-xs opacity-90">已记录课时</div>
            </div>
            <div className="rounded-2xl bg-white/20 px-4 py-2 text-center">
              <div className="text-2xl font-extrabold">{stableCount}</div>
              <div className="text-xs opacity-90">已稳定目标</div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-[28px] bg-white p-4 shadow-sm">
          <label className="flex items-center gap-2 text-sm font-bold text-slate-600">
            孩子
            <input
              value={student}
              onChange={(e) => changeStudent(e.target.value)}
              data-testid="expression-student"
              className="h-12 w-36 rounded-xl border-2 border-slate-200 px-3 text-base font-bold text-slate-800 outline-none focus:border-rose-400"
            />
          </label>
          <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
            这节课谁带
            <div className="flex overflow-hidden rounded-xl border-2 border-slate-200">
              {(['教师', '家长'] as ExpressionSubject[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  data-testid={`expression-subject-${v}`}
                  onClick={() => changeSubject(v)}
                  className={`h-12 px-4 text-sm font-bold ${subject === v ? 'bg-rose-500 text-white' : 'bg-white text-slate-500'}`}
                >
                  {v === '教师' ? '老师带' : '家长带'}
                </button>
              ))}
            </div>
          </div>
          <span className="text-xs text-slate-400">
            下一节是第 {nextSessionNo(book, student)} 课时（同一孩子连续编号，跨天不重置）
          </span>
        </div>

        {pendingCount > 0 && (
          <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
            ⚠️ 有 {pendingCount} 个目标是「待复核」：最近两次都是 2 分，但一次教师课、一次家长课。
            需要一节教师课复测，才能算稳定。
          </div>
        )}

        <div>
          <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-xl font-extrabold text-slate-800">选一个目标开始练</h2>
            <span className="text-xs font-bold text-slate-400">
              先按学段（B → G → K），段内由易到难；圆圈数字是全表台阶，与目标编号同向递增
            </span>
          </div>

          <div className="mb-4 flex flex-wrap gap-2" data-testid="expression-stage-filter">
            {([
              { key: 'all' as const, label: '全部学段' },
              ...EXPRESSION_STAGES.map((s) => ({ key: s.band, label: `${s.ageLabel} ${s.code}` })),
            ]).map((option) => {
              const active = stage === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  data-testid={`stage-filter-${option.key}`}
                  aria-pressed={active}
                  onClick={() => changeStage(option.key)}
                  className={`h-12 rounded-full px-4 text-sm font-bold transition ${
                    active ? 'bg-rose-500 text-white shadow-sm' : 'bg-white text-slate-500 shadow-sm'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.stage.band} data-testid={`stage-group-${group.stage.band}`}>
                <div className="mb-2 flex flex-wrap items-baseline gap-2">
                  <h3 className="text-sm font-extrabold text-slate-600">
                    {group.stage.ageLabel} · {group.stage.domainLabel}
                  </h3>
                  <span className="text-xs font-bold text-slate-400">
                    {group.stage.code} 段 · {group.targets.length} 个目标
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {group.targets.map((t) => (
                    <TargetCard
                      key={t.id}
                      target={t}
                      recommended={nextTarget?.id === t.id}
                      book={book}
                      student={student}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[32px] bg-white/90 p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-extrabold text-slate-800">📋 课时记录（{mine.length}）</h2>
            <span className="text-xs text-slate-400">点「导出」拿到可并入上课记录的 .md</span>
          </div>
          {mine.length === 0 ? (
            <p className="py-6 text-center text-base text-slate-400">还没有记录。挑一个目标，和孩子练完一轮就会自动生成。</p>
          ) : (
            <div className="space-y-2">
              {mine
                .slice()
                .reverse()
                .map((s) => (
                  <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-slate-100 p-3">
                    <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">第{s.sessionNo}课时</span>
                    <span className="text-sm font-bold text-slate-700">{s.date} · {s.topic}</span>
                    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-600">{s.targetId}</span>
                    <span className="rounded-full bg-slate-50 px-2 py-0.5 text-xs font-bold text-slate-500">{s.by}</span>
                    <ScoreChip score={s.score} />
                    <button
                      type="button"
                      onClick={() => setExporting(s)}
                      className="ml-auto h-12 rounded-xl bg-slate-800 px-4 text-xs font-bold text-white"
                    >
                      导出
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
      {exporting && <RecordExportSheet session={exporting} onClose={() => setExporting(null)} />}
    </div>
  );
}
