import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { build } from 'esbuild';
const bundle = await build({ entryPoints: ['market/planning.ts'], bundle: true, format: 'cjs', platform: 'node', write: false });
const mod = { exports: {} };
new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),mod,mod.exports);
const { planningJson } = mod.exports;
const originalFetch = globalThis.fetch;
const encoder = new TextEncoder();
const frame = (content, finish_reason=null, extra={}) => `data: ${JSON.stringify({ choices:[{index:0,delta:{content},finish_reason}],...extra })}\r\n\r\n`;
function stream(chunks, signal, interval=0) {
 let stopped=false;
 return new Response(new ReadableStream({
  start(controller) {
   signal?.addEventListener('abort',()=>{stopped=true;controller.error(signal.reason);},{once:true});
   (async()=>{for(const chunk of chunks){if(interval)await new Promise(r=>setTimeout(r,interval));if(stopped)return;controller.enqueue(typeof chunk==='string'?encoder.encode(chunk):chunk);}if(!stopped)controller.close();})();
  },cancel(){stopped=true;}
 }),{headers:{'content-type':'text/event-stream'}});
}
test('SSE handles byte splits, Chinese, reasoning, comments, usage and terminal events',async()=>{
 const text=frame(undefined,null,{choices:[{index:0,delta:{reasoning_content:'internal reasoning'}}]})+': heartbeat\r\n\r\n'+frame('{"title":"小猫"}', 'stop')+'data: {"usage":{"total_tokens":20}}\r\n\r\ndata: [DONE]\r\n\r\n';
 const bytes=encoder.encode(text);
 globalThis.fetch=async(_,o)=>stream([...bytes].map(b=>new Uint8Array([b])),o.signal);
 const {data}=await planningJson('https://test.example/chat',{});
 assert.equal(data.choices[0].message.content,'{"title":"小猫"}');
});
test('active output may take longer than the connection deadline',async()=>{
 globalThis.fetch=async(_,o)=>stream([frame('{'),frame('"ok":true'),frame('}','stop'),'data: [DONE]\n\n'],o.signal,12);
 const {data}=await planningJson('https://test.example/chat',{}, {connect:5,idle:40,total:250});
 assert.equal(data.choices[0].message.content,'{"ok":true}');
});
test('stalled output fails once with a useful idle error and cancels the stream',async()=>{
 let calls=0,cancelled=false;
 globalThis.fetch=async(_,o)=>{calls++;o.signal.addEventListener('abort',()=>{cancelled=true;});return stream([frame('{'),frame('}')],o.signal,40);};
 await assert.rejects(planningJson('https://test.example/chat',{}, {connect:100,idle:5,total:500}),/没有返回新内容/);
 assert.equal(calls,1);assert.equal(cancelled,true);
});
test('connection and total deadlines are distinct, and caller cancellation wins',async()=>{
 globalThis.fetch=async(_,o)=>new Promise((_,reject)=>o.signal.addEventListener('abort',()=>reject(o.signal.reason),{once:true}));
 await assert.rejects(planningJson('https://test.example/chat',{}, {connect:5,idle:50,total:100}),/连接超时/);
 globalThis.fetch=async(_,o)=>stream(Array.from({length:20},()=>frame('x')),o.signal,5);
 await assert.rejects(planningJson('https://test.example/chat',{}, {connect:50,idle:50,total:20}),/超过 5 分钟/);
 const control=new AbortController();setTimeout(()=>control.abort(),5);
 await assert.rejects(planningJson('https://test.example/chat',{signal:control.signal}),/已取消/);
});
test('truncated, over-limit and upstream error streams never become a valid plan',async()=>{
 for(const [payload,pattern] of [[frame('{}'),/连接中断/],[frame('{}','length'),/输出长度上限/],[frame('额度不足','stop',{id:'chatcmpl-gate-123'}),/额度不足/],['data: {"error":{"message":"model unavailable"}}\n\n',/model unavailable/]]){
  globalThis.fetch=async(_,o)=>stream([payload],o.signal);
  await assert.rejects(planningJson('https://test.example/chat',{}),pattern);
 }
});
test('JSON compatibility keeps HTTP status and detailed provider errors',async()=>{
 globalThis.fetch=async()=>new Response(JSON.stringify({message:'模型不在套餐内'}),{status:403,headers:{'content-type':'application/json'}});
 const result=await planningJson('https://test.example/chat',{});
 assert.equal(result.response.status,403);assert.equal(result.data.message,'模型不在套餐内');
});
test('a mid-stream platform failure shows the error rather than preceding partial JSON',async()=>{
 globalThis.fetch=async(_,o)=>stream([frame('{"analysis":'),frame('上游模型无响应','stop',{id:'chatcmpl-gate-error'})],o.signal);
 await assert.rejects(planningJson('https://test.example/chat',{}),error=>error.message==='上游模型无响应');
});
test.after(()=>{globalThis.fetch=originalFetch;});
