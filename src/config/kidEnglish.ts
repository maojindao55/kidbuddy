/**
 * 英语情景冒险岛配置、本地任务判定、词袋进度与双语绘本 Prompt。
 *
 * 零外部运行时依赖（仅读写 localStorage），便于 node 直接 transpile 单测。
 */
import type { AgeBand } from './ageProfile';

export const ENGLISH_BUDDY = {
  id: 'kid-english-sunny',
  name: 'Sunny 鹦鹉',
  emoji: '🦜',
  color: '#10B981',
} as const;

export interface EnglishMission {
  id: string;
  labelZh: string;
  hintEn: string;
  hintZh: string;
  keywords: string[];
}

export interface EnglishScene {
  id: string;
  order: number;
  title: string;
  englishTitle: string;
  emoji: string;
  accent: string;
  bg: string;
  levelLabel: string;
  roleName: string;
  setting: string;
  openingEn: string;
  openingZh: string;
  missions: EnglishMission[];
}

export const ENGLISH_SCENES: EnglishScene[] = [
  {
    id: 'ice_cream',
    order: 1,
    title: '买冰淇淋',
    englishTitle: 'Ice Cream Shop',
    emoji: '🍦',
    accent: '#EC4899',
    bg: '#FDF2F8',
    levelLabel: '入门 ★',
    roleName: '冰淇淋店员 Sunny',
    setting: '阳光小镇的冰淇淋小车旁，摆满了草莓、巧克力和香草甜筒。',
    openingEn: 'Hello! Welcome to Sunny Ice Cream Shop! What would you like?',
    openingZh: '你好！欢迎来到阳光冰淇淋店！你想要什么呀？',
    missions: [
      {
        id: 'ic-1',
        labelZh: '和店员打招呼并点一个冰淇淋',
        hintEn: 'Hello! One ice cream, please!',
        hintZh: '你好！请给我一个冰淇淋！',
        keywords: ['hello', 'hi', 'ice cream', 'one', 'please'],
      },
      {
        id: 'ic-2',
        labelZh: '选一个喜欢的口味（草莓 / 巧克力 / 香草）',
        hintEn: 'Strawberry flavor, please.',
        hintZh: '我想要草莓味的。',
        keywords: ['strawberry', 'chocolate', 'vanilla', 'flavor', 'like', 'want'],
      },
      {
        id: 'ic-3',
        labelZh: '接过冰淇淋并礼貌道谢说再见',
        hintEn: 'Thank you! Bye-bye!',
        hintZh: '谢谢你！再见！',
        keywords: ['thank', 'thanks', 'bye', 'goodbye', 'yummy'],
      },
    ],
  },
  {
    id: 'zoo_tour',
    order: 2,
    title: '逛动物园',
    englishTitle: 'Sunny Zoo',
    emoji: '🦁',
    accent: '#F59E0B',
    bg: '#FFFBEB',
    levelLabel: '入门 ★',
    roleName: '动物园小向导 Sunny',
    setting: '热闹的阳光动物园，狮子在打哈欠，大熊猫在啃竹子，长颈鹿伸着长脖子。',
    openingEn: 'Welcome to Sunny Zoo! What animal do you see?',
    openingZh: '欢迎来到阳光动物园！你看到了什么动物？',
    missions: [
      {
        id: 'zoo-1',
        labelZh: '指着你看到的动物大声说出来',
        hintEn: 'Look! A big lion!',
        hintZh: '看！一只大狮子！',
        keywords: ['look', 'see', 'lion', 'panda', 'monkey', 'elephant', 'giraffe', 'tiger', 'bear'],
      },
      {
        id: 'zoo-2',
        labelZh: '告诉 Sunny 你最喜欢哪种动物',
        hintEn: 'I like pandas best.',
        hintZh: '我最喜欢大熊猫。',
        keywords: ['like', 'love', 'panda', 'animal', 'favorite', 'best'],
      },
      {
        id: 'zoo-3',
        labelZh: '夸夸小动物真可爱或真酷',
        hintEn: 'It is so cute!',
        hintZh: '它太可爱了！',
        keywords: ['cute', 'cool', 'big', 'tall', 'happy', 'lovely'],
      },
    ],
  },
  {
    id: 'self_intro',
    order: 3,
    title: '认识新朋友',
    englishTitle: 'New Friend',
    emoji: '👋',
    accent: '#3B82F6',
    bg: '#EFF6FF',
    levelLabel: '入门 ★',
    roleName: '新同学 Sunny',
    setting: '快乐小学的操场上，Sunny 飞过来想和你交朋友。',
    openingEn: 'Hi there! I am Sunny. What is your name?',
    openingZh: '嗨！我叫 Sunny。你叫什么名字呀？',
    missions: [
      {
        id: 'si-1',
        labelZh: '用英文介绍自己的名字',
        hintEn: 'Hi! My name is Leo.',
        hintZh: '嗨！我的名字叫 Leo。',
        keywords: ['name', 'am', 'call', 'hi', 'hello'],
      },
      {
        id: 'si-2',
        labelZh: '说说你今年几岁了，或者喜欢什么',
        hintEn: 'I am eight years old.',
        hintZh: '我今年八岁了。',
        keywords: ['years', 'old', 'like', 'play', 'draw', 'read'],
      },
      {
        id: 'si-3',
        labelZh: '对新朋友说很高兴认识你',
        hintEn: 'Nice to meet you!',
        hintZh: '很高兴认识你！',
        keywords: ['nice', 'meet', 'friend', 'happy'],
      },
    ],
  },
  {
    id: 'fruit_shop',
    order: 4,
    title: '魔法水果店',
    englishTitle: 'Fruit Market',
    emoji: '🍎',
    accent: '#EF4444',
    bg: '#FEF2F2',
    levelLabel: '进阶 ★★',
    roleName: '水果店主 Sunny',
    setting: '魔法集市的水果摊，红苹果、甜香蕉和紫葡萄都在闪闪发光。',
    openingEn: 'Fresh fruits here! What fruit do you want today?',
    openingZh: '新鲜水果来啦！今天想买什么水果？',
    missions: [
      {
        id: 'fs-1',
        labelZh: '点出想要的水果和数量',
        hintEn: 'Can I have three apples?',
        hintZh: '我可以要三个苹果吗？',
        keywords: ['apple', 'apples', 'banana', 'orange', 'grape', 'want', 'have', 'three', 'two'],
      },
      {
        id: 'fs-2',
        labelZh: '问问店主这些水果多少钱',
        hintEn: 'How much is it?',
        hintZh: '这个多少钱？',
        keywords: ['how', 'much', 'yuan', 'dollar', 'price'],
      },
      {
        id: 'fs-3',
        labelZh: '递上星星币并礼貌道谢',
        hintEn: 'Here you are. Thank you!',
        hintZh: '给你。谢谢！',
        keywords: ['here', 'thank', 'thanks', 'bye'],
      },
    ],
  },
  {
    id: 'school_bag',
    order: 5,
    title: '整理小书包',
    englishTitle: 'Pack My Bag',
    emoji: '🎒',
    accent: '#8B5CF6',
    bg: '#F5F3FF',
    levelLabel: '进阶 ★★',
    roleName: '生活小管家 Sunny',
    setting: '晚上准备明天上学，书桌上放着铅笔盒、故事书和水壶。',
    openingEn: 'Time to pack your school bag! What do we need first?',
    openingZh: '该整理书包啦！我们先装什么？',
    missions: [
      {
        id: 'sb-1',
        labelZh: '说出你要找的文具（铅笔 / 橡皮 / 尺子）',
        hintEn: 'Where is my pencil?',
        hintZh: '我的铅笔在哪里？',
        keywords: ['pencil', 'pen', 'eraser', 'ruler', 'where', 'my'],
      },
      {
        id: 'sb-2',
        labelZh: '把书本或水壶放进书包里',
        hintEn: 'Put the book in the bag.',
        hintZh: '把书放进书包里。',
        keywords: ['put', 'book', 'water', 'bag', 'in'],
      },
      {
        id: 'sb-3',
        labelZh: '整理完毕，自信地说准备好上学啦',
        hintEn: 'I am ready for school!',
        hintZh: '我准备好去上学啦！',
        keywords: ['ready', 'school', 'done', 'good', 'great'],
      },
    ],
  },
  {
    id: 'space_trip',
    order: 6,
    title: '太空问路',
    englishTitle: 'Space Station',
    emoji: '🚀',
    accent: '#0EA5E9',
    bg: '#F0F9FF',
    levelLabel: '进阶 ★★',
    roleName: '太空站长 Sunny',
    setting: '银河空间站里窗外飘着月亮和彩色星球，你正开着小飞船去探险。',
    openingEn: 'Beep beep! Welcome to Space Station! Where are you flying to?',
    openingZh: '嘀嘀！欢迎来到太空站！你要飞去哪里呀？',
    missions: [
      {
        id: 'sp-1',
        labelZh: '礼貌询问月亮或地球在哪里',
        hintEn: 'Excuse me, where is the moon?',
        hintZh: '打扰一下，月亮在哪里？',
        keywords: ['excuse', 'where', 'moon', 'earth', 'star', 'planet'],
      },
      {
        id: 'sp-2',
        labelZh: '确认方向（向左转 / 向右转 / 直飞）',
        hintEn: 'Go straight and turn left.',
        hintZh: '直走然后向左转。',
        keywords: ['left', 'right', 'straight', 'turn', 'go', 'fly'],
      },
      {
        id: 'sp-3',
        labelZh: '感谢站长并告别起飞',
        hintEn: 'Thank you! See you in space!',
        hintZh: '谢谢！太空见！',
        keywords: ['thank', 'thanks', 'see', 'bye', 'rocket'],
      },
    ],
  },
];

