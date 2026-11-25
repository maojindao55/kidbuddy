/**
 * 拼图乐园：9 关，画面全部是本地生成的 SVG，不依赖任何图片资源和网络。
 *
 * 为什么用 SVG 而不是图片：拼图需要把一张图切成 N 块。用 viewBox/背景定位切 SVG，
 * 任意关卡数、任意屏幕尺寸都能切得干净，也不用为 9 张图各存一份切好的碎片。
 *
 * 本模块零运行时依赖（连 type import 都没有），方便 node 测试直接 transpile 导入。
 */

/** 只用到 ageProfile.AgeBand 里的两个值，这里本地声明，避免运行时/编译依赖 */
export type PuzzleBand = 'preschool' | 'school';

export type PuzzleSceneId =
  | 'sun-hill'
  | 'little-house'
  | 'big-tree'
  | 'sail-boat'
  | 'rainbow'
  | 'little-car'
  | 'flower-garden'
  | 'moon-night'
  | 'birthday-cake';

export interface PuzzleScene {
  id: PuzzleSceneId;
  /** 关卡标题也用这个名字，两边必须一致（有测试卡着） */
  name: string;
  emoji: string;
  /** 背景线性渐变：上 → 下 */
  bg: [string, string];
  /** svg 内部图形，坐标系固定 0 0 100 100 */
  shapes: string;
}

/** 画面统一 100×100 坐标系，切块时按这个比例算 */
export const PUZZLE_CANVAS = 100;

