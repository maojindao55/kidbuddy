import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

function toDataUrl(source) {
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  });
  return `data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`;
}

const mod = await import(toDataUrl(await readFile(new URL('./cognitionTargets.ts', import.meta.url), 'utf8')));
const base = await import(toDataUrl(await readFile(new URL('./expressionTargets.ts', import.meta.url), 'utf8')));

const { COGNITION_TARGETS, COGNITION_TARGETS_BY_STAGE, cognitionStageGroups, suggestNextCognition, getCognitionTarget } = mod;

// ---- 目标数量与台阶：12 个，难度 1–12 连续不跳号 ----
{
  assert.equal(COGNITION_TARGETS.length, 12, '认知理解先做 12 个目标');
  const steps = COGNITION_TARGETS.map((t) => t.difficulty).sort((a, b) => a - b);
  assert.deepEqual(steps, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], '难度序号必须连续');
  const ids = COGNITION_TARGETS.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length, 'id 不能重复');
}

// ---- 学段内的顺序要跟着难度走 ----
{
  const ranks = { infant: 0, preschool: 1, school: 2 };
  for (let i = 1; i < COGNITION_TARGETS_BY_STAGE.length; i += 1) {
    const prev = COGNITION_TARGETS_BY_STAGE[i - 1];
    const cur = COGNITION_TARGETS_BY_STAGE[i];
    if (ranks[prev.band] === ranks[cur.band]) {
      assert.ok(prev.difficulty < cur.difficulty, `${prev.id} 应排在 ${cur.id} 前面`);
    } else {
      assert.ok(ranks[prev.band] < ranks[cur.band], '学段顺序不能倒');
    }
  }
}

// ---- 每个目标必须字段齐全 ----
{
  for (const t of COGNITION_TARGETS) {
    assert.ok(t.name && t.summary && t.standard2 && t.onePenalty && t.sessionSuccess && t.opener, `${t.id} 文案缺项`);
    assert.equal(t.domain, '认知理解', `${t.id} 领域标签`);
    assert.ok(['receptive', 'expressive'].includes(t.modality), `${t.id} 沟通通道`);
    assert.ok(t.vbMapp?.operant && t.vbMapp?.tag && t.vbMapp?.rationale, `${t.id} 缺 VB-MAPP 说明`);
    const guide = t.familyGuide;
    for (const key of ['what', 'prepare', 'start', 'wait', 'prompts', 'success', 'fallback', 'dose', 'avoid']) {
      assert.ok(guide[key] && guide[key].length > 4, `${t.id} 家长指南缺 ${key}`);
    }
  }
}

// ---- 每个目标 8 道题，id 唯一，题干不重复 ----
{
  for (const t of COGNITION_TARGETS) {
    assert.equal(t.tasks.length, 8, `${t.id} 应该有 8 道题`);
    assert.equal(new Set(t.tasks.map((x) => x.id)).size, 8, `${t.id} 题目 id 重复`);
    assert.equal(new Set(t.tasks.map((x) => x.ask)).size, 8, `${t.id} 题干重复`);
    for (const task of t.tasks) {
      assert.ok(task.id.startsWith(`${t.id}-`), `${task.id} 前缀要和目标对上`);
      // DTT 指令本来就该短，但不能短到没内容（例如只有一个词）
      assert.ok(task.ask.length >= 5, `${task.id} 题干太短`);
      assert.ok(task.hint.length > 2, `${task.id} 缺提示`);
      assert.ok(task.checks.length >= 2, `${task.id} 判定项至少 2 条`);
    }
  }
}

// ---- 教具槽位：至少 2 个等价替代，题干里的占位必须都有定义 ----
{
  for (const t of COGNITION_TARGETS) {
    assert.ok(t.materials.length >= 1, `${t.id} 至少要有一个教具槽位`);
    for (const slot of t.materials) {
      assert.ok(slot.options.length >= 2, `${t.id}/${slot.key} 至少要 2 个替代`);
      assert.ok(slot.fallback && slot.fallback.length > 10, `${t.id}/${slot.key} 缺兜底方案`);
      for (const opt of slot.options) assert.ok(opt.name, `${t.id}/${slot.key} 选项缺 name`);
    }
    const keys = new Set(t.materials.map((m) => m.key));
    const used = new Set();
    for (const task of t.tasks) {
      for (const text of [task.ask, task.hint, ...task.checks]) {
        for (const k of base.placeholderKeys(text)) {
          used.add(k);
          assert.ok(keys.has(k), `${task.id} 引用了不存在的教具 {${k}}`);
        }
      }
    }
    for (const k of keys) assert.ok(used.has(k), `${t.id} 的教具 ${k} 没有任何题目用到`);
  }
}

// ---- 填充后不能残留占位符 ----
{
  for (const t of COGNITION_TARGETS) {
    const picks = base.resolvePicks(t.materials);
    for (const task of t.tasks) {
      const filled = [
        base.fillSlots(task.ask, t.materials, picks),
        base.fillSlots(task.hint, t.materials, picks),
        ...task.checks.map((c) => base.fillSlots(c, t.materials, picks)),
      ].join(' ');
      assert.doesNotMatch(filled, /\{[a-zA-Z][\w]*(?:\.[\w]+)?\}/, `${task.id} 填充后还有占位符`);
    }
  }
}

// ---- 分组与推荐 ----
{
  const groups = cognitionStageGroups('all');
  assert.equal(groups.length, 3, '三个学段');
  assert.equal(groups.reduce((n, g) => n + g.targets.length, 0), 12);

  const onlyPreschool = cognitionStageGroups('preschool');
  assert.ok(onlyPreschool.every((g) => g.stage.band === 'preschool'));

  assert.equal(suggestNextCognition([])?.id, 'C1', '什么都没有时从最容易的开始');
  assert.equal(suggestNextCognition(['C1', 'C2'])?.id, 'C3');
  assert.equal(suggestNextCognition(COGNITION_TARGETS.map((t) => t.id)), undefined, '全稳定后不再推荐');

  assert.equal(getCognitionTarget('C7')?.name, '方位理解');
  assert.equal(getCognitionTarget(undefined), undefined);
  assert.equal(getCognitionTarget('B5'), undefined, '不能串到语言表达的目标');
}

// ---- 抽题轮换沿用同一套算法：8 道里抽 4 道，练过的往后排 ----
{
  const t = COGNITION_TARGETS[0];
  const first = base.pickSessionTasks(t.tasks, 4, []);
  assert.equal(first.length, 4);
  assert.deepEqual(first.map((x) => x.id), ['C1-t1', 'C1-t2', 'C1-t3', 'C1-t4'], '没练过时按题库顺序来');

  const history = base.recordTaskUsage([], first.map((x) => x.id));
  const second = base.pickSessionTasks(t.tasks, 4, history);
  assert.deepEqual(second.map((x) => x.id), ['C1-t5', 'C1-t6', 'C1-t7', 'C1-t8'], '练过的往后排');
}

console.log('cognitionTargets.test.mjs: ok');
