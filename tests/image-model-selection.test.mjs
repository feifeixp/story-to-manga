import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { build } from 'esbuild';
const bundled=await build({entryPoints:['src/lib/aiModelRouter.ts'],bundle:true,format:'cjs',platform:'node',write:false,external:['@google/genai']});
const mod={exports:{}};
new Function('require','module','exports',bundled.outputFiles[0].text)(createRequire(import.meta.url),mod,mod.exports);
test('legacy local automatic selection depends on configured credentials, never language',()=>{
 const previous=process.env.GOOGLE_AI_API_KEY;
 try {
  for(const available of [false,true]) {
   if(available) process.env.GOOGLE_AI_API_KEY='test-only-key'; else delete process.env.GOOGLE_AI_API_KEY;
   const selected=['zh','en','zh-CN','ja'].map(language=>mod.exports.selectAIModel(language,'auto'));
   assert.equal(new Set(selected).size,1);assert.equal(selected[0],available?'nanobanana':'volcengine');
   for(const explicit of ['nanobanana','volcengine']) assert.equal(mod.exports.selectAIModel('zh',explicit),explicit);
  }
 } finally {if(previous===undefined)delete process.env.GOOGLE_AI_API_KEY;else process.env.GOOGLE_AI_API_KEY=previous;}
});
