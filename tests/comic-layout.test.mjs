import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { build } from 'esbuild';
const bundle=await build({entryPoints:['src/lib/comicPageRenderer.ts','src/lib/comicLayout.ts'],bundle:true,format:'cjs',platform:'node',write:false,outdir:'/tmp/comic-layout-tests'});
const load=name=>{const mod={exports:{}};new Function('require','module','exports',bundle.outputFiles.find(f=>f.path.endsWith(name+'.js')).text)(createRequire(import.meta.url),mod,mod.exports);return mod.exports;};
const layout=load('comicLayout'),renderer=load('comicPageRenderer');
const project=count=>({metadata:{name:'A comic'},generatedPanels:[],storyBreakdown:{panels:Array.from({length:count},(_,i)=>({panelNumber:i+1}))},studio:{}});
test('every layout covers 1–50 story panels in order, with no overlap or out-of-page frames',()=>{
 for(const {id} of layout.COMIC_LAYOUTS)for(let count=1;count<=50;count++){
  const p=project(count);p.studio.comicLayout=id;const capacity=layout.panelsPerPage(id);
  const actual=[];
  for(let page=0;page<renderer.comicPageCount(p);page++){
   const numbers=layout.comicPanelNumbers(p).slice(page*capacity,(page+1)*capacity);
   const g=layout.comicGeometry(id,numbers.length);assert.equal(g.frames.length,numbers.length);
   for(const [i,f] of g.frames.entries()){
    actual.push(numbers[i]);assert.ok(f.x>=0&&f.y>=0&&f.width>0&&f.height>0&&f.x+f.width<=g.width+0.001&&f.y+f.height<=g.height);
    for(const other of g.frames.slice(i+1))assert.ok(f.x+f.width<=other.x+0.001||other.x+other.width<=f.x+0.001||f.y+f.height<=other.y||other.y+other.height<=f.y);
   }
  }
  assert.deepEqual(actual,Array.from({length:count},(_,i)=>i+1));
 }
});
test('old projects default to varied manga pages; missing images keep their original slots',()=>{
 const p=project(4);delete p.studio;p.generatedPanels=[{panelNumber:4,image:'last'},{panelNumber:1,image:'first'}];
 assert.equal(layout.comicLayout(p),'manga');assert.deepEqual(layout.comicPanelNumbers(p),[1,2,3,4]);
 const frames=layout.comicGeometry('manga',4).frames;assert.equal(frames[0].width,1104);assert.notEqual(frames[1].width,frames[2].width);assert.equal(frames[3].width,1104);
});
test('automatic generation ratios follow each page slot, including sparse panel numbers and last page',()=>{
 const p=project(8);p.imageSize={aspectRatio:'9:16'};
 for(let i=1;i<=8;i++){const size=layout.panelImageSize(p,i);assert.ok(Math.abs(size.width/size.height-Number(size.aspectRatio.split(':')[0])/Number(size.aspectRatio.split(':')[1]))<0.003);}
 const sparse=project(4);sparse.storyBreakdown.panels.forEach((panel,i)=>panel.panelNumber=[2,5,9,14][i]);
 assert.deepEqual(sparse.storyBreakdown.panels.map(panel=>layout.panelImageSize(sparse,panel.panelNumber).aspectRatio),project(4).storyBreakdown.panels.map(panel=>layout.panelImageSize(project(4),panel.panelNumber).aspectRatio));
});
test('cropping preserves aspect ratio and stays within source bounds',()=>{
 for(const [iw,ih] of [[1920,1080],[1080,1920],[1024,1024]])for(const {id} of layout.COMIC_LAYOUTS)for(const frame of layout.comicGeometry(id,4).frames){
  const crop=layout.comicCrop(iw,ih,frame.width,frame.height);
  assert.ok(crop.x>=-0.001&&crop.y>=-0.001&&crop.x+crop.width<=iw+0.001&&crop.y+crop.height<=ih+0.001);
  assert.ok(Math.abs(crop.width/crop.height-frame.width/frame.height)<0.001);
 }
});
test('model ratio limitations select the closest supported size without asking the user',()=>{
 assert.equal(layout.supportedComicRatio('21:9',['1:1','16:9','9:16']),'16:9');
 assert.equal(layout.supportedComicRatio('2:3',['1:1','9:16']),'9:16');
 assert.equal(layout.supportedComicRatio('16:9',['16:9','1:1']),'16:9');
 assert.throws(()=>layout.supportedComicRatio('16:9',['invalid']));
});
test('page lettering wraps Chinese, English, emoji and newlines without losing text',()=>{
 const context={measureText:value=>({width:Array.from(value).length*24})};
 const text='奶奶：小满，你来了。\nHello, 小满 👋';const lines=renderer.comicTextLines(context,text,120);
 assert.equal(lines.join(''),text.replaceAll('\n',''));assert.ok(lines.every(line=>Array.from(line).length<=5));
});

test('nested art retains all source pixels and proportions across every page layout',()=>{
 for(const [iw,ih] of [[1920,1080],[1080,1920],[1024,1024]])for(const {id} of layout.COMIC_LAYOUTS)for(const frame of layout.comicGeometry(id,4).frames){
  const {source,target}=layout.comicImagePlacement(iw,ih,frame.width,frame.height,true);
  assert.deepEqual(source,{x:0,y:0,width:iw,height:ih});assert.ok(target.x>=-0.001&&target.y>=-0.001&&target.x+target.width<=frame.width+0.001&&target.y+target.height<=frame.height+0.001);
  assert.ok(Math.abs(target.width/target.height-iw/ih)<0.001);
 }
});
