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
  assert.deepEqual(steps, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], '难度序号必须连续，否则「由易到难」会出现空档');
}

// ---- 排序：编号即台阶，B5 → G1 → G2 → G4 → G5 → K1 … K5 ----
{
  assert.deepEqual(
    EXPRESSION_TARGETS_BY_DIFFICULTY.map((t) => t.id),
    ['B5', 'G1', 'G2', 'G3', 'G4', 'G5', 'K1', 'K2', 'K3', 'K4', 'K5'],
    '台阶顺序必须和编号一致',
  );
}

// ---- 编号必须跟着易到难走：每个学段内，ID 的尾号要随台阶递增 ----
{
  const ranks = { B: 0, G: 1, K: 2 };
  const list = EXPRESSION_TARGETS_BY_DIFFICULTY;
  for (let i = 1; i < list.length; i += 1) {
    const prev = list[i - 1];
    const cur = list[i];
    const prevBand = ranks[prev.id[0]];
    const curBand = ranks[cur.id[0]];
    assert.ok(
      curBand > prevBand || (curBand === prevBand && Number(cur.id.slice(1)) > Number(prev.id.slice(1))),
      `${cur.id} 排在 ${prev.id} 后面，但编号没有递增——编号和台阶打架了`,
    );
  }
}

// ---- 必须包含 VB-MAPP 最靠前的两个操作起点，否则 ASD / 发育迟缓孩子没有入口 ----
{
  const ids = EXPRESSION_TARGETS.map((t) => t.id);
  assert.ok(ids.includes('B5'), '缺 Mand 请求起点（B5 首个有意义的词）');
  assert.ok(ids.includes('G1'), '缺 Tact 命名起点（G1 词汇）');
  assert.equal(EXPRESSION_TARGETS_BY_DIFFICULTY[0].id, 'B5', '最容易的一条应该是请求');
}

// ---- 学段的最高 VB-MAPP 阶段不能倒退 ----
// 段内允许回落：代码表按年龄分段，K 段里的 K2 拒绝、K3 求助在 VB-MAPP 里是 Mand L2，
// 比 K1 的 Intraverbal L3 低，这是「同一功能在学龄段更独立」的正常现象。
{
  const maxLevel = (band) => Math.max(...mod.targetsForBand(band).map((t) => t.vbMapp.level));
  const order = ['infant', 'preschool', 'school'];
  for (let i = 1; i < order.length; i += 1) {
    assert.ok(
      maxLevel(order[i]) >= maxLevel(order[i - 1]),
      `${order[i]} 段的最高 VB-MAPP 阶段比上一段还低`,
    );
  }
}

// ---- 听 / 说：只有 G3 两步指令是听者反应，其余都要求开口 ----
{
  const byId = new Map(EXPRESSION_TARGETS.map((t) => [t.id, t]));
  assert.equal(byId.get('G3').modality, 'receptive', 'G3 是听者反应');
  const receptive = EXPRESSION_TARGETS.filter((t) => t.modality === 'receptive');
  assert.equal(receptive.length, 1, '目前只应有一条听者反应目标');
  for (const t of EXPRESSION_TARGETS) {
    assert.ok(['receptive', 'expressive'].includes(t.modality), `${t.id} 的 modality 不合法`);
    if (t.id !== 'G3') assert.equal(t.modality, 'expressive', `${t.id} 应该是表达类`);
  }
  assert.equal(mod.MODALITY_LABEL.receptive, '听');
  assert.equal(mod.MODALITY_LABEL.expressive, '说');
  assert.equal(mod.isReceptive(byId.get('G3')), true);
  assert.equal(mod.isReceptive(byId.get('G2')), false);
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
  assert.equal(EXPRESSION_TARGETS.length, 11);
  assert.equal(EXPRESSION_TARGETS_BY_DIFFICULTY.length, 11);
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
  assert.equal(tierOf(11), '挑战');
}

// ---- 分学段取目标时也要保持由易到难 ----
{
  assert.deepEqual(targetsForBand('infant').map((t) => t.id), ['B5']);
  assert.deepEqual(targetsForBand('preschool').map((t) => t.id), ['G1', 'G2', 'G3', 'G4', 'G5']);
  assert.deepEqual(targetsForBand('school').map((t) => t.id), ['K1', 'K2', 'K3', 'K4', 'K5']);
  for (const band of ['infant', 'preschool', 'school']) {
    const list = targetsForBand(band);
    for (let i = 1; i < list.length; i += 1) {
      assert.ok(list[i].difficulty > list[i - 1].difficulty, `${band} 内顺序必须递增`);
    }
  }
}

// ---- 学段分组：先 B（0-3 岁）再 G（3-6 岁）再 K（6-12 岁），组内由易到难 ----
{
  const groups = mod.stageGroups('all');
  assert.deepEqual(
    groups.map((g) => g.stage.code),
    ['B', 'G', 'K'],
    '学段顺序必须是 B → G → K',
  );
  assert.deepEqual(groups.map((g) => g.targets.map((t) => t.id)), [
    ['B5'],
    ['G1', 'G2', 'G3', 'G4', 'G5'],
    ['K1', 'K2', 'K3', 'K4', 'K5'],
  ]);
  for (const g of groups) {
    for (let i = 1; i < g.targets.length; i += 1) {
      assert.ok(g.targets[i].difficulty > g.targets[i - 1].difficulty, `${g.stage.code} 段内顺序必须递增`);
    }
  }
}

