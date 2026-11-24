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

const book = await importTsModule(new URL('./kidBilingualBook.ts', import.meta.url));

// ---- 翻译提示词 ----
{
  const { system, user } = book.buildBilingualBookPrompt('月球面包店', [
    { pageNumber: 1, storyText: '波波在月球烤星星面包。' },
    { pageNumber: 2, storyText: '香味飘到了地球。' },
  ]);
  assert.match(system, /双语绘本翻译师/);
  assert.match(system, /englishTitle/, '提示词里要带返回格式样例');
  assert.match(user, /《月球面包店》/);
  assert.match(user, /第1页：波波在月球烤星星面包。/);
  assert.match(user, /第2页：香味飘到了地球。/);
}

// ---- 解析：带 ```json 包裹 ----
{
  const parsed = book.parseBilingualBookResponse(
    '```json\n{"englishTitle":"Moon Bakery","pages":[{"pageNumber":1,"englishText":"Bobo bakes star bread on the moon."}]}\n```',
    [{ pageNumber: 1, storyText: '波波在月球烤星星面包。' }],
  );
  assert.equal(parsed.englishTitle, 'Moon Bakery');
  assert.equal(parsed.pageTexts[1], 'Bobo bakes star bread on the moon.');
}

// ---- 解析：前后有废话，只有中间是 JSON ----
{
  const parsed = book.parseBilingualBookResponse(
    '好的，这是翻译结果：{"pages":[{"pageNumber":2,"englishText":"The smell drifted to Earth."}]} 希望孩子喜欢！',
    [{ pageNumber: 2, storyText: '香味飘到了地球。' }],
  );
  assert.equal(parsed.pageTexts[2], 'The smell drifted to Earth.');
  assert.equal(parsed.englishTitle, undefined, '没给书名就不该编一个');
}

// ---- 解析：坏数据不抛错 ----
{
  assert.deepEqual(book.parseBilingualBookResponse('bad', []).pageTexts, {});
  assert.deepEqual(book.parseBilingualBookResponse('', []).pageTexts, {});
  // 页码缺失时回落到原页序号
  const parsed = book.parseBilingualBookResponse(
    '{"pages":[{"englishText":"Hello moon."}]}',
    [{ pageNumber: 3, storyText: '你好，月亮。' }],
  );
  assert.equal(parsed.pageTexts[3], 'Hello moon.');
  // 空英文文本不占位
  assert.deepEqual(book.parseBilingualBookResponse('{"pages":[{"pageNumber":1,"englishText":"   "}]}', []).pageTexts, {});
}

console.log('kidBilingualBook.test.mjs: ok');
