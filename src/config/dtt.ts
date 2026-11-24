/**
 * DTT（Discrete Trial Training，回合式教学）试次模型
 *
 * 一个试次五要素，缺一不可：
 *   1. 指令（SD）——短、单一、每次只说一遍
 *   2. 辅助（prompt）——预先定好等级，给了就要退
 *   3. 反应（response）——正确 / 错误 / 无反应（给 3 秒等待窗）
 *   4. 结果（consequence）——正确即时具体肯定；错误中性重来，不批评
 *   5. 试次间隔（ITI）——1.5 秒停顿再进下一试次
 *
 * 数据只记「发生了什么」，不推测原因；判定由带课的人点，不由程序猜。
 */

export type DttPromptLevel = 'independent' | 'verbal' | 'model' | 'physical';
export type DttOutcome = 'correct' | 'incorrect' | 'no_response';

export interface DttPromptOption {
  value: DttPromptLevel;
  label: string;
  short: string;
  desc: string;
}

/** 从轻到重，顺序即褪除顺序：能给口头就不给示范，能给示范就不上手 */
export const DTT_PROMPT_LEVELS: DttPromptOption[] = [
  { value: 'independent', label: '独立完成', short: '独立', desc: '没给任何提示，他自己说出来' },
  { value: 'verbal', label: '口头提示', short: '口头', desc: '说前半句、指一下、给二选一' },
  { value: 'model', label: '示范后仿说', short: '示范', desc: '我先说一遍，他跟着说' },
  { value: 'physical', label: '手把手', short: '手把手', desc: '带着他做或带着他发音' },
];

export const DTT_OUTCOME_LABEL: Record<DttOutcome, string> = {
  correct: '正确',
  incorrect: '错误',
  no_response: '无反应',
};

/** 等待窗：3 秒不给反应就当作「无反应」，这时才给辅助 */
export const DTT_WAIT_MS = 3000;
/** 试次间隔：结果出现后停顿，再进下一试次 */
export const DTT_ITI_MS = 1500;

export function promptLabel(level: DttPromptLevel | null | undefined): string {
  return DTT_PROMPT_LEVELS.find((p) => p.value === level)?.short ?? '未记录';
}

export interface DttTrial {
  outcome: DttOutcome | null;
  promptLevel: DttPromptLevel | null;
}

export interface DttStats {
  /** 已判定的试次数 */
  total: number;
  correct: number;
  incorrect: number;
  noResponse: number;
  /** 无辅助独立正确 */
  independentCorrect: number;
  /** 各辅助等级下的正确次数（不含独立） */
  correctByPrompt: Record<Exclude<DttPromptLevel, 'independent'>, number>;
  /** 独立正确率：独立正确 ÷ 已判定试次 */
  independentRate: number;
  /** 最长连续独立正确次数，用来判断是否达到掌握标准 */
  maxIndependentStreak: number;
  /** 当前连续独立正确次数 */
  currentStreak: number;
}

export function computeDttStats(trials: DttTrial[]): DttStats {
  const judged = trials.filter((t) => t.outcome !== null);
  const byPrompt: Record<Exclude<DttPromptLevel, 'independent'>, number> = { verbal: 0, model: 0, physical: 0 };
  let independentCorrect = 0;
  let incorrect = 0;
  let noResponse = 0;

  for (const t of judged) {
    if (t.outcome === 'incorrect') incorrect += 1;
    else if (t.outcome === 'no_response') noResponse += 1;
    else if (t.outcome === 'correct') {
      if (t.promptLevel === 'independent' || t.promptLevel === null) independentCorrect += 1;
      else byPrompt[t.promptLevel] += 1;
    }
  }

  let maxStreak = 0;
  let run = 0;
  for (const t of judged) {
    if (t.outcome === 'correct' && (t.promptLevel === 'independent' || t.promptLevel === null)) {
      run += 1;
      maxStreak = Math.max(maxStreak, run);
    } else {
      run = 0;
    }
  }

  const correct = independentCorrect + byPrompt.verbal + byPrompt.model + byPrompt.physical;
  return {
    total: judged.length,
    correct,
    incorrect,
    noResponse,
    independentCorrect,
    correctByPrompt: byPrompt,
    independentRate: judged.length === 0 ? 0 : independentCorrect / judged.length,
    maxIndependentStreak: maxStreak,
    currentStreak: run,
  };
}

/** 掌握提示：连续 3 次独立正确即可考虑褪除辅助；连续 3 次错误则考虑降级 */
export function dttMasteryHint(stats: DttStats): string | null {
  if (stats.currentStreak >= 3) return `连续 ${stats.currentStreak} 次独立正确，可以开始褪除辅助、把指令难度往上抬一档。`;
  if (stats.total >= 3 && stats.correct === 0) return '这一段连续没做对，先把辅助加回来（示范或手把手），把目标降一级再练。';
  return null;
}

/** 正确后的即时具体肯定，不用「真棒」这类空泛表扬 */
export function dttPraise(promptLevel: DttPromptLevel | null, variant: number): string {
  const independent = ['对了，你自己说完整了。', '对了，这次没等我提示。', '对了，说清楚了，我听到了。'];
  const helped = ['对了，我帮了你一下，你接上了。', '对了，这次是我先说的前半句。', '对了，跟着说出来也算过。'];
  const list = promptLevel === 'independent' || promptLevel === null ? independent : helped;
  return list[variant % list.length];
}

/** 错误 / 无反应的中性回应：不评价、不批评，只给下一步 */
export function dttCorrection(outcome: DttOutcome): string {
  return outcome === 'no_response' ? '没等到他开口，我们加一点辅助再来一次。' : '这次没对上，我们退一步再来一次。';
}

export interface DttJudge {
  outcome: DttOutcome;
  promptLevel: DttPromptLevel;
}

/** DTT 结果 → 课堂记录的 0/1/2 口径：独立正确算 2，辅助后正确算 1，其余算 0 */
export function dttToAchievement(judge: DttJudge): 'independent' | 'prompted' | 'failed' {
  if (judge.outcome !== 'correct') return 'failed';
  return judge.promptLevel === 'independent' ? 'independent' : 'prompted';
}
