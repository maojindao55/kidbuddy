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

// ---- 难度台阶：必须从 1 开始的连续序号，不跳号不重复 ----
{
  const steps = EXPRESSION_TARGETS.map((t) => t.difficulty).sort((a, b) => a - b);
  assert.deepEqual(steps, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], '难度序号必须连续，否则「由易到难」会出现空档');
}

// ---- 排序：按 VB-MAPP 语言操作获得顺序 ----
{
  assert.deepEqual(
    EXPRESSION_TARGETS_BY_DIFFICULTY.map((t) => t.id),
    ['B5', 'G1', 'G2', 'K2', 'K3', 'G5', 'G4', 'K1', 'K4', 'K5'],
    '顺序必须是 请求→命名→句长→拒绝→求助→语用→问答→叙述→复述→转述',
  );
}

// ---- 必须包含 VB-MAPP 最靠前的两个操作起点，否则 ASD / 发育迟缓孩子没有入口 ----
{
  const ids = EXPRESSION_TARGETS.map((t) => t.id);
  assert.ok(ids.includes('B5'), '缺 Mand 请求起点（B5 首个有意义的词）');
  assert.ok(ids.includes('G1'), '缺 Tact 命名起点（G1 词汇）');
  assert.equal(EXPRESSION_TARGETS_BY_DIFFICULTY[0].id, 'B5', '最容易的一条应该是请求');
}

// ---- VB-MAPP 阶段必须随台阶单调不降：不能出现「先练 L3 再练 L1」 ----
{
  const list = EXPRESSION_TARGETS_BY_DIFFICULTY;
  for (let i = 1; i < list.length; i += 1) {
    assert.ok(
      list[i].vbMapp.level >= list[i - 1].vbMapp.level,
      `${list[i].id} 的 VB-MAPP 阶段比上一条还低，顺序有问题`,
    );
  }
}

// ---- 每个目标都要能对上 VB-MAPP，否则没法跟老师说清「为什么现在练这个」 ----
{
  for (const t of EXPRESSION_TARGETS_BY_DIFFICULTY) {
    assert.ok(t.vbMapp, `${t.id} 缺 VB-MAPP 对应关系`);
    assert.ok([1, 2, 3].includes(t.vbMapp.level), `${t.id} 的 level 只能是 1/2/3`);
    assert.ok(t.vbMapp.operant && t.vbMapp.operant.length > 2, `${t.id} 缺操作类别`);
    assert.ok(t.vbMapp.milestone && t.vbMapp.milestone.length > 4, `${t.id} 缺里程碑区间`);
    assert.ok(t.vbMapp.rationale && t.vbMapp.rationale.length > 10, `${t.id} 缺「为什么排这里」`);
    assert.ok(t.vbMapp.tag && t.vbMapp.tag.length > 2, `${t.id} 缺卡片短标签`);
  }
}

// ---- 排序不能改动原数组（原始定义的顺序要继续可查） ----
{
  assert.equal(EXPRESSION_TARGETS.length, 10);
  assert.equal(EXPRESSION_TARGETS_BY_DIFFICULTY.length, 10);
  assert.notEqual(EXPRESSION_TARGETS, EXPRESSION_TARGETS_BY_DIFFICULTY, '必须是副本，不能原地排序');
}

// ---- 档位：1-3 入门 / 4-6 进阶 / 7-10 挑战 ----
{
  assert.equal(tierOf(1), '入门');
  assert.equal(tierOf(3), '入门');
  assert.equal(tierOf(4), '进阶');
  assert.equal(tierOf(6), '进阶');
  assert.equal(tierOf(7), '挑战');
  assert.equal(tierOf(10), '挑战');
}

// ---- 分学段取目标时也要保持由易到难 ----
{
  assert.deepEqual(targetsForBand('infant').map((t) => t.id), ['B5']);
  assert.deepEqual(targetsForBand('preschool').map((t) => t.id), ['G1', 'G2', 'G5', 'G4']);
  assert.deepEqual(targetsForBand('school').map((t) => t.id), ['K2', 'K3', 'K1', 'K4', 'K5']);
  for (const band of ['infant', 'preschool', 'school']) {
    const list = targetsForBand(band);
    for (let i = 1; i < list.length; i += 1) {
      assert.ok(list[i].difficulty > list[i - 1].difficulty, `${band} 内顺序必须递增`);
    }
  }
}

// ---- 下一个建议目标：台阶最靠前且未稳定的那个 ----
{
  assert.equal(suggestNextTarget([]).id, 'B5', '一个都没稳定时从最容易的请求开始');
  assert.equal(suggestNextTarget(['B5']).id, 'G1');
  assert.equal(suggestNextTarget(['B5', 'G1']).id, 'G2');
  assert.equal(
    suggestNextTarget(EXPRESSION_TARGETS.map((t) => t.id)),
    undefined,
    '全稳定就不再建议',
  );
}

// ---- 等待窗必须和 DTT 的 3 秒一致，不能还给家长「等 5 秒」 ----
{
  for (const t of EXPRESSION_TARGETS_BY_DIFFICULTY) {
    assert.ok(t.familyGuide.wait.includes('3 秒'), `${t.id} 的家庭指导等待时长和 DTT 不一致`);
    assert.ok(!t.familyGuide.wait.includes('5 秒'), `${t.id} 还写着等 5 秒`);
  }
}

// ---- 会话口径与学期口径要分开写：一节课不能拿学期标准判 ----
{
  for (const t of EXPRESSION_TARGETS_BY_DIFFICULTY) {
    assert.ok(t.standard2 && t.standard2.length > 4, `${t.id} 缺 2 分标准`);
    assert.ok(t.sessionSuccess && t.sessionSuccess.length > 6, `${t.id} 缺本次课达标线`);
    assert.notEqual(t.sessionSuccess, t.standard2, `${t.id} 的本次达标线不该照抄学期口径`);
    assert.ok(t.summary && t.summary.length > 4, `${t.id} 缺一句话说明`);
    assert.ok(t.onePenalty && t.onePenalty.length > 2, `${t.id} 缺 1 分情形`);
    assert.ok(t.opener && t.opener.length > 4, `${t.id} 缺开场白`);
  }
}

// ---- 选题：每条目标至少 3 个演练，每个演练都要有题干、提示和判定勾选项 ----
{
  for (const t of EXPRESSION_TARGETS_BY_DIFFICULTY) {
    assert.ok(t.tasks.length >= 3, `${t.id} 的演练任务太少`);
    for (const task of t.tasks) {
      assert.ok(task.ask && task.ask.length > 4, `${task.id} 缺题干`);
      assert.ok(task.hint && task.hint.length > 1, `${task.id} 缺提示句`);
      assert.ok(Array.isArray(task.checks) && task.checks.length >= 2, `${task.id} 判定项不足`);
    }
  }
}

// ---- 家庭指导九项不能缺项，否则家长带练会漏 ----
{
  const fields = ['what', 'prepare', 'start', 'wait', 'prompts', 'success', 'fallback', 'dose', 'avoid'];
  for (const t of EXPRESSION_TARGETS_BY_DIFFICULTY) {
    for (const f of fields) {
      assert.ok(t.familyGuide[f] && t.familyGuide[f].length > 4, `${t.id} 的家庭指导缺 ${f}`);
    }
  }
}
