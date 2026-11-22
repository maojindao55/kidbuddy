/**
 * 儿童魔法画室 & 绘本共创工坊的核心配置、安全画面约束、Prompt 构造与响应解析。
 *
 * 本模块保持零外部运行时依赖，便于 node 直接 transpile 单测。
 */
import type { AgeBand } from './ageProfile';

export type ArtStyleId = 'watercolor' | 'crayon' | 'clay' | 'anime';

export interface KidArtStyle {
  id: ArtStyleId;
  label: string;
  emoji: string;
  accent: string;
  bg: string;
  prompt: string;
}

export const DEFAULT_ART_STYLE: ArtStyleId = 'watercolor';

export const KID_ART_STYLES: KidArtStyle[] = [
  {
    id: 'watercolor',
    label: '绘本水彩',
    emoji: '🎨',
    accent: '#EC4899',
    bg: '#FDF2F8',
    prompt: "children's picture book watercolor illustration, soft pastel brushstrokes, warm sunlight, gentle dreamy atmosphere",
  },
  {
    id: 'crayon',
    label: '温暖蜡笔',
    emoji: '🖍️',
    accent: '#F59E0B',
    bg: '#FFFBEB',
    prompt: "warm children's crayon and oil pastel drawing on textured paper, charming hand-drawn lines, cheerful bright colors",
  },
  {
    id: 'clay',
    label: '软萌黏土',
    emoji: '🧸',
    accent: '#10B981',
    bg: '#ECFDF5',
    prompt: 'cute 3D soft claymation storybook style, rounded handcrafted figures, cozy miniature world, soft studio lighting',
  },
  {
    id: 'anime',
    label: '治愈动画',
    emoji: '✨',
    accent: '#3B82F6',
    bg: '#EFF6FF',
    prompt: 'warm healing hand-painted animated film illustration, expressive friendly characters, lush scenery, golden hour glow',
  },
];

export function getArtStyle(id: string | undefined): KidArtStyle {
  return KID_ART_STYLES.find((s) => s.id === id) || KID_ART_STYLES[0];
}

export const DRAW_INSPIRATIONS: string[] = [
  '戴草帽在月球上吃西瓜的小恐龙',
  '背着彩虹书包去上学的小柴犬',
  '开着泡泡潜艇探险的海底小猫',
  '会发光的森林蘑菇小树屋',
  '在云朵上烤草莓蛋糕的小熊厨师',
  '载着小老鼠起飞的五彩纸飞机',
  '住在茶杯里的小刺猬一家',
  '星星照亮的城堡音乐会',
];

export interface StorybookThemePreset {
  emoji: string;
  title: string;
  heroName: string;
  idea: string;
}

export const STORYBOOK_THEMES: StorybookThemePreset[] = [
  {
    emoji: '🥐',
    title: '月球面包店',
    heroName: '小柴犬波波',
    idea: '去月球开面包店的小柴犬，用星星面粉烤出会发光的牛角包',
  },
  {
    emoji: '✨',
    title: '怕黑的小萤火虫',
    heroName: '闪闪',
    idea: '有点怕黑的小萤火虫闪闪，在森林夜游里发现自己最亮的光芒',
  },
  {
    emoji: '☂️',
    title: '会飞的彩虹雨伞',
    heroName: '七彩伞',
    idea: '一把会说话的彩虹雨伞，带着小朋友飞到云朵上的游乐场',
  },
  {
    emoji: '🦕',
    title: '爱画画的小恐龙',
    heroName: '点点龙',
    idea: '力气很大却最爱用尾巴画画的小恐龙，想为森林朋友们办一场画展',
  },
  {
    emoji: '🐳',
    title: '海底音乐会',
    heroName: '泡泡鲸',
    idea: '喜欢吹彩色泡泡奏乐的小蓝鲸，邀请海底小伙伴合唱一首歌',
  },
  {
    emoji: '🤖',
    title: '送星星回家',
    heroName: '小机器人嘟嘟',
    idea: '善良的发条小机器人，帮迷路的小星星沿着银河找回家的路',
  },
];

