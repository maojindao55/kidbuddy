import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

function toDataUrl(source) {
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  });
  return `data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`;
}

const puzzle = await import(toDataUrl(await readFile(new URL('./kidPuzzle.ts', import.meta.url), 'utf8')));
const game = await import(toDataUrl(await readFile(new URL('./aiGame.ts', import.meta.url), 'utf8')));

const firstRandom = () => 0;
const halfRandom = () => 0.5;

// ---- 画面 ----
assert.equal(puzzle.PUZZLE_SCENES.length, 9, '9 关对应 9 幅画');
assert.equal(new Set(puzzle.PUZZLE_SCENES.map((s) => s.id)).size, 9, '画面 id 不能重复');
assert.equal(new Set(puzzle.PUZZLE_SCENES.map((s) => s.name)).size, 9, '画面名不能重复');

for (const scene of puzzle.PUZZLE_SCENES) {
  const svg = puzzle.sceneSvg(scene);
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 100 100"/, `${scene.id} 坐标系必须是 0 0 100 100`);
  assert.match(svg, /linearGradient/, `${scene.id} 要有背景渐变`);
  assert.match(svg, /<rect width="100" height="100"/, `${scene.id} 要有打底矩形，否则透明处切出来是空白`);
  assert.ok(scene.shapes.trim().length > 200, `${scene.id} 的图形太少，拼图会很空`);
  assert.ok((scene.shapes.match(/fill="#/g) || []).length >= 4, `${scene.id} 颜色太少，切块后分不出位置`);
  assert.doesNotMatch(svg, /<script|onclick|onload|href="javascript:/i, `${scene.id} 不能带脚本`);
  assert.match(puzzle.sceneDataUrl(scene), /^data:image\/svg\+xml;charset=utf-8,/, '要给 CSS 用的是 data url');
}

// 每幅画的图形都必须落在画面内，否则切出来会缺角
for (const scene of puzzle.PUZZLE_SCENES) {
  const nums = [...scene.shapes.matchAll(/(?:cx|cy|x|y|x1|y1|x2|y2|width|height)="(-?[\d.]+)"/g)].map((m) => Number(m[1]));
  assert.ok(nums.every((n) => n >= -6 && n <= 106), `${scene.id} 有图形超出 0-100 坐标系`);
}

// ---- 关卡 ----
assert.equal(puzzle.MAX_PUZZLE_LEVEL, 9);
{
  let previous = 0;
  for (let level = 1; level <= puzzle.MAX_PUZZLE_LEVEL; level += 1) {
    const def = puzzle.puzzleLevelFor(level, 'school');
    assert.equal(def.levelNumber, level);
    assert.equal(def.rows * def.cols, def.pieces, '块数必须是行×列');
    assert.ok(def.pieces >= previous, '关卡块数不能变少');
    previous = def.pieces;
    assert.equal(def.scene.id, puzzle.PUZZLE_SCENES[level - 1].id, '一关一幅画，顺序固定');
    assert.equal(def.title, def.scene.name, '关卡标题直接用画面名');
    assert.ok(def.difficulty >= 1 && def.difficulty <= 5);
    assert.ok(def.rows >= 2 && def.cols >= 2, 'background-position 的百分比公式要求至少 2×2');
  }
  assert.equal(puzzle.puzzleLevelFor(1, 'school').pieces, 4, '第一关 2×2');
  assert.equal(puzzle.puzzleLevelFor(9, 'school').pieces, 25, '最后一关 5×5');
  assert.equal(puzzle.puzzleLevelFor(0, 'school').levelNumber, 1, '关卡号钳到 1');
  assert.equal(puzzle.puzzleLevelFor(99, 'school').levelNumber, 9, '关卡号钳到 9');
  // 小龄孩子块数封顶，别一上来就挫败
  for (let level = 1; level <= puzzle.MAX_PUZZLE_LEVEL; level += 1) {
    const kid = puzzle.puzzleLevelFor(level, 'preschool');
    assert.ok(kid.pieces <= 12, `小龄 ${level} 关块数 ${kid.pieces} 太多`);
    assert.ok(kid.pieces >= 4);
  }
}

// 与 aiGame 的关卡标题保持一致：两边各存一份，靠这条测试防漂移
for (let level = 1; level <= 9; level += 1) {
  const fromGame = game.generateKidGameLevel('puzzle', level, 'school');
  assert.equal(fromGame.title, puzzle.puzzleLevelFor(level, 'school').title, `第 ${level} 关标题两边不一致`);
  assert.equal(fromGame.targetRounds, 0, '拼图不用轮次字段');
}

// ---- 切片定位 ----
{
  assert.deepEqual(puzzle.pieceCell(0, 3), { row: 0, col: 0 });
  assert.deepEqual(puzzle.pieceCell(5, 3), { row: 1, col: 2 });
  assert.deepEqual(puzzle.pieceCell(8, 3), { row: 2, col: 2 });

  const scene = puzzle.PUZZLE_SCENES[0];
  const topLeft = puzzle.pieceBackground(scene, 0, 2, 3);
  assert.equal(topLeft.backgroundPosition, '0% 0%', '左上角块要贴住左上角');
  assert.equal(topLeft.backgroundSize, '300% 200%', '放大到 列×行 倍才能切出一格');
  const bottomRight = puzzle.pieceBackground(scene, 5, 2, 3);
  assert.equal(bottomRight.backgroundPosition, '100% 100%', '右下角块要贴住右下角');
  const middle = puzzle.pieceBackground(scene, 4, 2, 3); // 第 2 行第 2 列
  assert.equal(middle.backgroundPosition, '50% 100%');
  assert.match(middle.backgroundImage, /^url\("data:image\/svg\+xml/);
}

// ---- 洗牌与盘面 ----
{
  const ids = puzzle.shufflePieces(9, halfRandom);
  assert.equal(ids.length, 9);
  assert.deepEqual([...ids].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7, 8], '洗牌不能丢块或重复');
  assert.notDeepEqual(ids, [0, 1, 2, 3, 4, 5, 6, 7, 8], '洗出来不能还是原顺序');
  // 极端随机源：每次都取 0，容易洗成原顺序，必须被兜住
  const edge = puzzle.shufflePieces(4, firstRandom);
  assert.notDeepEqual(edge, [0, 1, 2, 3], '洗成原顺序要强制换一下');

  const run = puzzle.createPuzzleRun(4, halfRandom);
  assert.deepEqual(run.board, [null, null, null, null], '开局盘面全空');
  assert.equal(run.tray.length, 4);
  assert.equal(puzzle.puzzlePlacedCount(run), 0);
  assert.equal(puzzle.isPuzzleSolved(run), false, '空盘当然不算拼好');
}

// ---- 放置规则 ----
{
  const run = puzzle.createPuzzleRun(4, halfRandom);

  const wrong = puzzle.placePuzzlePiece(run, 2, 0);
  assert.equal(wrong.correct, false, '放错位置不接受');
  assert.deepEqual(wrong.run, run, '放错时盘面一点不能变，块要留在小筐');

  const right = puzzle.placePuzzlePiece(run, 0, 0);
  assert.equal(right.correct, true);
  assert.equal(right.run.board[0], 0);
  assert.deepEqual(right.run.tray.filter((id) => id === 0), [], '放上去的块要从小筐移除');

  const occupied = puzzle.placePuzzlePiece(right.run, 1, 0);
  assert.equal(occupied.correct, false, '格子被占了就不能再放');

  const outOfRange = puzzle.placePuzzlePiece(run, 3, 99);
  assert.equal(outOfRange.correct, false);

  const back = puzzle.takePuzzlePieceBack(right.run, 0);
  assert.equal(back.board[0], null);
  assert.ok(back.tray.includes(0), '取回的块要回小筐');
  assert.deepEqual(puzzle.takePuzzlePieceBack(back, 0), back, '空格子上取东西不该出事');

  // 全部按顺序放好 = 拼好
  let solved = puzzle.createPuzzleRun(4, halfRandom);
  for (let slot = 0; slot < 4; slot += 1) {
    const outcome = puzzle.placePuzzlePiece(solved, slot, slot);
    assert.equal(outcome.correct, true);
    solved = outcome.run;
    assert.equal(puzzle.isPuzzleSolved(solved), slot === 3, '只有最后一块放对才算拼好');
  }
  assert.equal(puzzle.puzzlePlacedCount(solved), 4);
  assert.deepEqual(solved.tray, []);
}

// ---- 星星 ----
{
  const level = puzzle.puzzleLevelFor(1, 'school'); // 4 块
  assert.equal(puzzle.puzzleStars(level, { mistakes: 0, hintsUsed: 0 }), 3, '一次没错给 3 星');
  assert.equal(puzzle.puzzleStars(level, { mistakes: 1, hintsUsed: 0 }), 2);
  assert.equal(puzzle.puzzleStars(level, { mistakes: 2, hintsUsed: 0 }), 2, '错 2 次（≤ ceil(4/3)=2）还是 2 星');
  assert.equal(puzzle.puzzleStars(level, { mistakes: 3, hintsUsed: 0 }), 1);
  assert.equal(puzzle.puzzleStars(level, { mistakes: 0, hintsUsed: 1 }), 2, '看过整图最多 2 星');
  assert.equal(puzzle.puzzleStars(level, { mistakes: 5, hintsUsed: 1 }), 1, '看过整图也不会掉到 2 星以上');

  const hard = puzzle.puzzleLevelFor(9, 'school'); // 25 块
  assert.equal(puzzle.puzzleStars(hard, { mistakes: 8, hintsUsed: 0 }), 2, '块多时容错也放宽');
}

// ---- 陪伴话术 ----
{
  assert.match(puzzle.puzzleCheer(0, 9, 0), /慢慢来/);
  assert.match(puzzle.puzzleCheer(9, 9, 0), /拼好啦/);
  assert.match(puzzle.puzzleCheer(5, 9, 0), /一半/);
  assert.match(puzzle.puzzleCheer(8, 9, 0), /最后几块/);
  assert.match(puzzle.puzzleCheer(1, 9, 4), /小筐/, '错太多次要提示块会弹回小筐');
}

console.log('kidPuzzle.test.mjs: ok');
