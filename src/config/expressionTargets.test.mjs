import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

function toDataUrl(source) {
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  });
  return `data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`;
}

const mod = await import(toDataUrl(await readFile(new URL('./expressionTargets.ts', import.meta.url), 'utf8')));

const { EXPRESSION_TARGETS, EXPRESSION_TARGETS_BY_DIFFICULTY, targetsForBand, tierOf, suggestNextTarget } = mod;

// ---- 难度台阶：必须是从 1 开始的连续序号，不跳号不重复 ----
{
  const steps = EXPRESSION_TARGETS.map((t) => t.difficulty).sort((a, b) => a - b);
  assert.deepEqual(
    steps,
    [1, 2, 3, 4, 5, 6, 7, 8],
    '难度序号必须连续，否则「由易到难」会出现空档',
  );
}

// ---- 排序：按语言结构递进，先句子形式，再语用，再功能表达，最后带记忆负荷 ----
{
  assert.deepEqual(
    EXPRESSION_TARGETS_BY_DIFFICULTY.map((t) => t.id),
    ['G2', 'G4', 'G5', 'K1', 'K2', 'K3', 'K4', 'K5'],
    '目标卡顺序必须按语言结构递进',
  );
}

// ---- 排序不能改动原数组（原始定义的顺序要继续可查） ----
{
  assert.equal(EXPRESSION_TARGETS.length, 8);
  assert.equal(EXPRESSION_TARGETS_BY_DIFFICULTY.length, 8);
  assert.notEqual(EXPRESSION_TARGETS, EXPRESSION_TARGETS_BY_DIFFICULTY, '必须是副本，不能原地排序');
}

// ---- 档位：1-3 入门 / 4-6 进阶 / 7-8 挑战 ----
{
  assert.equal(tierOf(1), '入门');
  assert.equal(tierOf(3), '入门');
  assert.equal(tierOf(4), '进阶');
  assert.equal(tierOf(6), '进阶');
  assert.equal(tierOf(7), '挑战');
  assert.equal(tierOf(8), '挑战');
}

// ---- 分学段取目标时也要保持由易到难 ----
{
  assert.deepEqual(targetsForBand('preschool').map((t) => t.id), ['G2', 'G4', 'G5']);
  assert.deepEqual(targetsForBand('school').map((t) => t.id), ['K1', 'K2', 'K3', 'K4', 'K5']);
  for (const band of ['preschool', 'school']) {
    const list = targetsForBand(band);
    for (let i = 1; i < list.length; i += 1) {
      assert.ok(list[i].difficulty > list[i - 1].difficulty, `${band} 内顺序必须递增`);
    }
  }
}

// ---- 下一个建议目标：台阶最靠前且未稳定的那个 ----
{
  assert.equal(suggestNextTarget([]).id, 'G2', '一个都没稳定时从最容易的开始');
  assert.equal(suggestNextTarget(['G2']).id, 'G4');
  assert.equal(suggestNextTarget(['G2', 'G4', 'G5']).id, 'K1', '跨学段也要按台阶继续');
  assert.equal(suggestNextTarget(['G2', 'G4', 'G5', 'K1', 'K2', 'K3', 'K4', 'K5']), undefined, '全稳定就不再建议');
}

// ---- 台阶要和「2 分标准」一起看：每个目标都得有标准，否则卡片没法判断难度合理性 ----
{
  for (const t of EXPRESSION_TARGETS_BY_DIFFICULTY) {
    assert.ok(t.standard2 && t.standard2.length > 4, `${t.id} 缺 2 分标准`);
    assert.ok(t.summary && t.summary.length > 4, `${t.id} 缺一句话说明`);
    assert.equal(t.tasks.length >= 3, true, `${t.id} 的演练任务太少`);
  }
}
