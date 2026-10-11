import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { build } from 'esbuild';
const bundled=await build({entryPoints:['src/lib/neowowGeneration.ts'],bundle:true,format:'cjs',platform:'node',write:false});
const mod={exports:{}};
new Function('require','module','exports',bundled.outputFiles[0].text)(createRequire(import.meta.url),mod,mod.exports);
const calls=[];
const api=mod.exports.createNeoWoWApi({plan:()=>{throw new Error('unexpected LLM request');},image:async(prompt,model,ratio,refs)=>{calls.push({prompt,model,ratio,refs});return 'data:image/png;base64,test';}});
const panel={panelNumber:1,characters:['小猫','爷爷'],sceneId:'scene1',sceneDescription:'小猫将红伞递给爷爷。',dialogue:'小猫：您的伞。\n爷爷：谢谢！',cameraAngle:'中景',visualMood:'暖色灯光'};
test('panel image requests bind only visible characters, their appearances and ordered reference roles',async()=>{
 calls.length=0;
 await api('/api/generate-panel',{panel,characterReferences:[{name:'爷爷',image:'grandpa.png',description:'白发蓝外套'},{name:'路人',image:'extra.png',description:'不出场'},{name:'小猫',image:'cat.png',description:'橘白短毛'}],uploadedSettingReferences:[{name:'书店',image:'store.png'}],style:'healing',language:'zh',aiModel:'chosen-image',imageSize:{aspectRatio:'16:9'}});
 assert.deepEqual(calls[0].refs,['grandpa.png','cat.png','store.png']);
 assert.match(calls[0].prompt,/白发蓝外套/);assert.match(calls[0].prompt,/橘白短毛/);assert.doesNotMatch(calls[0].prompt,/路人|extra.png/);
 assert.match(calls[0].prompt,/"image":1,"use":"Character identity: 爷爷"/);
 assert.match(calls[0].prompt,/"image":3,"use":"Environment: 书店"/);
 assert.match(calls[0].prompt,/小猫：您的伞/);assert.match(calls[0].prompt,/assign bubble tails/);
 assert.equal(calls[0].model,'chosen-image');assert.equal(calls[0].ratio,'16:9');
});
test('duplicate references keep their labels aligned with actual uploads',async()=>{
 calls.length=0;
 await api('/api/generate-panel',{panel,characterReferences:[{name:'小猫',image:'shared.png',description:'橘猫'}],uploadedSettingReferences:[{name:'书店',image:'shared.png'}]});
 assert.deepEqual(calls[0].refs,['shared.png']);assert.match(calls[0].prompt,/"image":1,"use":"Character identity: 小猫; Environment: 书店"/);
});
test('silent panels request no lettering or empty bubbles',async()=>{
 calls.length=0;await api('/api/generate-panel',{panel:{...panel,dialogue:'',characters:[]},language:'en'});
 assert.match(calls[0].prompt,/Silent panel: no text/);assert.doesNotMatch(calls[0].prompt,/Lettering script:/);assert.deepEqual(calls[0].refs,[]);
});
test('character references use one design and only that character upload, without adding scene scenery',async()=>{
 calls.length=0;await api('/api/generate-character-refs',{characters:[{name:'小猫',physicalDescription:'橘白短毛',personality:'善良',role:'主角'}],setting:{location:'DO_NOT_DRAW_BOOKSTORE'},uploadedCharacterReferences:[{name:'小猫',image:'cat.png'},{name:'爷爷',image:'grandpa.png'}]});
 assert.deepEqual(calls[0].refs,['cat.png']);assert.match(calls[0].prompt,/one full-body/);assert.match(calls[0].prompt,/plain neutral background/);assert.doesNotMatch(calls[0].prompt,/DO_NOT_DRAW_BOOKSTORE/);
});
test('editing keeps the source first and scopes changes to the requested edit',async()=>{
 calls.length=0;await api('/api/modify-image',{originalImage:'source.png',referenceImages:['cat.png'],modificationPrompt:'让红伞收拢',originalPrompt:'小猫归还红伞'});
 assert.deepEqual(calls[0].refs,['source.png','cat.png']);assert.match(calls[0].prompt,/Edit only the first reference/);assert.match(calls[0].prompt,/让红伞收拢/);assert.match(calls[0].prompt,/Preserve all unrelated/);
});
