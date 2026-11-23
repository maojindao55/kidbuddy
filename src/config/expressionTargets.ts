/**
 * 语言表达练习 · 目标库
 *
 * 编号与判定标准逐条对齐 skill「课堂记录量化工具」的 references/goal-codes.md：
 * - B 段（0-3 岁 · 语言沟通）：B5 首个有意义的词
 * - G 段（3-6 岁 · 语言沟通）：G1 词汇、G2 句长、G4 提问与回答、G5 语用
 * - K 段（6-12 岁 · 语言表达）：K1 说清一件事、K2 明确拒绝与索回、K3 主动求助、
 *   K4 复述口头通知、K5 电话/当面说清三要素
 *
 * 编号含义固定，不得临时发明；standard2 / onePenalty 保持 skill 原文口径，
 * 改了统计会错位。跨龄个案按「实际教学目标所在段」取码，不按年龄取码。
 *
 * 排列依据：VB-MAPP（Sundberg）的语言操作获得顺序——
 * Mand 请求 → Tact 命名 → 语言结构（句长）→ 功能性 Mand（拒绝、求助）→
 * 社会性语用 → Intraverbal 对话 → 叙述/复述/转述。
 * 对 ASD 与发育迟缓孩子的意义：
 * 1. 先建立「说话有用」——请求的动机就在眼前，比命名和问答都容易起量；
 * 2. 词汇是句子的材料，命名没铺开就上句长，只会练出仿说；
 * 3. Intraverbal（对话）没有实物可指，难度最高，必须排在命名之后；
 * 4. 带记忆负荷的复述、没有表情可用的电话，放在最后。
 */

export type ExpressionBand = 'infant' | 'preschool' | 'school';

export interface ExpressionTask {
  id: string;
  /** 伙伴对孩子念的题干，照念，不加话 */
  ask: string;
  /** 孩子卡住时给的提示句 */
  hint: string;
  /** 判定提示项：人工勾选，不做自动计分 */
  checks: string[];
}

export interface ExpressionFamilyGuide {
  /** 练什么 */
  what: string;
  /** 准备什么 */
  prepare: string;
  /** 怎么开始（照念的那一句） */
  start: string;
  /** 等几秒 */
  wait: string;
  /** 提示顺序 */
  prompts: string;
  /** 算成功的标准 */
  success: string;
  /** 做不到怎么降级 */
  fallback: string;
  /** 时长与频次 */
  dose: string;
  /** 这三件先别做 */
  avoid: string;
}

/** VB-MAPP 对应关系：给老师看，也给家长一个「为什么现在练这个」的解释 */
export interface VbMappRef {
  /** 语言操作类别：Mand 请求 / Tact 命名 / Linguistic 语言结构 / Intraverbal 对话 等 */
  operant: string;
  /** VB-MAPP 阶段：1 = 0-18 个月，2 = 18-30 个月，3 = 30-48 个月 */
  level: 1 | 2 | 3;
  /** 对应里程碑（写区间，不写单条，避免学期内口径变动） */
  milestone: string;
  /** 为什么这一条对 ASD / 发育迟缓的孩子排在这个位置 */
  rationale: string;
  /** 卡片上的短标签，如「Mand L1」 */
  tag: string;
}

export interface ExpressionTarget {
  id: string;
  name: string;
  band: ExpressionBand;
  /**
   * 由易到难的练习台阶，1 = 最容易。数字必须连续、不跳号。
   * 排序口径：VB-MAPP 语言操作获得顺序（请求 → 命名 → 句长 → 拒绝/求助 →
   * 语用 → 问答 → 叙述 → 复述 → 转述）。
   */
  difficulty: number;
  /** 五领域归类，用于统计 */
  domain: '语言沟通' | '语言表达';
  /** 一句话说清练什么，给孩子和家长看 */
  summary: string;
  /** 2 分标准（skill 原文口径，学期目标） */
  standard2: string;
  /** 常见 1 分情形 */
  onePenalty: string;
  /** 本次课的达标线：DTT 一次练习里看这个，不要拿学期口径判一节课 */
  sessionSuccess: string;
  /** 伙伴开场白 */
  opener: string;
  vbMapp: VbMappRef;
  tasks: ExpressionTask[];
  familyGuide: ExpressionFamilyGuide;
}

/**
 * 3 秒等待窗，和 DTT 的 DTT_WAIT_MS 保持一致。
 * ASD 孩子等待耐受更短，5 秒容易变成「走神」而不是「思考」。
 */
