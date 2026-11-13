import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
function load(overrides = {}) {
 const source = readFileSync(process.env.USAGE_PLUGIN_PATH || new URL('../desktop/plugin.js', import.meta.url), 'utf8').replace(/^import .*$/gm, '').replace('export default', 'globalThis.plugin =');
 const box = { console, Date, Intl, Number, Math, host: {state:{}}, useValue: x=>x?.get?x.get():x, atom:v=>({get:()=>v,set:n=>{v=n}}), useMemo:f=>f(), useQuery:()=>({}), useState:v=>[typeof v==='function'?v():v,()=>{}], useEffect:()=>{}, useLayoutEffect:()=>{}, useId:()=>"test-bamboo", useRef:v=>({current:v}), jsx:(type,props)=>({type,props}), jsxs:(type,props)=>({type,props}) };
 Object.assign(box, overrides); vm.createContext(box); vm.runInContext(source, box); return box;
}
function paneFrom(b){const source=b.useUsageData();return b.UsagePane({snapshot:{...source,cycle:b.useQuotaCycle(source.provider,source.cycleKey)}})}
test('percentage is never inferred from token counts or missing quota', ()=> {
 const box = load();
 assert.equal(box.remaining({used_percent:23}), 77);
 assert.equal(box.remaining({}), null);
 assert.equal(box.remaining({used_percent:null}), null);
 assert.equal(box.remaining({used_percent:120}), 0);
 assert.equal(box.remaining({used_percent:'23'}), null);
});
test('widget no longer registers a large bottom pane', ()=> {
 const rows=[]; load().plugin.register({register:r=>rows.push(r)});
 assert.ok(rows.some(r=>r.area==='statusBar.left' && typeof r.render==='function'));
 assert.ok(!rows.some(r=>r.area==='panes'));
});
test('floating art is small and never opens text details merely on hover',()=>{
 const b=load(); const tree=b.UsageCorner();
 assert.equal(tree.props['data-usage-floating'],true);assert.equal(tree.props.style.position,'fixed');
 assert.ok(tree.props.style.width<=64);assert.ok(tree.props.style.height<=56);
 assert.equal(tree.props['data-expanded'],false);assert.equal(typeof tree.props.onPointerMove,'function');
 assert.ok(tree.props.style.zIndex<=2,'widget must stay in the base app layer, below native previews');
 assert.ok(tree.props.children.some(n=>n?.props?.['data-usage-resize']));
 assert.equal(tree.props.children[0].props.children.props.artOnly,true);
});
test('floating position and size are clamped to the viewport and corrupt storage is harmless',()=>{
 const b=load();const r=b.clampFloatingRect({x:9999,y:-999,width:9999,height:NaN},{width:800,height:600});
 assert.ok(r.width<=360);assert.ok(r.height>=40);assert.ok(r.x+r.width<=800);assert.ok(r.y>=36);
});
test('gauge uses only Session quota and never falls back to Weekly', ()=> {
 const b=load();
 assert.equal(b.gaugeRemaining({usage:{windows:[{label:'Session',used_percent:0}]}}),100);
 assert.equal(b.gaugeRemaining({usage:{windows:[{label:'Session',used_percent:100}]}}),0);
 assert.equal(b.gaugeRemaining({usage:{windows:[{label:'Weekly',used_percent:80},{label:'Session',used_percent:0}]}}),100);
 assert.equal(b.gaugeRemaining({usage:{windows:[{label:'Weekly',used_percent:80}]}}),null);
 assert.equal(b.gaugeRemaining({usage:{windows:[{label:'5h',used_percent:20},{label:'Weekly',used_percent:80}]}}),80);
 assert.equal(b.gaugeRemaining({}),null);
 assert.equal(b.gaugeRemaining({usage:{accounts:[{windows:[{used_percent:5}]},{windows:[{used_percent:90}]}]}}),null);
});
test('floating metadata still reflects independent real S and W quota without visible metric rows',()=>{
 const host={state:{focusedSessionId:'s1',focusedSessionProfile:'default',profile:'default',model:'m',gateway:'open'}};
 const b=load({host,useQuery:()=>({data:{provider:'p',providers:[{slug:'p',usage:{windows:[{label:'Session',used_percent:0},{label:'Weekly',used_percent:60}]}}]}})});
 const tree=b.UsageCorner();assert.equal(tree.props['data-session-remaining'],100);assert.equal(tree.props['data-weekly-quota'],40);
 assert.equal(tree.props['data-expanded'],false);
});
test('weekly gauge never uses Session when weekly quota is missing', ()=> {
 const b=load();
 assert.equal(b.gaugeRemaining({usage:{windows:[{label:'Session',used_percent:50}]}},'weekly'),null);
 assert.equal(b.gaugeRemaining({usage:{windows:[{label:'Session',used_percent:100},{label:'Weekly',used_percent:0}]}},'weekly'),100);
 assert.equal(b.gaugeRemaining({usage:{windows:[{label:'Weekly',used_percent:100}]}},'weekly'),0);
});
test('Claude native Current session and Current week labels are recognized', ()=> {
 const b=load(); const p={usage:{windows:[{label:'Current session',used_percent:12},{label:'Current week',used_percent:25},{label:'Opus week',scope:'model',used_percent:60}]}};
 assert.equal(b.gaugeRemaining(p),88);
 assert.equal(b.gaugeRemaining(p,'weekly'),75);
 assert.equal(b.gaugeRemaining(p,'weekly','claude-opus-4-6'),40);
 assert.equal(b.gaugeRemaining(p,'weekly','claude-sonnet-4-6'),75);
});
test('Claude resolves the only credential with actual quota and identifies its source without averaging',()=>{
 const b=load();const p={slug:'anthropic',usage:{accounts:[{id:'old',state:'unknown',windows:[]},{id:'live',state:'ready',windows:[{label:'Current session',used_percent:15},{label:'Current week',used_percent:86}]}]}};
 const r=b.resolveQuotaProvider(p);
 assert.equal(b.gaugeRemaining(r),85);assert.equal(b.gaugeRemaining(r,'weekly'),14);
 assert.equal(r.quota_selection.id,'live');assert.equal(r.quota_selection.reason,'only-reporting');
 p.usage.accounts[0].windows=[{label:'Current session',used_percent:99},{label:'Current week',used_percent:99}];
 assert.equal(b.gaugeRemaining(b.resolveQuotaProvider(p)),null);
 assert.equal(b.gaugeRemaining(b.resolveQuotaProvider(p,'old')),1);
 assert.equal(p.usage.accounts.length,2);
});
test('unsupported quota remains unknown but all providers retain live session tokens',()=>{
 const b=load();for(const slug of ['gemini','nous','nvidia','zai','custom']){
  assert.equal(b.gaugeRemaining(b.resolveQuotaProvider({slug})),null);
  assert.equal(b.cycleState(null,slug,Date.now()).progress,null);
 }
});
test('Gemini quota absence is explained rather than fabricated', ()=> {
 const host={state:{focusedSessionId:'s1',focusedSessionProfile:'default',profile:'default',model:'gemini-pro',gateway:'open',focusedUsage:{input:100,output:20,total:120}}};
 const b=load({host,useQuery:()=>({data:{provider:'gemini',model:'gemini-pro',providers:[{slug:'gemini'}]}})});
 assert.equal(b.gaugeRemaining({slug:'gemini'}),null);
 const text=JSON.stringify(paneFrom(b));
 assert.match(text,/120/); assert.match(text,/تكامل Gemini/);
});
test('art-only mode hides percentage and explanatory captions without changing reservoir values',()=>{
 const b=load(); const scene=b.bambooScene(50,37,'art-only',true,{progress:.5,phase:'filling',artOnly:true});
 const json=JSON.stringify(scene);assert.ok(!json.includes('37%'));assert.ok(!json.includes('متبقٍ أسبوعيًا'));
 assert.ok(json.includes('usage-aurora-reservoir'));assert.ok(json.includes('data-reservoir-remaining'));
});
test('buffer bamboo tracks time independently from W and S and only tips on confirmed renewal', ()=> {
 const b=load(); const cycle={progress:.75,phase:'filling',dumping:false};
 const m=b.bambooMetrics(0,40,cycle);
 assert.equal(m.bambooLevel,.75); assert.equal(m.sessionLevel,0); assert.equal(m.weeklyLevel,40);
 assert.equal(m.flowing,true); assert.equal(m.tipped,false);
 assert.equal(b.bambooMetrics(100,40,{...cycle,progress:1,phase:'awaiting'}).tipped,false);
 assert.equal(b.bambooMetrics(100,40,{...cycle,progress:1,dumping:true}).tipped,true);
 assert.equal(b.bambooMetrics(null,null,{progress:null}).bambooLevel,null);
 const scene=b.bambooScene(100,50,'test',true,cycle);
 assert.equal(scene.props['data-flow-from'],'W'); assert.equal(scene.props['data-flow-via'],'cycle');
 assert.equal(scene.props['data-flow-to'],'S'); assert.equal(scene.props['data-source-pipe'],'none');
 assert.equal(scene.props['data-outlet-position'],'bottom');
 const json=JSON.stringify(scene);
 assert.match(json,/bevel-upper-shorter/); assert.match(json,/usage-aurora-reservoir/);
});
test('buffer fill comes from the provider reset deadline, not app uptime or tokens', ()=> {
 const b=load(); const end=Date.parse('2026-10-25T15:00:00Z');
 const w={label:'Session',used_percent:100,resets_at:new Date(end).toISOString()};
 const a=b.cycleState(w,'openai-codex',end-2.5*3600000);
 assert.equal(a.progress,.5); assert.equal(a.phase,'filling');
 const waiting=b.cycleState(w,'openai-codex',end+1);
 assert.equal(waiting.progress,1); assert.equal(waiting.phase,'awaiting');
 assert.equal(b.cycleState({},'openai-codex',end).progress,null);
 assert.equal(b.cycleState(w,'unknown-provider',end).progress,null);
 assert.equal(b.cycleState({...w,duration_seconds:4*3600},'unknown-provider',end-3600000).progress,.75);
 const p={usage:{windows:[w,{label:'Weekly',resets_at:'2030-01-01T00:00:00Z'}]}};
 assert.equal(b.sessionQuotaWindow(p),w);
 assert.equal(b.sessionQuotaWindow({usage:{accounts:[{windows:[w]},{windows:[w]}]}}),null);
});
test('clock expiry never fabricates a refill and changing accounts/models never dumps the buffer', ()=> {
 const b=load(); const prev={key:'a',resetMs:1000,left:0};
 assert.equal(b.confirmedCycleRenewal(prev,{key:'a',resetMs:1000,left:0},2000),false);
 assert.equal(b.confirmedCycleRenewal(prev,{key:'a',resetMs:20000,left:100},2000),true);
 assert.equal(b.confirmedCycleRenewal(prev,{key:'b',resetMs:20000,left:100},2000),false);
 assert.equal(b.confirmedCycleRenewal(null,{key:'a',resetMs:20000,left:100},2000),false);
 assert.equal(b.confirmedCycleRenewal(prev,{key:'a',resetMs:20000,left:100},900),false);
 assert.equal(b.confirmedCycleRenewal(prev,{key:'a',resetMs:null,left:100},2000),false);
 assert.equal(b.confirmedCycleRenewal({...prev,left:12},{key:'a',resetMs:1000,left:13},2000),false);
});
test('known account identity prevents interpreting another account as quota renewal',()=>{
 const b=load(); const previous={key:'same-context',account:'A',resetMs:1000,left:0};
 assert.equal(b.confirmedCycleRenewal(previous,{key:'same-context',account:'B',resetMs:20000,left:100},2000),false);
 assert.equal(b.confirmedCycleRenewal(previous,{key:'same-context',account:'A',resetMs:20000,left:100},2000),true);
});
test('bamboo rests mouth-up, pivots at its middle, and W shows actual weekly percent',()=>{
 const b=load(); const scene=b.bambooScene(0,37,'geometry-test',true,{progress:.5,phase:'filling',dumping:false});
 const nodes=[]; const visit=n=>{if(!n||typeof n!=='object')return;nodes.push(n);const c=n.props?.children;for(const x of Array.isArray(c)?c:[c])visit(x)};visit(scene);
 const receiver=nodes.find(n=>n.props?.['data-bamboo-receiver']);
 assert.equal(receiver.props.style.transform,'rotate(45deg) scale(0.44)');
 assert.equal(receiver.props.style.transformOrigin,'191px 136px');
 const weekly=nodes.find(n=>n.props?.['data-weekly-remaining']!==undefined);
 assert.equal(weekly.props['data-weekly-remaining'],37);assert.equal(weekly.props.children,'37%');
});
test('all fountain views use the exact same document-timeline start, not mount time',()=>{
 const b=load();const rows=[{animationName:'usage-liquid-color',startTime:null}];
 b.syncFountainAnimations({getAnimations:()=>rows},{});assert.equal(rows[0].startTime,0);
 const cycle={dumping:true,animationStart:1234.5,refillFrom:0,progress:0};
 const compact=b.fluidFrame(85,14,cycle,1700,0),lateDetails=b.fluidFrame(85,14,cycle,1700,0);
 assert.equal(compact.angle,lateDetails.angle);assert.equal(compact.S.fraction,lateDetails.S.fraction);assert.equal(compact.bamboo.volume,lateDetails.bamboo.volume);
});
test('cold provider cache automatically gets a fast follow-up without manual reload', ()=> {
 const b=load();
 const cold={state:{data:{provider:'openai-codex',providers:[{slug:'openai-codex'}]},dataUpdateCount:1}};
 assert.equal(b.quotaRefreshInterval(cold),5000);
 cold.state.dataUpdateCount=8;
 assert.equal(b.quotaRefreshInterval(cold),30000);
 const warm={state:{data:{provider:'openai-codex',providers:[{slug:'openai-codex',usage:{windows:[{label:'Session',used_percent:12}]}}]}}};
 assert.equal(b.quotaRefreshInterval(warm),60000);
 warm.state.data.providers[0].usage.windows[0].resets_at=new Date(Date.now()+30000).toISOString();
 assert.equal(b.quotaRefreshInterval(warm),5000);
 warm.state.data.providers[0].usage.windows[0].resets_at=new Date(Date.now()-30000).toISOString();
 assert.equal(b.quotaRefreshInterval(warm),5000);
 assert.equal(b.quotaRefreshInterval({state:{data:{provider:'gemini',providers:[{slug:'gemini'}]}}}),60000);
});
test('quota refresh survives background windows and connection failures', ()=> {
 let opts;
 const host={state:{focusedSessionId:'s1',focusedSessionProfile:'default',profile:'default',gateway:'open'}};
 const b=load({host,useQuery:o=>{opts=o;return {}}});
 b.useUsageData();
 assert.equal(opts.enabled,true);
 assert.equal(opts.refetchIntervalInBackground,true);
 assert.equal(opts.refetchOnReconnect,'always');
 assert.equal(opts.refetchOnWindowFocus,'always');
 assert.equal(opts.refetchOnMount,'always');
 assert.ok(opts.retry>=3);
 assert.ok(typeof opts.refetchInterval==='function');
});
test('startup profile resolution falls back to gateway profile until focus is resolved', ()=> {
 let opts;
 const host={state:{focusedSessionId:null,profile:'default',gateway:'open'}};
 const b=load({host,useQuery:o=>{opts=o;return {}}}); b.useUsageData();
 assert.equal(opts.enabled,true);
});
test('countdown handles exact reset, expired reset and missing time', ()=> {
 const b=load(); const now=Date.parse('2026-10-20T10:00:00Z');
 assert.match(b.countdown('2026-10-20T15:00:00Z',now), /5.*0/);
 assert.match(b.countdown('2026-10-19T15:00:00Z',now), /تحديث/);
 assert.equal(b.countdown(null,now), 'موعد غير متاح');
});
test('pane follows session and renders both tokens and provider quota', ()=> {
 const calls=[];
 const host={state:{focusedSessionId:'s1',focusedSessionProfile:'default',profile:'default',model:'my-model',focusedUsage:{input:100,output:50,total:150},gateway:'open'}};
 const b=load({host,useQuery:opts=>{calls.push(opts);return {data:{model:'my-model',provider:'openai-codex',providers:[{slug:'openai-codex',usage:{windows:[{label:'5h',used_percent:23,resets_at:'2026-10-20T15:00:00Z'}]}}]},refetch:()=>{}};}});
 const tree=paneFrom(b); const text=JSON.stringify(tree);
 assert.match(text,/150/); assert.match(text,/77/); assert.match(text,/my-model/);
 assert.ok(calls[0].queryKey.includes('s1'));
});
