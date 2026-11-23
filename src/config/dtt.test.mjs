import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

function toDataUrl(source) {
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  });
  return `data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`;
}

const dtt = await import(toDataUrl(await readFile(new URL('./dtt.ts', import.meta.url), 'utf8')));

const t = (outcome, promptLevel = null) => ({ outcome, promptLevel });

// ---- 试次结构：3 秒等待窗 + 1.5 秒试次间隔 ----
{
  assert.equal(dtt.DTT_WAIT_MS, 3000);
  assert.equal(dtt.DTT_ITI_MS, 1500);
  assert.deepEqual(
    dtt.DTT_PROMPT_LEVELS.map((p) => p.value),
    ['independent', 'verbal', 'model', 'physical'],
    '辅助等级必须从轻到重排',
  );
}

// ---- 统计：独立正确率只按已判定试次算 ----
{
  const trials = [
    t('correct', 'independent'),
    t('correct', 'independent'),
    t('correct', 'verbal'),
    t('incorrect', 'independent'),
    t('no_response', 'independent'),
    t(null, null),
  ];
  const s = dtt.computeDttStats(trials);
  assert.equal(s.total, 5, '未判定的试次不进分母');
  assert.equal(s.correct, 3);
  assert.equal(s.incorrect, 1);
  assert.equal(s.noResponse, 1);
  assert.equal(s.independentCorrect, 2);
  assert.equal(s.correctByPrompt.verbal, 1);
  assert.equal(s.correctByPrompt.model, 0);
  assert.equal(s.correctByPrompt.physical, 0);
  assert.equal(s.independentRate, 2 / 5);
  assert.equal(s.maxIndependentStreak, 2);
  assert.equal(s.currentStreak, 0);
}

// ---- 连续独立正确：被一次提示打断就归零 ----
{
  const s = dtt.computeDttStats([t('correct', 'independent'), t('correct', 'independent'), t('correct', 'model'), t('correct', 'independent')]);
  assert.equal(s.maxIndependentStreak, 2, '提示后正确不算独立连续');
  assert.equal(s.currentStreak, 1);

  const empty = dtt.computeDttStats([]);
  assert.equal(empty.total, 0);
  assert.equal(empty.independentRate, 0, '空集不除零');
}

// ---- 掌握提示：连续 3 次独立正确 / 连续全错 ----
{
  const good = dtt.computeDttStats([t('correct', 'independent'), t('correct', 'independent'), t('correct', 'independent')]);
  assert.match(dtt.dttMasteryHint(good) ?? '', /连续 3 次独立正确/);

  const bad = dtt.computeDttStats([t('incorrect'), t('incorrect'), t('incorrect')]);
  assert.match(dtt.dttMasteryHint(bad) ?? '', /把辅助加回来/);

  const mid = dtt.computeDttStats([t('correct', 'verbal'), t('incorrect'), t('correct', 'independent')]);
  assert.equal(dtt.dttMasteryHint(mid), null, '没到门槛不给建议');

  assert.equal(dtt.dttMasteryHint(dtt.computeDttStats([])), null);
}

// ---- DTT 结果 → 0/1/2 口径 ----
{
  assert.equal(dtt.dttToAchievement({ outcome: 'correct', promptLevel: 'independent' }), 'independent');
  assert.equal(dtt.dttToAchievement({ outcome: 'correct', promptLevel: 'verbal' }), 'prompted');
  assert.equal(dtt.dttToAchievement({ outcome: 'correct', promptLevel: 'physical' }), 'prompted');
  assert.equal(dtt.dttToAchievement({ outcome: 'incorrect', promptLevel: 'physical' }), 'failed');
  assert.equal(dtt.dttToAchievement({ outcome: 'no_response', promptLevel: 'independent' }), 'failed');
}

// ---- 结果反馈：正确给具体肯定，错误不给评价词 ----
{
  const praiseIndependent = dtt.dttPraise('independent', 0);
  assert.ok(praiseIndependent.length > 0);
  assert.doesNotMatch(praiseIndependent, /真棒|聪明|好孩子/);
  assert.match(praiseIndependent, /你自己|没等我|说清楚/);

  const praiseHelped = dtt.dttPraise('model', 0);
  assert.match(praiseHelped, /我帮|我先说|跟着/);

  assert.match(dtt.dttCorrection('incorrect'), /再来一次/);
  assert.match(dtt.dttCorrection('no_response'), /没等到|辅助/);
  for (const o of ['incorrect', 'no_response']) {
    assert.doesNotMatch(dtt.dttCorrection(o), /错|不对|怎么又/, '错误反馈不能出现指责词');
  }
}

// ---- 辅助等级显示名 ----
{
  assert.equal(dtt.promptLabel('verbal'), '口头');
  assert.equal(dtt.promptLabel('physical'), '手把手');
  assert.equal(dtt.promptLabel(null), '未记录');
}

console.log('PASS dtt');
