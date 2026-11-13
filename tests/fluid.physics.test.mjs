import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const src=readFileSync(process.env.USAGE_PLUGIN_PATH||new URL('../desktop/plugin.js',import.meta.url),'utf8').replace(/^import .*$/gm,'').replace('export default','globalThis.plugin=');
function load(){const b={console,Date,Intl,Number,Math,atom:v=>({get:()=>v,set:n=>{v=n}}),jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};vm.createContext(b);vm.runInContext(src,b);return b}
const inside=(p,poly)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])c=!c}return c};
const crosses=(p,q,r,s)=>{const o=(a,b,c)=>Math.sign((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]));return o(p,q,r)*o(p,q,s)<0&&o(r,s,p)*o(r,s,q)<0};
test('45-degree camera: W is a meandering W channel carved into the flat top of a grounded rock, pouring from its left end',()=>{
 const b=load(),g=b.fluidGeometry(),w=g.weekly,k=Math.SQRT1_2,width=p=>Math.max(...p.map(q=>q[0]))-Math.min(...p.map(q=>q[0]));
 assert.ok(Math.abs(width(g.bamboo)-54*1.1)<1e-9,'approved bamboo size is unchanged');
 assert.equal(g.camera.elevation,45);
 for(let i=0;i<w.ground.length;i++)assert.ok(w.points[i][0]===w.ground[i][0]&&Math.abs(w.points[i][1]-w.ground[i][1]*k)<1e-9,'rock top is foreshortened by cos45');
 const P=w.points,inRange=(lo,hi)=>P.filter(p=>p[0]>=lo&&p[0]<=hi).map(p=>p[1]);
 assert.ok(Math.max(...inRange(198,222))>64&&Math.max(...inRange(244,268))>64,'two low valleys');assert.ok(Math.min(...inRange(225,240))<39,'raised middle');
 assert.ok(P[0][1]<36&&P.at(-1)[1]<36,'both W ends are high');for(let i=1;i<P.length;i++)assert.ok(P[i][0]>=P[i-1][0]-1e-9,'W reads left to right without loops');
 let turns=0,last=0;for(let i=1;i<P.length-1;i++){const c=Math.sign((P[i][0]-P[i-1][0])*(P[i+1][1]-P[i][1])-(P[i][1]-P[i-1][1])*(P[i+1][0]-P[i][0]));if(c&&last&&c!==last)turns++;if(c)last=c}
 assert.ok(turns>=8,'natural meanders, not a stiff letter: '+turns);
 for(let i=0;i<g.W.length;i++)for(let j=i+2;j<g.W.length;j++){if(i===0&&j===g.W.length-1)continue;assert.ok(!crosses(g.W[i],g.W[i+1],g.W[j],g.W[(j+1)%g.W.length]),'W bed must not self-intersect')}
 for(const p of g.W)if(Math.hypot(p[0]-w.lip[0],p[1]-w.lip[1])>7){assert.ok(inside(p,g.plateau),'W must be carved into the rock top '+p);assert.ok(inside(p,g.rock))}
 const rockBottom=Math.max(...g.rock.map(p=>p[1]));assert.ok(rockBottom<130&&rockBottom-Math.min(...g.rock.map(p=>p[1]))<125,'a boulder, not a pillar');
 for(const p of g.rock.filter(p=>p[1]>100))assert.ok(inside(p,g.ground),'rock base rests on the ground '+p);
 const glass=[[113,158],[145,114],[258,114],[271,136],[258,158]].map(b.bambooPoint),restGlass=glass.map(p=>b.rotateFluidPoint(p,45));
 assert.ok(Math.max(...g.W.map(p=>p[1]))<Math.min(...restGlass.map(p=>p[1])),'W is higher than the bamboo');
 assert.ok(w.lip[0]<=Math.min(...P.map(p=>p[0]))&&w.lip[1]<36,'water leaves from the upper-left end');
 const mouth=b.bambooPoint([144.4,98]);assert.ok(w.lip[0]>mouth[0]&&w.lip[0]-mouth[0]<6,'jet leaves leftward and lands in the mouth');
 for(let s=.1;s<1;s+=.01){const x=w.lip[0]+(mouth[0]-w.lip[0])*s,y=w.lip[1]+(mouth[1]-w.lip[1])*s*s;assert.ok(!inside([x,y],g.rock),'falling water must stay outside the stone at y='+y)}
 for(let a=45;a>=-28;a-=.5){const p=glass.map(q=>b.rotateFluidPoint(q,a));for(let i=0;i<p.length;i++)for(let t=0;t<=1;t+=.05){const A=p[i],B=p[(i+1)%p.length];assert.ok(!inside([A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t],g.rock),'tipping bamboo hits the rock at '+a)}}
 const json=JSON.stringify(b.bambooScene(40,60,'rock-test',true,{progress:.5,artOnly:true}));for(const s of ['data-rock','w-watercourse-rock','oblique-45','data-rock-facet','data-ground-plane'])assert.ok(json.includes(s),s);
});
test('S lies flat on the ground under the same 45-degree camera, from beneath the bamboo to its former lower position',()=>{
 const b=load(),g=b.fluidGeometry(),k=Math.SQRT1_2;assert.ok(g.channel,'S must expose its actual watercourse geometry');
 const ch=g.channel;for(let i=0;i<ch.ground.length;i++)assert.ok(Math.abs(ch.points[i][1]-(151+ch.ground[i][1]*k))<1e-9&&ch.points[i][0]===ch.ground[i][0]);
 assert.ok(Math.abs(Math.abs(ch.left[0][1]-ch.right[0][1])-14*k)<.15,'width across the view is foreshortened');
 assert.ok(Math.abs(Math.abs(ch.left[28][0]-ch.right[28][0])-14)<.15&&Math.abs(ch.left[28][1]-ch.right[28][1])<.5,'width toward the camera is not');
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
test('channel water area equals quota; W dries from its spring and S from its inlet, each staying wet at the end it drains to',()=>{
 const b=load(),g=b.fluidGeometry();
 for(const name of ['W','S'])for(const fraction of [.001,.01,.14,.25,.5,.85,.99])for(const t of [0,300,1150])for(const motion of [0,1,2.8]){
  const f=b.fluidFrame(fraction*100,fraction*100,{progress:.5},t,0)[name],fill=b.channelFill(f,t,motion);
  assert.ok(Math.abs(b.polygonArea(fill.polygon)/f.capacity-fraction)<1e-4,`${name} ${fraction} ${t} ${motion}`);
 }
 for(const name of ['W','S']){
  // independent grid count, not the plugin's own area routine
  const f=b.fluidFrame(37,37,{progress:.5},0,0)[name],fill=b.channelFill(f,0,0),xs=f.polygon.map(p=>p[0]),ys=f.polygon.map(p=>p[1]);let all=0,wet=0;
  for(let x=Math.min(...xs);x<Math.max(...xs);x+=.25)for(let y=Math.min(...ys);y<Math.max(...ys);y+=.25)if(inside([x,y],f.polygon)){all++;if(inside([x,y],fill.polygon))wet++}
  assert.ok(Math.abs(wet/all-.37)<.006,`${name} grid ${wet/all}`);
 }
 for(const pct of [5,20,40,60,80,95]){
  const f=b.fluidFrame(pct,pct,{progress:.5},0,0);
  for(const [name,points] of [['W',g.weekly.points],['S',[...g.channel.points].reverse()]]){
   const fill=b.channelFill(f[name],0,0),wet=points.map(p=>inside(p,fill.polygon)),first=wet.indexOf(false);
   assert.equal(wet[1],true,`${name} keeps water at the end it drains to`);assert.ok(first>0&&wet.slice(first+1).every(v=>!v),`${name} water is one continuous run from that end`);
  }
 }
 assert.equal(b.channelFill(b.fluidFrame(100,100,{progress:.5},0,0).W,0,1).polygon,g.W);
 for(const v of [0,null])assert.equal(b.channelFill(b.fluidFrame(v,v,{progress:.5},0,0).S,0,1).fill,'');
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
test('channel water laps gently at its front, the bamboo surface waves, and reduced motion stays still',()=>{
 const b=load(),f=b.fluidFrame(50,50,{progress:.5},0,0);
 for(const name of ['W','S']){assert.notEqual(b.channelFill(f[name],1000,1).fill,b.channelFill(f[name],1400,1).fill);assert.equal(b.channelFill(f[name],1000,0).fill,b.channelFill(f[name],1400,0).fill,'reduced motion must be static')}
 assert.notEqual(b.liquidWave(f.bamboo,1000,1).fill,b.liquidWave(f.bamboo,1400,1).fill);assert.equal(b.liquidWave(f.bamboo,1000,0).amplitude,0);
 for(const pct of [0,100]){const e=b.fluidFrame(pct,pct,{progress:pct/100},0,0);assert.equal(b.channelFill(e.S,1000,1).amplitude,0);assert.equal(b.liquidWave(e.bamboo,1000,1).amplitude,0)}
});
test('the actual wavy bamboo fill conserves provider time, including amplified tiny-widget waves',()=>{
 const b=load();for(const fraction of [.01,.14,.5,.75,.85,.99])for(const t of [0,300,1150]){
  const liquid=b.fluidFrame(50,50,{progress:fraction},t,0).bamboo,wave=b.liquidWave(liquid,t,2.8);
  const actual=b.waveArea(liquid.polygon,wave.points)/liquid.capacity;
  assert.ok(Math.abs(actual-fraction)<.0001,`bamboo wanted=${fraction} actual=${actual}`);
 }
});
test('independent vertical quadrature validates the wave-area solver, not a circular self-check',()=>{
 const b=load();for(const [pct,time] of [[75,0],[50,300]]){
  const f=b.fluidFrame(pct,pct,{progress:pct/100},time,0).bamboo,wave=b.liquidWave(f,time,2.8);
  const min=Math.min(...f.polygon.map(p=>p[0])),max=Math.max(...f.polygon.map(p=>p[0])),dx=(max-min)/5000;let area=0;
  for(let j=0;j<5000;j++){const x=min+(j+.5)*dx,cuts=[];
   for(let i=0;i<f.polygon.length;i++){const a=f.polygon[i],c=f.polygon[(i+1)%f.polygon.length];if((a[0]>x)!==(c[0]>x))cuts.push(a[1]+(x-a[0])*(c[1]-a[1])/(c[0]-a[0]))}cuts.sort((a,c)=>a-c);
   const step=wave.points[1][0]-wave.points[0][0],k=Math.max(0,Math.min(wave.points.length-2,Math.floor((x-wave.points[0][0])/step))),a=wave.points[k],c=wave.points[k+1],y=a[1]+(x-a[0])*(c[1]-a[1])/(c[0]-a[0]);
   for(let i=0;i+1<cuts.length;i+=2)area+=Math.max(0,cuts[i+1]-Math.max(cuts[i],y))*dx;
  }
  assert.ok(Math.abs(area/f.capacity-pct/100)<.0001,`bamboo: ${area/f.capacity}`);
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

test('stones, pebbles and wind-swayed grass sit on the 45-degree ground, never in the water',()=>{
 const b=load(),g=b.fluidGeometry(),json=JSON.stringify(b.bambooScene(70,70,'garden-test',true,{progress:.5,artOnly:true}));
 assert.ok(g.grass.length>=8&&g.stones.length>=5&&g.pebbles.length>=20);assert.ok(json.includes('usage-grass-sway'));
 assert.ok((json.match(/"data-grass"/g)||[]).length===g.grass.length&&(json.match(/"data-stone"/g)||[]).length===g.stones.length);
 for(const [x,y] of g.grass)for(let k=0;k<=4;k++){const p=[x,y-k];assert.ok(!inside(p,g.S)&&!inside(p,g.W)&&!inside(p,g.rock)&&inside([x,y],g.ground),'grass in water or rock '+x+','+y)}
 for(const s of g.stones){for(const p of s.footprint)assert.ok(!inside(p,g.S)&&inside(p,g.ground),'stone in S '+s.x);
  const w=Math.max(...s.footprint.map(p=>p[0]))-Math.min(...s.footprint.map(p=>p[0])),h=Math.max(...s.footprint.map(p=>p[1]))-Math.min(...s.footprint.map(p=>p[1]));assert.ok(h/w<.8,'stone footprint lies on the foreshortened ground')}
 for(const [x,y] of g.pebbles)assert.ok(!inside([x,y],g.S)&&!inside([x,y],g.W)&&!inside([x,y],g.rock));
});
test('one or two realistic butterflies visit every30 seconds with bobbing flight, rest on grass, then leave',()=>{
 const b=load();let pairs=0;
 const json=JSON.stringify(b.bambooScene(70,70,'butterfly-test',true,{progress:.5,artOnly:true}));for(const s of ['monarch','blue-morpho','data-butterfly-wings'])assert.ok(json.includes(s),s);
 for(let c=0;c<40;c++){const seen=[0,1].map(i=>{let any=false;for(let t=0;t<30000;t+=250){const f=b.butterflyFlight(c*30000+t,i);if(f){any=true;assert.ok(f.opacity>=0&&f.opacity<=1&&f.flap>0&&f.flap<=1)}}return any});
  assert.equal(seen[0],true,'at least one butterfly every cycle');if(seen[1])pairs++;
  assert.equal(b.butterflyFlight(c*30000+20000,0),null,'butterflies leave before the next visit');
  const enter=b.butterflyFlight(c*30000+10,0),rest=b.butterflyFlight(c*30000+5500,0);assert.ok(enter.opacity<.05&&(enter.x<0||enter.x>300),'arrives from outside');assert.equal(rest.perched,true);
  assert.ok(b.fluidGeometry().grass.some(([x,y,s])=>Math.abs(rest.x-x)<8&&Math.abs(rest.y-(y-13*s-2))<3),'rests on a grass tuft');
  const path=[];for(let t=300;t<3300;t+=60){const f=b.butterflyFlight(c*30000+t,0);path.push(f);assert.ok(Number.isFinite(f.angle))}
  const wobble=path.slice(1).map((f,i)=>Math.sign(f.y-path[i].y)).filter((v,i,a)=>i&&v&&v!==a[i-1]).length;assert.ok(wobble>=3,'flight bobs instead of gliding straight')}
 assert.ok(pairs>5&&pairs<35,'sometimes two butterflies: '+pairs);
 assert.equal(b.butterflyFlight(Number.NaN,0),null);
});
test('displayed quota glides toward new provider values without overshoot; unknown and reduced motion snap',()=>{
 const b=load();let v=80;const seen=[];for(let i=0;i<120;i++){v=b.easeShownQuota(v,60,100);seen.push(v)}
 assert.ok(seen[0]<80&&seen[0]>60,'starts descending gradually');assert.equal(seen.at(-1),60,'settles exactly on the real value');
 for(let i=1;i<seen.length;i++)assert.ok(seen[i]<=seen[i-1]&&seen[i]>=60);
 assert.equal(b.easeShownQuota(80,null,100),null);assert.equal(b.easeShownQuota(undefined,42,100),42);assert.equal(b.easeShownQuota(80,60,100,true),60);
});
