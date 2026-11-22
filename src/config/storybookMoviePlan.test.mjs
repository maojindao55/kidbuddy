import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function importTsModule(url) {
  const source = await readFile(url, 'utf8');
  const compiled = ts.transpileModule(`${source}\n// cache-bust:${Date.now()}:${Math.random()}`, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`);
}

const plan = await importTsModule(new URL('./storybookMoviePlan.ts', import.meta.url));

// ---- Ken Burns 插值 ----
{
  const preset = plan.KEN_BURNS_PRESETS[0];
  const at0 = plan.interpolateKenBurns(preset, -1);
  assert.equal(at0.scale, preset.startScale);
  assert.equal(at0.offsetX, preset.startX);

  const at1 = plan.interpolateKenBurns(preset, 2);
  assert.equal(at1.scale, preset.endScale);
  assert.equal(at1.offsetY, preset.endY);

  const mid = plan.interpolateKenBurns(preset, 0.5);
  assert.ok(mid.scale > preset.startScale && mid.scale < preset.endScale);
}

// ---- 时长估算与 MIME 选择 ----
{
  assert.equal(plan.estimateNarrationDurationMs(''), 4200);
  const longMs = plan.estimateNarrationDurationMs('从前有一只小恐龙，喜欢在夜空下数星星并烤美味的曲奇饼干。'.repeat(4));
  assert.equal(longMs, 12000);

  assert.deepEqual(
    plan.pickSupportedVideoMime((m) => m === 'video/mp4'),
    { mimeType: 'video/mp4', ext: 'mp4' },
  );
  assert.deepEqual(
    plan.pickSupportedVideoMime((m) => m === 'video/webm;codecs=vp9,opus'),
    { mimeType: 'video/webm;codecs=vp9,opus', ext: 'webm' },
  );
  assert.deepEqual(
    plan.pickSupportedVideoMime(() => false),
    { mimeType: '', ext: 'webm' },
  );
}

// ---- 绘本影院/导出分镜构建 ----
{
  const book = {
    id: 'book-1',
    title: '月球面包店',
    author: '乐乐',
    style: 'watercolor',
    heroName: '波波',
    heroDesc: '小柴犬',
    coverPath: '/c.png',
    coverVideoPath: '/c.mp4',
    pagesJson: JSON.stringify([
      {
        pageNumber: 1,
        storyText: '波波烤出了发光的面包。',
        imagePrompt: 'bake',
        imagePath: '/p1.png',
        bilingualText: 'Bobo baked glowing bread.',
        videoPath: '/p1.mp4',
      },
      {
        pageNumber: 2,
        storyText: '小兔子闻香跑来。',
        imagePrompt: 'rabbit',
        imagePath: '/p2.png',
      },
    ]),
    status: 'completed',
    createdAt: 1,
    updatedAt: 2,
  };

  const zhSlides = plan.buildStorybookMovieSlides(book, 'zh');
  assert.equal(zhSlides.length, 3);
  assert.equal(zhSlides[0].isCover, true);
  assert.equal(zhSlides[0].videoPath, '/c.mp4');
  assert.equal(zhSlides[1].videoPath, '/p1.mp4');
  assert.equal(zhSlides[2].videoPath, undefined);
  assert.equal(zhSlides[1].primarySubtitle, '波波烤出了发光的面包。');
  assert.equal(zhSlides[1].secondarySubtitle, undefined);
  assert.deepEqual(zhSlides[1].narrationSegments, [{ text: '波波烤出了发光的面包。', lang: 'zh-CN' }]);

  const biSlides = plan.buildStorybookMovieSlides(book, 'bilingual');
  assert.equal(biSlides[1].primarySubtitle, '波波烤出了发光的面包。');
  assert.equal(biSlides[1].secondarySubtitle, 'Bobo baked glowing bread.');
  assert.deepEqual(biSlides[1].narrationSegments, [
    { text: 'Bobo baked glowing bread.', lang: 'en-US' },
    { text: '波波烤出了发光的面包。', lang: 'zh-CN' },
  ]);

  const enSlides = plan.buildStorybookMovieSlides(book, 'en');
  assert.equal(enSlides[1].primarySubtitle, 'Bobo baked glowing bread.');
  assert.deepEqual(enSlides[1].narrationSegments, [{ text: 'Bobo baked glowing bread.', lang: 'en-US' }]);
  // 第 2 页无英文翻译时降级为中文
  assert.equal(enSlides[2].primarySubtitle, '小兔子闻香跑来。');
}

console.log('storybookMoviePlan.test.mjs: ok');