export function getEnglishScene(id: string | undefined): EnglishScene | undefined {
  return ENGLISH_SCENES.find((s) => s.id === id);
}

/** 提取英文单词（小写去标点，保留 I 和长度 >= 2 的单词） */
export function extractEnglishWords(text: string): string[] {
  const matches = (text || '').match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) || [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of matches) {
    const w = raw.toLowerCase();
    if (w !== 'i' && w.length < 2) continue;
    if (!seen.has(w)) {
      seen.add(w);
      out.push(w);
    }
  }
  return out;
}

/**
 * 判定孩子的发言是否推进当前英语任务：
 * 1. 至少包含英文单词（纯中文提问“怎么说”不算完成，由 Sunny 先示范）；
 * 2. 命中当前任务的关键词，或勇敢说出了 2 个及以上英文单词即可通关本步！
 */
export function matchMissionAttempt(text: string, mission: EnglishMission): boolean {
  const words = extractEnglishWords(text);
  if (words.length === 0) return false;

  const lower = (text || '').toLowerCase();
  const wordSet = new Set(words);
  for (const kw of mission.keywords) {
    const target = kw.toLowerCase().trim();
    if (!target) continue;
    if (target.includes(' ') ? lower.includes(target) : wordSet.has(target) || lower.includes(target)) {
      return true;
    }
  }
  return words.length >= 2;
}

