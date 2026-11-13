// Real React + React Query + headless Chromium integration test.
// Network replies here are labelled test fixtures, NOT account readings.
const {createRequire}=require('node:module');
const {readFileSync,writeFileSync,mkdirSync,existsSync}=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const http=require('node:http');
const assert=require('node:assert/strict');
// Uses the Hermes Agent checkout's own dev dependencies (esbuild, React, React Query,
// Playwright); nothing is installed. Override with HERMES_AGENT_DIR if needed.
const hermesHome=process.env.HERMES_HOME||(process.platform==='win32'&&process.env.LOCALAPPDATA?path.join(process.env.LOCALAPPDATA,'hermes'):path.join(os.homedir(),'.hermes'));
const agentDir=process.env.HERMES_AGENT_DIR||path.join(hermesHome,'hermes-agent');
const root=[agentDir,path.join(agentDir,'apps','desktop')].find(dir=>{try{createRequire(path.join(dir,'package.json')).resolve('esbuild');createRequire(path.join(dir,'package.json')).resolve('react-dom/client');return true}catch{return false}});
if(!root)throw new Error('Hermes Agent dev dependencies not found. Set HERMES_AGENT_DIR to your hermes-agent checkout.');
const req=createRequire(path.join(root,'package.json'));
const esbuild=req('esbuild');
const {chromium}=(()=>{for(const name of ['playwright','@playwright/test','playwright-core']){try{return req(name)}catch{}}throw new Error('Playwright was not found in the Hermes Agent checkout.')})();
const pluginPath=process.env.USAGE_PLUGIN_PATH||path.join(__dirname,'..','desktop','plugin.js');
const scratch=process.env.USAGE_METER_ARTIFACTS||path.join(os.tmpdir(),'usage-meter-browser-test');
mkdirSync(scratch,{recursive:true});
const sdk=`
import {useSyncExternalStore} from 'react';
export {useQuery} from '@tanstack/react-query';
export function atom(value){const listeners=new Set();return {get:()=>value,set:v=>{value=v;for(const fn of listeners)fn()},subscribe:fn=>{listeners.add(fn);return ()=>listeners.delete(fn)}}}
export const control={calls:0,failNext:0,sessionUsed:30,weeklyUsed:10,sessionReset:new Date(Date.now()+2.5*3600000).toISOString()};
export const host={state:{focusedSessionId:atom(null),focusedSessionProfile:atom(undefined),profile:atom('default'),model:atom('test-codex'),focusedUsage:atom({input:100,output:20,total:120}),gateway:atom('connecting')},request:async()=>{
 control.calls++;await new Promise(r=>setTimeout(r,25));
 if(control.failNext){control.failNext--;throw new Error('TEST temporary network failure')}
 const model=host.state.model.get();const claude=model.includes('opus');const provider=claude?'anthropic':model.includes('gemini')?'gemini':model.includes('nvidia')?'nvidia':model.includes('zai')?'zai':model.includes('nous')?'nous':'openai-codex';
 const row={slug:provider};
  if(control.calls>1) {
   const windows=[{label:claude?'Current session':'Session',used_percent:control.sessionUsed,resets_at:control.sessionReset},{label:claude?'Current week':'Weekly',used_percent:control.weeklyUsed}];
   if(['anthropic','openai-codex'].includes(provider))row.usage=claude&&control.claudeMixed?{accounts:[{id:'claude-old',state:'unknown',windows:[]},{id:'claude-live',label:'Claude OAuth',state:'ready',windows}]}:control.accountId?{accounts:[{id:control.accountId,label:control.accountId,windows:control.noQuota?[]:windows}]}:{windows:control.noQuota?[]:windows}
  }
 return {provider,model:host.state.model.get(),providers:[row]}
}};
export function useValue(a){return useSyncExternalStore(a.subscribe,a.get,a.get)}
`;
const entry=`
import React from 'react';import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider,focusManager,onlineManager} from '@tanstack/react-query';
import {host,control} from '@hermes/plugin-sdk';import plugin from ${JSON.stringify(pluginPath)};
const contributions=[];const storage={get:(k,f)=>{try{return JSON.parse(localStorage.getItem('test-usage-'+k))??f}catch{return f}},set:(k,v)=>localStorage.setItem('test-usage-'+k,JSON.stringify(v))};plugin.register({register:row=>contributions.push(row),storage});
const client=new QueryClient();focusManager.setFocused(false);
const tree=contributions.find(c=>c.area==='statusBar.left').render();
createRoot(document.getElementById('root')).render(React.createElement(QueryClientProvider,{client},tree));
window.testControl={host,control,focusManager,onlineManager,client,contributions};
`;
(async()=>{
 const result=await esbuild.build({stdin:{contents:entry,resolveDir:root,loader:'js'},bundle:true,nodePaths:[path.join(root,'node_modules')],write:false,platform:'browser',format:'iife',plugins:[{name:'test-sdk',setup(build){build.onResolve({filter:/^@hermes\/plugin-sdk$/},()=>({path:'test-sdk',namespace:'test-sdk'}));build.onLoad({filter:/.*/,namespace:'test-sdk'},()=>({contents:sdk,loader:'js',resolveDir:root}))}}]});
 const js=result.outputFiles[0].text;
 const html='<!doctype html><html><head><style>:root{--ui-accent:var(--color-blue-500);--color-blue-500:#3b82f6;--color-green-400:#4ade80;--ui-text-quaternary:#777;--ui-text-primary:#eee;--ui-text-secondary:#b7bcc6;--ui-bg-elevated:#222;--ui-stroke-secondary:#444}body{margin:0;background:#181818}#root{display:contents}</style></head><body><div id="root"></div><div style="position:fixed;right:80px;bottom:8px;display:flex;gap:8px"><button aria-label="WhatsApp">WA</button><button aria-label="Telegram">TG</button></div><script src="/test.js"></script></body></html>';
 const server=http.createServer((request,response)=>{response.setHeader('Content-Type',request.url==='/test.js'?'text/javascript':'text/html');response.end(request.url==='/test.js'?js:html)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 // Prefer an explicit browser, then Playwright's own, then installed Edge/Chrome.
 const launches=[process.env.USAGE_METER_BROWSER&&existsSync(process.env.USAGE_METER_BROWSER)?{executablePath:process.env.USAGE_METER_BROWSER}:null,{},{channel:'msedge'},{channel:'chrome'}].filter(Boolean);
 let browser,lastLaunchError;
 try{
  for(const option of launches){try{browser=await chromium.launch({headless:true,...option});break}catch(error){lastLaunchError=error}}
  if(!browser)throw lastLaunchError;
  const page=await browser.newPage({viewport:{width:800,height:600},deviceScaleFactor:3});const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  let checks=0;const pass=label=>{checks++;console.log('PASS: '+label)};
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>!!window.testControl);
  await page.evaluate(()=>window.testControl.host.state.gateway.set('open'));
  const widget=page.locator('[data-usage-floating]'),scene=widget.locator('[data-bamboo-scene]');
  const waitS=value=>page.waitForFunction(v=>document.querySelector('[data-usage-floating]')?.getAttribute('data-session-remaining')===String(v),value,{timeout:10000});
  const state=()=>scene.getAttribute('data-cycle-state');
  const refetch=fn=>page.evaluate(async f=>{new Function('c',f)(window.testControl.control);await window.testControl.client.refetchQueries()},fn);
  const close=async()=>{if(await page.locator('#usage-meter-details').count())await page.locator('[aria-label="إغلاق التفاصيل"]').click()};
  const details=async()=>{await widget.dblclick();await page.locator('[data-usage-meter]').waitFor({state:'visible'})};
  await waitS(70);assert.equal(await widget.getAttribute('data-weekly-quota'),'90');
  assert.equal(await page.evaluate(()=>window.testControl.focusManager.isFocused()),false);pass('cold cache fills quota automatically in a background window');
  assert.equal(await page.evaluate(()=>window.testControl.contributions.some(c=>c.area==='panes')),false);
  assert.equal(await page.locator('[data-usage-dock]').count(),0);
  let box=await widget.boundingBox();assert.ok(box.width<=64&&box.height<=56);
  assert.equal(await widget.locator('[data-weekly-remaining]').count(),0);
  assert.equal(await widget.getAttribute('data-expanded'),'false');
  await widget.hover();assert.equal(await page.locator('#usage-meter-details').count(),0);
  pass('art-only figure is tiny, has no metric panel or legend, and hover never opens details');
  const channel=await page.locator('[aria-label="Telegram"]').boundingBox();
  assert.ok(!(box.x<channel.x+channel.width&&box.x+box.width>channel.x&&box.y<channel.y+channel.height&&box.y+box.height>channel.y));
  pass('default placement avoids the messaging button');
  const originalPosition=await widget.boundingBox();
  await page.evaluate(()=>{const r=document.querySelector('[data-usage-floating]').getBoundingClientRect(),el=document.createElement('div');el.id='native-preview-test';el.setAttribute('data-overlay-surface','');el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');Object.assign(el.style,{position:'fixed',inset:'0',zIndex:'50',background:'#292929'});el.onclick=()=>{window.nativePreviewClicked=true};window.nativePreviewCenter={x:r.x+r.width/2,y:r.y+r.height/2};document.body.append(el)});
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  assert.equal(await page.evaluate(()=>{const p=window.nativePreviewCenter;return document.elementFromPoint(p.x,p.y)?.id==='native-preview-test'}),true,'native preview must be above the widget');
  const nativeCenter=await page.evaluate(()=>window.nativePreviewCenter);await page.mouse.click(nativeCenter.x,nativeCenter.y);assert.equal(await page.evaluate(()=>window.nativePreviewClicked),true);
  await page.evaluate(()=>document.querySelector('#native-preview-test').remove());await widget.waitFor({state:'visible'});
  assert.deepEqual(await widget.boundingBox(),originalPosition);pass('native modal preview covers the widget and receives clicks; closing restores its position');
  await page.evaluate(()=>{const r=document.querySelector('[data-usage-floating]').getBoundingClientRect(),el=document.createElement('aside');el.id='inline-preview-test';Object.assign(el.style,{position:'fixed',left:r.x-3+'px',top:r.y-3+'px',width:r.width+6+'px',height:r.height+6+'px',background:'#252525'});document.body.append(el)});
  await page.waitForFunction(()=>document.querySelector('[data-usage-floating]')?.getAttribute('data-native-covered')==='true');
  assert.equal(await page.evaluate(()=>{const p=window.nativePreviewCenter;return document.elementFromPoint(p.x,p.y)?.id==='inline-preview-test'}),true);
  await page.evaluate(()=>document.querySelector('#inline-preview-test').hidden=true);await widget.waitFor({state:'visible'});
  await page.evaluate(()=>document.querySelector('#inline-preview-test').hidden=false);await page.waitForFunction(()=>document.querySelector('[data-usage-floating]')?.getAttribute('data-native-covered')==='true');
  await page.evaluate(()=>document.querySelector('#inline-preview-test').remove());await widget.waitFor({state:'visible'});
  assert.deepEqual(await widget.boundingBox(),originalPosition);pass('inline file pane also occludes the widget, including hide/show transitions, without moving it');

  assert.equal(await scene.getAttribute('data-material'),'glass-bamboo');assert.equal(await scene.getAttribute('data-physical-angle'),'45');
  assert.equal(await scene.locator('[data-glass-bamboo-node]').count(),2);
  const align=await scene.evaluate(svg=>{const r=svg.querySelector('[data-bamboo-receiver]'),c=svg.querySelector('[data-fluid-cavity]'),matrix=svg.getCTM().inverse().multiply(r.getCTM()),p=new DOMPoint(148,120).matrixTransform(matrix);return {glass:[p.x,p.y],fluid:[c.points.getItem(0).x,c.points.getItem(0).y],matrix:[matrix.a,matrix.b,matrix.c,matrix.d,matrix.e,matrix.f]}});
  assert.ok(Math.hypot(align.glass[0]-align.fluid[0],align.glass[1]-align.fluid[1])<.001,JSON.stringify(align));
  assert.ok(Math.abs(Math.hypot(align.matrix[0],align.matrix[1])-.44)<.00001,'actual glass transform must grow10percent to44percent of original');
  const proportions=await scene.evaluate(svg=>{const w=svg.querySelector('[data-bamboo-reservoir="W"]>path'),rock=svg.querySelector('[data-rock-body]'),inlet=svg.querySelector('[data-bamboo-inflow]'),cavity=svg.querySelector('[data-fluid-cavity]');const start=inlet.getPointAtLength(0),end=inlet.getPointAtLength(inlet.getTotalLength()),fall=[];for(let l=inlet.getTotalLength()*.15;l<inlet.getTotalLength()*.95;l+=2){const p=inlet.getPointAtLength(l);fall.push(rock.isPointInFill(new DOMPoint(p.x,p.y)))}const b=w.getBBox();return{outletInsideW:w.isPointInFill(new DOMPoint(start.x,start.y)),entryInsideGlass:cavity.isPointInFill(end),fallHitsRock:fall.some(Boolean),wCentreInRock:rock.isPointInFill(new DOMPoint(b.x+b.width/2,b.y+4)),wBottom:b.y+b.height}});
  assert.equal(proportions.outletInsideW,true,JSON.stringify(proportions));assert.equal(proportions.entryInsideGlass,true);assert.equal(proportions.fallHitsRock,false);assert.equal(proportions.wCentreInRock,true);assert.ok(proportions.wBottom<112);
  pass('W watercourse is carved in the rock and its top-left lip falls clear of the stone into the bamboo');
  const sessionBox=await scene.locator('[data-bamboo-reservoir="S"]>path').first().evaluate(n=>{const b=n.getBBox();return {top:b.y,bottom:b.y+b.height,height:b.height,inlet:n.isPointInFill(new DOMPoint(158,151)),end:n.isPointInFill(new DOMPoint(120.5,242))}});
  assert.equal(await scene.getAttribute('data-session-shape'),'s-watercourse');assert.ok(sessionBox.top<170&&sessionBox.bottom>245&&sessionBox.bottom<251&&sessionBox.height>80,JSON.stringify(sessionBox));assert.equal(sessionBox.inlet,true);assert.equal(sessionBox.end,true);
  const river=scene.locator('[data-session-channel]');const ends=await river.evaluate(n=>{const a=n.getPointAtLength(0),b=n.getPointAtLength(n.getTotalLength());return {a:[a.x,a.y],b:[b.x,b.y]}});assert.ok(ends.a[1]<175&&ends.b[1]>235);
  pass('S is one long watercourse from below the glass bamboo to its existing lower position');
  assert.equal(await scene.getAttribute('data-colour-style'),'apple-reference-v10');
  assert.match(await scene.locator('[data-fluid-glow="W"]').evaluate(e=>getComputedStyle(e).filter),/url/);
  const siriBefore=await scene.locator('[data-siri-gradient]').getAttribute('gradientTransform');await page.waitForTimeout(180);
  assert.notEqual(await scene.locator('[data-siri-gradient]').getAttribute('gradientTransform'),siriBefore);
  const siriColours=await scene.locator('[data-siri-gradient] stop').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).stopColor));assert.ok(siriColours.includes('rgb(8, 123, 255)'));assert.ok(siriColours.includes('rgb(233, 30, 154)'));
  pass('reference-image electric blue/purple/fuchsia palette has coloured bloom and a live shared gradient');


  const levels=await scene.evaluate(svg=>{const out={};for(const name of ['W','S']){const body=svg.querySelector(`[data-bamboo-reservoir="${name}"]>path`),water=svg.querySelector(`[data-fluid-liquid="${name}"]`),b=body.getBBox(),p=svg.createSVGPoint();let total=0,wet=0;for(let x=b.x+.3;x<b.x+b.width;x+=.6)for(let y=b.y+.3;y<b.y+b.height;y+=.6){p.x=x;p.y=y;if(body.isPointInFill(p)){total++;if(water.isPointInFill(p))wet++}}out[name]=wet/total}return out});
  assert.ok(Math.abs(levels.W-.9)<.015,JSON.stringify(levels));assert.ok(Math.abs(levels.S-.7)<.015,JSON.stringify(levels));
  pass('actual SVG fill area matches independent W/S quota, including tiny64px view');
  const drain=await scene.evaluate(svg=>{const at=(n,f)=>{const p=n.getPointAtLength(n.getTotalLength()*f);return new DOMPoint(p.x,p.y)},w=svg.querySelector('[data-fluid-liquid="W"]'),s=svg.querySelector('[data-fluid-liquid="S"]'),wc=svg.querySelector('[data-weekly-current]'),sc=svg.querySelector('[data-session-channel]');
   return {wOutlet:w.isPointInFill(at(wc,.02)),wSpring:w.isPointInFill(at(wc,.98)),sEnd:s.isPointInFill(at(sc,.98)),sInlet:s.isPointInFill(at(sc,.02)),camera:svg.getAttribute('data-camera'),rockOnGround:svg.querySelector('[data-ground-plane]').isPointInFill(new DOMPoint(250,116))}});
  assert.deepEqual(drain,{wOutlet:true,wSpring:false,sEnd:true,sInlet:false,camera:'oblique-45',rockOnGround:true});
  pass('45-degree scene: W stays wet at its outlet and dries from the spring; S stays wet downstream and dries from the inlet');
  const waveBefore=await scene.locator('[data-fluid-liquid]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('d')));await page.waitForTimeout(180);
  const waveAfter=await scene.locator('[data-fluid-liquid]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('d')));for(let i=0;i<3;i++)assert.notEqual(waveBefore[i],waveAfter[i]);
  const currentBefore=await scene.locator('[data-session-current]').getAttribute('stroke-dashoffset');await page.waitForTimeout(180);assert.notEqual(await scene.locator('[data-session-current]').getAttribute('stroke-dashoffset'),currentBefore);
  assert.equal(await scene.evaluate(svg=>svg.querySelector('[data-session-flow-clip]').getAttribute('d')===svg.querySelector('[data-fluid-liquid="S"]').getAttribute('d')),true);
  pass('downstream river ripples move only within the actual quota-filled part of S');
  const garden=await scene.evaluate(svg=>({sway:document.getAnimations().filter(a=>a.animationName==='usage-grass-sway').length,grass:svg.querySelectorAll('[data-grass]').length,stones:svg.querySelectorAll('[data-stone]').length,butterflies:[...svg.querySelectorAll('[data-butterfly]')].map(n=>({state:n.getAttribute('data-butterfly-state'),opacity:+n.style.opacity,transform:n.getAttribute('transform')}))}));
  assert.ok(garden.sway>=garden.grass&&garden.grass>=6&&garden.stones>=5,JSON.stringify(garden));assert.equal(garden.butterflies.length,2);
  for(const b of garden.butterflies)assert.ok(b.state==='away'?b.opacity===0:b.opacity>0&&/translate/.test(b.transform),JSON.stringify(b));
  pass('grass sways in the wind and butterflies are driven by the shared animation clock');
  await widget.screenshot({path:path.join(scratch,'glass-tiny-retina.png')});
  pass('all three containers have live gravity-aligned waves and transparent nodal bamboo45deg');
  await page.mouse.move(box.x+10,box.y+10);await page.mouse.down();await page.mouse.move(box.x+130,box.y-120,{steps:8});await page.mouse.up();
  let dragged=await widget.boundingBox();assert.ok(Math.abs(dragged.x-box.x)>50||Math.abs(dragged.y-box.y)>50);
  pass('pointer drag actually changes the figure position');
  let handle=await widget.locator('[data-usage-resize]').boundingBox();
  await page.mouse.move(handle.x+7,handle.y+7);await page.mouse.down();await page.mouse.move(handle.x+97,handle.y+81,{steps:8});await page.mouse.up();
  const resized=await widget.boundingBox();assert.ok(resized.width>dragged.width+60&&resized.height>dragged.height+50);
  pass('corner drag actually resizes the drawing');
  await page.reload();await page.waitForFunction(()=>!!window.testControl);await page.evaluate(()=>window.testControl.host.state.gateway.set('open'));await waitS(70);
  box=await widget.boundingBox();for(const k of ['x','y','width','height'])assert.ok(Math.abs(box[k]-resized[k])<1);
  pass('position and size survive a fresh renderer reload');
  await page.mouse.move(5,5);await widget.screenshot({path:path.join(scratch,'floating-art-retina.png')});
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelector('[data-usage-floating] [data-bamboo-scene]')?.getAttribute('data-fluid-motion')==='reduced');
  assert.equal(await widget.locator('[data-bamboo-receiver]').evaluate(e=>getComputedStyle(e).animationName),'none');
  assert.equal(await widget.locator('[data-bamboo-flow]').evaluate(e=>getComputedStyle(e).animationName),'none');
  const frozen=await scene.locator('[data-fluid-surface="S"]').getAttribute('d'),frozenGradient=await scene.locator('[data-siri-gradient]').getAttribute('gradientTransform'),frozenCurrent=await scene.locator('[data-session-current]').getAttribute('stroke-dashoffset');await page.waitForTimeout(180);assert.equal(await scene.locator('[data-fluid-surface="S"]').getAttribute('d'),frozen);assert.equal(await scene.locator('[data-siri-gradient]').getAttribute('gradientTransform'),frozenGradient);assert.equal(await scene.locator('[data-session-current]').getAttribute('stroke-dashoffset'),frozenCurrent);assert.equal(await scene.locator('[data-butterfly-state="away"]').count(),2);
  await page.emulateMedia({reducedMotion:'no-preference'});pass('reduced-motion disables decorative, wave and renewal animations');
  await details();await close();pass('details appear only on explicit double click and close normally');
  await page.evaluate(()=>window.testControl.focusManager.setFocused(true));await page.waitForTimeout(100);
  const before=await page.evaluate(()=>window.testControl.control.calls);
  await page.evaluate(()=>{window.testControl.onlineManager.setOnline(false);window.testControl.control.failNext=1;window.testControl.onlineManager.setOnline(true)});
  await page.waitForFunction(p=>window.testControl.control.calls>=p+2,before,{timeout:6000});await waitS(70);
  pass('reconnect recovers from transient failures without losing quota');
  await page.evaluate(()=>window.testControl.host.state.model.set('test-claude-opus'));await waitS(70);await page.waitForTimeout(150);
  pass('model switching refreshes the quota source without reload');
  await refetch('c.sessionUsed=100');await waitS(0);
  assert.equal(await scene.locator('[data-bamboo-receiver]').getAttribute('data-tipped'),'false');
  assert.ok(Number(await scene.locator('[data-bamboo-level="cycle"]').getAttribute('data-liquid-volume'))>0);
  pass('exhausting S never empties or tips the separate buffer');
  await refetch('c.sessionReset=new Date(Date.now()-1000).toISOString()');
  await page.waitForFunction(()=>document.querySelector('[data-usage-floating] [data-bamboo-scene]')?.getAttribute('data-cycle-state')==='awaiting');
  assert.equal(await widget.getAttribute('data-session-remaining'),'0');
  assert.equal(await scene.locator('[data-bamboo-receiver]').getAttribute('data-tipped'),'false');
  await refetch('c.sessionUsed=99');await waitS(1);assert.equal(await state(),'awaiting');assert.equal(await scene.locator('[data-bamboo-receiver]').getAttribute('data-tipped'),'false');
  await refetch('c.sessionUsed=100');await waitS(0);pass('upward quota correction with the same expired deadline never fabricates renewal');
  await page.mouse.move(5,5);await widget.screenshot({path:path.join(scratch,'bamboo-cycle-00.png')});
  await page.evaluate(()=>{window.fluidSamples=[];const end=performance.now()+2600;const sample=()=>{const s=document.querySelector('[data-usage-floating] [data-bamboo-scene]');if(s)window.fluidSamples.push({state:s.dataset.cycleState,s:Number(s.querySelector('[data-fluid-liquid="S"]').dataset.visualFraction),buffer:Number(s.querySelector('[data-fluid-liquid="cycle"]').dataset.visualFraction),jet:Number(s.querySelector('[data-bamboo-pour]').style.opacity),angle:Number(s.dataset.physicalAngle)});if(performance.now()<end)requestAnimationFrame(sample)};requestAnimationFrame(sample)});
  await refetch('c.sessionUsed=0;c.sessionReset=new Date(Date.now()+5*3600000).toISOString()');
  await page.waitForFunction(()=>document.querySelector('[data-usage-floating] [data-bamboo-scene]')?.getAttribute('data-cycle-state')==='dumping');
  await page.waitForTimeout(350);await details();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const phases=await page.evaluate(()=>['[data-usage-floating] [data-bamboo-receiver]','#usage-meter-details [data-bamboo-receiver]'].map(s=>new DOMMatrixReadOnly(getComputedStyle(document.querySelector(s)).transform).b));
  assert.ok(Math.abs(phases[0]-phases[1])<.02);pass('floating figure and late-opened details share the exact animation timeline');
  await close();await page.mouse.move(5,5);
  let didTip=false,didDrain=false;
  for(let i=1;i<=8;i++){
   const motion=await scene.evaluate(e=>{const p=getComputedStyle(e.querySelector('[data-bamboo-receiver]')).transform,w=Number(e.querySelector('[data-bamboo-level="cycle"]').getAttribute('data-visual-fraction'));return {tilt:p==='none'?0:new DOMMatrixReadOnly(p).b,scale:w}});
   didTip ||= motion.tilt<-.1;didDrain ||= motion.scale<.95;
   await widget.screenshot({path:path.join(scratch,'bamboo-cycle-'+String(i).padStart(2,'0')+'.png')});await page.waitForTimeout(100)
  }
  assert.equal(didTip,true);assert.equal(didDrain,true);
  await page.waitForFunction(()=>document.querySelector('[data-usage-floating] [data-bamboo-scene]')?.getAttribute('data-cycle-state')==='filling');
  await widget.screenshot({path:path.join(scratch,'bamboo-cycle-09.png')});
  pass('provider-confirmed renewal tips, drains, pours and returns; clock expiry alone never refills quota');
  const samples=await page.evaluate(()=>window.fluidSamples.filter(s=>s.state==='dumping'));
  assert.ok(samples.some(s=>s.s>.02&&s.s<.98),'S must visibly refill through intermediate fractions');
  assert.ok(samples.some(s=>s.jet>.1&&s.s<.98),'cohesive jet must connect while S fills');
  assert.ok(samples.some(s=>s.buffer<.02&&s.s>.98),'buffer drains fully as S reaches actual target');
  for(let i=1;i<samples.length;i++)assert.ok(samples[i].s>=samples[i-1].s-.00001,'S refill must not jump backwards');
  pass('cohesive moving-lip liquid pour and rapid progressive S refill conserve transfer');
  await refetch("Object.assign(c,{accountId:'A',sessionUsed:100,sessionReset:new Date(Date.now()-1000).toISOString()})");
  await page.waitForFunction(()=>document.querySelector('[data-usage-floating] [data-bamboo-scene]')?.getAttribute('data-cycle-state')==='awaiting');
  await refetch("Object.assign(c,{accountId:'B',sessionUsed:0,sessionReset:new Date(Date.now()+5*3600000).toISOString()})");await page.waitForTimeout(100);
  assert.equal(await state(),'filling');pass('switching account never fabricates a renewal');
  await refetch('c.sessionUsed=100;c.sessionReset=new Date(Date.now()-1000).toISOString()');
  await page.waitForFunction(()=>document.querySelector('[data-usage-floating] [data-bamboo-scene]')?.getAttribute('data-cycle-state')==='awaiting');
  await refetch('c.noQuota=true');await page.waitForFunction(()=>document.querySelector('[data-usage-floating] [data-bamboo-scene]')?.getAttribute('data-cycle-state')==='unknown');
  await refetch('c.noQuota=false;c.sessionUsed=0;c.sessionReset=new Date(Date.now()+5*3600000).toISOString()');
  await page.waitForFunction(()=>document.querySelector('[data-usage-floating] [data-bamboo-scene]')?.getAttribute('data-cycle-state')==='dumping');
  pass('temporary missing quota preserves the last complete renewal reading');
  await page.evaluate(()=>window.testControl.host.state.focusedSessionId.set('other-session'));
  await page.waitForFunction(()=>document.querySelector('[data-usage-floating] [data-bamboo-scene]')?.getAttribute('data-cycle-state')==='filling');
  await page.evaluate(()=>window.testControl.host.state.focusedSessionId.set(null));await page.waitForTimeout(120);
  assert.notEqual(await state(),'dumping');pass('returning to a session never replays its old pour');
  await refetch('c.weeklyUsed=63');await page.waitForFunction(()=>document.querySelector('[data-usage-floating]')?.getAttribute('data-weekly-quota')==='37');
  assert.equal(await widget.getAttribute('data-session-remaining'),'100');pass('W remains actual weekly quota independent from S and buffer time');
  await refetch('c.claudeMixed=true;c.sessionUsed=15;c.weeklyUsed=86');await waitS(85);
  assert.equal(await widget.getAttribute('data-weekly-quota'),'14');
  await details();await page.locator('[aria-label="حساب مصدر بيانات الحصة"]').selectOption('claude-old');
  await page.waitForFunction(()=>document.querySelector('[data-usage-floating]')?.getAttribute('data-session-remaining')===null);
  await page.locator('[aria-label="حساب مصدر بيانات الحصة"]').selectOption('');await waitS(85);await close();
  pass('Claude mixed-credential data resolves the reporting account and honors explicit source selection');
  for(const provider of ['gemini','nvidia','zai','nous']){
   await page.evaluate(p=>{window.testControl.host.state.model.set('test-'+p);window.testControl.host.state.focusedUsage.set({input:123,output:198,total:321})},provider);
   await page.waitForFunction(p=>document.querySelector('[data-usage-floating]')?.getAttribute('data-provider')===p,provider);
   assert.equal(await widget.getAttribute('data-token-total'),'321');assert.equal(await widget.getAttribute('data-weekly-quota'),null)
  }
  pass('all configured providers retain session tokens while unsupported subscription quotas stay unknown');
  await page.setViewportSize({width:480,height:420});
  await page.waitForFunction(()=>{const r=document.querySelector('[data-usage-floating]')?.getBoundingClientRect();return r&&r.right<=window.innerWidth&&r.bottom<=window.innerHeight},{},{timeout:3000});
  box=await widget.boundingBox();assert.ok(box.x+box.width<=480&&box.y+box.height<=420,JSON.stringify({box,viewport:await page.evaluate(()=>({w:innerWidth,h:innerHeight}))}));
  pass('viewport shrink keeps the floating drawing on screen');
  await page.evaluate(()=>window.testControl.host.state.model.set('test-codex'));
  await refetch('c.sessionUsed=100;c.sessionReset=new Date(Date.now()-1000).toISOString()');await waitS(0);
  await page.waitForFunction(()=>document.querySelector('[data-usage-floating] [data-bamboo-scene]')?.dataset.cycleState==='awaiting');
  await page.evaluate(()=>Object.defineProperty(document.timeline,'currentTime',{configurable:true,get:()=>null}));
  await refetch('c.sessionUsed=15;c.sessionReset=new Date(Date.now()+5*3600000).toISOString()');await waitS(85);
  await page.waitForFunction(()=>{const n=document.querySelector('[data-usage-floating] [data-fluid-liquid="S"]');const p=Number(n?.dataset.visualFraction);return p>.01&&p<.84},{},{timeout:1800});
  await page.waitForFunction(()=>document.querySelector('[data-usage-floating] [data-bamboo-scene]')?.dataset.cycleState==='filling');
  assert.ok(Math.abs(Number(await scene.locator('[data-fluid-liquid="S"]').getAttribute('data-visual-fraction'))-.85)<.00001);
  await page.evaluate(()=>delete document.timeline.currentTime);pass('missing DocumentTimeline start uses shared wall clock and visibly refills to actual85percent');
  assert.deepEqual(errors,[]);pass('zero browser errors across cold start, drag, resize, model changes and provider renewal');
  writeFileSync(path.join(scratch,'result.json'),JSON.stringify({passed:checks,browserErrors:errors,pluginPath,testFixtures:true},null,2)); }finally{await browser?.close();await new Promise(r=>server.close(r))}
})().catch(error=>{console.error(error);process.exitCode=1});