export const STORYBOOK_TOTAL_PAGES = 4;

export interface KidArtworkRecord {
  id: string;
  title: string;
  prompt: string;
  style: ArtStyleId | string;
  mode: 'text' | 'sketch';
  imagePath: string;
  sketchPath?: string | null;
  videoPath?: string | null;
  createdAt: number;
}

export function buildVideoAnimatePrompt(title: string, prompt: string): string {
  const safeDesc = (prompt || title || '可爱的儿童绘本插画').trim().slice(0, 180);
  return `儿童绘本柔和动画效果：微风轻轻拂过，画面中的主角与景物自然灵动地眨眼、微笑、轻柔摆动，阳光闪烁，画面温馨明亮。画面内容：${safeDesc}`;
}

export interface StorybookPage {
  pageNumber: number;
  storyText: string;
  imagePrompt: string;
  imagePath: string;
  bilingualText?: string;
  videoPath?: string;
}

export interface KidStorybookRecord {
  id: string;
  title: string;
  author: string;
  style: ArtStyleId | string;
  heroName: string;
  heroDesc: string;
  coverPath: string;
  coverVideoPath?: string | null;
  pagesJson: string;
  status: 'draft' | 'completed';
  createdAt: number;
  updatedAt: number;
}

export function countAnimatedSlides(book: KidStorybookRecord): { animated: number; total: number } {
  const pages = parseBookPages(book.pagesJson);
  const total = 1 + pages.length;
  const animated =
    (book.coverVideoPath?.trim() ? 1 : 0) + pages.filter((p) => Boolean(p.videoPath?.trim())).length;
  return { animated, total };
}

export function buildStorybookSlideAnimatePrompt(input: {
  bookTitle: string;
  heroDesc?: string;
  isCover: boolean;
  storyText?: string;
  imagePrompt?: string;
}): string {
  const roleHint = input.heroDesc?.trim() ? `（主角：${input.heroDesc.trim()}）` : '';
  const scene = input.isCover
    ? `儿童绘本《${input.bookTitle}》封面动画${roleHint}：主角开心地眨眼微笑、挥手或轻柔呼吸，背景光影温暖闪烁，镜头微微推进。`
    : `儿童绘本《${input.bookTitle}》内页动画${roleHint}：画面角色与自然景物呈现轻柔流畅的微动作、微风拂动与表情变化，氛围温暖童趣。情节：${(input.storyText || input.imagePrompt || '').trim()}`;
  return scene.slice(0, 260);
}

export interface StoryCoverPlan {
  title: string;
  heroDesc: string;
  coverImagePrompt: string;
  firstQuestion: string;
  choices: string[];
}

export interface StoryPagePlan {
  storyText: string;
  imagePrompt: string;
  nextPrompt: string;
  choices: string[];
}

export interface SafeImagePromptInput {
  subject: string;
  style?: string;
  isSketch?: boolean;
  isContinuation?: boolean;
  heroDesc?: string;
}

/**
 * 统一前置儿童安全与适龄画风约束，供魔法画室与绘本工坊共用。
 */
export function buildSafeImagePrompt(input: SafeImagePromptInput): string {
  const artStyle = getArtStyle(input.style);
  const parts = [
    '为5到10岁儿童创作的绘本插画，画面明亮温暖、可爱童趣、构图清晰友好，绝对不含任何恐怖、暴力、黑暗压抑元素，也不要出现多余乱码文字。',
    `画风：${artStyle.label}（${artStyle.prompt}）。`,
  ];
  if (input.isSketch) {
    parts.push('请严格参考原涂鸦的构图轮廓与主体形状，保留孩子的创意布局，将其转化成精细温暖的儿童绘本成品插画。');
  }
  if (input.isContinuation) {
    const hero = input.heroDesc?.trim();
    parts.push(
      hero
        ? `请严格保持参考图里主角的外观、毛色、发型和服饰特征一致（主角设定：${hero}），只改变动作和背景场景。`
        : '请严格保持参考图里主角的外貌特征与画风一致，融入新的剧情画面中。',
    );
  }
  parts.push(`画面内容：${(input.subject || '').trim()}`);
  return parts.join('\n');
}

