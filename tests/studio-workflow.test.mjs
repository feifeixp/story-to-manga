import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
const source = stripTypeScriptTypes(readFileSync(new URL('../src/lib/studioWorkflow.ts', import.meta.url), 'utf8'), { mode: 'transform' });
const { generatePendingPanels, pendingPanels, upsertPanel, validateBreakdown, requestStudioApi, studioImageSource } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const panel = (panelNumber) => ({ panelNumber, sceneDescription: `Scene ${panelNumber}`, characters: [], sceneId: 'scene1', cameraAngle: 'wide', visualMood: 'warm' });
const breakdown = { panels: [panel(1), panel(2), panel(3)] };

test('pending panels are identity-based, preserve gaps, and include only explicitly stale images', () => {
  assert.deepEqual(pendingPanels(breakdown, [{panelNumber:3,image:'third'},{panelNumber:1,image:'first'}], [1]).map(p=>p.panelNumber), [1,2]);
  assert.deepEqual(pendingPanels(null, []), []);
});
test('redrawing one panel replaces it without duplicating or disturbing other images', () => {
  const existing=[{panelNumber:3,image:'third'},{panelNumber:1,image:'old'}];
  assert.deepEqual(upsertPanel(existing,{panelNumber:1,image:'new'}),[{panelNumber:1,image:'new'},{panelNumber:3,image:'third'}]);
  assert.equal(existing[1].image,'old');
  assert.throws(()=>upsertPanel(existing,{panelNumber:1,image:''}));
});
test('pause keeps the in-flight panel and never starts the next paid request', async () => {
  let paused=false; const requested=[],saved=[];
  await generatePendingPanels({breakdown,generated:[],shouldPause:()=>paused,generate:async p=>{requested.push(p.panelNumber);paused=true;return {panelNumber:p.panelNumber,image:'ready'}},onPanel:p=>saved.push(p.panelNumber),onFailure:()=>assert.fail()});
  assert.deepEqual(requested,[1]); assert.deepEqual(saved,[1]);
});
test('continue skips completed panels even when completion order differs', async () => {
  const requested=[];
  await generatePendingPanels({breakdown,generated:[{panelNumber:3,image:'third'},{panelNumber:1,image:'first'}],shouldPause:()=>false,generate:async p=>{requested.push(p.panelNumber);return {panelNumber:p.panelNumber,image:'ready'}},onPanel:()=>{},onFailure:()=>assert.fail()});
  assert.deepEqual(requested,[2]);
});
test('failure stops generation without automatically repeating an uncertain paid request', async () => {
  const requested=[],failed=[];
  await generatePendingPanels({breakdown,generated:[],shouldPause:()=>false,generate:async p=>{requested.push(p.panelNumber);throw new Error('rate limited')},onPanel:()=>assert.fail(),onFailure:(number,error)=>failed.push([number,error.message])});
  assert.deepEqual(requested,[1]);assert.deepEqual(failed,[[1,'rate limited']]);
});
test('mismatched or missing model output cannot be counted as a completed panel', async () => {
  for (const value of [{panelNumber:2,image:'wrong'}, {panelNumber:1,image:''}]) {
    const errors=[];
    await generatePendingPanels({breakdown,generated:[],shouldPause:()=>false,generate:async()=>value,onPanel:()=>assert.fail(),onFailure:(number)=>errors.push(number)});
    assert.deepEqual(errors,[1]);
  }
});
test('saving a completed panel finishes before the next request starts', async () => {
  const events=[];
  await generatePendingPanels({breakdown,generated:[],shouldPause:()=>false,generate:async p=>{events.push(`request:${p.panelNumber}`);return {panelNumber:p.panelNumber,image:'ready'}},onPanel:async p=>{await new Promise(resolve=>setTimeout(resolve,1));events.push(`saved:${p.panelNumber}`)},onFailure:()=>assert.fail()});
  assert.deepEqual(events,['request:1','saved:1','request:2','saved:2','request:3','saved:3']);
});
test('storyboard validation rejects empty, duplicate, incomplete or oversized plans', () => {
  for(const invalid of [{panels:[]},{panels:[panel(1),panel(1)]},{panels:[{...panel(1),sceneDescription:''}]},{panels:Array.from({length:51},(_,i)=>panel(i+1))}]) assert.throws(()=>validateBreakdown(invalid));
  assert.deepEqual(validateBreakdown({panels:[panel(3),panel(1)]}).panels.map(p=>p.panelNumber),[1,3]);
});
test('character states must bind every visible character once while legacy panels remain valid',()=>{
 const base={...panel(1),characters:['cat']};
 for(const states of [[],[{name:'other',appearance:'wet'}],[{name:'cat',appearance:''}],[{name:'cat',appearance:'wet'},{name:'cat',appearance:'dry'}],null]) assert.throws(()=>validateBreakdown({panels:[{...base,characterStates:states}]}));
 assert.equal(validateBreakdown({panels:[base]}).panels.length,1);
 const valid={...base,characterStates:[{name:'cat',appearance:'base; wet'}]};assert.deepEqual(validateBreakdown({panels:[valid]}).panels[0],valid);
});
test('provider error surfaces exact response, with one request only', async () => {
  const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({error:'Quota exceeded'}),{status:429})};
  try {await assert.rejects(requestStudioApi('/api/generate-panel',{}),/Quota exceeded/);assert.equal(calls,1)}finally{globalThis.fetch=original}
});
test('HTTP 200 provider failure is not silently accepted', async () => {
  const original=globalThis.fetch;
  globalThis.fetch=async()=>new Response(JSON.stringify({success:false,error:'No image'}),{status:200});
  try {await assert.rejects(requestStudioApi('/api/redraw-image',{}),/No image/)}finally{globalThis.fetch=original}
});
test('export reuses Volcengine proxy URLs without double wrapping', () => {
  const proxy='/api/image-proxy?url=https%3A%2F%2Fimages.example%2Fpanel.png';
  assert.equal(studioImageSource(proxy),proxy);
  assert.equal(studioImageSource('data:image/png;base64,AAA'),'data:image/png;base64,AAA');
  assert.equal(studioImageSource('https://images.example/panel.png'),'/api/image-proxy?url=https%3A%2F%2Fimages.example%2Fpanel.png');
  assert.throws(()=>studioImageSource('javascript:alert(1)'));
});
