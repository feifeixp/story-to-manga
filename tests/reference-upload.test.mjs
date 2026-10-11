import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { build } from 'esbuild';
const bundle = await build({ entryPoints: ['market/api.ts'], bundle: true, format: 'cjs', platform: 'node', write: false, external: ['react', 'ali-oss/dist/aliyun-oss-sdk.min.js'] });
const mod = { exports: {} };
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), mod, mod.exports);
function freshApi() { const fresh={exports:{}}; new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),fresh,fresh.exports); return fresh.exports; }
const { referenceUrl, generateImage, clearModelCache } = mod.exports;
const originalFetch = globalThis.fetch;
const storage = new Map();
globalThis.localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,String(v)), removeItem: k => storage.delete(k) };
globalThis.document = { cookie: '' };
globalThis.FileReader = class { readAsDataURL(blob) { blob.arrayBuffer().then(bytes=>{ this.result=`data:${blob.type};base64,${Buffer.from(bytes).toString('base64')}`; this.onload(); }); } };
const json = data => new Response(JSON.stringify({ success: true, data }), { headers: { 'Content-Type': 'application/json' } });
const source = () => `data:image/png;base64,${Buffer.from(randomUUID()).toString('base64')}`;
function signIn(token = 'upload-test-session', preserve = false) { if(!preserve)storage.clear(); storage.set('neoStudioSession', JSON.stringify({ authorization: token, userId: token })); clearModelCache(); }
test('data-URL references use the current presigned upload contract before recording the reusable URL', async () => {
  signIn(); const ref = source(); const bytes = Buffer.from(ref.split(',')[1], 'base64'); const md5 = createHash('md5').update(bytes).digest('hex'); const calls = [];
  const fileUrl = `https://bucket.oss-cn-hangzhou.aliyuncs.com/uploads/${md5}.png`;
  globalThis.fetch = async (url, opts = {}) => {
    calls.push({url,opts});
    if (url === ref) return new Response(bytes, {headers:{'Content-Type':'image/png'}});
    if (url.includes('/image-record/query?')) { assert(url.endsWith(md5)); return json(null); }
    if (url.endsWith('/oss/upload-url')) { assert.deepEqual(JSON.parse(opts.body),{fileName:`${md5}.png`,bizType:'uploads'}); return json({uploadUrl:fileUrl+'?Signature=test-only',fileUrl,method:'PUT',requiredHeaders:{'Content-Type':'image/png'}}); }
    if (url.startsWith(fileUrl+'?')) { assert.equal(opts.method,'PUT'); assert.equal(new Headers(opts.headers).get('accessToken'),null); assert.equal(new Headers(opts.headers).get('Content-Type'),'image/png'); assert.deepEqual(Buffer.from(await opts.body.arrayBuffer()),bytes); return new Response(null,{status:200}); }
    if (url.endsWith('/image-record/save')) { assert.deepEqual(JSON.parse(opts.body),{imageMd5:md5,imageUrl:fileUrl}); return json(null); }
    throw new Error(`Unexpected legacy endpoint: ${url}`);
  };
  assert.equal(await referenceUrl(ref),fileUrl);
  const count=calls.length; assert.equal(await referenceUrl(ref),fileUrl); assert.equal(calls.length,count);
  assert.equal(calls.filter(c=>c.opts.method==='PUT').length,1);
});
test('persisted image records survive module caches and avoid reuploading the reference', async () => {
  signIn(); const ref=source(); let uploads=0;
  globalThis.fetch=async url=>{
    if(url===ref)return new Response('reference',{headers:{'Content-Type':'image/png'}});
    if(url.includes('/image-record/query?'))return json({imageUrl:'https://images.example/existing.png'});
    uploads++;throw new Error('must not request upload');
  };
  assert.equal(await referenceUrl(ref),'https://images.example/existing.png');assert.equal(uploads,0);
});
test('reference upload failure stops before paid generation and identifies the failed stage', async () => {
  signIn(); const ref=source(); let submits=0;
  globalThis.fetch=async (url,opts={})=>{
    if(url===ref)return new Response('reference',{headers:{'Content-Type':'image/png'}});
    if(url.includes('models/by-scenario'))return json([{model_name:'test-image',max_reference_images:1}]);
    if(url.includes('/image-record/query?'))return json(null);
    if(url.endsWith('/oss/upload-url'))return json({uploadUrl:'https://images.example/upload?Signature=secret-signature',fileUrl:'https://images.example/ref.png',method:'PUT',requiredHeaders:{'Content-Type':'image/png'}});
    if(opts.method==='PUT')return new Response('Forbidden',{status:403});
    if(url.endsWith('/generate'))submits++;
    throw new Error('legacy upload endpoint');
  };
  await assert.rejects(generateImage('panel','test-image','1:1',[ref],new AbortController().signal),e=>/参考图上传/.test(e.message)&&/403/.test(e.message)&&!e.message.includes('secret-signature'));
  assert.equal(submits,0);assert.equal([...storage.keys()].filter(k=>k.startsWith('manga-neo-task-')).length,0);
});
test('account changes during presigning stop before OSS upload or record creation', async () => {
  signIn(); const ref=source(); let uploads=0;
  globalThis.fetch=async (url,opts={})=>{
    if(url===ref)return new Response('reference',{headers:{'Content-Type':'image/png'}});
    if(url.includes('/image-record/query?'))return json(null);
    if(url.endsWith('/oss/upload-url')){signIn('other-session');return json({uploadUrl:'https://images.example/upload',fileUrl:'https://images.example/ref.png',method:'PUT'});}
    uploads++;throw new Error('must stop after account changed');
  };
  await assert.rejects(referenceUrl(ref),/切换/);assert.equal(uploads,0);
});
test('a reference transfer completing after 90 seconds is not cut off at the old 60 second deadline', async t => {
  signIn(); const ref=source(); const timers=[];
  t.mock.method(AbortSignal,'timeout',ms=>{const controller=new AbortController();timers.push({ms,controller});return controller.signal;});
  globalThis.fetch=async(url,opts={})=>{
    if(url===ref)return new Response(new Uint8Array(3*1024*1024),{headers:{'Content-Type':'image/png'}});
    if(url.includes('/image-record/query?'))return json(null);
    if(url.endsWith('/oss/upload-url'))return json({uploadUrl:'https://images.example/slow-upload',fileUrl:'https://images.example/slow.png',method:'PUT'});
    if(opts.method==='PUT'){
      const clock=timers.at(-1);
      if(clock.ms<=90000)clock.controller.abort(new DOMException('signal timed out','TimeoutError'));
      opts.signal.throwIfAborted(); return new Response(null,{status:200});
    }
    if(url.endsWith('/image-record/save'))return json(null);
    throw new Error('unexpected request');
  };
  assert.equal(await freshApi().referenceUrl(ref),'https://images.example/slow.png');
});
test('real transfer timeout explains the stage and size, with no automatic generation or upload retry',async()=>{
  signIn(); const ref=source();let uploads=0,submits=0;
  globalThis.fetch=async(url,opts={})=>{
    if(url===ref)return new Response(new Uint8Array(2*1024*1024),{headers:{'Content-Type':'image/png'}});
    if(url.includes('models/by-scenario'))return json([{model_name:'test-image',max_reference_images:1}]);
    if(url.includes('/image-record/query?'))return json(null);
    if(url.endsWith('/oss/upload-url'))return json({uploadUrl:'https://images.example/timeout',fileUrl:'https://images.example/timeout.png',method:'PUT'});
    if(opts.method==='PUT'){uploads++;throw new DOMException('signal timed out','TimeoutError');}
    if(url.endsWith('/generate'))submits++;
    throw new Error('unexpected request');
  };
  await assert.rejects(freshApi().generateImage('slow','test-image','1:1',[ref],new AbortController().signal),e=>/传输.*超时/.test(e.message)&&/2\.0 MB/.test(e.message)&&/尚未提交/.test(e.message)&&!e.message.includes('signal timed out'));
  assert.equal(uploads,1);assert.equal(submits,0);
});
test('generated references reuse their original hosted URL after reload without uploading image bytes',async()=>{
  signIn();let submits=0,uploads=0,changedAccount=false,recordQueries=0;
  const url='https://bucket.oss-cn-hangzhou.aliyuncs.com/generated/reference.png';
  globalThis.fetch=async(target,opts={})=>{
    if(target.includes('models/by-scenario'))return json([{model_name:'test-image',max_reference_images:1}]);
    if(target.endsWith('/generate')){submits++;return json({task_code:'generated-reference'});}
    if(target.includes('/result/'))return json({status:'SUCCESS',image_urls:[url]});
    if(target===url)return new Response('generated-reference-bytes',{headers:{'Content-Type':'image/png'}});
    if(target.startsWith('data:'))return new Response(Buffer.from(target.split(',')[1],'base64'),{headers:{'Content-Type':'image/png'}});
    if(changedAccount && target.includes('/image-record/query?')){recordQueries++;return json({imageUrl:'https://images.example/another-account-reference.png'});}
    uploads++;throw new Error('generated image must not be uploaded again');
  };
  const api=freshApi(); const ref=await api.generateImage('identity','test-image','1:1',[],new AbortController().signal);
  assert.match(ref,/^data:image/);assert.equal(await api.referenceUrl(ref),url);
  assert.equal(await freshApi().referenceUrl(ref),url);
  assert.equal(submits,1);assert.equal(uploads,0);
  assert(![...storage.entries()].filter(([key])=>key.startsWith('manga-neo-reference-')).some(([key,value])=>(key+value).includes('upload-test-session')));
  signIn('different-reference-account',true);changedAccount=true;
  assert.equal(await freshApi().referenceUrl(ref),'https://images.example/another-account-reference.png');assert.equal(recordQueries,1);
});
test('reference reuse remains scoped to the account and does not persist signed download URLs',async()=>{
  signIn();const api=freshApi();let recordQueries=0;
  const signed='https://images.example/generated.png?Signature=temporary-private-signature';
  globalThis.fetch=async(target)=>{
    if(target.includes('models/by-scenario'))return json([{model_name:'test-image'}]);
    if(target.endsWith('/generate'))return json({task_code:'signed-reference'});
    if(target.includes('/result/'))return json({status:'SUCCESS',image_urls:[signed]});
    if(target===signed)return new Response('signed-reference-bytes',{headers:{'Content-Type':'image/png'}});
    if(target.startsWith('data:'))return new Response(Buffer.from(target.split(',')[1],'base64'),{headers:{'Content-Type':'image/png'}});
    if(target.includes('/image-record/query?')){recordQueries++;return json({imageUrl:'https://images.example/account-b.png'});}
    throw new Error('unexpected request');
  };
  const ref=await api.generateImage('identity-signed','test-image','1:1',[],new AbortController().signal);
  assert(![...storage.values()].some(value=>value.includes('temporary-private-signature')));
  signIn('another-upload-account',true);assert.equal(await freshApi().referenceUrl(ref),'https://images.example/account-b.png');assert.equal(recordQueries,1);
});
test('cancelled upload remains cancelled and stops before registration',async()=>{
  signIn();const ref=source(),cancel=new AbortController();let registrations=0;
  globalThis.fetch=async(url,opts={})=>{
    if(url===ref)return new Response('cancelled-reference',{headers:{'Content-Type':'image/png'}});
    if(url.includes('/image-record/query?'))return json(null);
    if(url.endsWith('/oss/upload-url'))return json({uploadUrl:'https://images.example/cancel',fileUrl:'https://images.example/cancel.png'});
    if(opts.method==='PUT'){cancel.abort(new DOMException('cancelled','AbortError'));opts.signal.throwIfAborted();}
    registrations++;return json(null);
  };
  await assert.rejects(freshApi().referenceUrl(ref,cancel.signal),e=>e.name==='AbortError');assert.equal(registrations,0);
});
test('multiple uncached references do not compete for upstream bandwidth and keep their prompt order',async()=>{
  signIn();const refs=[source(),source()];let active=0,maxActive=0,submissions=0;const urls=[];
  globalThis.fetch=async(target,opts={})=>{
    if(target.startsWith('data:'))return new Response(Buffer.from(target.split(',')[1],'base64'),{headers:{'Content-Type':'image/png'}});
    if(target.includes('models/by-scenario'))return json([{model_name:'test-image',max_reference_images:2}]);
    if(target.includes('/image-record/query?'))return json(null);
    if(target.endsWith('/oss/upload-url')){const url='https://images.example/'+JSON.parse(opts.body).fileName;urls.push(url);return json({uploadUrl:url,fileUrl:url,method:'PUT'});}
    if(opts.method==='PUT'){active++;maxActive=Math.max(maxActive,active);await new Promise(r=>setTimeout(r,5));active--;return new Response(null,{status:200});}
    if(target.endsWith('/image-record/save'))return json(null);
    if(target.endsWith('/generate')){submissions++;assert.deepEqual(JSON.parse(opts.body).imageUrls,urls);return new Response(JSON.stringify({success:false,errMessage:'stop-after-uploads'}));}
    throw new Error('unexpected request');
  };
  await assert.rejects(freshApi().generateImage('two refs','test-image','1:1',refs,new AbortController().signal),/stop-after-uploads/);
  assert.equal(maxActive,1);assert.equal(urls.length,2);assert.equal(submissions,1);
});
test.after(()=>{globalThis.fetch=originalFetch;});