export function buildDrawingEnhancePrompt(idea: string, style: ArtStyleId, isSketch = false): { system: string; user: string } {
  const artStyle = getArtStyle(style);
  return {
    system: [
      '你是温柔又有想象力的「画画兔」，正在帮 5 到 10 岁小朋友把脑海里的画面润色成适合生图模型绘制的中文画面描述。',
      '要求：画面必须安全、正向、明亮、充满童趣；只输出 1 到 2 句具体的中文画面描写（包含主角外观、动作、环境、色彩），不超过 110 个字；不要输出任何标题、解释或 Markdown 符号。',
    ].join('\n'),
    user: isSketch
      ? `小朋友画了一幅草图，并说想把它变成：「${idea}」。请结合「${artStyle.label}」画风，写出一段具体可爱的画面升级描述。`
      : `小朋友想画：「${idea}」。请结合「${artStyle.label}」画风，补充温暖生动的画面细节。`,
  };
}

export function buildCoverPlanPrompt(input: {
  idea: string;
  heroName: string;
  style: ArtStyleId;
  band: AgeBand;
}): { system: string; user: string } {
  const artStyle = getArtStyle(input.style);
  const ageLabel = input.band === 'preschool' ? '3到6岁' : '5到10岁';
  return {
    system: [
      `你是温柔的「故事精灵」，正在和一位${ageLabel}的小朋友一起共创一本温暖的 4 页儿童绘本。`,
      '守则：故事绝对正向温暖、安全有趣，不包含恐怖、伤害、恶意或个人信息。',
      '请严格只返回一个 JSON 对象（不要加多余解释），字段如下：',
      '{"title":"书名(12字以内)","heroDesc":"主角固定外貌特征(毛色/衣服/小配饰，40字以内)","coverImagePrompt":"封面插画画面描述(90字以内，不含文字排版要求)","firstQuestion":"故事精灵邀请小朋友开启第1页剧情的一句话提问(45字以内)","choices":["第1页剧情点子A(16字内)","点子B","点子C"]}',
    ].join('\n'),
    user: `主题想法：${input.idea}\n主角名字：${input.heroName || '小主角'}\n画风：${artStyle.label}`,
  };
}

export function buildStoryPagePrompt(input: {
  title: string;
  heroName: string;
  heroDesc: string;
  pageNumber: number;
  totalPages: number;
  priorPages: Array<{ pageNumber: number; storyText: string }>;
  kidIdea: string;
  band: AgeBand;
}): { system: string; user: string } {
  const isLast = input.pageNumber >= input.totalPages;
  const maxStoryChars = input.band === 'preschool' ? 45 : 85;
  const prior = input.priorPages.length
    ? input.priorPages.map((p) => `第${p.pageNumber}页：${p.storyText}`).join('\n')
    : '（这是故事的第 1 页开头）';

  return {
    system: [
      '你是温柔的「故事精灵」，正在陪小朋友共创儿童绘本。',
      '守则：情节温暖安全、充满童真，最后一页要有温馨圆满的收尾。',
      '请严格只返回一个 JSON 对象（不要加多余解释），字段如下：',
      `{"storyText":"本页绘本正文(不超过${maxStoryChars}字，口语自然适合朗读)","imagePrompt":"本页插画画面描述(主角动作+表情+背景，90字以内)","nextPrompt":"${isLast ? '故事完结时夸奖小朋友的温暖结语(40字以内)' : '引导小朋友接着编下一页的提问(45字以内)'}","choices":[${isLast ? '' : '"下一页点子A(16字内)","点子B","点子C"'}]}`,
    ].join('\n'),
    user: [
      `绘本《${input.title}》，主角「${input.heroName}」（外观：${input.heroDesc}）。`,
      `当前正在创作第 ${input.pageNumber} 页（共 ${input.totalPages} 页）。`,
      `前面剧情：\n${prior}`,
      `小朋友对这一页的想法：${input.kidIdea}`,
    ].join('\n'),
  };
}

