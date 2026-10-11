import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { build } from 'esbuild';
const bundled = await build({ entryPoints: ['market/api.ts'], bundle: true, format: 'cjs', platform: 'node', write: false, external: ['react', 'ali-oss/dist/aliyun-oss-sdk.min.js'] });
const mod = { exports: {} };
new Function('require', 'module', 'exports', bundled.outputFiles[0].text)(createRequire(import.meta.url), mod, mod.exports);
const { platformJson, requestMarketApi, generateImage, imageSource, parseJsonReply, validateAnalysis, clearModelCache, getBalance, IMAGE_POLL_INTERVAL, IMAGE_POLL_TIMEOUT } = mod.exports;
const originalFetch = globalThis.fetch;
const data = new Map();
globalThis.localStorage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) };
globalThis.document = { cookie: '' };
globalThis.FileReader = class { readAsDataURL(blob) { blob.arrayBuffer().then(b => { this.result = `data:${blob.type};base64,${Buffer.from(b).toString('base64')}`; this.onload(); }); } };
function signIn() { clearModelCache(); data.clear(); data.set('neoStudioSession', JSON.stringify({ authorization: 'test-web-session', userId: 'user-a' })); }
const json = value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
const model = { model_name: 'mock-image', max_reference_images: 4, supported_aspect_ratios: ['1:1'] };
test('Market AI never sends requests without a user web session', async () => {
  data.clear(); let calls = 0; globalThis.fetch = async () => { calls++; throw new Error('unexpected request'); };
  await assert.rejects(requestMarketApi('/api/analyze-story', { story: 'test' }), /登录/);
  assert.equal(calls, 0);
});
test('web AI keeps Authorization and accessToken separate from CLI api-key', async () => {
  signIn(); const calls = []; globalThis.fetch = async (url, options) => { calls.push([url, options.headers]); return json({ success: true, data: [] }); };
  await platformJson('/api/me/chat/completions', { messages: [] }); await platformJson('/neo-api/agent/ai-image-generation/models/by-scenario?scenarioType=1');
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
test('method 2 accepts documented flat payloads and uses the hosted CORS gateway', async () => {
  signIn(); const calls=[];
  globalThis.fetch=async(url,opts)=>{
   calls.push([url,opts]);
   if(url.includes('models/by-scenario'))return json([model]);
   if(url.endsWith('/generate'))return json({task_code:'flat-task'});
   if(url.includes('/result/flat-task'))return json({status:'SUCCESS',image_urls:['https://images.example/flat.png']});
   return new Response('image',{headers:{'Content-Type':'image/png'}});
  };
  assert.match(await generateImage('flat','mock-image','1:1',[],new AbortController().signal),/^data:image/);
  for(const [url,opts] of calls.filter(([url])=>url.includes('/agent/'))) {
   assert(url.startsWith('https://app.neowow.studio/neo-api/agent/'));
   assert.equal(opts.headers.accessToken,'test-web-session');assert.equal(opts.headers['api-key'],undefined);
  }
  assert.equal(IMAGE_POLL_INTERVAL,3000);assert.equal(IMAGE_POLL_TIMEOUT,180000);
});
test('missing task status fails promptly and retains the task instead of polling for minutes',async()=>{
 signIn(); let polls=0;
 globalThis.fetch=async url=>url.includes('models/by-scenario')?json({data:[model]}):url.endsWith('/generate')?json({task_code:'invalid-status'}):(polls++,json({data:{unexpected:true}}));
 await assert.rejects(generateImage('invalid','mock-image','1:1',[],new AbortController().signal),/有效任务状态/);assert.equal(polls,1);assert.equal([...data.keys()].filter(k=>k.startsWith('manga-neo-task-')).length,1);
});
test('uncertain submission is journaled before fetch and cannot be silently resubmitted',async()=>{
 signIn();let submits=0;
 globalThis.fetch=async url=>{if(url.includes('models/by-scenario'))return json([model]);submits++;throw new Error('lost submit response');};
 await assert.rejects(generateImage('uncertain','mock-image','1:1',[],new AbortController().signal),/lost/);
 await assert.rejects(generateImage('uncertain','mock-image','1:1',[],new AbortController().signal),/阻止重复扣费/);assert.equal(submits,1);
 const task=[...data.entries()].find(([k])=>k.startsWith('manga-neo-task-'))[1];assert(!task.includes('test-web-session'));
});
test('a definite quota rejection permits an explicit next attempt',async()=>{
 signIn();globalThis.fetch=async url=>url.includes('models/by-scenario')?json([model]):json({success:false,errCode:'INSUFFICIENT_POINTS',errMessage:'积分不足'});
 await assert.rejects(generateImage('quota','mock-image','1:1',[],new AbortController().signal),/积分不足/);assert.equal([...data.keys()].filter(k=>k.startsWith('manga-neo-task-')).length,0);
});
test('models are cached per token for a minute and switching accounts cannot charge the new account mid-operation',async()=>{
 signIn();let calls=0;
 globalThis.fetch=async()=>{calls++;return json([model]);};
 await mod.exports.listModels();await mod.exports.listModels();assert.equal(calls,1);
 data.set('neoStudioSession',JSON.stringify({authorization:'user-b-token',userId:'b'}));
 await mod.exports.listModels();assert.equal(calls,2);
 await assert.rejects(platformJson('/api/me/chat/completions',{},undefined,'test-web-session'),/切换/);assert.equal(calls,2);
});
test('credits use method 2 and expired login is reported clearly',async()=>{
 signIn();globalThis.fetch=async url=>{assert(url.endsWith('/agent/user/points/info'));return json({data:{totalAvailablePoints:42}});};assert.equal(await getBalance(),42);
 globalThis.fetch=async()=>json({success:false,errCode:2001,errMessage:'invalid'});
 await assert.rejects(getBalance(),/登录已过期/);
});

test('story planning uses method 1 Coding Plan with explicit model and OpenAI messages', async () => {
  signIn(); const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, headers: options.headers, body: JSON.parse(options.body) });
    return json({ choices: [{ message: { content: '{"storyBreakdown":{"panels":[]}}' } }] });
  };
  await requestMarketApi('/api/chunk-story', { story: 'A cat returns an umbrella.', panelCount: 4 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://app.neowow.studio/api/me/chat/completions');
  assert.equal(calls[0].headers.Authorization, 'Bearer test-web-session');
  assert.equal(calls[0].headers.accessToken, undefined);
  assert.equal(calls[0].body.model, 'doubao-seed-2-1-pro-260915');
  assert.equal(calls[0].body.stream, true);
  assert.equal(calls[0].body.messages[0].role, 'system');
  assert.equal(calls[0].body.messages[1].role, 'user');
  assert.equal(calls[0].body.system, undefined);
});
test('Coding Plan surfaces the detailed model/plan error without submitting again', async () => {
  signIn(); let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({ error: 'model_not_in_plan', message: '模型不在当前套餐内，请更换模型。' }), { status: 400 }); };
  await assert.rejects(requestMarketApi('/api/chunk-story', {}), /模型不在当前套餐内/);
  assert.equal(calls, 1);
});
test('LLM upstream balance errors are distinguished from image credits and never retried', async () => {
  signIn(); let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({ error: '402 Insufficient Balance (request_id: test-llm-request)' }), { status: 502 }); };
  await assert.rejects(requestMarketApi('/api/chunk-story', {}), error => /文本模型服务/.test(error.message) && /图片积分/.test(error.message) && /test-llm-request/.test(error.message));
  assert.equal(calls, 1);
});