export const PUZZLE_SCENES: PuzzleScene[] = [
  {
    id: 'sun-hill',
    name: '太阳小山',
    emoji: '☀️',
    bg: ['#CDEEFF', '#F1FAFF'],
    shapes: `
      <circle cx="24" cy="22" r="12" fill="#FFD24A"/>
      <g stroke="#FFC93C" stroke-width="2.2" stroke-linecap="round">
        <line x1="24" y1="3" x2="24" y2="8"/><line x1="24" y1="36" x2="24" y2="41"/>
        <line x1="5" y1="22" x2="10" y2="22"/><line x1="38" y1="22" x2="43" y2="22"/>
        <line x1="10" y1="8" x2="14" y2="12"/><line x1="34" y1="32" x2="38" y2="36"/>
        <line x1="38" y1="8" x2="34" y2="12"/><line x1="14" y1="32" x2="10" y2="36"/>
      </g>
      <ellipse cx="62" cy="30" rx="14" ry="8" fill="#FFFFFF" opacity="0.92"/>
      <ellipse cx="74" cy="32" rx="10" ry="6" fill="#FFFFFF" opacity="0.92"/>
      <ellipse cx="26" cy="96" rx="54" ry="26" fill="#8FD86A"/>
      <ellipse cx="86" cy="102" rx="44" ry="24" fill="#6FC94F"/>
      <path d="M66 82 q4 -16 8 0" stroke="#4E9F3D" stroke-width="2.2" fill="none"/>
      <circle cx="70" cy="72" r="4.5" fill="#FF8FB1"/>
      <circle cx="70" cy="72" r="1.8" fill="#FFD24A"/>
    `,
  },
  {
    id: 'little-house',
    name: '小房子',
    emoji: '🏠',
    bg: ['#FFE9C7', '#FFF8EC'],
    shapes: `
      <circle cx="82" cy="14" r="8" fill="#FFD24A"/>
      <rect x="0" y="86" width="100" height="14" fill="#8FD86A"/>
      <rect x="62" y="22" width="8" height="14" fill="#C9553F"/>
      <polygon points="50,18 80,48 20,48" fill="#E86A5B"/>
      <rect x="26" y="48" width="48" height="38" fill="#FFD8A8"/>
      <rect x="31" y="56" width="11" height="11" rx="1" fill="#8FD3F4"/>
      <rect x="58" y="56" width="11" height="11" rx="1" fill="#8FD3F4"/>
      <rect x="44" y="64" width="14" height="22" rx="2" fill="#B5733A"/>
      <circle cx="55" cy="76" r="1.5" fill="#FFD24A"/>
      <path d="M6 86 q10 -8 20 0" stroke="#4E9F3D" stroke-width="2" fill="none"/>
      <circle cx="12" cy="83" r="3" fill="#FF8FB1"/>
      <circle cx="88" cy="88" r="3" fill="#FFFFFF" opacity="0.8"/>
    `,
  },
  {
    id: 'big-tree',
    name: '大树小鸟',
    emoji: '🌳',
    bg: ['#E3F7E6', '#F8FFF9'],
    shapes: `
      <circle cx="80" cy="16" r="9" fill="#FFD24A"/>
      <rect x="0" y="82" width="100" height="18" fill="#8FD86A"/>
      <rect x="44" y="56" width="13" height="34" rx="3" fill="#A97142"/>
      <circle cx="50" cy="42" r="24" fill="#4CAF50"/>
      <circle cx="30" cy="52" r="15" fill="#66BB6A"/>
      <circle cx="70" cy="52" r="15" fill="#66BB6A"/>
      <circle cx="40" cy="36" r="3" fill="#E53935"/>
      <circle cx="58" cy="46" r="3" fill="#E53935"/>
      <circle cx="62" cy="33" r="3" fill="#E53935"/>
      <ellipse cx="22" cy="26" rx="6" ry="5" fill="#F06292"/>
      <polygon points="28,26 34,23 34,29" fill="#FFB300"/>
      <circle cx="20" cy="25" r="1.4" fill="#3B4252"/>
      <path d="M14 32 l-4 6" stroke="#F06292" stroke-width="1.6" stroke-linecap="round"/>
    `,
  },
  {
    id: 'sail-boat',
    name: '大海帆船',
    emoji: '⛵',
    bg: ['#CDEBFF', '#EEF8FF'],
    shapes: `
      <circle cx="80" cy="16" r="9" fill="#FFD24A"/>
      <ellipse cx="20" cy="22" rx="12" ry="6" fill="#FFFFFF" opacity="0.9"/>
      <rect x="0" y="60" width="100" height="40" fill="#4FA8E8"/>
      <path d="M0 66 q8 -4 16 0 t16 0 t16 0 t16 0 t16 0 t16 0" stroke="#7FC4F5" stroke-width="3" fill="none"/>
      <rect x="49" y="16" width="2.5" height="42" fill="#8B5E3C"/>
      <polygon points="48,18 48,56 28,56" fill="#FFFFFF"/>
      <polygon points="53,24 53,56 72,56" fill="#F1EAD9"/>
      <polygon points="28,58 72,58 64,72 36,72" fill="#C97B4A"/>
      <circle cx="84" cy="84" r="2.5" fill="#FFFFFF" opacity="0.7"/>
      <circle cx="16" cy="76" r="2" fill="#FFFFFF" opacity="0.7"/>
    `,
  },
  {
    id: 'rainbow',
    name: '彩虹云朵',
    emoji: '🌈',
    bg: ['#E9F3FF', '#FFFFFF'],
    shapes: `
      <path d="M8 72 A42 42 0 0 1 92 72" stroke="#FF6B6B" stroke-width="9" fill="none"/>
      <path d="M18 72 A32 32 0 0 1 82 72" stroke="#FFA94D" stroke-width="9" fill="none"/>
      <path d="M28 72 A22 22 0 0 1 72 72" stroke="#FFD24A" stroke-width="9" fill="none"/>
      <path d="M38 72 A12 12 0 0 1 62 72" stroke="#7ED6A5" stroke-width="9" fill="none"/>
      <ellipse cx="20" cy="74" rx="16" ry="10" fill="#FFFFFF"/>
      <ellipse cx="15" cy="68" rx="9" ry="7" fill="#FFFFFF"/>
      <ellipse cx="80" cy="74" rx="16" ry="10" fill="#FFFFFF"/>
      <ellipse cx="85" cy="68" rx="9" ry="7" fill="#FFFFFF"/>
      <rect x="0" y="84" width="100" height="16" fill="#8FD86A"/>
      <circle cx="50" cy="92" r="3" fill="#FF8FB1"/>
    `,
  },
  {
    id: 'little-car',
    name: '小汽车',
    emoji: '🚗',
    bg: ['#FFF0E0', '#FFFDF8'],
    shapes: `
      <rect x="0" y="80" width="100" height="20" fill="#7A8699"/>
      <g stroke="#FFFFFF" stroke-width="3" stroke-linecap="round">
        <line x1="4" y1="90" x2="18" y2="90"/><line x1="28" y1="90" x2="42" y2="90"/>
        <line x1="52" y1="90" x2="66" y2="90"/><line x1="76" y1="90" x2="90" y2="90"/>
      </g>
      <rect x="12" y="52" width="76" height="24" rx="10" fill="#FF7A59"/>
      <path d="M30 52 q4 -16 14 -16 h14 q10 0 14 16 z" fill="#FF9E80"/>
      <rect x="36" y="40" width="13" height="12" rx="2" fill="#BEE7FF"/>
      <rect x="53" y="40" width="13" height="12" rx="2" fill="#BEE7FF"/>
      <circle cx="84" cy="62" r="3" fill="#FFE08A"/>
      <circle cx="30" cy="78" r="9" fill="#333A45"/><circle cx="30" cy="78" r="3.5" fill="#B0B7C3"/>
      <circle cx="70" cy="78" r="9" fill="#333A45"/><circle cx="70" cy="78" r="3.5" fill="#B0B7C3"/>
      <ellipse cx="22" cy="20" rx="12" ry="6" fill="#FFFFFF" opacity="0.9"/>
      <ellipse cx="78" cy="16" rx="11" ry="5.5" fill="#FFFFFF" opacity="0.9"/>
      <ellipse cx="72" cy="20" rx="8" ry="4.5" fill="#FFFFFF" opacity="0.9"/>
    `,
  },
  {
    id: 'flower-garden',
    name: '花朵花园',
    emoji: '🌸',
    bg: ['#FFF3F8', '#FFFDFF'],
    shapes: `
      <circle cx="84" cy="14" r="9" fill="#FFD24A"/>
      <ellipse cx="10" cy="14" rx="5.5" ry="4" fill="#FFB3C7" transform="rotate(-22 10 14)"/>
      <ellipse cx="19" cy="14" rx="5.5" ry="4" fill="#FFB3C7" transform="rotate(22 19 14)"/>
      <rect x="14" y="10" width="1.6" height="9" rx="0.8" fill="#8B5E3C"/>
      <rect x="0" y="72" width="100" height="28" fill="#8FD86A"/>
      <line x1="26" y1="72" x2="26" y2="50" stroke="#4E9F3D" stroke-width="3"/>
      <g fill="#FF8FB1">
        <circle cx="26" cy="37" r="6"/><circle cx="32.6" cy="41.8" r="6"/><circle cx="30.1" cy="49.7" r="6"/>
        <circle cx="21.9" cy="49.7" r="6"/><circle cx="19.4" cy="41.8" r="6"/>
      </g>
      <circle cx="26" cy="44" r="4" fill="#FFD24A"/>
      <line x1="56" y1="76" x2="56" y2="54" stroke="#4E9F3D" stroke-width="3"/>
      <g fill="#B39DDB">
        <circle cx="56" cy="41" r="6"/><circle cx="62.6" cy="45.8" r="6"/><circle cx="60.1" cy="53.7" r="6"/>
        <circle cx="51.9" cy="53.7" r="6"/><circle cx="49.4" cy="45.8" r="6"/>
      </g>
      <circle cx="56" cy="48" r="4" fill="#FFD24A"/>
      <line x1="82" y1="74" x2="82" y2="58" stroke="#4E9F3D" stroke-width="2.6"/>
      <g fill="#7EC8E3">
        <circle cx="82" cy="47" r="5"/><circle cx="86.8" cy="50.7" r="5"/><circle cx="84.9" cy="56.4" r="5"/>
        <circle cx="79.1" cy="56.4" r="5"/><circle cx="77.2" cy="50.7" r="5"/>
      </g>
      <circle cx="82" cy="52" r="3.4" fill="#FFD24A"/>
      <ellipse cx="70" cy="88" rx="12" ry="4" fill="#6FC94F" opacity="0.7"/>
    `,
  },
  {
    id: 'moon-night',
    name: '月亮夜空',
    emoji: '🌙',
    bg: ['#1E2A55', '#41538F'],
    shapes: `
      <circle cx="70" cy="26" r="15" fill="#FFE9A8"/>
      <circle cx="79" cy="19" r="13" fill="#2A3766"/>
      <circle cx="20" cy="16" r="1.6" fill="#FFFFFF"/><circle cx="34" cy="30" r="1.2" fill="#FFFFFF"/>
      <circle cx="52" cy="12" r="1.4" fill="#FFFFFF"/><circle cx="90" cy="42" r="1.5" fill="#FFFFFF"/>
      <circle cx="12" cy="42" r="1.2" fill="#FFFFFF"/><circle cx="44" cy="40" r="1" fill="#FFFFFF"/>
      <ellipse cx="28" cy="98" rx="48" ry="26" fill="#16203F"/>
      <ellipse cx="88" cy="102" rx="40" ry="22" fill="#101A34"/>
      <polygon points="54,52 68,64 40,64" fill="#0C1530"/>
      <rect x="42" y="64" width="24" height="18" fill="#0C1530"/>
      <rect x="48" y="70" width="6" height="6" fill="#FFD24A"/>
      <rect x="57" y="70" width="5" height="7" fill="#FFC93C"/>
    `,
  },
  {
    id: 'birthday-cake',
    name: '生日蛋糕',
    emoji: '🎂',
    bg: ['#FFF0F5', '#FFFBFD'],
    shapes: `
      <rect x="0" y="84" width="100" height="16" fill="#FBE3EF"/>
      <rect x="0" y="84" width="100" height="3" fill="#F4CFE1"/>
      <ellipse cx="50" cy="88" rx="40" ry="8" fill="#E8DDE7"/>
      <rect x="20" y="60" width="60" height="26" rx="5" fill="#FFD6E7"/>
      <rect x="30" y="42" width="40" height="20" rx="4" fill="#FFC0D9"/>
      <path d="M20 62 q6 -8 12 0 t12 0 t12 0 t12 0 t12 0" stroke="#FFFFFF" stroke-width="4" fill="none"/>
      <path d="M30 44 q5 -7 10 0 t10 0 t10 0 t10 0" stroke="#FFFFFF" stroke-width="3.5" fill="none"/>
      <rect x="36" y="26" width="4" height="16" rx="2" fill="#7ED6DF"/>
      <rect x="48" y="24" width="4" height="18" rx="2" fill="#FFB3C7"/>
      <rect x="60" y="26" width="4" height="16" rx="2" fill="#A7D8F0"/>
      <ellipse cx="38" cy="21" rx="3" ry="4.5" fill="#FFC93C"/>
      <ellipse cx="50" cy="19" rx="3" ry="4.5" fill="#FFC93C"/>
      <ellipse cx="62" cy="21" rx="3" ry="4.5" fill="#FFC93C"/>
      <circle cx="28" cy="70" r="2.5" fill="#FF8FB1"/><circle cx="40" cy="76" r="2" fill="#FFD24A"/>
      <circle cx="58" cy="70" r="2.5" fill="#A7D8F0"/><circle cx="70" cy="76" r="2" fill="#FFD24A"/>
      <circle cx="9" cy="10" r="3" fill="#FFD24A"/><circle cx="20" cy="22" r="2" fill="#7ED6DF"/>
      <circle cx="7" cy="30" r="2.2" fill="#FF8FB1"/><circle cx="16" cy="44" r="1.8" fill="#B39DDB"/>
      <circle cx="6" cy="62" r="2.6" fill="#7ED6DF"/><circle cx="14" cy="76" r="2" fill="#FFC93C"/>
      <circle cx="91" cy="9" r="2.8" fill="#FF8FB1"/><circle cx="82" cy="24" r="2" fill="#FFD24A"/>
      <circle cx="94" cy="34" r="2.2" fill="#A7D8F0"/><circle cx="86" cy="48" r="1.8" fill="#FFC93C"/>
      <circle cx="95" cy="66" r="2.4" fill="#B39DDB"/><circle cx="88" cy="78" r="2" fill="#FF8FB1"/>
      <path d="M4 50 l2 -5 2 5 5 2 -5 2 -2 5 -2 -5 -5 -2z" fill="#FFD24A"/>
      <path d="M84 62 l1.6 -4 1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6z" fill="#FFC93C"/>
    `,
  },
];