export function extractJsonObject(raw: string): Record<string, unknown> | null {
  const text = (raw || '').trim();
  if (!text) return null;
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
  const candidates = [cleaned];
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(cleaned.slice(firstBrace, lastBrace + 1));
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}

const DEFAULT_CHOICES = [
  '遇到了一位热心的新朋友',
  '天空中飘来闪闪发光的云',
  '发现了一个藏着秘密的小口袋',
];

function cleanStr(value: unknown, fallback: string, maxLen = 180): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLen) : fallback;
}

function cleanChoices(value: unknown, fallback: string[] = DEFAULT_CHOICES): string[] {
  if (!Array.isArray(value)) return fallback;
  const list = value
    .filter((item): item is string => typeof item === 'string')
    .map((s) => s.trim().slice(0, 24))
    .filter(Boolean)
    .slice(0, 3);
  return list.length > 0 ? list : fallback;
}

export function parseCoverPlanResponse(
  raw: string,
  fallback: { idea: string; heroName: string },
): StoryCoverPlan {
  const obj = extractJsonObject(raw);
  const hero = fallback.heroName.trim() || '小主角';
  const fallbackTitle = `${hero}的冒险`.slice(0, 12);
  const fallbackDesc = `可爱的${hero}，戴着亮色小围巾，眼睛亮晶晶的`;
  if (!obj) {
    return {
      title: fallbackTitle,
      heroDesc: fallbackDesc,
      coverImagePrompt: `${fallbackDesc}，正开心地开始关于「${fallback.idea}」的旅程`,
      firstQuestion: `太棒啦！${hero}已经准备好出发了，故事的第一页会发生什么呢？`,
      choices: DEFAULT_CHOICES,
    };
  }
  return {
    title: cleanStr(obj.title, fallbackTitle, 20),
    heroDesc: cleanStr(obj.heroDesc, fallbackDesc, 80),
    coverImagePrompt: cleanStr(obj.coverImagePrompt, `${fallbackDesc}，${fallback.idea}`, 140),
    firstQuestion: cleanStr(obj.firstQuestion, `故事开头，${hero}正在做什么呢？`, 80),
    choices: cleanChoices(obj.choices),
  };
}

export function parseStoryPageResponse(raw: string, fallbackText: string): StoryPagePlan {
  const safeFallback = (fallbackText || '').trim() || '阳光洒在草地上，小主角迈开了快乐的脚步。';
  const obj = extractJsonObject(raw);
  if (!obj) {
    const plain = (raw || '').replace(/```[\s\S]*?```/g, '').trim();
    const storyText = plain && !plain.startsWith('{') ? plain.slice(0, 120) : safeFallback;
    return {
      storyText,
      imagePrompt: storyText,
      nextPrompt: '接下来又发生了什么好玩的事呢？',
      choices: DEFAULT_CHOICES,
    };
  }
  const storyText = cleanStr(obj.storyText, safeFallback, 150);
  return {
    storyText,
    imagePrompt: cleanStr(obj.imagePrompt, storyText, 150),
    nextPrompt: cleanStr(obj.nextPrompt, '接下来会发生什么有趣的事情呢？', 80),
    choices: cleanChoices(obj.choices),
  };
}

export function parseBookPages(pagesJson: string): StorybookPage[] {
  try {
    const raw = JSON.parse(pagesJson);
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((p): p is StorybookPage => Boolean(p) && typeof p.storyText === 'string' && typeof p.imagePath === 'string')
      .map((p, idx) => ({
        pageNumber: Number(p.pageNumber) || idx + 1,
        storyText: p.storyText,
        imagePrompt: typeof p.imagePrompt === 'string' ? p.imagePrompt : '',
        imagePath: p.imagePath,
        bilingualText: typeof p.bilingualText === 'string' ? p.bilingualText : undefined,
        videoPath: typeof p.videoPath === 'string' && p.videoPath.trim() ? p.videoPath : undefined,
      }));
  } catch {
    return [];
  }
}
