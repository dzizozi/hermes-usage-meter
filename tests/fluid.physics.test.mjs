import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const src=readFileSync(process.env.USAGE_PLUGIN_PATH||new URL('../desktop/plugin.js',import.meta.url),'utf8').replace(/^import .*$/gm,'').replace('export default','globalThis.plugin=');
function load(){const b={console,Date,Intl,Number,Math,atom:v=>({get:()=>v,set:n=>{v=n}}),jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};vm.createContext(b);vm.runInContext(src,b);return b}
test('watercourse redesign preserves the approved bamboo and W proportions',()=>{
 const b=load(),g=b.fluidGeometry(),width=p=>Math.max(...p.map(q=>q[0]))-Math.min(...p.map(q=>q[0]));
 assert.ok(Math.abs(width(g.bamboo)-54*1.1)<1e-9,'bamboo must grow10percent from v8');
 assert.ok(Math.abs(width(g.W)-66*1.4)<1e-9,'W must be140percent of its former width');
 assert.ok(Math.abs((Math.max(...g.bamboo.map(p=>p[1]))-Math.min(...g.bamboo.map(p=>p[1])))-12.8*1.1)<1e-9);

});
test('S is one connected downhill watercourse from beneath the bamboo to its former lower position',()=>{
 const b=load(),g=b.fluidGeometry();assert.ok(g.channel,'S must expose its actual watercourse geometry');
 const c=g.channel;assert.ok(c.points[0][1]<175);assert.ok(c.points.at(-1)[1]>235&&c.points.at(-1)[1]<249);
 assert.ok(Math.min(...g.S.map(p=>p[1]))<170);assert.ok(Math.max(...g.S.map(p=>p[1]))<251);
 let sign=0,turns=0;for(let i=1;i<c.points.length;i++){assert.ok(c.points[i][1]>=c.points[i-1][1]-1e-8,'river cannot run uphill');const dx=c.points[i][0]-c.points[i-1][0];if(Math.abs(dx)>1e-8){const s=Math.sign(dx);if(sign&&sign!==s)turns++;sign=s}}
 assert.equal(turns,2,'long S needs two alternating bends');
 const f=b.fluidFrame(85,14,{progress:0,dumping:true,animationStart:0,refillFrom:0},400,0);
 assert.equal(f.jet.target[0],c.inlet[0]);assert.equal(f.jet.target[1],c.inlet[1]);assert.ok(f.jet.source[1]<f.jet.target[1]);
 const json=JSON.stringify(b.bambooScene(85,14,'river-test',true,{progress:.5,artOnly:true}));assert.ok(json.includes('data-session-channel'));assert.ok(json.includes('data-session-flow-clip'));
});
test('Siri-inspired luminous palette uses coloured bloom outside the clipped liquid core',()=>{
 const b=load(),scene=b.bambooScene(85,14,'neon-test',true,{progress:.5,artOnly:true}),json=JSON.stringify(scene);
 for(const hex of ['#087bff','#6424c8','#c41ddf','#e91e9a','#ff4fae','#ff8a18'])assert.ok(json.includes(hex),hex);
 assert.equal(scene.props['data-colour-style'],'apple-reference-v10');
 assert.ok(json.includes('data-fluid-glow'));assert.ok(json.includes('feGaussianBlur'));
 assert.ok(json.includes('data-siri-gradient'));
});
test('actual reservoir volume, not bounding-box height, equals quota at every level',()=>{
 const b=load(),g=b.fluidGeometry();
 for(const name of ['W','S'])for(const fraction of [0,.001,.01,.14,.25,.5,.85,.99,1]){
  const p=g[name],area=b.polygonArea(p),y=b.liquidLevel(p,fraction);
  const actual=b.polygonArea(b.polygonBelow(p,y))/area;
  assert.ok(Math.abs(actual-fraction)<1e-6,`${name} fraction=${fraction} actual=${actual}`);
 }
});
test('glass bamboo is raised exactly45deg and water is clipped in world/gravity coordinates',()=>{
 const b=load(),f=b.fluidFrame(85,14,{progress:.5,dumping:false},1000,0);
 assert.equal(f.angle,45);assert.equal(f.W.fraction,.14);assert.equal(f.S.fraction,.85);
 const y=f.bamboo.level,area=b.polygonArea(b.polygonBelow(f.bamboo.polygon,y));
 assert.ok(Math.abs(area-f.bamboo.volume)<1e-5);
 const original=[[148,120],[254,120],[254,152],[119,152]].map(p=>b.rotateFluidPoint(p,45)),span=p=>Math.max(...p.map(q=>q[1]))-Math.min(...p.map(q=>q[1]));
 assert.ok(Math.abs(span(f.bamboo.polygon)-span(original)*.44)<1e-8);
 assert.ok(f.bamboo.level>100,'low-half liquid must settle in the lower closed end, not rotate a local rectangle');
});
test('confirmed pour conserves displayed transfer and rapidly fills S without inventing100percent',()=>{
 const b=load(),cycle={progress:0,dumping:true,animationStart:1000,refillFrom:12};let previous=1,previousS=.12;let flowing=false;
 for(let ms=0;ms<=2100;ms+=10){
  const f=b.fluidFrame(85,14,cycle,1000+ms,0);
  assert.ok(f.bamboo.fraction<=previous+1e-8);assert.ok(f.S.fraction>=previousS-1e-8);
  assert.ok(Math.abs(f.S.fraction-(.12+(.85-.12)*(1-f.bamboo.fraction)))<1e-8);
  assert.ok(f.S.fraction<=.85+1e-8);previous=f.bamboo.fraction;previousS=f.S.fraction;
  if(f.jet.opacity>0){flowing=true;assert.ok(f.jet.source[1]<f.jet.target[1],'pour must fall downward')}
 }
 assert.ok(flowing);assert.equal(previous,0);assert.equal(previousS,.85);
 const early=b.fluidFrame(85,14,cycle,1000+400,0),late=b.fluidFrame(85,14,cycle,1000+1000,0);
 assert.ok(early.S.fraction>.12&&early.S.fraction<.85,'refill has real intermediate levels');assert.equal(late.S.fraction,.85);
});
test('a lower new provider balance never animates an overestimated S quota',()=>{
 const b=load();for(const t of [0,300,800,1800])assert.ok(b.fluidFrame(60,14,{progress:0,dumping:true,animationStart:0,refillFrom:95},t,0).S.fraction<=.6);
});
test('free surface is live, horizontal on average, and bounded at empty/full',()=>{
 const b=load(),f=b.fluidFrame(50,50,{progress:.5},0,0);
 const a=b.liquidWave(f.S,1000,1),c=b.liquidWave(f.S,1400,1);assert.notEqual(a.fill,c.fill);
 for(const pct of [0,1]){const e=b.fluidFrame(pct*100,pct*100,{progress:pct},0,0);assert.equal(b.liquidWave(e.S,1000,1).amplitude,0)}
 assert.equal(b.liquidWave(f.S,1000,0).amplitude,0,'reduced motion must be static');
});
test('the actual wavy fill conserves provider quota, including amplified tiny-widget waves',()=>{
 const b=load();for(const name of ['W','S','bamboo'])for(const fraction of [.01,.14,.5,.75,.85,.99])for(const t of [0,300,1150]){
  const frame=b.fluidFrame(fraction*100,fraction*100,{progress:fraction},t,0),liquid=frame[name],wave=b.liquidWave(liquid,t,2.8);
  const actual=b.waveArea(liquid.polygon,wave.points)/liquid.capacity;
  assert.ok(Math.abs(actual-fraction)<.0001,`${name} wanted=${fraction} actual=${actual}`);
 }
});
test('independent vertical quadrature validates the wave-area solver, not a circular self-check',()=>{
 const b=load();for(const [name,pct,time] of [['W',75,0],['S',50,300]]){
  const f=b.fluidFrame(pct,pct,{progress:pct/100},time,0)[name],wave=b.liquidWave(f,time,2.8);
  const min=Math.min(...f.polygon.map(p=>p[0])),max=Math.max(...f.polygon.map(p=>p[0])),dx=(max-min)/5000;let area=0;
  for(let j=0;j<5000;j++){const x=min+(j+.5)*dx,cuts=[];
   for(let i=0;i<f.polygon.length;i++){const a=f.polygon[i],c=f.polygon[(i+1)%f.polygon.length];if((a[0]>x)!==(c[0]>x))cuts.push(a[1]+(x-a[0])*(c[1]-a[1])/(c[0]-a[0]))}cuts.sort((a,c)=>a-c);
   const step=wave.points[1][0]-wave.points[0][0],k=Math.max(0,Math.min(wave.points.length-2,Math.floor((x-wave.points[0][0])/step))),a=wave.points[k],c=wave.points[k+1],y=a[1]+(x-a[0])*(c[1]-a[1])/(c[0]-a[0]);
   for(let i=0;i+1<cuts.length;i+=2)area+=Math.max(0,cuts[i+1]-Math.max(cuts[i],y))*dx;
  }
  assert.ok(Math.abs(area/f.capacity-pct/100)<.0001,`${name}: ${area/f.capacity}`);
 }
});
test('drainage while flowing touches the actual lower lip, not an independent timed shrink',()=>{
 const b=load();for(let t=300;t<1000;t+=10){const f=b.fluidFrame(85,14,{progress:0,dumping:true,animationStart:0,refillFrom:0},t,0);if(f.jet.opacity>0&&f.bamboo.fraction>0)assert.ok(Math.abs(f.bamboo.level-f.jet.source[1])<.00001)}
});
test('wall-clock fallback keeps the same confirmed animation moving without DocumentTimeline',()=>{
 const b=load(),cycle={progress:0,dumping:true,animationStart:null,animationWallStart:10000,refillFrom:0};
 assert.equal(b.fluidFrame(85,14,cycle,0,10000).S.fraction,0);
 assert.ok(b.fluidFrame(85,14,cycle,0,10400).S.fraction>0);
 assert.equal(b.fluidFrame(85,14,cycle,0,11000).S.fraction,.85);
});
test('missing quota stays unknown, and waiting at a deadline does not start a jet or refill',()=>{
 const b=load(),u=b.fluidFrame(null,null,{progress:null},1000,0);
 assert.equal(u.W.fraction,null);assert.equal(u.S.fraction,null);assert.equal(u.bamboo.fraction,null);assert.equal(u.jet.opacity,0);
 const awaiting=b.fluidFrame(0,14,{progress:1,phase:'awaiting',dumping:false},1000,0);
 assert.equal(awaiting.bamboo.fraction,1);assert.equal(awaiting.S.fraction,0);assert.equal(awaiting.jet.opacity,0);assert.equal(awaiting.angle,45);
});
