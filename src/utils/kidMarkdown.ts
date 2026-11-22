/**
 * 轻量级零依赖儿童聊天气泡 Markdown 解析器（仅解析标题、列表、引用、粗体、斜体和已放行的图片）。
 * 不依赖 antd / @lobehub/ui / mermaid / shiki / katex，保证体积小且无危险 HTML 注入。
 */

export type KidInlineNode =
  | { type: 'text'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'italic'; text: string }
  | { type: 'image'; alt: string; url: string };

export type KidMarkdownBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'quote'; text: string }
  | { type: 'image'; alt: string; url: string };

const SAFE_IMAGE_URL_RE = /^(?:https?:\/\/|data:image\/)/i;
const STANDALONE_IMAGE_RE = /^\s*!\[([^\]]*)\]\(\s*(<[^>]+>|[^)\s]+)(?:\s+"[^"]*")?\s*\)\s*$/;
const INLINE_TOKEN_RE =
  /!\[([^\]]*)\]\(\s*(<[^>]+>|[^)\s]+)(?:\s+"[^"]*")?\s*\)|\*\*([^*\n]+)\*\*|\*([^*\s][^*\n]*?)\*/g;

export function isSafeKidImageUrl(url: string): boolean {
  return SAFE_IMAGE_URL_RE.test((url || '').trim());
}

export function parseKidInline(text: string): KidInlineNode[] {
  if (!text) return [];
  const nodes: KidInlineNode[] = [];
  let cursor = 0;
  INLINE_TOKEN_RE.lastIndex = 0;

  for (let match = INLINE_TOKEN_RE.exec(text); match; match = INLINE_TOKEN_RE.exec(text)) {
    if (match.index > cursor) {
      nodes.push({ type: 'text', text: text.slice(cursor, match.index) });
    }
    if (match[2] !== undefined) {
      const url = match[2].replace(/^<|>$/g, '').trim();
      const alt = (match[1] || '').trim();
      if (isSafeKidImageUrl(url)) {
        nodes.push({ type: 'image', alt, url });
      } else if (alt) {
        nodes.push({ type: 'text', text: alt });
      }
    } else if (match[3] !== undefined) {
      nodes.push({ type: 'bold', text: match[3] });
    } else if (match[4] !== undefined) {
      nodes.push({ type: 'italic', text: match[4] });
    }
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) {
    nodes.push({ type: 'text', text: text.slice(cursor) });
  }
  return nodes;
}

export function parseKidMarkdown(cleanedText: string): KidMarkdownBlock[] {
  const input = (cleanedText || '').replace(/\r\n?/g, '\n').trim();
  if (!input) return [];

  const blocks: KidMarkdownBlock[] = [];
  const lines = input.split('\n');
  let paragraphLines: string[] = [];
  let quoteLines: string[] = [];
  let ulItems: string[] = [];
  let olItems: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    blocks.push({ type: 'paragraph', text: paragraphLines.join('\n') });
    paragraphLines = [];
  };
  const flushQuote = () => {
    if (quoteLines.length === 0) return;
    blocks.push({ type: 'quote', text: quoteLines.join('\n') });
    quoteLines = [];
  };
  const flushUl = () => {
    if (ulItems.length === 0) return;
    blocks.push({ type: 'ul', items: ulItems });
    ulItems = [];
  };
  const flushOl = () => {
    if (olItems.length === 0) return;
    blocks.push({ type: 'ol', items: olItems });
    olItems = [];
  };
  const flushAll = () => {
    flushParagraph();
    flushQuote();
    flushUl();
    flushOl();
  };

  for (const line of lines) {
    if (!line.trim()) {
      flushAll();
      continue;
    }

    const standaloneImg = line.match(STANDALONE_IMAGE_RE);
    if (standaloneImg) {
      const url = standaloneImg[2].replace(/^<|>$/g, '').trim();
      const alt = (standaloneImg[1] || '').trim();
      flushAll();
      if (isSafeKidImageUrl(url)) {
        blocks.push({ type: 'image', alt, url });
      } else if (alt) {
        blocks.push({ type: 'paragraph', text: alt });
      }
      continue;
    }

    const heading = line.match(/^\s*(#{1,3})\s+(.+)$/);
    if (heading) {
      flushAll();
      blocks.push({
        type: 'heading',
        level: heading[1].length as 1 | 2 | 3,
        text: heading[2].trim(),
      });
      continue;
    }

    const quote = line.match(/^\s*>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      flushUl();
      flushOl();
      quoteLines.push(quote[1]);
      continue;
    }

    const ul = line.match(/^\s*[-*•]\s+(.+)$/);
    if (ul) {
      flushParagraph();
      flushQuote();
      flushOl();
      ulItems.push(ul[1]);
      continue;
    }

    const ol = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ol) {
      flushParagraph();
      flushQuote();
      flushUl();
      olItems.push(ol[1]);
      continue;
    }

    flushQuote();
    flushUl();
    flushOl();
    paragraphLines.push(line);
  }

  flushAll();
  return blocks;
}