export function getPuzzleScene(id: PuzzleSceneId): PuzzleScene {
  return PUZZLE_SCENES.find((scene) => scene.id === id) || PUZZLE_SCENES[0];
}

/** 一整张画面的 svg 字符串（100×100 坐标系） */
export function sceneSvg(scene: PuzzleScene): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">',
    '<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">',
    `<stop offset="0" stop-color="${scene.bg[0]}"/><stop offset="1" stop-color="${scene.bg[1]}"/>`,
    '</linearGradient></defs>',
    '<rect width="100" height="100" fill="url(#bg)"/>',
    scene.shapes,
    '</svg>',
  ].join('');
}

/** 给 CSS background-image 用的 data url */
export function sceneDataUrl(scene: PuzzleScene): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sceneSvg(scene))}`;
}

// ============ 关卡 ============

/** 每关的网格，下标 = 关卡号 - 1 */
const PUZZLE_GRIDS: Array<[rows: number, cols: number]> = [
  [2, 2],
  [2, 3],
  [3, 3],
  [3, 4],
  [4, 4],
  [4, 5],
  [4, 5],
  [5, 5],
  [5, 5],
];

export const MAX_PUZZLE_LEVEL = PUZZLE_GRIDS.length;

/** 小龄孩子最多 12 块，再多容易挫败 */
const PRESCHOOL_MAX_PIECES = 12;

export interface PuzzleLevel {
  id: string;
  levelNumber: number;
  title: string;
  emoji: string;
  /** 1（最简单）到 5 */
  difficulty: number;
  rows: number;
  cols: number;
  pieces: number;
  scene: PuzzleScene;
}

export function puzzleLevelFor(levelNumber: number, band: PuzzleBand = 'school'): PuzzleLevel {
  const level = Math.max(1, Math.min(MAX_PUZZLE_LEVEL, Math.floor(Number(levelNumber) || 1)));
  const scene = PUZZLE_SCENES[level - 1] || PUZZLE_SCENES[0];
  const [gridRows, gridCols] = PUZZLE_GRIDS[level - 1];
  let rows = gridRows;
  let cols = gridCols;
  if (band === 'preschool' && rows * cols > PRESCHOOL_MAX_PIECES) {
    rows = 3;
    cols = 4;
  }
  return {
    id: `puzzle-${level}`,
    levelNumber: level,
    title: scene.name,
    emoji: scene.emoji,
    difficulty: Math.min(5, 1 + Math.floor((level - 1) / 2)),
    rows,
    cols,
    pieces: rows * cols,
    scene,
  };
}

/** 第 pieceId 块在整图里的位置（左上角为 0） */
export function pieceCell(pieceId: number, cols: number): { row: number; col: number } {
  return { row: Math.floor(pieceId / cols), col: pieceId % cols };
}

/**
 * 一块拼图的背景定位：用 background-size / background-position 把整图“取景”到这一格。
 * 返回的百分比正好是 CSS 里该用的值（cols/rows 至少为 2）。
 */
export function pieceBackground(
  scene: PuzzleScene,
  pieceId: number,
  rows: number,
  cols: number,
): { backgroundImage: string; backgroundSize: string; backgroundPosition: string } {
  const { row, col } = pieceCell(pieceId, cols);
  return {
    backgroundImage: `url("${sceneDataUrl(scene)}")`,
    backgroundSize: `${cols * 100}% ${rows * 100}%`,
    backgroundPosition: `${(col / (cols - 1)) * 100}% ${(row / (rows - 1)) * 100}%`,
  };
}

// ============ 盘面状态（纯函数，方便测试） ============

export interface PuzzleRun {
  /** 下标是格子位置，值是放在这里的拼图块编号 */
  board: Array<number | null>;
  /** 还没放上去的块（打乱顺序） */
  tray: number[];
}

export function shufflePieces(pieces: number, random: () => number = Math.random): number[] {
  const ids = Array.from({ length: pieces }, (_, i) => i);
  for (let i = ids.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1)) % (i + 1);
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  // 极少数情况下洗出来还是原顺序，那样一上来就“已经拼好”了，强制换一下
  if (ids.length > 1 && ids.every((id, index) => id === index)) {
    [ids[0], ids[1]] = [ids[1], ids[0]];
  }
  return ids;
}

export function createPuzzleRun(pieces: number, random: () => number = Math.random): PuzzleRun {
  return { board: Array.from({ length: pieces }, () => null), tray: shufflePieces(pieces, random) };
}

/** 把 tray 里的一块放到 slot 上。位置不对时不接受，块留在托盘里 */
export function placePuzzlePiece(
  run: PuzzleRun,
  pieceId: number,
  slot: number,
): { run: PuzzleRun; correct: boolean } {
  if (slot < 0 || slot >= run.board.length) return { run, correct: false };
  if (run.board[slot] !== null) return { run, correct: false };
  if (slot !== pieceId) return { run, correct: false };
  const board = run.board.slice();
  board[slot] = pieceId;
  return {
    run: { board, tray: run.tray.filter((id) => id !== pieceId) },
    correct: true,
  };
}

/** 把已经放上去的块拿回托盘（点错了想换一块） */
export function takePuzzlePieceBack(run: PuzzleRun, slot: number): PuzzleRun {
  const pieceId = run.board[slot];
  if (pieceId === null || pieceId === undefined) return run;
  const board = run.board.slice();
  board[slot] = null;
  return { board, tray: [...run.tray, pieceId] };
}

export function isPuzzleSolved(run: PuzzleRun): boolean {
  return run.board.every((pieceId, slot) => pieceId === slot);
}

export function puzzlePlacedCount(run: PuzzleRun): number {
  return run.board.filter((pieceId) => pieceId !== null).length;
}

/**
 * 星星：全对不难，难在少走弯路。用错次数控制 1~3 星；
 * 中途看过整图（提示）最多只能拿 2 星。
 */
export function puzzleStars(
  level: PuzzleLevel,
  result: { mistakes: number; hintsUsed: number },
): 0 | 1 | 2 | 3 {
  const mistakes = Math.max(0, result.mistakes);
  let stars: 0 | 1 | 2 | 3 = 1;
  if (mistakes === 0) stars = 3;
  else if (mistakes <= Math.ceil(level.pieces / 3)) stars = 2;
  if (result.hintsUsed > 0 && stars > 2) stars = 2;
  return stars;
}

/** 伙伴的鼓励话术：按完成比例给，最后一句留给完成时 */
export function puzzleCheer(placed: number, pieces: number, mistakes: number): string {
  if (placed === 0) return '慢慢来，先看看这块的颜色和哪一格最像～';
  if (placed >= pieces) return '拼好啦！你观察得真仔细！';
  const ratio = placed / pieces;
  if (ratio >= 0.75) return '就差最后几块了，稳住！';
  if (ratio >= 0.5) return '一半啦，越来越像样了！';
  if (mistakes >= 3) return '放错的块已经回小筐里了，再找找看～';
  return '对，就是这里！继续找下一块～';
}
