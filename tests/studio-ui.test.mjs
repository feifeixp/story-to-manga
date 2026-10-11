/** Mocked component tests: no browser storage, authentication, network, or paid model calls. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { resolve } from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
let compile;
if (process.env.STUDIO_TRANSFORM_MODULE) {
  const babel = require(process.env.STUDIO_TRANSFORM_MODULE);
  compile = (code, file) => babel.babelTransform(code, file, false, [], []).code;
} else {
  const ts = require('typescript');
  compile = (code, file) => ts.transpileModule(code, {fileName:file,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
}
const source = stripTypeScriptTypes(readFileSync(new URL('../src/lib/studioWorkflow.ts',import.meta.url),'utf8'),{mode:'transform'});
const workflow = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const layoutSource=stripTypeScriptTypes(readFileSync(new URL('../src/lib/comicLayout.ts',import.meta.url),'utf8'),{mode:'transform'});
const comicLayout=await import(`data:text/javascript;base64,${Buffer.from(layoutSource).toString('base64')}`);
const artworkSource=stripTypeScriptTypes(readFileSync(new URL('../src/lib/studioArtwork.ts',import.meta.url),'utf8'),{mode:'transform'});
const studioArtwork=await import(`data:text/javascript;base64,${Buffer.from(artworkSource).toString('base64')}`);
const promptSource=stripTypeScriptTypes(readFileSync(new URL('../src/lib/mangaPrompts.ts',import.meta.url),'utf8'),{mode:'transform'});
const mangaPrompts=await import(`data:text/javascript;base64,${Buffer.from(promptSource).toString('base64')}`);
const analysis={title:'雨巷里的来信',characters:[{name:'小满',physicalDescription:'短发、绿伞',personality:'温柔',role:'主角'}],setting:{timePeriod:'现代',location:'雨巷',mood:'温暖'},scenes:[{id:'scene1',name:'旧书店',description:'雨中的旧书店',location:'雨巷',mood:'温暖',visualElements:['书','伞']}]};
const panel=(n)=>({panelNumber:n,characters:['小满'],sceneId:'scene1',sceneDescription:`第 ${n} 格，旧书店的门轻轻打开。`,dialogue:'雨停之前，来巷子的尽头。',cameraAngle:'中景',visualMood:'温暖'});
const base=()=>({metadata:{id:'project-a',name:'雨巷里的来信',createdAt:1,updatedAt:1,panelCount:0,characterCount:0,style:'healing',imageSize:{width:1024,height:1024,aspectRatio:'1:1',volcEngineSize:'1K'}},story:'小满在雨巷里收到一封信，她撑起一把旧绿伞，跟着一只橘猫找到了奶奶。',style:'healing',imageSize:{width:1024,height:1024,aspectRatio:'1:1',volcEngineSize:'1K'},storyAnalysis:null,storyBreakdown:null,characterReferences:[],generatedPanels:[],uploadedCharacterReferences:[],uploadedSettingReferences:[],studio:{aiModel:'auto',step:1,approved:false,requestedPanelCount:4,stalePanels:[],panelVersions:{}}});
function harness(initial=base()) {
  const hooks=[];let cursor=0; const calls=[],routes=[];let saves=0;let pending=[];
  const state={project:structuredClone(initial)};
  const store={current:{current:state.project},get project(){return state.project},update(fn){state.project=fn(state.project);store.current.current=state.project},async save(){saves++},async open(){},async create(){state.project=base();store.current.current=state.project},loading:false,saveStatus:'saved',storageError:''};
  const react={useId(){cursor++;return "test-studio"},useState(initial){const index=cursor++;if(!(index in hooks))hooks[index]=typeof initial==='function'?initial():initial;return[hooks[index],value=>{hooks[index]=typeof value==='function'?value(hooks[index]):value}]},useRef(initial){const index=cursor++;if(!(index in hooks))hooks[index]={current:initial};return hooks[index]},useEffect(){cursor++}};
  const jsx=(type,props)=>({type,props:props||{}});
  const external=(name)=>(props)=>jsx('mock-component',{'data-component':name,...props});
  let provider=async(path,body)=>{if(path==='/api/analyze-story')return{analysis};if(path==='/api/chunk-story')return{storyBreakdown:{panels:[panel(1),panel(2),panel(3),panel(4)]}};if(path==='/api/generate-character-refs')return{characterReferences:[{name:'小满',description:'短发',image:'data:image/png;base64,REF'}]};if(path==='/api/generate-panel')return{generatedPanel:{panelNumber:body.panel.panelNumber,image:`data:image/png;base64,PANEL${body.panel.panelNumber}`}};return{imageData:'data:image/png;base64,EDIT'}};
  const modules={react,'@/lib/mangaPrompts':mangaPrompts,'@/lib/studioArtwork':studioArtwork,'@/lib/comicLayout':comicLayout,'./ComicPageComposer':{ComicLayoutChoices:external('ComicLayoutChoices'),ComicPageComposer:external('ComicPageComposer')},'next/link':props=>jsx('a',props),'next/navigation':{useRouter:()=>({push:url=>routes.push(url)})},'lucide-react':new Proxy({}, {get:(_target,name)=>props=>jsx('svg',{'data-icon':name,width:props.size||18,height:props.size||18,'aria-hidden':true})}),'@/components/AuthModal':{AuthModal:external('AuthModal')},'@/components/AuthProvider':{useAuth:()=>({user:null})},'@/components/I18nProvider':{useI18n:()=>({language:'zh'})},'@/components/ImageUpload':external('ImageUpload'),'@/components/LanguageSwitcher':()=>jsx('span',{children:'中文'}),'@/components/ShareComicModal':{ShareComicModal:external('ShareComicModal')},'@/lib/projectStorage':{getProjectList:()=>[]},'@/lib/studioExport':{downloadImage:async()=>{},downloadProject:()=>{},exportComicPages:async()=>{},exportPanels:async()=>{}},'@/lib/studioWorkflow':{...workflow,requestStudioApi:async(path,body)=>{calls.push({path,body});return provider(path,body)}},'@/types/project':{IMAGE_SIZE_PRESETS:{square_1_1:initial.imageSize}},'./StudioDialog':{StudioDialog:props=>jsx('section',{...props,role:'dialog'})},'./useStudioProject':{useStudioProject:()=>store,defaultStudio:()=>base().studio}};
  const exports={};
  const filename=resolve('src/components/studio/MangaStudio.tsx');
  vm.runInNewContext(compile(readFileSync(filename,'utf8'),filename),{exports,require:name=>name.includes('jsx-runtime')?{jsx,jsxs:jsx,Fragment:'fragment'}:name in modules?modules[name]:(()=>{throw new Error(`Unexpected import ${name}`)})(),AbortController,window:{scrollTo(){},addEventListener(){},removeEventListener(){}},setTimeout,clearTimeout,console},{filename});
  function render(){cursor=0;return exports.default()}
  function nodes(value,result=[]){if(value===null||value===undefined||typeof value==='boolean')return result;if(Array.isArray(value)){for(const child of value)nodes(child,result);return result}if(typeof value!=='object')return result;if(typeof value.type==='function')return nodes(value.type(value.props),result);result.push(value);nodes(value.props.children,result);return result}
  const text=node=>typeof node==='string'||typeof node==='number'?String(node):Array.isArray(node)?node.map(text).join(''):node?.props?text(node.props.children):'';
  const find=predicate=>{const found=nodes(render()).find(predicate);assert.ok(found,'Expected UI control not found');return found};
  const button=label=>find(node=>node.type==='button'&&text(node).trim()===label);
  const settle=async()=>{for(let i=0;i<15;i++)await new Promise(r=>setImmediate(r));};
  return{state,store,calls,routes,render,nodes,text,find,button,settle,get saves(){return saves},provider(fn){provider=fn}};
}
function planned(step=2){const value=base();value.storyAnalysis=analysis;value.storyBreakdown={panels:[panel(1),panel(2),panel(3),panel(4)]};value.studio.step=step;value.studio.plannedStory=value.story;return value}

test('story planning calls analysis and breakdown only, never image generation',async()=>{const h=harness();h.button('拆解我的故事').props.onClick();await h.settle();assert.deepEqual(h.calls.map(c=>c.path),['/api/analyze-story','/api/chunk-story']);assert.equal(h.calls[1].body.panelCount,4);assert.equal(h.state.project.studio.step,2);assert.equal(h.state.project.studio.approved,false)});
test('a failed replacement plan preserves every existing panel and reference',async()=>{const p=planned(1);p.generatedPanels=[{panelNumber:1,image:'old'}];const h=harness(p);h.provider(async path=>{if(path==='/api/analyze-story')return{analysis};throw new Error('planning unavailable')});h.button('拆解我的故事').props.onClick();h.button('重新拆解').props.onClick();await h.settle();assert.equal(h.state.project.generatedPanels[0].image,'old');assert.equal(h.state.project.storyBreakdown.panels.length,4)});
test('double-clicking start creates just one generation pipeline',async()=>{const h=harness(planned());h.button('确认分镜，开始生成').props.onClick();const start=h.button('开始生成');start.props.onClick();start.props.onClick();await h.settle();assert.equal(h.calls.filter(c=>c.path==='/api/generate-character-refs').length,1);assert.equal(h.calls.filter(c=>c.path==='/api/generate-panel').length,4);assert.equal(h.state.project.generatedPanels.length,4);assert.equal(h.state.project.studio.step,3)});
test('clicking the selected style is a true no-op and retains paid artwork',()=>{const p=planned(1);p.characterReferences=[{name:'小满',image:'ref',description:'appearance'}];p.generatedPanels=[{panelNumber:1,image:'original'}];const h=harness(p);const style=h.find(node=>node.type==='button'&&node.props.className?.includes('style-choice')&&node.props['aria-pressed']);style.props.onClick();assert.equal(h.state.project.characterReferences.length,1);assert.deepEqual(h.state.project.studio.stalePanels,[])});
test('a changed story cannot use its previous storyboard for generation',()=>{const p=planned();p.story+='后来发生了完全不同的事情。';const h=harness(p);assert.equal(h.button('确认分镜，开始生成').props.disabled,true)});
test('editing one panel marks only that frame stale',()=>{const p=planned(4);p.generatedPanels=[{panelNumber:1,image:'a'},{panelNumber:2,image:'b'}];const h=harness(p);const field=h.find(node=>node.type==='textarea'&&node.props.value===p.storyBreakdown.panels[0].sceneDescription);field.props.onChange({target:{value:'New first scene'}});assert.deepEqual(Array.from(h.state.project.studio.stalePanels),[1]);assert.equal(h.state.project.generatedPanels[1].image,'b')});
test('header navigation saves before routing and is blocked during generation',async()=>{const h=harness();h.find(node=>node.type==='a'&&node.props.href==='/').props.onClick({preventDefault(){}});await h.settle();assert.ok(h.saves>0);assert.deepEqual(h.routes,['/']);const g=harness(planned());g.provider(()=>new Promise(()=>{}));g.button('确认分镜，开始生成').props.onClick();g.button('开始生成').props.onClick();g.find(node=>node.type==='a'&&node.props.href==='/comics').props.onClick({preventDefault(){}});assert.deepEqual(g.routes,[])});
test('late upload completion cannot attach a reference to another project',()=>{const h=harness();const uploader=h.find(node=>node.type==='mock-component'&&node.props['data-component']==='ImageUpload');h.store.update(value=>({...value,metadata:{...value.metadata,id:'project-b'}}));uploader.props.onImageAdd({id:'late',name:'old file',fileName:'old.png',image:'data:image/png;base64,AAA'});assert.equal(h.state.project.uploadedCharacterReferences.length,0)});

test('local export sharing opens file instructions without an application login',()=>{const p=planned(4);p.generatedPanels=[{panelNumber:1,image:'ready'}];const h=harness(p);h.button('导出漫画').props.onClick();h.button('分享导出的作品导出漫画文件后自行分享，无需登录').props.onClick();assert.ok(h.nodes(h.render()).some(node=>node.props.role==='dialog'&&node.props.title==='分享你的作品'));assert.equal(h.nodes(h.render()).filter(node=>node.props['data-component']==='AuthModal').length,0);assert.equal(h.calls.length,0)});

test('completed character references are saved before a later character fails',async()=>{const p=planned();p.storyAnalysis=structuredClone(analysis);p.storyAnalysis.characters.push({name:'奶奶',physicalDescription:'银发',personality:'温柔',role:'配角'});const h=harness(p);h.provider(async(path,body)=>{if(path!=='/api/generate-character-refs')throw new Error('No panel should be submitted');const c=body.characters[0];if(c.name==='奶奶')throw new Error('quota unavailable');return{characterReferences:[{name:c.name,description:c.physicalDescription,image:'data:image/png;base64,READY'}]}});h.button('确认分镜，开始生成').props.onClick();h.button('开始生成').props.onClick();await h.settle();assert.deepEqual(h.calls.map(c=>Array.from(c.body.characters,x=>x.name)),[['小满'],['奶奶']]);assert.equal(h.state.project.characterReferences.length,1);assert.equal(h.state.project.characterReferences[0].name,'小满');assert.ok(h.saves>=2);assert.equal(h.state.project.generatedPanels.length,0)});

// Optional layout snapshots use the actual component markup, with dependencies mocked above.
if(process.env.STUDIO_SNAPSHOT_DIR){
  const folder=process.env.STUDIO_SNAPSHOT_DIR;mkdirSync(folder,{recursive:true});
  const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const html=(value)=>{if(value==null||typeof value==='boolean')return'';if(Array.isArray(value))return value.map(html).join('');if(typeof value!=='object')return escape(value);if(typeof value.type==='function')return html(value.type(value.props));if(value.type==='fragment')return html(value.props.children);const props=value.props||{};const attrs=Object.entries(props).filter(([key,val])=>!['children','key','ref','value','defaultValue','style'].includes(key)&&!key.startsWith('on')&&typeof val!=='function'&&val!==false&&val!=null).map(([key,val])=>`${key==='className'?'class':key==='htmlFor'?'for':key}="${escape(val===true?'':val)}"`).join(' ');const content=value.type==='textarea'?escape(props.value||''):html(props.children);return`<${value.type} ${attrs}${value.type==='input'&&props.value!=null?` value="${escape(props.value)}"`:''}>${content}</${value.type}>`};
  const css=readFileSync('src/app/app/studio.css','utf8');
  for(const step of [1,2,3,4]){const p=step===1?base():planned(step);if(step>=3){p.studio.approved=true;p.generatedPanels=[1,2,3,4].map(panelNumber=>({panelNumber,image:'/studio/story-preview.svg'}))}const h=harness(p);writeFileSync(`${folder}/step-${step}.html`,`<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}*{box-sizing:border-box}button,input,textarea,select{font:inherit}${css}</style>${html(h.render())}</html>`)}
}

test('layout controls replace manual aspect ratios and preserve paid images when recomposing',()=>{
 const p=planned(4);p.generatedPanels=[{panelNumber:1,image:'paid-original'}];const h=harness(p);
 const composer=h.find(n=>n.props['data-component']==='ComicPageComposer');composer.props.onLayout('cinema');
 assert.equal(h.state.project.studio.comicLayout,'cinema');assert.equal(h.state.project.generatedPanels[0].image,'paid-original');assert.deepEqual(h.state.project.studio.stalePanels,[]);assert.equal(h.calls.length,0);
 const story=harness();assert.equal(story.nodes(story.render()).filter(n=>n.type==='select'&&n.props.id?.endsWith('-ratio')).length,0);
});
test('generation derives different panel ratios from page geometry instead of legacy project size',async()=>{
 const p=planned();p.imageSize.aspectRatio='9:16';const h=harness(p);
 h.button('确认分镜，开始生成').props.onClick();h.button('开始生成').props.onClick();await h.settle();
 const requests=h.calls.filter(c=>c.path==='/api/generate-panel');assert.equal(requests.length,4);
 assert.deepEqual(requests.map(c=>c.body.imageSize.aspectRatio),[1,2,3,4].map(n=>comicLayout.panelImageSize(p,n).aspectRatio));
 assert.ok(new Set(requests.map(c=>c.body.imageSize.aspectRatio)).size>=3);
});

test('storyboard review and generation keep pagination independently of the comic page view',()=>{
 for(const step of [2,3]){
  const p=planned(step);p.storyBreakdown.panels=Array.from({length:13},(_,i)=>panel(i+1));const h=harness(p);
  assert.equal(h.button('下一页').props.disabled,false);h.button('下一页').props.onClick();
  const cards=h.nodes(h.render()).filter(n=>n.type==='button'&&n.props.className?.includes('board-card'));assert.equal(cards.length,1);assert.ok(h.text(cards[0]).includes('第 13 格'));
 }
});

function withArtwork(){const p=planned(4);p.characterReferences=[{name:'小满',description:'绿伞',image:'ref'}];p.generatedPanels=[{panelNumber:1,image:'paid-original',composition:'single'},{panelNumber:2,image:'untouched'}];return p;}
test('explicit character upgrade uses the old image once and preserves artwork without automatically redrawing',async()=>{
 const p=withArtwork();p.studio.step=2;p.storyBreakdown.panels[1].characters=[];
 const h=harness(p);h.button('升级为设定图').props.onClick();assert.equal(h.calls.length,0);
 const confirm=h.button('确认生成设定图');confirm.props.onClick();confirm.props.onClick();await h.settle();
 assert.equal(h.calls.length,1);assert.equal(h.calls[0].body.uploadedCharacterReferences[0].image,'ref');assert.equal(h.state.project.characterReferences[0].sheetVersion,1);assert.deepEqual(Array.from(h.state.project.studio.stalePanels),[1]);assert.equal(h.state.project.generatedPanels[0].image,'paid-original');assert.equal(h.state.project.generatedPanels[1].image,'untouched');assert.ok(h.saves>0);
});
test('failed or invalid character updates keep the previous reference and never retry',async()=>{
 for(const provider of [async()=>{throw new Error('timeout')},async()=>({characterReferences:[]})]) {
  const p=withArtwork();p.studio.step=2;const h=harness(p);h.provider(provider);h.button('升级为设定图').props.onClick();h.button('确认生成设定图').props.onClick();await h.settle();
  assert.equal(h.calls.length,1);assert.equal(h.state.project.characterReferences[0].image,'ref');assert.equal(h.state.project.generatedPanels[0].image,'paid-original');assert.equal(h.state.project.studio.stalePanels.length,0);
 }
});
test('legacy portraits remain reusable without a paid automatic upgrade',async()=>{
 const p=withArtwork();p.studio.step=2;const h=harness(p);h.button('确认分镜，开始生成').props.onClick();h.button('开始生成').props.onClick();await h.settle();
 assert.equal(h.calls.filter(c=>c.path==='/api/generate-character-refs').length,0);assert.equal(h.state.project.characterReferences[0].image,'ref');
});
test('editing a design keeps the old image as a stale anchor and renames per-panel state bindings',()=>{
 const p=withArtwork();p.studio.step=2;p.storyBreakdown.panels[0].characterStates=[{name:'小满',appearance:'雨衣；淋湿'}];const h=harness(p);
 h.find(n=>n.props['aria-label']==='编辑小满').props.onClick();h.find(n=>n.type==='input'&&n.props.value==='小满').props.onChange({target:{value:'小雨'}});h.button('保存角色').props.onClick();
 assert.equal(h.calls.length,0);assert.equal(h.state.project.characterReferences[0].image,'ref');assert.equal(h.state.project.characterReferences[0].needsUpdate,true);assert.equal(h.state.project.characterReferences[0].name,'小雨');assert.equal(h.state.project.storyBreakdown.panels[0].characterStates[0].name,'小雨');
});
test('redrawing carries identity anchors and the selected appearance into the edit request',async()=>{
 const p=withArtwork();p.characterReferences[0].design={identity:'左眼下的痣',outfits:'雨衣',forms:'',states:'淋湿'};p.storyBreakdown.panels[0].characterStates=[{name:'小满',appearance:'雨衣；淋湿'}];const h=harness(p);h.button('只重绘这一格').props.onClick();await h.settle();
 assert.match(h.calls[0].body.originalPrompt,/左眼下的痣/);assert.match(h.calls[0].body.originalPrompt,/雨衣；淋湿/);assert.match(h.calls[0].body.originalPrompt,/NEVER copy the sheet grid/);
});
test('clearing a frame appearance restores the base design instead of leaving an invalid plan',()=>{
 const p=planned();p.storyBreakdown.panels[0].characterStates=[{name:'小满',appearance:'雨衣'}];const h=harness(p);const field=()=>h.find(n=>n.type==='input'&&n.props.placeholder==='沿用基础设定；有变化时填写已定义的名称');field().props.onChange({target:{value:''}});field().props.onBlur({target:{value:''}});
 assert.equal(h.state.project.storyBreakdown.panels[0].characterStates[0].appearance,'基础设定');assert.doesNotThrow(()=>workflow.validateBreakdown(h.state.project.storyBreakdown));
});
test('selecting manga insets is free; explicit recompose retains originals and other panels',async()=>{
 const h=harness(withArtwork());h.find(n=>n.props['data-component']==='ComicPageComposer').props.onLayout('japanese');assert.equal(h.calls.length,0);
 const btn=h.button('日漫重排这一格');btn.props.onClick();btn.props.onClick();await h.settle();assert.equal(h.calls.length,1);
 const {path,body}=h.calls[0];assert.equal(path,'/api/modify-image');assert.equal(body.originalImage,'paid-original');assert.equal(body.recompose,true);assert.equal(body.composition,'japanese');
 assert.equal(h.state.project.generatedPanels[0].composition,'japanese');assert.equal(h.state.project.generatedPanels[1].image,'untouched');assert.equal(h.state.project.studio.panelVersions['1'][0].image,'paid-original');assert.equal(h.state.project.studio.panelVersions['1'][0].composition,'single');assert.ok(h.saves>0);
 h.button('查看上一版').props.onClick();h.button('恢复这张图片').props.onClick();assert.equal(h.state.project.generatedPanels[0].image,'paid-original');assert.equal(h.state.project.generatedPanels[0].composition,'single');
});
test('a failed manga recomposition never replaces the current paid image or retries',async()=>{
 const h=harness(withArtwork());h.provider(async()=>{throw new Error('upstream timed out')});h.button('日漫重排这一格').props.onClick();await h.settle();assert.equal(h.calls.length,1);assert.equal(h.state.project.generatedPanels[0].image,'paid-original');assert.deepEqual(h.state.project.studio.panelVersions,{});
});
test('new manga-inset frames receive composition and automatic ratios while characters stay single',async()=>{
 const p=planned();p.studio.comicLayout='japanese';const h=harness(p);h.button('确认分镜，开始生成').props.onClick();h.button('开始生成').props.onClick();await h.settle();
 assert.ok(h.calls.filter(c=>c.path==='/api/generate-panel').every(c=>c.body.composition==='japanese'&&c.body.imageSize.aspectRatio===comicLayout.panelImageSize(p,c.body.panel.panelNumber).aspectRatio));
 assert.ok(h.state.project.generatedPanels.every(p=>p.composition==='japanese'));assert.equal(h.calls.find(c=>c.path==='/api/generate-character-refs').body.composition,undefined);
});
test('small edits preserve original inset mode instead of adopting newly selected layout',async()=>{
 const p=withArtwork();p.generatedPanels[0].composition='japanese';p.studio.comicLayout='cinema';const h=harness(p);
 h.find(n=>n.type==='textarea'&&n.props.placeholder==='例如：让光线再温暖一点').props.onChange({target:{value:'暖一些'}});h.button('修改当前画面').props.onClick();await h.settle();assert.equal(h.calls[0].body.composition,'japanese');assert.equal(h.calls[0].body.recompose,false);
});