// ---- 学前孩子打开时，K 段不会被夹在 B/G 中间 ----
{
  const order = mod.EXPRESSION_TARGETS_BY_STAGE.map((t) => t.id);
  assert.deepEqual(order, ['B5', 'G1', 'G2', 'G3', 'G4', 'G5', 'K1', 'K2', 'K3', 'K4', 'K5']);
  const firstKSchool = order.findIndex((id) => id.startsWith('K'));
  const lastGPreschool = order.map((id) => id.startsWith('G')).lastIndexOf(true);
  assert.ok(firstKSchool > lastGPreschool, 'K 段必须整体排在 G 段之后');
}

// ---- 单个学段筛选：只返回该段，且顺序不乱 ----
{
  assert.deepEqual(mod.stageGroups('infant').map((g) => g.stage.band), ['infant']);
  assert.deepEqual(mod.stageGroups('preschool').map((g) => g.targets.map((t) => t.id)), [['G1', 'G2', 'G3', 'G4', 'G5']]);
  assert.deepEqual(mod.stageGroups('school').map((g) => g.targets.map((t) => t.id)), [['K1', 'K2', 'K3', 'K4', 'K5']]);
  assert.equal(mod.stageGroups('preschool').length, 1);
}

// ---- 学段顺序不能改动原数组 ----
{
  assert.notEqual(mod.EXPRESSION_TARGETS_BY_STAGE, mod.EXPRESSION_TARGETS);
  assert.notEqual(mod.EXPRESSION_TARGETS_BY_STAGE, mod.EXPRESSION_TARGETS_BY_DIFFICULTY);
  assert.equal(mod.EXPRESSION_TARGETS_BY_STAGE.length, 11);
}

// ---- 建议目标跟着学段顺序走：先把 B 段做完再看 G ----
{
  assert.equal(mod.suggestNextTarget(['B5']).id, 'G1');
  assert.equal(mod.suggestNextTarget(['B5', 'G1', 'G2', 'G3', 'G4', 'G5']).id, 'K1', 'G 段清完后才进 K 段');
}


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

// ---- 教具槽位：题干里出现的每一个 {key} 都必须有定义，否则现场会念出「{item}」 ----
{
  const { fillSlots, placeholderKeys, resolvePicks } = mod;
  for (const t of EXPRESSION_TARGETS_BY_DIFFICULTY) {
    assert.ok(Array.isArray(t.materials), `${t.id} 缺 materials 字段（没有教具也要给空数组）`);
    const defined = new Set(t.materials.map((s) => s.key));
    assert.equal(defined.size, t.materials.length, `${t.id} 的教具槽位 key 重复`);

    for (const slot of t.materials) {
      assert.ok(slot.label && slot.label.length > 1, `${t.id}/${slot.key} 缺 label`);
      assert.ok(slot.options.length >= 2, `${t.id}/${slot.key} 至少要有 2 个等价替代，否则等于写死`);
      assert.ok(slot.fallback && slot.fallback.length > 6, `${t.id}/${slot.key} 缺「都没有怎么办」`);
    }

    for (const task of t.tasks) {
      const text = [task.ask, task.hint, ...task.checks].join(' ');
      for (const key of placeholderKeys(text)) {
        assert.ok(defined.has(key), `${task.id} 引用了没定义的教具占位 {${key}}`);
      }
      // 全部替换后不能再残留 {xxx}
      const filled = fillSlots(text, t.materials, {});
      assert.doesNotMatch(filled, /\{[a-zA-Z][\w.]*\}/, `${task.id} 有占位没被替换掉：${filled}`);
    }
  }
}

// ---- 填充函数：{key} / {key.word} / {key.1} 三种写法都要能换对 ----
{
  const { fillSlots } = mod;
  const slots = [
    {
      key: 'item',
      label: '东西',
      fallback: '随便一样',
      options: [
        { name: '泡泡水', word: '泡泡' },
        { name: '饼干罐', word: '饼干' },
      ],
    },
    {
      key: 'pair',
      label: '两样',
      fallback: '随便两样',
      options: [
        { name: '杯子和积木', parts: ['杯子', '积木'] },
        { name: '碗和勺子', parts: ['碗', '勺子'] },
      ],
    },
  ];
  assert.equal(fillSlots('把{item}举起来', slots), '把泡泡水举起来', '默认取第一项');
  assert.equal(fillSlots('把{item}举起来', slots, { item: '饼干罐' }), '把饼干罐举起来', '选择要生效');
  assert.equal(fillSlots('说「{item.word}」', slots, { item: '饼干罐' }), '说「饼干」', '.word 要换成孩子说的词');
  assert.equal(fillSlots('先拿{pair.1}，再拿{pair.2}', slots), '先拿杯子，再拿积木', '.1/.2 要拆出组件');
  assert.equal(
    fillSlots('先拿{pair.1}', slots, { pair: '碗和勺子' }),
    '先拿碗',
    '换一组后 .1 要跟着变',
  );
  // 传了不存在的名字要退回默认，不能让题干空掉
  assert.equal(fillSlots('把{item}举起来', slots, { item: '不存在的' }), '把泡泡水举起来', '非法选择退回默认');
}
