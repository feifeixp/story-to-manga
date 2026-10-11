// Local route contract tests with a mock image provider; no network or credits.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
const calls=[],cacheKeys=[];
const quiet=new Proxy(()=>{}, {get:()=>()=>{}});
const modules={
 'next/server':{NextResponse:{json:(body,options)=>({body,status:options?.status||200})}},
 '@/lib/aiModelRouter':{selectAIModel:()=> 'test',getAIModelRouter:()=>({generateComicPanel:async(...args)=>{calls.push(args);return{success:true,imageData:'data:image/png;base64,TEST'}}})},
 '@/lib/styleConfig':{getStylePrompt:()=> 'warm color comic'},
 '@/lib/logger':new Proxy({},{get:()=>quiet}),
 '@/lib/cacheManager':{cacheHelpers:{getCachedPanelImage:(_n,key)=>{cacheKeys.push(key);return null},cachePanelImage:()=>{}}}
};
async function route(name){
 const bundled=await build({entryPoints:[`src/app/api/${name}/route.ts`],bundle:true,write:false,format:'cjs',platform:'node',plugins:[{name:'mock',setup(b){b.onResolve({filter:/.*/},args=>Object.hasOwn(modules,args.path)?{path:args.path,external:true}:undefined)}}]});
 const mod={exports:{}};new Function('require','module','exports',bundled.outputFiles[0].text)(name=>{assert.ok(modules[name],`Unexpected module ${name}`);return modules[name]},mod,mod.exports);return mod.exports.POST;
}
const panel={panelNumber:2,characters:[],sceneId:'scene1',sceneDescription:'An empty alley with a green umbrella.',dialogue:'',cameraAngle:'wide',visualMood:'calm'};
test('local nested generation separates cache keys and uses the shared silent inset contract',async()=>{
 calls.length=0;const post=await route('generate-panel');const body={panel,setting:{location:'alley'},characterReferences:[],style:'healing',composition:'japanese',imageSize:{aspectRatio:'1:1'}};
 const result=await post({json:async()=>body});assert.equal(result.status,200);assert.equal(result.body.generatedPanel.composition,'japanese');assert.match(calls[0][0],/exactly TWO subframes/);assert.match(calls[0][0],/Silent panel: no text/);assert.equal(JSON.parse(cacheKeys.at(-1)).composition,'japanese');
});
test('local redraw and recomposition do not override nested directions with single-panel instructions',async()=>{
 for(const name of ['redraw-image','modify-image']){
  calls.length=0;const post=await route(name);const result=await post({json:async()=>({imageType:'panel',imageId:2,originalPrompt:'Empty alley.',originalImage:'data:image/png;base64,ORIGINAL',modificationPrompt:'Recompose',recompose:true,referenceImages:[],style:'healing',composition:'japanese',imageSize:{aspectRatio:'1:1'}})});
  assert.equal(result.status,200);assert.match(calls[0][0],/Japanese manga inset composition/);assert.doesNotMatch(calls[0][0],/Generate a single panel|ONE continuous/);
  if(name==='modify-image'){assert.match(calls[0][0],/Recompose the FIRST reference/);assert.equal(calls[0][1][0],'data:image/png;base64,ORIGINAL');}
 }
});
