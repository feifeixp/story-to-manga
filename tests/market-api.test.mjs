import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { build } from 'esbuild';
const bundled = await build({ entryPoints: ['market/api.ts'], bundle: true, format: 'cjs', platform: 'node', write: false, external: ['react', 'ali-oss/dist/aliyun-oss-sdk.min.js'] });
const mod = { exports: {} };
new Function('require', 'module', 'exports', bundled.outputFiles[0].text)(createRequire(import.meta.url), mod, mod.exports);
const { platformJson, requestMarketApi, generateImage, imageSource, parseJsonReply, validateAnalysis } = mod.exports;
const originalFetch = globalThis.fetch;
const data = new Map();
globalThis.localStorage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) };
globalThis.document = { cookie: '' };
globalThis.FileReader = class { readAsDataURL(blob) { blob.arrayBuffer().then(b => { this.result = `data:${blob.type};base64,${Buffer.from(b).toString('base64')}`; this.onload(); }); } };
function signIn() { data.clear(); data.set('neoStudioSession', JSON.stringify({ authorization: 'test-web-session', userId: 'user-a' })); }
const json = value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
const model = { model_name: 'mock-image', max_reference_images: 4, supported_aspect_ratios: ['1:1'] };
test('Market AI never sends requests without a user web session', async () => {
  data.clear(); let calls = 0; globalThis.fetch = async () => { calls++; throw new Error('unexpected request'); };
  await assert.rejects(requestMarketApi('/api/analyze-story', { story: 'test' }), /登录/);
  assert.equal(calls, 0);
});
test('web AI keeps Authorization and accessToken separate from CLI api-key', async () => {
  signIn(); const calls = []; globalThis.fetch = async (url, options) => { calls.push([url, options.headers]); return json({ success: true, data: [] }); };
  await platformJson('/api/chat', { messages: [] }); await platformJson('/neo-api/agent/ai-image-generation/models/by-scenario?scenarioType=1');
  assert.equal(calls[0][1].Authorization, 'Bearer test-web-session');
  assert.equal(calls[1][1].accessToken, 'test-web-session');
  assert.equal(calls[0][1]['api-key'], undefined); assert.equal(calls[1][1]['api-key'], undefined);
});
test('HTTP 200 quota errors surface without retrying the paid request', async () => {
  signIn(); let calls = 0; globalThis.fetch = async () => { calls++; return json({ success: false, errMessage: '积分不足', errCode: 'INSUFFICIENT_POINTS' }); };
  await assert.rejects(platformJson('/neo-api/agent/ai-image-generation/generate', {}), /积分不足/); assert.equal(calls, 1);
});
test('an interrupted poll resumes its task and does not submit twice', async () => {
  signIn(); let submits = 0, polls = 0, interrupt = true;
  globalThis.fetch = async url => {
    if (url.includes('models/by-scenario')) return json({ data: [model] });
    if (url.endsWith('/generate')) { submits++; return json({ data: { task_code: 'task-a' } }); }
    if (url.includes('/result/task-a')) { polls++; if (interrupt) throw new Error('network interruption'); return json({ data: { status: 'SUCCESS', image_urls: ['https://images.example/test.png'] } }); }
    return new Response('mock image bytes', { headers: { 'Content-Type': 'image/png' } });
  };
  await assert.rejects(generateImage('prompt', 'mock-image', '1:1', [], new AbortController().signal), /interruption/);
  const stored = [...data.entries()].filter(([k]) => k.startsWith('manga-neo-task-')); assert.equal(stored.length, 1); assert.ok(!stored[0][1].includes('test-web-session'));
  interrupt = false;
  assert.match(await generateImage('prompt', 'mock-image', '1:1', [], new AbortController().signal), /^data:image\/png/);
  assert.equal(submits, 1); assert.equal(polls, 2);
  assert.equal([...data.keys()].filter(k => k.startsWith('manga-neo-task-')).length, 0);
});
test('unsupported reference counts fail before any upload or paid generation', async () => {
  signIn(); let calls = 0; globalThis.fetch = async () => { calls++; return json({ data: [{ ...model, max_reference_images: 0 }] }); };
  await assert.rejects(generateImage('prompt', 'mock-image', '1:1', ['https://images.example/ref.png'], new AbortController().signal), /最多支持/); assert.equal(calls, 1);
});
test('Market download sources never call the unavailable Next.js proxy', () => {
  assert.equal(imageSource('data:image/png;base64,AAA'), 'data:image/png;base64,AAA');
  assert.equal(imageSource('https://neowow.oss-cn-hangzhou.aliyuncs.com/a.png'), 'https://app.neowow.studio/oss/a.png');
  assert.equal(imageSource('https://images.example/a.png'), 'https://images.example/a.png');
  assert.throws(() => imageSource('javascript:alert(1)'));
});
test('incomplete story planning is rejected before image generation', () => {
  assert.deepEqual(parseJsonReply('```json\n{"a":1}\n```'), { a: 1 });
  assert.throws(() => parseJsonReply('{"a":'));
  assert.throws(() => validateAnalysis({ title: 'test', characters: [{ name: 'A' }], setting: { location: 'test' }, scenes: [] }));
});
test.after(() => { globalThis.fetch = originalFetch; });
