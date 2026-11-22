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

function installLocalStorage() {
  const store = new Map();
  globalThis.localStorage = {
    get length() { return store.size; },
    key: (i) => Array.from(store.keys())[i] ?? null,
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
  return store;
}

const store = installLocalStorage();
const en = await importTsModule(new URL('./kidEnglish.ts', import.meta.url));

// ---- 6 大情景与任务结构 ----
{
  assert.equal(en.ENGLISH_SCENES.length, 6);
  for (const scene of en.ENGLISH_SCENES) {
    assert.ok(scene.id && scene.title && scene.englishTitle && scene.openingEn);
    assert.equal(scene.missions.length, 3, `${scene.id} has 3 progressive missions`);
    for (const m of scene.missions) {
      assert.ok(m.hintEn && m.hintZh && m.keywords.length >= 3);
    }
  }
  assert.equal(en.getEnglishScene('ice_cream')?.title, '买冰淇淋');
  assert.equal(en.getEnglishScene('unknown'), undefined);
}

// ---- 英语词袋提取与任务判定 ----
{
  assert.deepEqual(en.extractEnglishWords('Hello! One ice cream, please!'), ['hello', 'one', 'ice', 'cream', 'please']);
  assert.deepEqual(en.extractEnglishWords('I like a cute panda!'), ['i', 'like', 'cute', 'panda']);
  assert.deepEqual(en.extractEnglishWords('这个用英文怎么说？'), []);

  const mission = en.ENGLISH_SCENES[0].missions[0];
  assert.equal(en.matchMissionAttempt('Hello!', mission), true, 'keyword hit advances mission');
  assert.equal(en.matchMissionAttempt('Ice cream please', mission), true, 'phrase keyword hit advances mission');
  assert.equal(en.matchMissionAttempt('Good morning', mission), true, '2+ English words encourages progress');
  assert.equal(en.matchMissionAttempt('怎么说冰淇淋呀？', mission), false, 'pure Chinese question does not complete mission');
}

// ---- 进度持久化与词袋去重 ----
{
  store.clear();
  assert.deepEqual(en.loadEnglishProgress(), en.emptyEnglishProgress());
  const p1 = en.recordEnglishTurn('Hello! One strawberry ice cream, please!');
  assert.equal(p1.totalTurns, 1);
  assert.ok(p1.wordsSpoken.includes('strawberry'));

  const p2 = en.recordEnglishSceneWin('ice_cream', 3);
  assert.equal(p2.completedScenes.ice_cream.stars, 3);
  assert.equal(en.loadEnglishProgress().completedScenes.ice_cream.stars, 3);

  store.set('kid_english_progress', '{broken');
  assert.deepEqual(en.loadEnglishProgress(), en.emptyEnglishProgress());
}

// ---- Roleplay 与双语绘本 Prompt/解析 ----
{
  const scene = en.ENGLISH_SCENES[0];
  const promptRealtime = en.buildEnglishRoleplayPrompt({
    scene,
    mission: scene.missions[0],
    kidName: '乐乐',
    band: 'school',
    realtimeMode: true,
  });
  assert.match(promptRealtime, /Ice Cream Shop/);
  assert.match(promptRealtime, /乐乐/);
  assert.match(promptRealtime, /实时语音通话/);

  const parsed = en.parseBilingualBookResponse(
    '```json\n{"englishTitle":"Moon Bakery","pages":[{"pageNumber":1,"englishText":"Bobo bakes star bread on the moon."}]}\n```',
    [{ pageNumber: 1, storyText: '波波在月球烤星星面包。' }],
  );
  assert.equal(parsed.englishTitle, 'Moon Bakery');
  assert.equal(parsed.pageTexts[1], 'Bobo bakes star bread on the moon.');
  assert.deepEqual(en.parseBilingualBookResponse('bad', []).pageTexts, {});
}

console.log('kidEnglish.test.mjs: ok');