// ============ 本地进度与词袋 ============

export interface EnglishProgress {
  completedScenes: Record<string, { stars: number; completedAt: number }>;
  wordsSpoken: string[];
  totalTurns: number;
}

export const MAX_ENGLISH_WORDS = 80;
const PROGRESS_KEY = 'kid_english_progress';

export function emptyEnglishProgress(): EnglishProgress {
  return { completedScenes: {}, wordsSpoken: [], totalTurns: 0 };
}

export function normalizeEnglishProgress(raw: unknown): EnglishProgress {
  const base = emptyEnglishProgress();
  if (!raw || typeof raw !== 'object') return base;
  const obj = raw as Record<string, unknown>;
  const completedScenes: EnglishProgress['completedScenes'] = {};
  if (obj.completedScenes && typeof obj.completedScenes === 'object') {
    for (const [k, v] of Object.entries(obj.completedScenes as Record<string, unknown>)) {
      if (v && typeof v === 'object') {
        const rec = v as Record<string, unknown>;
        const stars = Math.max(1, Math.min(3, Math.floor(Number(rec.stars) || 3)));
        const completedAt = Number(rec.completedAt) || 0;
        completedScenes[k] = { stars, completedAt };
      }
    }
  }
  const wordsSpoken = Array.isArray(obj.wordsSpoken)
    ? Array.from(
        new Set(
          obj.wordsSpoken
            .filter((w): w is string => typeof w === 'string' && /^[a-z']+$/i.test(w.trim()))
            .map((w) => w.trim().toLowerCase()),
        ),
      ).slice(0, MAX_ENGLISH_WORDS)
    : [];
  const totalTurns = Math.max(0, Math.floor(Number(obj.totalTurns) || 0));
  return { completedScenes, wordsSpoken, totalTurns };
}

export function loadEnglishProgress(): EnglishProgress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    return normalizeEnglishProgress(raw ? JSON.parse(raw) : null);
  } catch {
    return emptyEnglishProgress();
  }
}

export function saveEnglishProgress(progress: EnglishProgress): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(normalizeEnglishProgress(progress)));
  } catch {
    // ignore
  }
}

