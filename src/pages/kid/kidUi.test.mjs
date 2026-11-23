import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

async function listSources(dirUrl) {
  const out = [];
  for (const entry of await readdir(dirUrl, { withFileTypes: true })) {
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dirUrl);
    if (entry.isDirectory()) out.push(...(await listSources(url)));
    else if (/\.tsx?$/.test(entry.name)) out.push(url);
  }
  return out;
}

// 儿童端是默认首页，家长中心位于 /parent 并且需要先通过家长验证
const routes = await read('../../routes.tsx');
assert.match(routes, /path: '\/',\s*element: <KidLayout \/>/);
assert.match(routes, /index: true, element: <KidHome \/>/);
assert.match(routes, /path: 'draw'/);
assert.match(routes, /path: 'english'/);
assert.match(routes, /path: 'english\/:sceneId'/);
assert.match(routes, /path: 'books'/);
assert.match(routes, /path: 'books\/new'/);
assert.match(routes, /path: 'books\/:bookId'/);
assert.match(routes, /path: '\/parent'/);
assert.match(routes, /<ParentArea \/>/);
assert.doesNotMatch(routes, /path: '',\s*element: <Chat \/>/, 'adult chat is completely removed');

// 旧版成人角色群聊目录已彻底移除
await assert.rejects(access(new URL('../chat/', import.meta.url)), { code: 'ENOENT' }, 'src/pages/chat must be deleted');

const parent = await read('../parent/index.tsx');
assert.match(parent, /isParentAreaUnlocked\(\)/);
assert.match(parent, /<Navigate to="\/" replace \/>/);
assert.doesNotMatch(parent, /from '\.\.\/chat'/, 'parent area no longer reuses old adult chat');

const gate = await read('./components/ParentGate.tsx');
assert.match(gate, /LONG_PRESS_MS = 1500/);
assert.match(gate, /checkChallengeAnswer/);
assert.match(gate, /unlockParentArea\(\)/);
assert.match(gate, /hasParentPin/);
assert.match(gate, /verifyParentPin/);

// 护眼时长遮罩
const layout = await read('./KidLayout.tsx');
assert.match(layout, /TimeLimitOverlay/);
assert.match(layout, /time-limit-overlay/);

// 儿童端不用 antd 的后台组件，只用 Tailwind
const kidFiles = await listSources(new URL('./', import.meta.url));
assert.ok(kidFiles.length >= 8);
for (const url of kidFiles) {
  const source = await readFile(url, 'utf8');
  assert.doesNotMatch(source, /from 'antd'|from '@lobehub\/ui'/, `${url.pathname} should not import admin UI kits`);
}

// 触控区域：交互按钮至少 h-12（48px）
for (const url of kidFiles) {
  const source = await readFile(url, 'utf8');
  for (const match of source.matchAll(/<button\b[^<]*?className=[{]?[`"]([^`"]*)[`"]/g)) {
    const cls = match[1];
    if (/\b(?:h|min-h)-(?:1[2-9]|[2-9]\d)\b/.test(cls) || /relative flex h-14/.test(cls)) continue;
    assert.fail(`${url.pathname}: button without a 48px touch target: ${cls}`);
  }
}

// 聊天走共享的伙伴调度和守则
const chat = await read('./KidChat.tsx');
assert.match(chat, /pickCompanions\(/);
assert.match(chat, /capResponders\(/);
assert.match(chat, /rememberFromMessage\(text\)/);
const companionChat = await read('../../lib/companionChat.ts');
assert.match(companionChat, /request\('\/api\/chat'/);
assert.match(companionChat, /gamePrompt/);

// 游戏判定在本地，伙伴只负责陪玩
const play = await read('./KidGamePlay.tsx');
for (const fn of ['submitGuess', 'submitChainWord', 'acceptCompanionWord', 'submitStoryLine', 'recordGame']) {
  assert.match(play, new RegExp(`${fn}\\(`), `game page uses ${fn}`);
}

// 麦克风只在支持语音识别时出现，且支持空格键按住说话
const input = await read('./components/KidInputBar.tsx');
assert.match(input, /recognizer\.supported &&/);
assert.match(input, /voice\.inputMode === 'voice' && recognizer\.supported/);
assert.match(input, /addEventListener\('keydown'/);
assert.match(input, /Space/);

// 说说小课堂：目标按学段分组显示，但圆圈数字必须是全表台阶（target.difficulty），
// 不能按列表下标重新编号——否则段内会出现「4 比 6 容易」的错觉。
const exprHome = await read('./KidExpression.tsx');
assert.match(exprHome, /stageGroups\(/, '目标列表要按学段分组');
assert.match(exprHome, /expression-step-/, '目标卡要显示台阶编号');
assert.match(exprHome, /\{target\.difficulty\}/, '台阶编号必须直接用 difficulty');
assert.doesNotMatch(exprHome, /step=\{i \+ 1\}/, '不允许按列表下标重新编号');
assert.match(exprHome, /stage-filter-/, '要有学段筛选');
assert.match(exprHome, /kidbuddy\.expression\.stage/, '学段选择要记住');
assert.match(exprHome, /expression-modality-/, '卡片要显示听/说标记');
assert.match(exprHome, /MODALITY_LABEL/, '听/说标记要用统一文案');
const exprPlay = await read('./KidExpressionPlay.tsx');
assert.match(exprPlay, /MODALITY_LABEL/, '练习页也要显示听/说标记');
assert.match(exprPlay, /modality === 'receptive'/, '听者反应类目标要有「看动作不要求开口」的说明');

console.log('kidUi.test.mjs: ok');