test('Kimi K3 selection is persisted and sent to Coding Plan without changing image model selection', async () => {
  signIn(); mod.exports.setPlanningModel('kimi-k3');
  assert.equal(mod.exports.getPlanningModel(), 'kimi-k3');
  globalThis.fetch = async (url, options) => {
    assert(url.endsWith('/api/me/chat/completions'));
    assert.equal(JSON.parse(options.body).model, 'kimi-k3');
    return json({ choices: [{ message: { content: '{"storyBreakdown":{"panels":[]}}' } }] });
  };
  await requestMarketApi('/api/chunk-story', { aiModel: 'image-only-model' });
  assert.throws(() => mod.exports.setPlanningModel('unverified-model'), /请选择/);
  assert.equal(mod.exports.getPlanningModel(), 'kimi-k3');
});
test('stale or invalid text model preferences restore the verified Doubao default', () => {
  signIn(); data.set('manga-neo-planning-model', 'deepseek-v4-flash');
  assert.equal(mod.exports.getPlanningModel(), 'doubao-seed-2-1-pro-260915');
});

test('streamed Coding Plan content reaches the story workflow as parsed JSON', async () => {
  signIn(); let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    const content = JSON.stringify({storyBreakdown:{panels:[{panelNumber:1,sceneDescription:'A red umbrella.',characters:[]}]}});
    const event = JSON.stringify({choices:[{index:0,delta:{content},finish_reason:'stop'}]});
    return new Response(`data: ${event}\n\ndata: [DONE]\n\n`, {headers:{'content-type':'text/event-stream'}});
  };
  const result = await requestMarketApi('/api/chunk-story', {story:'A red umbrella.',panelCount:2});
  assert.equal(result.storyBreakdown.panels[0].sceneDescription, 'A red umbrella.');
  assert.equal(calls, 1);
});