export function recordEnglishTurn(text: string): EnglishProgress {
  const current = loadEnglishProgress();
  const newlySpoken = extractEnglishWords(text);
  const merged = Array.from(new Set([...newlySpoken, ...current.wordsSpoken])).slice(0, MAX_ENGLISH_WORDS);
  const next: EnglishProgress = {
    ...current,
    wordsSpoken: merged,
    totalTurns: current.totalTurns + 1,
  };
  saveEnglishProgress(next);
  return next;
}

export function recordEnglishSceneWin(sceneId: string, stars = 3): EnglishProgress {
  const current = loadEnglishProgress();
  const prevStars = current.completedScenes[sceneId]?.stars ?? 0;
  const next: EnglishProgress = {
    ...current,
    completedScenes: {
      ...current.completedScenes,
      [sceneId]: {
        stars: Math.max(prevStars, Math.max(1, Math.min(3, Math.floor(stars)))),
        completedAt: Date.now(),
      },
    },
  };
  saveEnglishProgress(next);
  return next;
}

// ============ Roleplay Prompt 与双语绘本 ============

export function buildEnglishRoleplayPrompt(input: {
  scene: EnglishScene;
  mission?: EnglishMission;
  kidName?: string;
  band: AgeBand;
  realtimeMode?: boolean;
}): string {
  const ageText = input.band === 'preschool' ? '3到6岁' : '5到10岁';
  const lines = [
    `【英语情景陪练模式】你现在扮演「${input.scene.roleName}」，在「${input.scene.englishTitle}（${input.scene.title}）」场景里陪一位 ${ageText} 的中国小朋友${input.kidName ? `（${input.kidName}）` : ''}练习英语口语。`,
    `场景背景：${input.scene.setting}`,
    input.mission
      ? `当前小任务：${input.mission.labelZh}（参考句：${input.mission.hintEn}）。`
      : '全部小任务已完成，请用热情的英语夸奖小朋友并欢快道别！',
    '说话原则：',
    '1. 每次只用 1 到 2 句简单、清晰、地道的小学英语回复，鼓励小朋友继续开口。',
    '2. 如果小朋友用中文提问或卡壳（例如问“怎么说”），先温柔夸奖，再给出一句简短好读的英文示范请他跟着说一遍。',
    '3. 不纠结语法小错误，只要表达出意思就大力鼓励（例如 "Great job!" / "Awesome!"）。',
  ];
  if (input.realtimeMode) {
    lines.push('4. 正在实时语音通话：回复直接用英语说出来，语气活泼亲切；不要使用表情符号、列表或括号里的中文/动作描写。');
  } else {
    lines.push('4. 文本气泡模式：英语回复后面可以换行附一句简短的中文小括号提示，帮助孩子理解。');
  }
  return lines.join('\n');
}

export function buildBilingualBookPrompt(
  title: string,
  pages: Array<{ pageNumber: number; storyText: string }>,
): { system: string; user: string } {
  const items = pages.map((p) => `第${p.pageNumber}页：${p.storyText}`).join('\n');
  return {
    system: [
      '你是儿童双语绘本翻译师，负责把温暖的中文儿童绘本翻译成适合 5 到 10 岁孩子阅读和朗读的简单英语。',
      '要求：用词生动浅显、句子简短朗朗上口，保留童真语气。',
      '请严格只返回 JSON 对象（不要加多余说明）：',
      '{"englishTitle":"英文书名","pages":[{"pageNumber":1,"englishText":"第1页英文"}]}',
    ].join('\n'),
    user: `中文书名：《${title}》\n${items}`,
  };
}

export function parseBilingualBookResponse(
  raw: string,
  pages: Array<{ pageNumber: number; storyText: string }>,
): { englishTitle?: string; pageTexts: Record<number, string> } {
  const cleaned = (raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
  const candidates = [cleaned];
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first >= 0 && last > first) {
    candidates.push(cleaned.slice(first, last + 1));
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as { englishTitle?: unknown; pages?: unknown };
      if (parsed && typeof parsed === 'object') {
        const pageTexts: Record<number, string> = {};
        if (Array.isArray(parsed.pages)) {
          parsed.pages.forEach((item, idx) => {
            if (!item || typeof item !== 'object') return;
            const rec = item as Record<string, unknown>;
            const num = Number(rec.pageNumber) || pages[idx]?.pageNumber || idx + 1;
            const en = typeof rec.englishText === 'string' ? rec.englishText.trim() : '';
            if (en) pageTexts[num] = en;
          });
        }
        const englishTitle = typeof parsed.englishTitle === 'string' ? parsed.englishTitle.trim() : undefined;
        return { englishTitle, pageTexts };
      }
    } catch {
      // try next
    }
  }
  return { pageTexts: {} };
}
