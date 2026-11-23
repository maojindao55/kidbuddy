/**
 * 双语绘本 · 翻译提示词与解析
 *
 * 从原来和「英语岛」混在一起的 kidEnglish.ts 里拆出来的：
 * 英语岛模块已移除，但绘本屋的双语对照还要用这两个函数。
 */

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
