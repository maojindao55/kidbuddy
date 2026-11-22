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
const tokenPlan = await importTsModule(new URL('./tokenPlan.ts', import.meta.url));
const timeLimit = await importTsModule(new URL('./kidTimeLimit.ts', import.meta.url));

// ---- Token Plan 端点派生 ----
{
  const expected = {
    httpBase: 'https://token-plan.maas.qianwenaiapi.com',
    chatBaseUrl: 'https://token-plan.maas.qianwenaiapi.com/compatible-mode/v1',
    dialogEndpoint: 'wss://token-plan.maas.qianwenaiapi.com/api-ws/v1/realtime',
  };
  assert.deepEqual(tokenPlan.deriveTokenPlanEndpoints(), expected);
  assert.deepEqual(tokenPlan.deriveTokenPlanEndpoints(''), expected);
  assert.deepEqual(tokenPlan.deriveTokenPlanEndpoints('https://token-plan.maas.qianwenaiapi.com/'), expected);
  assert.deepEqual(
    tokenPlan.deriveTokenPlanEndpoints('https://token-plan.maas.qianwenaiapi.com/compatible-mode/v1'),
    expected,
  );
  assert.deepEqual(tokenPlan.deriveTokenPlanEndpoints('token-plan.maas.qianwenaiapi.com'), expected);
  assert.deepEqual(
    tokenPlan.deriveTokenPlanEndpoints('https://token-plan.cn-beijing.maas.aliyuncs.com/api/v1'),
    {
      httpBase: 'https://token-plan.cn-beijing.maas.aliyuncs.com',
      chatBaseUrl: 'https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1',
      dialogEndpoint: 'wss://token-plan.cn-beijing.maas.aliyuncs.com/api-ws/v1/realtime',
    },
  );
  assert.throws(() => tokenPlan.deriveTokenPlanEndpoints('not a valid url'));
  assert.throws(() => tokenPlan.deriveTokenPlanEndpoints('ftp://example.com'));
  assert.throws(() => tokenPlan.deriveTokenPlanEndpoints('http://example.com'));
  assert.throws(() => tokenPlan.deriveTokenPlanEndpoints('abc'));
}

// ---- Provider 构造与生图配置 ----
{
  const provider = tokenPlan.buildTokenPlanProvider({
    baseUrl: 'https://token-plan.cn-beijing.maas.aliyuncs.com/',
    textModel: 'qwen4-max',
  });
  assert.equal(provider.id, 'qwen-token-plan');
  assert.equal(provider.baseURL, 'https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1');
  assert.equal(provider.apiKeyRef, 'provider:qwen-token-plan');
  assert.equal(provider.models[0], 'qwen4-max');
  assert.equal(new Set(provider.models).size, provider.models.length, 'models are deduplicated');
  assert.equal(provider.source, 'user');
  assert.equal(provider.enabled, true);

  assert.deepEqual(tokenPlan.loadImageConfig(), tokenPlan.DEFAULT_IMAGE_CONFIG);
  tokenPlan.saveImageConfig({
    providerId: 'qwen-token-plan',
    httpBase: 'https://token-plan.cn-beijing.maas.aliyuncs.com',
    model: 'qwen-image-3.0-pro',
    videoModel: 'happyhorse-1.1-i2v',
  });
  assert.deepEqual(tokenPlan.loadImageConfig(), {
    providerId: 'qwen-token-plan',
    httpBase: 'https://token-plan.cn-beijing.maas.aliyuncs.com',
    model: 'qwen-image-3.0-pro',
    videoModel: 'happyhorse-1.1-i2v',
  });
  store.set('kid_image_config', '{broken');
  assert.deepEqual(tokenPlan.loadImageConfig(), tokenPlan.DEFAULT_IMAGE_CONFIG);
}

// ---- 每日护眼时长限制 ----
{
  store.clear();
  const day1 = new Date('2026-11-21T10:00:00');
  const day2 = new Date('2026-11-22T09:00:00');

  assert.deepEqual(timeLimit.loadTimeLimitConfig(), { enabled: true, dailyMinutes: 30 });
  timeLimit.saveTimeLimitConfig({ enabled: true, dailyMinutes: 20 });
  assert.deepEqual(timeLimit.loadTimeLimitConfig(), { enabled: true, dailyMinutes: 20 });
  timeLimit.saveTimeLimitConfig({ enabled: true, dailyMinutes: 1 });
  assert.equal(timeLimit.loadTimeLimitConfig().dailyMinutes, 5, 'clamps min daily minutes');

  timeLimit.saveTimeLimitConfig({ enabled: true, dailyMinutes: 20 });
  let usage = timeLimit.addUsageSeconds(600, day1);
  assert.equal(usage.usedSeconds, 600);
  let status = timeLimit.getTimeStatus(timeLimit.loadTimeLimitConfig(), usage);
  assert.equal(status.isExceeded, false);
  assert.equal(status.remainingSeconds, 600);
  assert.equal(status.percentUsed, 50);

  usage = timeLimit.addUsageSeconds(600, day1);
  status = timeLimit.getTimeStatus(timeLimit.loadTimeLimitConfig(), usage);
  assert.equal(status.isExceeded, true);
  assert.equal(status.remainingSeconds, 0);

  usage = timeLimit.grantBonusMinutes(15, day1);
  status = timeLimit.getTimeStatus(timeLimit.loadTimeLimitConfig(), usage);
  assert.equal(status.isExceeded, false);
  assert.equal(status.remainingSeconds, 900);

  // 跨天自动清零
  const nextDayUsage = timeLimit.loadDailyUsage(day2);
  assert.equal(nextDayUsage.date, timeLimit.todayDateKey(day2));
  assert.equal(nextDayUsage.usedSeconds, 0);
  assert.equal(nextDayUsage.bonusMinutes, 0);

  timeLimit.resetTodayUsage(day1);
  assert.equal(timeLimit.loadDailyUsage(day1).usedSeconds, 0);
}

console.log('tokenPlan.test.mjs: ok');