const WAIT_THREE_SECONDS =
  '等 3 秒。这 3 秒里不重复问题、不替他接话、不改成二选一、不说「你想想呀」、不用手指。他看你的时候，你就看着他，不点头也不出声。';

export const EXPRESSION_TARGETS: ExpressionTarget[] = [
  {
    id: 'B5',
    name: '开口要东西',
    band: 'infant',
    difficulty: 1,
    domain: '语言沟通',
    summary: '想要的东西在眼前，用词说出来，不用伸手、不用哭',
    standard2: '在需要时主动说出 ≥1 个稳定的词（同一情境 3 次以上）',
    onePenalty: '仿说但不主动用；词义不稳定',
    sessionSuccess: '10 个回合里 ≥8 次自己说出目标词（构音不准也算）',
    opener: '想要什么，就说给我听。你说了，我就给你。',
    vbMapp: {
      operant: 'Mand 请求',
      level: 1,
      milestone: 'Mand L1 · 第 1–5 里程碑（2 → 10 个不同请求）',
      rationale:
        '请求的动机就在眼前，是所有语言操作里最容易建立的。ASD 和发育迟缓的孩子常先学会拉手、指、哭来要东西，先把「说话」变成最省力的方式，后面的命名和对话才有地基。',
      tag: 'Mand L1',
    },
    tasks: [
      {
        id: 'B5-t1',
        ask: '（把泡泡水举到他面前，盖子拧紧，看着他，不说话）',
        hint: '「泡泡」',
        checks: ['自己说出「泡泡」', '没有伸手来抢', '说完看着你等回应'],
      },
      {
        id: 'B5-t2',
        ask: '（把饼干装进透明罐子，拧紧，放在他面前）',
        hint: '「饼干」',
        checks: ['说出「饼干」', '不是只说「这个」「那个」', '说完等你打开'],
      },
      {
        id: 'B5-t3',
        ask: '（把小汽车放在他够不到的架子上）',
        hint: '「车」',
        checks: ['说出「车」或「汽车」', '看向目标物', '没有拉你的手去够'],
      },
      {
        id: 'B5-t4',
        ask: '（张开手臂站在他面前，等他说）',
        hint: '「抱抱」',
        checks: ['说出「抱抱」或「举高」', '主动靠近你', '说完伸手要抱'],
      },
    ],
    familyGuide: {
      what: '练「用词换东西」。只要他开口就马上给，不要求说得完整、说得好听。',
      prepare:
        '选 3-5 样他真喜欢的东西（吃的、玩的），放进透明罐或高架子，让他看得见、拿不到。桌面其他东西全收走，只留这一次的目标物。',
      start: '举着东西不说话，等他。不要问「要不要」，不要晃给他看。',
      wait: WAIT_THREE_SECONDS,
      prompts:
        '① 给首字「泡…」→ ② 完整示范「泡泡」再等 3 秒 → ③ 手把手带他说一次。哪一级成功，下一次退回上一级；辅助只用来开头，不要一直给。',
      success: '10 个回合里 ≥8 次他自己说出目标词（构音不准也算）。到这个程度告诉老师。',
      fallback:
        '只留一样最强动机的东西，一次只练这一个词；出不了词就先接住任何声音（嗯、啊都算），再慢慢塑形。',
      dose: '一天 5-8 分钟，拆成 5-8 个自然时机，不要一口气连做 20 个回合。',
      avoid: '① 他一伸手你就给（说话就没必要了）　② 说「说对了才给」把请求变成考试　③ 一次换太多东西，前一个词还没稳就加新的',
    },
  },
  {
    id: 'G1',
    name: '看见就说',
    band: 'preschool',
    difficulty: 2,
    domain: '语言沟通',
    summary: '看到实物或图片，能说出它的名称',
    standard2: '常见名词、动词、形容词总量 ≥200，且能主动使用 ≥150',
    onePenalty: '认识但不说；总量 100-200',
    sessionSuccess: '10 张卡里 ≥8 张自己说出，换顺序还能说',
    opener: '你看，这是小狗。你也说说看。',
    vbMapp: {
      operant: 'Tact 命名',
      level: 1,
      milestone: 'Tact L1 · 第 1–5 里程碑（命名 2 → 10 个物品）',
      rationale:
        '命名和请求共用同一批词，但动机不同：命名是「看到就说」，没有东西可要。词汇量是后面所有句子的材料，ASD 孩子尤其需要大量、能泛化的命名练习。',
      tag: 'Tact L1',
    },
    tasks: [
      {
        id: 'G1-t1',
        ask: '（桌上放 3 样他认识的实物：杯子、球、小车。你指一样，等他说）',
        hint: '「杯子」',
        checks: ['3 样里 ≥2 样独立说出', '说出的是名称，不是「这个」', '不用等提示'],
      },
      {
        id: 'G1-t2',
        ask: '（摆 10 张常见物品图片卡，一张一张举起来）',
        hint: '「苹果」',
        checks: ['≥8 张独立说出', '打乱顺序也能说', '没有一张重复问'],
      },
      {
        id: 'G1-t3',
        ask: '（出示动作图片：喝水、跑、睡觉）',
        hint: '「他在喝水」',
        checks: ['说出动作词', '能带上谁在做', '≥2 张独立说出'],
      },
      {
        id: 'G1-t4',
        ask: '（走到窗边或玩具架前，指给他看）',
        hint: '「那是大树」',
        checks: ['在自然情境里主动说', '不是只在桌面卡上说', '一次活动里 ≥3 次'],
      },
    ],
    familyGuide: {
      what: '练「看见就说名字」。不是考他，是你在旁边不停地说，让他跟着说。',
      prepare: '10 张一组图片卡（同一类，比如动物），再配 3 样实物；桌面只留这一组，别的一概收走。',
      start: '拿起一张，说「你看，小狗。」然后停住，看他 3 秒。',
      wait: WAIT_THREE_SECONDS,
      prompts:
        '① 说首字「小…」→ ② 完整说一遍让他仿说 → ③ 手把手或口型辅助。仿说成功也算一次，但要马上退到上一级。',
      success: '10 张里 ≥8 张他自己说出；同一组换顺序还能说；换个人问也能说。',
      fallback: '从 3 张开始，只练这 3 张；还不行就只练 1 张，一天练 10 遍，练熟了再添第二张。',
      dose: '一天 5-8 分钟，一组 10 张过 2 遍。',
      avoid: '① 连问「这是什么」十遍，变成考试　② 纠正发音（「是狗狗不是斗斗」）　③ 旧卡还没稳就换新一批',
    },
  },
  {
    id: 'G2',
    name: '把词连成句',
    band: 'preschool',
    difficulty: 3,
    domain: '语言沟通',
    summary: '把两个词连成三个词以上的一句话',
    standard2: '自发说出三词以上简单句 ≥5 次/次观察',
    onePenalty: '以双词句为主；需仿说',
    sessionSuccess: '10 个来回里 ≥5 次自己说出三词以上',
    opener: '我说短的，你把它说长一点。',
    vbMapp: {
      operant: 'Linguistic 语言结构',
      level: 2,
      milestone: 'L2 · 双词到三词组合（前置是 Tact L2 的双词组合）',
      rationale:
        '句长是语言结构的门槛。发育迟缓的孩子常停在双词句，需要成人给出「多一个词」的支架；只说「说长一点」他听不懂，要直接给那一两个词的形状。',
      tag: 'Linguistic L2',
    },
    tasks: [
      {
        id: 'G2-t1',
        ask: '（桌上放红车、蓝球）你看这个，说成一句话：什么颜色的什么。',
        hint: '「红色的车」',
        checks: ['说出物品', '加上颜色或大小', '合成三词以上'],
      },
      {
        id: 'G2-t2',
        ask: '（做一个动作：喝水）说一句话，谁在做什么。',
        hint: '「宝宝在喝水」',
        checks: ['有主语', '有动作词', '三词以上'],
      },
      {
        id: 'G2-t3',
        ask: '（把小熊放到桌子下面）小熊在哪里？说成一句话。',
        hint: '「小熊在桌子下面」',
        checks: ['说清位置', '用上「在」', '三词以上'],
      },
      {
        id: 'G2-t4',
        ask: '（回放刚才玩过的活动）刚才我们做了什么？说一句。',
        hint: '「我和老师玩小汽车」',
        checks: ['说出事件', '有对象', '三词以上'],
      },
    ],
    familyGuide: {
      what: '在他已经会说的词上加一个词。不要求语法完整，不纠正顺序。',
      prepare: '只用他 100% 会说名字的 3 样东西；桌上别的都收走，减少分心。',
      start: '照这句说：「你说，这是什么颜色的什么？」说完就把嘴闭上。',
      wait: WAIT_THREE_SECONDS,
      prompts:
        '① 说前半句「这是小汽…」留最后一个词给他 → ② 二选一「是红色的还是蓝色的？」 → ③ 你说完整句让他仿说。哪一级做到了，下一次退回上一级。',
      success: '10 个来回里 ≥5 次他自己说出三词以上的句子，中间不用你提示。',
      fallback: '先只加颜色（「红车」），做顺了再加位置或量词；还不行就退回两词句，只要求多一个字。',
      dose: '一天 8-10 分钟 1 次。他开始东张西望或走开就停，不加练。',
      avoid: '① 替他把句子说完　② 他说「车」你回「不对，要说红汽车」　③ 同一句问第二遍',
    },
  },
  {
    id: 'K2',
    name: '拒绝与索回',
    band: 'school',
    difficulty: 4,
    domain: '语言表达',
    summary: '不想给就说「不要」，东西被拿走就说「还给我」',
    standard2: '角色扮演/真实情境中，3 次均能说出「不要」「还给我」，音量可被听清',
    onePenalty: '说了但声音过小；需教师示意才开口',
    sessionSuccess: '6 个回合里 ≥5 次在 1 秒内说出「不要」或「还给我」',
    opener: '不想要就说「不要」，我会停下来。',
    vbMapp: {
      operant: 'Mand 请求',
      level: 2,
      milestone: 'Mand L2 · 第 6–7 里程碑（拒绝/终止、索回）',
      rationale:
        '拒绝是使用频率最高的请求之一。ASD 孩子不会用词拒绝时，往往用推、哭、跑掉代替，问题行为多半从这里长出来——先给他一句好用的话，比事后纠正行为省力得多。',
      tag: 'Mand L2',
    },
    tasks: [
      {
        id: 'K2-t1',
        ask: '（递给他一样他不喜欢的东西，比如一块生胡萝卜）',
        hint: '「不要」',
        checks: ['1 秒内说出「不要」', '音量能被听清', '没有推开或哭'],
      },
      {
        id: 'K2-t2',
        ask: '（把他手上的玩具拿走，握在自己手里）',
        hint: '「还给我」',
        checks: ['说出「还给我」', '看着对方说', '说完伸手要回'],
      },
      {
        id: 'K2-t3',
        ask: '（假装抢走他的画，角色扮演）',
        hint: '「不要抢，还给我」',
        checks: ['组合成短句', '语气坚定', '没有直接动手'],
      },
      {
        id: 'K2-t4',
        ask: '（关掉他正在看的动画，说「关掉了」）',
        hint: '「不要关，我还想看」',
        checks: ['说出「不要」', '补一句要求', '音量可听清'],
      },
    ],
    familyGuide: {
      what: '练「不想就要说出来」。这条比请求更容易起量，因为动机是现成的。',
      prepare: '准备 2 样他不喜欢的（不爱的零食、凉毛巾）和 1 样他正玩得起劲的玩具。',
      start: '递东西的同时说「给你。」然后闭嘴，等他。',
      wait: WAIT_THREE_SECONDS,
      prompts:
        '① 提示「不…」→ ② 示范「不要」再等 3 秒 → ③ 手把手带说。他一说「不要」，立刻收回东西并说「好，不要」——让他看到这句话真的有用。',
      success: '6 个回合里 ≥5 次在 1 秒内说出「不要」或「还给我」，音量能被听清。',
      fallback: '先只练「不要」这一个词，练稳了再加「还给我」；还不行就从摇头配「不」起步，再补全词。',
      dose: '一天 5 分钟，3-5 个回合就够，别把他惹急了。',
      avoid: '① 在他哭闹的时候练（会变成情绪对抗）　② 他说了「不要」你还继续给（下次他就不说了）　③ 要求他说「请您不要这样」这种长句',
    },
  },
  {
    id: 'K3',
    name: '主动求助',
    band: 'school',
    difficulty: 5,
    domain: '语言表达',
    summary: '卡住了就找人开口说「帮我」，不自己硬撑也不放弃',
    standard2: '主动走向指定成人并开口「老师，我……」，完成一次求助',
    onePenalty: '需教师指方向或先叫名字',
    sessionSuccess: '5 次机会里 ≥4 次他自己走过来开口',
    opener: '打不开就说「帮我」，我马上来。',
    vbMapp: {
      operant: 'Mand 请求',
      level: 2,
      milestone: 'Mand L2 · 第 7 里程碑（请求他人做出动作）',
      rationale:
        '求助要先觉察「我卡住了」，再主动找人，比要东西难一层。这一条不通，孩子容易直接放弃或发脾气，学业和自理都会卡在同一个点上。',
      tag: 'Mand L2',
    },
    tasks: [
      {
        id: 'K3-t1',
        ask: '（把一个拧得很紧的零食罐放在他面前，你退到两米外）',
        hint: '「老师，帮我」',
        checks: ['走过来找你', '开口叫了人', '说出要帮什么'],
      },
      {
        id: 'K3-t2',
        ask: '（把他喜欢的玩具放在他够不到的柜子顶上）',
        hint: '「我够不到，帮我拿」',
        checks: ['主动走向成人', '说出「帮我」', '没有自己爬高'],
      },
      {
        id: 'K3-t3',
        ask: '（给他一支写不出水的笔和一张纸）',
        hint: '「笔坏了，帮我换」',
        checks: ['发现问题', '开口说明', '指出问题在哪'],
      },
      {
        id: 'K3-t4',
        ask: '（把拼图最后一块藏起来，他拼不上）',
        hint: '「少了一块，帮我找」',
        checks: ['说出卡在哪', '主动求助', '没有直接放弃'],
      },
    ],
    familyGuide: {
      what: '练「卡住了就找人」。关键是让他知道：求助比放弃和发脾气都快。',
      prepare: '准备 3 个「一定会卡住」的小情境：拧紧的罐子、放高的玩具、写不出水的笔。',
      start: '你把东西给他，然后退开两步，不说话，等他自己来找你。',
      wait: WAIT_THREE_SECONDS,
      prompts:
        '① 你看向他、抬一下下巴示意 → ② 问「怎么了？」引出他说 → ③ 示范「帮我」让他仿说。',
      success: '5 次机会里 ≥4 次他自己走过来开口（只叫人、没叫名字也算）。',
      fallback: '先只练一个情境（拧罐子），天天同一个；还不行就把你的位置挪近一点，稳定后再慢慢拉远。',
      dose: '一天 3-5 次机会，散在自然活动里，不要集中练。',
      avoid: '① 他一哼你就把东西弄好（求助就没必要了）　② 说「你说话呀」　③ 他开口了你还在看手机',
    },
  },
  {
    id: 'G5',
    name: '语用四类',
    band: 'preschool',
    difficulty: 6,
    domain: '语言沟通',
    summary: '请求、拒绝、求助、打招呼，四类里能自己说出三类',
    standard2: '请求、拒绝、求助、打招呼四类中 ≥3 类能主动说出',
    onePenalty: '用哭闹或拉扯代替；需提示',
    sessionSuccess: '四个情境过一遍，≥3 类能自己主动说出',
    opener: '我们来演四个小场景：要东西、不要、求助、打招呼。',
    vbMapp: {
      operant: 'Mand + Social',
      level: 2,
      milestone: 'L2 · 社会行为与请求（四类语用综合）',
      rationale:
        '这是一条综合检验：四类语用里 ≥3 类能自发用出来，才说明语言真的进了日常。缺哪类就回去补对应的专项目标——它不替代 K2、K3，而是查漏。',
      tag: 'Mand/Social L2',
    },
    tasks: [
      {
        id: 'G5-t1',
        ask: '（有人进门，你提示「看，谁来了」）',
        hint: '「老师好」',
        checks: ['主动开口', '看着对方', '音量能被听清'],
      },
      {
        id: 'G5-t2',
        ask: '（把喜欢的点心放在透明盒里，不给他勺子）',
        hint: '「请给我一个勺子」',
        checks: ['说出请求', '用上「给我」或「请」', '不是直接伸手'],
      },
      {
        id: 'G5-t3',
        ask: '（递给他一样不想要的东西）',
        hint: '「我不要」',
        checks: ['明确说「不要」', '没有推开', '语气平和'],
      },
      {
        id: 'G5-t4',
        ask: '（给他一个打不开的盒子）',
        hint: '「帮我打开」',
        checks: ['主动开口', '说清要什么', '等到回应再重复'],
      },
    ],
    familyGuide: {
      what: '这条是查漏：请求、拒绝、求助、打招呼四类，看哪几类已经能自己用出来。',
      prepare: '四个情境各准备一样道具：门口（打招呼）、点心盒（请求）、不爱的东西（拒绝）、紧盒子（求助）。',
      start: '一次只演一个情境，演完记一下他有没有主动说；不要四个一口气演完。',
      wait: WAIT_THREE_SECONDS,
      prompts: '① 情境本身提示（抬手、看着他）→ ② 说首字 → ③ 示范一遍让他仿说。',
      success: '四类里 ≥3 类能自己主动说出（不用提示），这条就算达标。',
      fallback: '先集中补最能起量的那一类（通常是请求），其他三类隔天再试。',
      dose: '一周 2 次，每次只过 2 个情境，5 分钟。',
      avoid: '① 一次问四类（他会乱）　② 用零食换他说「谢谢」　③ 当着外人说「他怎么不叫人」',
    },
  },
  {
    id: 'G4',
    name: '提问与回答',
    band: 'preschool',
    difficulty: 7,
    domain: '语言沟通',
    summary: '能回答「什么/谁/在哪」，也能自己问一句',
    standard2: '能回答什么/谁/在哪；能主动问「这是什么」',
    onePenalty: '只回答不提问；需二选一',
    sessionSuccess: '回答类 10 个问题 ≥8 个对，且主动提问 ≥1 次',
    opener: '我问你，你也可以问我。我们轮流来。',
    vbMapp: {
      operant: 'Intraverbal 对话',
      level: 2,
      milestone: 'Intraverbal L2 · 第 8 里程碑（回答什么/谁/在哪）＋ Mand L2 提问',
      rationale:
        '对话是「听到话再说话」，眼前没有实物可指，难度高于命名和请求。先练答，答稳了再教问——问句是 Mand，比答更难。',
      tag: 'Intraverbal L2',
    },
    tasks: [
      {
        id: 'G4-t1',
        ask: '（举起一张图片）这是什么？',
        hint: '「这是苹果」',
        checks: ['答出名称', '2 秒内回答', '不用二选一'],
      },
      {
        id: 'G4-t2',
        ask: '（出示家人照片）这是谁？',
        hint: '「这是妈妈」',
        checks: ['答出称谓', '≥3 张正确', '不用提示'],
      },
      {
        id: 'G4-t3',
        ask: '（问常见物品的位置）小熊在哪里？',
        hint: '「在床上」',
        checks: ['答出地点', '用上「在」', '≥3 次正确'],
      },
      {
        id: 'G4-t4',
        ask: '（把一个他没见过的物品放进袋子，只露一角）',
        hint: '「这是什么？」',
        checks: ['主动问 ≥1 次', '问的是「是什么」类', '问完等回答'],
      },
    ],
    familyGuide: {
      what: '先练答（什么/谁/在哪），再练问。问比答难，别一起上。',
      prepare: '一组图片卡（物品、家人、常见地点各 3 张），装在不透明袋里。',
      start: '抽一张问：「这是什么？」问完闭嘴等 3 秒，不要接着问第二遍。',
      wait: WAIT_THREE_SECONDS,
      prompts:
        '① 二选一「是苹果还是香蕉？」→ ② 说首字「苹…」→ ③ 示范完整答案让他仿说。',
      success: '回答类 10 个问题 ≥8 个对；主动提问 ≥1 次。',
      fallback: '只练「这是什么」一类，答稳了再加「谁」「在哪」；提问单独练，用他真不认识的物品才问得出来。',
      dose: '一天 5-8 分钟，10-15 个回合。',
      avoid: '① 连着问三个问题等他一起答　② 纠正问句语法（「应该说这是什么呀」）　③ 答错就换下一题（要先给正确答案，再让他试一次）',
    },
  },
  {
    id: 'K1',
    name: '说清一件事',
    band: 'school',
    difficulty: 8,
    domain: '语言表达',
    summary: '用「谁—在哪—做了什么—然后」讲清一件亲身经历',
    standard2: '用「谁—在哪—做了什么—然后」四要素讲述亲身经历，要素齐全率 ≥3/4',
    onePenalty: '需提示「后来呢」才补全；要素齐全但需追问',
    sessionSuccess: '讲 3 件事，其中 2 件四要素齐全，中间不用「后来呢」',
    opener: '跟我说说，刚才发生了什么？',
    vbMapp: {
      operant: 'Intraverbal 对话',
      level: 3,
      milestone: 'Intraverbal L3 · 叙述与顺序',
      rationale:
        '叙述要同时组织时间顺序和要素，是学龄段的核心。ASD 孩子常记得片段但连不成线，四要素就是给他的支架——缺哪个补哪个，不要笼统要求「说清楚」。',
      tag: 'Intraverbal L3',
    },
    tasks: [
      {
        id: 'K1-t1',
        ask: '今天在教室里你做了什么？说给我听。',
        hint: '「我先……然后……」',
        checks: ['有「谁」', '有「做了什么」', '有「然后」'],
      },
      {
        id: 'K1-t2',
        ask: '刚才我们玩的那个游戏，是怎么玩的？',
        hint: '「先把球扔进去，然后……」',
        checks: ['按顺序说', '≥2 个步骤', '不用追问「后来呢」'],
      },
      {
        id: 'K1-t3',
        ask: '（三格图片故事）这三张图讲了什么？一张一张说。',
        hint: '「第一张……第二张……」',
        checks: ['三格都说到', '顺序正确', '有连接词'],
      },
      {
        id: 'K1-t4',
        ask: '周末你去哪了？跟谁去的？做了什么？',
        hint: '「我和妈妈去公园，玩了滑梯」',
        checks: ['有地点', '有同伴', '有事件'],
      },
    ],
    familyGuide: {
      what: '练「讲清楚」，四要素：谁—在哪—做了什么—然后。缺哪个就只补那个。',
      prepare: '用刚发生的真事（不要让他回忆很久以前）；三格图片故事一套。',
      start: '照这句问：「刚才我们做了什么？说给我听。」问完等 3 秒，不要马上补「后来呢」。',
      wait: WAIT_THREE_SECONDS,
      prompts: '① 提示「后来呢？」→ ② 给要素提示「谁？在哪？」→ ③ 你说前半句让他接。',
      success: '讲 3 件事，其中 2 件四要素齐全，中间不用「后来呢」。',
      fallback: '先只要求两要素（谁＋做了什么）；还不行就用图片当线索，讲一张说一句。',
      dose: '一天 5 分钟，讲 1-2 件事，别变成审问。',
      avoid: '① 中途打断纠正用词　② 替他把「然后」补上　③ 讲完追问细节考他',
    },
  },
  {
    id: 'K4',
    name: '复述通知',
    band: 'school',
    difficulty: 9,
    domain: '语言表达',
    summary: '听完一句通知，能把关键信息说出来',
    standard2: '听完 1-2 句通知后复述关键信息，正确率 ≥80%',
    onePenalty: '需重复一遍才能复述；漏掉时间或物品',
    sessionSuccess: '5 条通知里 ≥4 条关键信息复述正确',
    opener: '我说一句话，你听完再说给我听。',
    vbMapp: {
      operant: 'Intraverbal 对话',
      level: 3,
      milestone: 'Intraverbal L3 · 多要素听觉记忆与复述',
      rationale:
        '听一遍就要记住并说出来，工作记忆负荷最高之一。一次只加一个信息、比反复重复更有效——重复三遍再说，练的是「等」，不是「记」。',
      tag: 'Intraverbal L3',
    },
    tasks: [
      {
        id: 'K4-t1',
        ask: '听好：明天带水杯。你说一遍。',
        hint: '「明天带什么？」',
        checks: ['说出「水杯」', '说出「明天」', '一次就记住'],
      },
      {
        id: 'K4-t2',
        ask: '听好：下午去操场玩，带上帽子。你说一遍。',
        hint: '「先说去哪，再说带什么」',
        checks: ['两个信息都有', '顺序正确', '不用重复一遍'],
      },
      {
        id: 'K4-t3',
        ask: '听好：妈妈五点在门口接你，别乱跑。你说一遍。',
        hint: '「几点？在哪？」',
        checks: ['说出时间', '说出地点', '说出要求'],
      },
      {
        id: 'K4-t4',
        ask: '听好这句话，等会儿说给隔壁老师听：三班今天不上课。',
        hint: '「哪个班？今天怎么了？」',
        checks: ['记住并转达', '信息准确', '隔一会儿还能说'],
      },
    ],
    familyGuide: {
      what: '练「听完记住再说出来」。一条只给 1-2 个信息，不要一次三句。',
      prepare: '用真实会发生的事当通知（带水杯、几点接），不要编无意义的句子。',
      start: '清楚说一遍，说完停 3 秒，不要自己重复。',
      wait: WAIT_THREE_SECONDS,
      prompts: '① 提问式提示「带什么？」→ ② 说前半句让他接 → ③ 完整重复一遍让他仿说。',
      success: '5 条通知里 ≥4 条关键信息复述正确。',
      fallback: '退回一个信息（只说「带水杯」）；还不行就配一张图卡当视觉提示。',
      dose: '一天 5 条，分散在不同时间，不要连续轰炸。',
      avoid: '① 说完自己马上重复一遍　② 一次给三句以上　③ 他说错立刻说「不对」',
    },
  },
  {
    id: 'K5',
    name: '电话说清三要素',
    band: 'school',
    difficulty: 10,
    domain: '语言表达',
    summary: '电话或当面对别人说清「我是谁、我在哪、我需要什么」',
    standard2: '依次说出「我是谁、我在哪、我需要什么」，不依赖提示卡',
    onePenalty: '需提示卡；漏说其中一项',
    sessionSuccess: '3 次通话里 2 次三要素齐全，不用卡片',
    opener: '假装打电话，你要告诉我三件事：你是谁、你在哪、你要什么。',
    vbMapp: {
      operant: 'Intraverbal + Social',
      level: 3,
      milestone: 'L3 · 跨对象、跨情境泛化',
      rationale:
        '电话没有表情和手势可用，是纯听觉的语言任务，最考验泛化——桌面练会了，换个通道就散架的情况很常见，所以放最后，专门练「换人换场景还能说」。',
      tag: 'Intraverbal L3',
    },
    tasks: [
      {
        id: 'K5-t1',
        ask: '（用真手机演，你走到另一个房间当接电话的人）喂，你好。',
        hint: '「我是……我在……我要……」',
        checks: ['说出自己是谁', '说出在哪', '说出需要什么'],
      },
      {
        id: 'K5-t2',
        ask: '（演：你找不到妈妈了，给老师打电话）',
        hint: '「老师，我是××，我在超市」',
        checks: ['三要素齐', '顺序正确', '语气能听清'],
      },
      {
        id: 'K5-t3',
        ask: '（走到另一位老师面前）把你刚才的事说给这位老师听。',
        hint: '「我是……我需要……」',
        checks: ['主动走过去', '三要素齐', '不看卡片'],
      },
      {
        id: 'K5-t4',
        ask: '（真打给一位熟悉的大人，说清一件事）',
        hint: '「先说是谁，再说要什么」',
        checks: ['真实情境能完成', '三要素齐', '对方听懂了'],
      },
    ],
    familyGuide: {
      what: '这条最难，放在最后。三要素：我是谁、我在哪、我需要什么。',
      prepare: '用真手机演（不开免提也行），你走到另一个房间当接电话的人；准备一张写三个词的小卡片，但先不给。',
      start: '照这句说：「喂，你好。」然后等他开口。',
      wait: WAIT_THREE_SECONDS,
      prompts:
        '① 问「你是谁？」提示第一空 → ② 问「你在哪儿？」 → ③ 把卡片给他看，让他照着说。',
      success: '3 次通话里 2 次三要素齐全，不用卡片。',
      fallback: '先只练前两句（我是谁、我在哪）；还不行就把三句写在卡片上，读一遍，再练不看卡片。',
      dose: '一次 5 分钟，3 个来回，隔天 1 次。',
      avoid: '① 他刚说一句你就替他说完　② 要求他说「您好、请问、谢谢」这些客套　③ 在真有急事的时候练',
    },
  },
];

