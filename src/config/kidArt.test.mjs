import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function importTsModule(url) {
  const source = await readFile(url, 'utf8');
  const compiled = ts.transpileModule(`${source}\n// cache-bust:${Date.now()}:${Math.random()}`, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  });
  return import(`data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`);
}

const art = await importTsModule(new URL('./kidArt.ts', import.meta.url));

// ---- 画风与主题预设 ----
{
  assert.equal(art.KID_ART_STYLES.length, 4);
  assert.equal(art.getArtStyle('clay').id, 'clay');
  assert.equal(art.getArtStyle('unknown').id, art.DEFAULT_ART_STYLE);
  assert.ok(art.DRAW_INSPIRATIONS.length >= 6);
  assert.ok(art.STORYBOOK_THEMES.length >= 6);
  assert.equal(art.STORYBOOK_TOTAL_PAGES, 4);
}

// ---- 儿童安全生图约束 ----
{
  const t2i = art.buildSafeImagePrompt({ subject: '月球上的小恐龙', style: 'watercolor' });
  assert.match(t2i, /5到10岁儿童/);
  assert.match(t2i, /绘本水彩/);
  assert.match(t2i, /月球上的小恐龙/);

  const sketch = art.buildSafeImagePrompt({ subject: '森林小猫', style: 'crayon', isSketch: true });
  assert.match(sketch, /原涂鸦/);
  assert.match(sketch, /温暖蜡笔/);

  const cont = art.buildSafeImagePrompt({
    subject: '烤面包',
    style: 'clay',
    isContinuation: true,
    heroDesc: '戴蓝色围裙的黄白小柴犬',
  });
  assert.match(cont, /保持参考图里主角/);
  assert.match(cont, /戴蓝色围裙的黄白小柴犬/);
}

// ---- 结构化 JSON 解析与降级 ----
{
  const coverRaw = '```json\n{"title":"月球面包香","heroDesc":"戴蓝色小帽的小柴犬","coverImagePrompt":"小柴犬在月球烤箱旁微笑","firstQuestion":"面包店开张啦，谁第一个来买面包？","choices":["小兔子来了","外星小飞船降落","月亮婆婆敲门"]}\n```';
  const cover = art.parseCoverPlanResponse(coverRaw, { idea: '月球面包店', heroName: '波波' });
  assert.equal(cover.title, '月球面包香');
  assert.equal(cover.heroDesc, '戴蓝色小帽的小柴犬');
  assert.equal(cover.choices.length, 3);

  const fallbackCover = art.parseCoverPlanResponse('not json at all', { idea: '海底冒险', heroName: '泡泡' });
  assert.equal(fallbackCover.title, '泡泡的冒险');
  assert.ok(fallbackCover.choices.length >= 3);

  const pageRaw = '{"storyText":"波波拿出星星面粉，烤出了香喷喷的面包。","imagePrompt":"小柴犬捧着发光的牛角包","nextPrompt":"谁闻到香味跑来了？","choices":["太空小兔","星星小鸟","小熊宇航员"]}';
  const page = art.parseStoryPageResponse(pageRaw, '兜底文本');
  assert.equal(page.storyText, '波波拿出星星面粉，烤出了香喷喷的面包。');
  assert.equal(page.choices.length, 3);

  const brokenPage = art.parseStoryPageResponse('{broken json', '小柴犬出发了');
  assert.equal(brokenPage.storyText, '小柴犬出发了');
  assert.ok(brokenPage.choices.length >= 3);

  const parsedPages = art.parseBookPages(
    JSON.stringify([
      { pageNumber: 1, storyText: '第一页', imagePrompt: '图', imagePath: '/a.png', videoPath: '/a.mp4' },
      { pageNumber: 2, storyText: '第二页', imagePrompt: '图2', imagePath: '/b.png' },
    ]),
  );
  assert.equal(parsedPages.length, 2);
  assert.equal(parsedPages[0].videoPath, '/a.mp4');
  assert.equal(parsedPages[1].videoPath, undefined);
  assert.deepEqual(art.parseBookPages('{bad'), []);

  const counts = art.countAnimatedSlides({
    id: 'b1',
    title: '月球面包店',
    author: '乐乐',
    style: 'watercolor',
    heroName: '波波',
    heroDesc: '小柴犬',
    coverPath: '/c.png',
    coverVideoPath: '/c.mp4',
    pagesJson: JSON.stringify(parsedPages),
    status: 'completed',
    createdAt: 1,
    updatedAt: 2,
  });
  assert.deepEqual(counts, { animated: 2, total: 3 });

  const coverMotion = art.buildStorybookSlideAnimatePrompt({
    bookTitle: '月球面包店',
    heroDesc: '小柴犬',
    isCover: true,
  });
  assert.match(coverMotion, /封面动画/);
  const pageMotion = art.buildStorybookSlideAnimatePrompt({
    bookTitle: '月球面包店',
    isCover: false,
    storyText: '波波端出牛角包',
  });
  assert.match(pageMotion, /波波端出牛角包/);

  const vidPrompt = art.buildVideoAnimatePrompt('戴草帽的小恐龙', '在月球吃西瓜');
  assert.match(vidPrompt, /儿童绘本柔和动画/);
  assert.match(vidPrompt, /在月球吃西瓜/);
}

console.log('kidArt.test.mjs: ok');
