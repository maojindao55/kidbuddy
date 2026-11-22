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

const source = await readFile(new URL('./Markdown.tsx', import.meta.url), 'utf8');
const { toKidFriendlyMarkdown } = await importTsModule(new URL('../utils/markdownContent.ts', import.meta.url));
const { parseKidMarkdown, parseKidInline } = await importTsModule(new URL('../utils/kidMarkdown.ts', import.meta.url));

// 组件源码安全与去重库约束
assert.match(source, /toKidFriendlyMarkdown\(content\)/, 'content is cleaned before rendering');
assert.match(source, /parseKidMarkdown\(/, 'uses pure lightweight parser');
assert.doesNotMatch(source, /from ['"]antd['"]|from ['"]@lobehub\/ui['"]/, 'must not bundle heavy admin UI libraries');
assert.doesNotMatch(source, /dangerouslySetInnerHTML/, 'raw HTML injection is forbidden');
assert.doesNotMatch(source, /convertFileSrc|save_image_as|basePath/, 'local file access is gone');

// 解析器行为测试
{
  const blocks = parseKidMarkdown(
    toKidFriendlyMarkdown('# 科学小问题\n\n> 提示一下\n\n- 苹果 **真甜**\n- *香蕉*\n\n1. 先观察\n2. 再实验\n\n![猫](https://img.example.com/cat.png)\n\n```mermaid\ngraph TD; A-->B\n```\n<script>bad()</script>'),
  );
  assert.equal(blocks[0].type, 'heading');
  assert.equal(blocks[0].text, '科学小问题');
  assert.equal(blocks[1].type, 'quote');
  assert.equal(blocks[1].text, '提示一下');
  assert.equal(blocks[2].type, 'ul');
  assert.deepEqual(blocks[2].items, ['苹果 **真甜**', '*香蕉*']);
  assert.equal(blocks[3].type, 'ol');
  assert.deepEqual(blocks[3].items, ['先观察', '再实验']);
  assert.equal(blocks[4].type, 'image');
  assert.equal(blocks[4].url, 'https://img.example.com/cat.png');
  assert.equal(blocks.at(-1).type, 'paragraph');
  assert.equal(blocks.at(-1).text, 'bad()');

  const inline = parseKidInline('你好 **小明** 和 *小花* ![图](https://a.example/b.png)');
  assert.deepEqual(inline, [
    { type: 'text', text: '你好 ' },
    { type: 'bold', text: '小明' },
    { type: 'text', text: ' 和 ' },
    { type: 'italic', text: '小花' },
    { type: 'text', text: ' ' },
    { type: 'image', alt: '图', url: 'https://a.example/b.png' },
  ]);
}

console.log('Markdown.test.mjs: ok');
