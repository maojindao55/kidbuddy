/**
 * 小课堂模块注册表
 *
 * 语言表达（说说小课堂）和认知理解走的是同一套课堂流程：
 * 选目标 → 选教具 → 每节抽 4 道 → DTT 试次判定 → 打分 → 三行记录 → 导出。
 * 差别只有「题库」和「账本 key」，所以把差异收敛到这里，页面本身不含任何模块特有逻辑。
 */

import {
  EXPRESSION_STAGES,
  EXPRESSION_TARGETS_BY_STAGE,
  getExpressionTarget,
  stageGroups,
  suggestNextTarget,
  type ExpressionBand,
  type ExpressionStage,
  type ExpressionStageGroup,
  type ExpressionTarget,
} from './expressionTargets';
import {
  COGNITION_STAGES,
  COGNITION_TARGETS_BY_STAGE,
  cognitionStageGroups,
  getCognitionTarget,
  suggestNextCognition,
} from './cognitionTargets';
import {
  addSessionTo,
  loadBookFrom,
  type ExpressionBook,
  type ExpressionSession,
} from './kidExpression';

export type LessonModuleId = 'expression' | 'cognition';

export interface LessonModule {
  id: LessonModuleId;
  title: string;
  emoji: string;
  /** 路由前缀，如 /expression */
  basePath: string;
  /** 卡片和页面头部的一句话 */
  tagline: string;
  /** 练习台气泡里的称呼 */
  coachName: string;
  /** 主色，用于教练头像等 */
  accentColor: string;
  /** 目标列表页头部渐变（Tailwind class 片段） */
  headerGradient: string;
  /** 强调色：练习台的选中态、按钮、卡片边框都跟着它走 */
  accent: {
    solid: string;
    ring: string;
    soft: string;
    softBorder: string;
    text: string;
    textStrong: string;
    icon: string;
    focusRing: string;
  };
  /** 账本 localStorage key */
  bookKey: string;
  /** localStorage 前缀，如 kidbuddy.expression（教具、轮换、学生名都挂在这下面） */
  storagePrefix: string;
  /** 按「学段 → 难度」排好的目标 */
  targets: ExpressionTarget[];
  stages: ExpressionStage[];
  getTarget: (id?: string) => ExpressionTarget | undefined;
  stageGroups: (only: ExpressionBand | 'all') => ExpressionStageGroup[];
  suggestNext: (stableIds: string[]) => ExpressionTarget | undefined;
  loadBook: () => ExpressionBook;
  addSession: (book: ExpressionBook, session: ExpressionSession) => ExpressionBook;
}

export const EXPRESSION_MODULE: LessonModule = {
  id: 'expression',
  title: '说说小课堂',
  emoji: '💬',
  basePath: '/expression',
  tagline: '练表达与听指令：开口要东西、听两步指令、说清一件事——每次练完留一份可统计的记录。',
  coachName: '说说老师',
  accentColor: '#F97316',
  headerGradient: 'from-rose-400 to-orange-400',
  accent: {
    solid: 'bg-rose-500',
    ring: 'border-rose-400',
    soft: 'bg-rose-50',
    softBorder: 'border-rose-200',
    text: 'text-rose-600',
    textStrong: 'text-rose-700',
    icon: 'bg-rose-100',
    focusRing: 'focus:border-rose-400',
  },
  bookKey: 'kidbuddy.expression.book.v1',
  storagePrefix: 'kidbuddy.expression',
  targets: EXPRESSION_TARGETS_BY_STAGE,
  stages: EXPRESSION_STAGES,
  getTarget: getExpressionTarget,
  stageGroups,
  suggestNext: suggestNextTarget,
  loadBook: () => loadBookFrom('kidbuddy.expression.book.v1'),
  addSession: (book, session) => addSessionTo('kidbuddy.expression.book.v1', book, session),
};

export const COGNITION_MODULE: LessonModule = {
  id: 'cognition',
  title: '认知理解',
  emoji: '🧩',
  basePath: '/cognition',
  tagline: '练配对、分类、特征功能与推理：从「找一个一样的」到「为什么该用它」——每次练完留一份可统计的记录。',
  coachName: '认知老师',
  accentColor: '#6366F1',
  headerGradient: 'from-indigo-400 to-violet-500',
  accent: {
    solid: 'bg-indigo-500',
    ring: 'border-indigo-400',
    soft: 'bg-indigo-50',
    softBorder: 'border-indigo-200',
    text: 'text-indigo-600',
    textStrong: 'text-indigo-700',
    icon: 'bg-indigo-100',
    focusRing: 'focus:border-indigo-400',
  },
  bookKey: 'kidbuddy.cognition.book.v1',
  storagePrefix: 'kidbuddy.cognition',
  targets: COGNITION_TARGETS_BY_STAGE,
  stages: COGNITION_STAGES,
  getTarget: getCognitionTarget,
  stageGroups: cognitionStageGroups,
  suggestNext: suggestNextCognition,
  loadBook: () => loadBookFrom('kidbuddy.cognition.book.v1'),
  addSession: (book, session) => addSessionTo('kidbuddy.cognition.book.v1', book, session),
};

export const LESSON_MODULES: Record<LessonModuleId, LessonModule> = {
  expression: EXPRESSION_MODULE,
  cognition: COGNITION_MODULE,
};