test('Neo Image 2.5 wins over catalog order and the platform default, including legacy preferences', () => {
  const models=[{...model,is_default_design_model:true},{...model,model_name:'gpt-image-2.5-sunburst'},{...model,model_name:'gpt-image-2.5-flare'}];
  for(const preference of ['auto','','nanobanana','volcengine']) assert.equal(mod.exports.selectImageModel(models,preference).model_name,'gpt-image-2.5-flare');
  assert.equal(mod.exports.selectImageModel(models,'gpt-image-2.5-sunburst').model_name,'gpt-image-2.5-sunburst');
  assert.equal(mod.exports.selectImageModel(models,'missing-model'),undefined);
});
test('available Sunburst is preferred before the platform fallback; empty catalogs remain unavailable', () => {
  const fallback={...model,is_default_design_model:true};
  assert.equal(mod.exports.selectImageModel([fallback,{...model,model_name:'gpt-image-2.5-sunburst'}]).model_name,'gpt-image-2.5-sunburst');
  assert.equal(mod.exports.selectImageModel([{...model,model_name:'other'},fallback]).model_name,'mock-image');
  assert.equal(mod.exports.selectImageModel([]),undefined);
});
test('Chinese and English panel requests send the same Neo Image 2.5 model', async () => {
  const submissions=[];
  for(const language of ['zh','en']) {
    signIn();
    globalThis.fetch=async(url,opts)=>{
      if(url.includes('models/by-scenario')) return json([{...model,is_default_design_model:true},{...model,model_name:'gpt-image-2.5-flare'}]);
      if(url.endsWith('/generate')) { submissions.push(JSON.parse(opts.body)); return json({task_code:'neo25-task'}); }
      if(url.includes('/result/neo25-task')) return json({status:'SUCCESS',image_urls:['https://images.example/neo25.png']});
      return new Response('image',{headers:{'Content-Type':'image/png'}});
    };
    await requestMarketApi('/api/generate-panel',{language,aiModel:'auto',panel:{panelNumber:1,characters:[],sceneId:'scene1',sceneDescription:'A red umbrella',dialogue:'',cameraAngle:'wide',visualMood:'warm'}});
  }
  assert.equal(submissions.length,2);
  assert(submissions.every(body=>body.modelName==='gpt-image-2.5-flare'));
});

test.after(() => { globalThis.fetch = originalFetch; });