/** 难度档，只用于给孩子家长看的一句话说明 */
export type ExpressionTier = '入门' | '进阶' | '挑战';

/** 台阶 → 档位。1-3 入门，4-6 进阶，7-10 挑战 */
export function tierOf(difficulty: number): ExpressionTier {
  if (difficulty <= 3) return '入门';
  if (difficulty <= 6) return '进阶';
  return '挑战';
}

/** 由易到难排好的目标，界面上用这个，不要直接用 EXPRESSION_TARGETS */
export const EXPRESSION_TARGETS_BY_DIFFICULTY: ExpressionTarget[] = EXPRESSION_TARGETS.slice().sort(
  (a, b) => a.difficulty - b.difficulty,
);

/** 建议下一个练的目标：台阶最靠前、还没稳定的那个 */
export function suggestNextTarget(stableIds: string[]): ExpressionTarget | undefined {
  return EXPRESSION_TARGETS_BY_DIFFICULTY.find((t) => !stableIds.includes(t.id));
}

export function getExpressionTarget(id: string | undefined): ExpressionTarget | undefined {
  if (!id) return undefined;
  return EXPRESSION_TARGETS.find((t) => t.id === id);
}

export function targetsForBand(band: ExpressionBand): ExpressionTarget[] {
  return EXPRESSION_TARGETS_BY_DIFFICULTY.filter((t) => t.band === band);
}
