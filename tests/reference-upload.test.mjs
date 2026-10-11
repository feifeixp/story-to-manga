import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { build } from 'esbuild';
const bundle = await build({ entryPoints: ['market/api.ts'], bundle: true, format: 'cjs', platform: 'node', write: false, external: ['react', 'ali-oss/dist/aliyun-oss-sdk.min.js'] });
const mod = { exports: {} };
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), mod, mod.exports);
const { referenceUrl, generateImage, clearModelCache } = mod.exports;
const originalFetch = globalThis.fetch;
const storage = new Map();
globalThis.localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,String(v)), removeItem: k => storage.delete(k) };
globalThis.document = { cookie: '' };
const json = data => new Response(JSON.stringify({ success: true, data }), { headers: { 'Content-Type': 'application/json' } });
const source = () => `data:image/png;base64,${Buffer.from(randomUUID()).toString('base64')}`;
function signIn(token = 'upload-test-session') { storage.set('neoStudioSession', JSON.stringify({ authorization: token, userId: token })); clearModelCache(); }
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
test.after(()=>{globalThis.fetch=originalFetch;});
