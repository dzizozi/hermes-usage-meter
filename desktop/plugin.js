// Local read-only widget. No credentials, external services, or paid API calls.
import { host, useValue, useQuery, atom } from '@hermes/plugin-sdk'
import { useEffect, useState, useId, useRef, useMemo, useLayoutEffect } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'

function remaining(window) {
 return typeof window?.used_percent === 'number' && Number.isFinite(window.used_percent) ? Math.max(0, Math.min(100, 100-window.used_percent)) : null
}
function countdown(reset, now) {
 const stamp = reset ? Date.parse(reset) : NaN
 if (!Number.isFinite(stamp)) return 'موعد غير متاح'
 const seconds = Math.ceil((stamp-now)/1000)
 if (seconds <= 0) return 'حان الموعد — بانتظار تحديث المزوّد'
 const minutes = Math.ceil(seconds/60)
 const days = Math.floor(minutes/1440), hours = Math.floor(minutes%1440/60), mins = minutes%60
 return (days ? `${days} يوم و` : '') + `${hours} س و${mins} د`
}
// model.options returns cached quota first, then refreshes it asynchronously.
// Re-read quickly during startup; never require plugin reload to see that refresh.
function quotaRefreshInterval(query) {
 const state=query?.state||{}
 const data=state.data
 const provider=resolveQuotaProvider(data?.providers?.find(p=>p.slug===data.provider))
 const windows=[...(provider?.usage?.windows||[]),...(provider?.usage?.accounts||[]).flatMap(a=>a.windows||[])]
 if(windows.some(w=>remaining(w)!==null)) {
  const reset=sessionQuotaWindow(provider)?.resets_at
  const until=reset?Date.parse(reset)-Date.now():NaN
  return ['openai-codex','anthropic'].includes(data?.provider)&&until<=60000&&until>=-300000?5000:60000
 }
 if(data?.provider && !['openai-codex','anthropic'].includes(data.provider)) return 60000
 if(provider?.authenticated===false) return 60000
 return (state.dataUpdateCount||0)<6 ? 5000 : 30000
}
let widgetStorage=null
const usageView=atom(null)
let lastQuotaDiagnostic=''
function useUsageData(selection=null) {
 const session = useValue(host.state.focusedSessionId)
 const profile = useValue(host.state.focusedSessionProfile)
 const gatewayProfile = useValue(host.state.profile)
 const liveModel = useValue(host.state.model)
 const usage = useValue(host.state.focusedUsage)
 const gateway = useValue(host.state.gateway)
 const resolvedProfile = profile || gatewayProfile
 const sameProfile = resolvedProfile === gatewayProfile
 const query = useQuery({
  queryKey:['usage-meter','auto-refresh-v2',resolvedProfile,session,liveModel],
  queryFn:async()=>{
   const result=await host.request('model.options',{...(session?{session_id:session}:{}),profile:resolvedProfile,explicit_only:true},20000)
   const row=resolveQuotaProvider(result?.providers?.find(p=>p.slug===result.provider))
   const summary=JSON.stringify({provider:result?.provider||null,model:result?.model||null,session:gaugeRemaining(row),weekly:gaugeRemaining(row,'weekly',result?.model||'')})
   if(summary!==lastQuotaDiagnostic){console.info('[usage-meter] quota',summary);lastQuotaDiagnostic=summary}
   return result
  },
  enabled:gateway==='open' && sameProfile,
  refetchInterval:quotaRefreshInterval, refetchIntervalInBackground:true,
  refetchOnMount:'always',refetchOnReconnect:'always',refetchOnWindowFocus:'always',
  staleTime:10000,retry:3,retryDelay:attempt=>Math.min(1000*2**attempt,15000)
 })
 const data = sameProfile ? query.data : null
 const rawProvider = data?.providers?.find(p=>p.slug===data.provider)
 const selectedId=selection?.provider===rawProvider?.slug?selection?.id:null
 const provider=useMemo(()=>resolveQuotaProvider(rawProvider,selectedId),[rawProvider,selectedId])
 return {usage,gateway,liveModel,sameProfile,query,data,provider,rawProvider,cycleKey:JSON.stringify([resolvedProfile,session,data?.provider||'',data?.model||liveModel||''])}
}
function resolveQuotaProvider(provider,selectedId=null) {
 const accounts=provider?.usage?.accounts
 if(!accounts||accounts.length<2)return provider
 const reporting=accounts.filter(a=>(a.windows||[]).some(w=>remaining(w)!==null))
 const selected=selectedId?accounts.find(a=>a.id===selectedId):reporting.length===1?reporting[0]:null
 if(!selected)return provider
 return {...provider,usage:{...provider.usage,accounts:[selected]},quota_selection:{id:selected.id,label:selected.label||selected.id,reason:selectedId?'explicit':'only-reporting',total:accounts.length}}
}
function gaugeRemaining(provider, kind='session', model='') {
 const accounts = provider?.usage?.accounts
 const windows = accounts?.length === 1 ? accounts[0].windows : accounts?.length > 1 ? [] : provider?.usage?.windows
 if(kind==='weekly') {
  const family=/opus/i.test(model)?'opus':/sonnet/i.test(model)?'sonnet':null
  const candidates=(windows||[]).filter(w=>{
   const label=String(w.label||'').trim().toLowerCase()
   return /^(weekly|week|current week|7\s*d|7[ -]days?|seven[ -]days?|all models week)$/.test(label) || (family && label===`${family} week`)
  }).map(remaining).filter(n=>n!==null)
  return candidates.length ? Math.min(...candidates) : null
 }
 return remaining(sessionQuotaWindow(provider))
}
function quotaUnavailableReason(slug,provider) {
 if(provider?.usage?.accounts?.length>1) return 'هناك عدة حسابات؛ تعرض البطاقة بيانات كل حساب دون دمج نسبها.'
 if(/^(gemini|google|google-gemini|google-ai-studio|solstice|solstice-oauth)$/.test(slug||'')) return 'تكامل Gemini الحالي في Hermes لا يوفّر بيانات الحصة المتبقية ومواعيد التجدد. توكنز الجلسة تُعرض أعلاه، ولا نحوّلها إلى نسبة تخمينية.'
 if(slug==='anthropic') return 'لم تصل بيانات حصة Claude في هذه القراءة. تحقق من حساب مصدر الحصة؛ لا نعرض نسبة تخمينية أو ندمج حسابين.'
 return 'لم يوفّر المزوّد بيانات الرصيد في هذه القراءة، أو لا يدعم التكامل عرضها.'
}
function sessionQuotaWindow(provider) {
 const accounts=provider?.usage?.accounts
 const windows=accounts?.length===1?accounts[0].windows:accounts?.length>1?[]:provider?.usage?.windows
 return (windows||[]).find(w=>/^(session|current session)$/i.test(String(w.label||'').trim()))
  || (windows||[]).find(w=>/^(5\s*h|5[ -]hours?|five[ -]hours?)$/i.test(String(w.label||'').trim())) || null
}
function cycleState(window,slug,now) {
 const parsed=window?.resets_at?Date.parse(window.resets_at):NaN
 const resetMs=Number.isFinite(parsed)?parsed:null
 let seconds=[window?.duration_seconds,window?.window_seconds,window?.limit_window_seconds].find(n=>typeof n==='number'&&Number.isFinite(n)&&n>0)
 let durationSource=seconds?'provider-duration':null
 if(!seconds&&/^(5\s*h|5[ -]hours?|five[ -]hours?)$/i.test(String(window?.label||'').trim())){seconds=18000;durationSource='five-hour-label'}
 // Installed Hermes maps Codex Session and Claude five_hour to these labels.
 // This is the window duration, NOT a reset scheduled from app startup.
 if(!seconds&&['openai-codex','anthropic'].includes(slug)&&/^(session|current session)$/i.test(String(window?.label||'').trim())){seconds=18000;durationSource='five-hour-provider'}
 const progress=resetMs!==null&&seconds?Math.max(0,Math.min(1,1-(resetMs-now)/(seconds*1000))):null
 return {resetMs,durationSeconds:seconds??null,durationSource,progress,phase:progress===null?'unknown':resetMs<=now?'awaiting':'filling'}
}
function confirmedCycleRenewal(previous,next,now) {
 if(!previous||previous.key!==next.key||previous.account!==next.account||!Number.isFinite(previous.resetMs)||previous.resetMs>now||!Number.isFinite(next.left)) return false
 return Number.isFinite(next.resetMs)&&next.resetMs>previous.resetMs+1000
}
function useQuotaCycle(provider,key) {
 const [now,setNow]=useState(Date.now())
 const [event,setEvent]=useState(null)
 const previous=useRef(null)
 const window=sessionQuotaWindow(provider)
 const state=cycleState(window,provider?.slug,now)
 useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(id)},[])
 useEffect(()=>{
  // A context switch must cancel the old event, not merely hide it until return.
  if(previous.current?.key!==key){previous.current=null;setEvent(null)}
  const accounts=provider?.usage?.accounts
  if(accounts?.length>1){previous.current=null;setEvent(null);return}
  const account=accounts?.length===1?(accounts[0].id??null):null
  const next={key,account,resetMs:state.resetMs,left:remaining(window)}
  // Retain the last valid reading across transient cache/empty responses.
  if(!Number.isFinite(next.left)){setEvent(null);return}
  if(previous.current&&previous.current.account!==account){previous.current=null;setEvent(null)}
  const renewed=confirmedCycleRenewal(previous.current,next,Date.now())
  if(renewed){const stamp=Date.now();setEvent({key,id:stamp,startWall:stamp,fromLeft:previous.current.left,start:typeof document!=='undefined'?document.timeline?.currentTime:null})}
  if(Number.isFinite(next.resetMs)||renewed) previous.current=next
 },[provider,key])
 useEffect(()=>{if(!event)return;const id=setTimeout(()=>setEvent(null),2100);return()=>clearTimeout(id)},[event])
 const dumping=!!event&&event.key===key
 return {...state,now,dumping,eventId:dumping?event.id:'idle',animationStart:dumping?event.start:null,animationWallStart:dumping?event.startWall:null,refillFrom:dumping?event.fromLeft:null}
}
function bambooMetrics(sessionLeft=null,weeklyLeft=null,cycle={progress:null,dumping:false}) {
 const progress=typeof cycle.progress==='number'&&Number.isFinite(cycle.progress)?Math.max(0,Math.min(1,cycle.progress)):null
 return {sessionLevel:sessionLeft,weeklyLevel:weeklyLeft,bambooLevel:cycle.dumping?1:progress,
  flowing:weeklyLeft!==null&&weeklyLeft>0&&progress!==null&&progress<1&&!cycle.dumping,
  tipped:cycle.dumping===true}
}
// Area-conserving 2-D liquid model. Free surfaces live in WORLD coordinates,
// never inside the rotating glass group. Quota values remain provider-derived.
function polygonArea(p) {
 let sum=0;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];sum+=a[0]*b[1]-b[0]*a[1]}return Math.abs(sum)/2
}
function polygonBelow(p,y) {
 const out=[];for(let i=0;i<p.length;i++){
  const a=p[i],b=p[(i+1)%p.length],ia=a[1]>=y,ib=b[1]>=y;
  if(ia)out.push(a);if(ia!==ib){const t=(y-a[1])/(b[1]-a[1]);out.push([a[0]+t*(b[0]-a[0]),y])}
 }return out
}
function liquidLevel(p,fraction,capacity=polygonArea(p)) {
 let low=Math.min(...p.map(a=>a[1])),high=Math.max(...p.map(a=>a[1]));
 if(!Number.isFinite(fraction)||fraction<=0)return high+1;
 const target=Math.min(polygonArea(p),Math.max(0,fraction)*capacity);
 for(let i=0;i<28;i++){const mid=(low+high)/2;if(polygonArea(polygonBelow(p,mid))>target)low=mid;else high=mid}return(low+high)/2
}
function makeSessionChannel() {
 const points=[[169,151]];let previous=points[0];
 const cubic=(a,b,c)=>{const start=previous;for(let i=1;i<=28;i++){const t=i/28,u=1-t;points.push([u*u*u*start[0]+3*u*u*t*a[0]+3*u*t*t*b[0]+t*t*t*c[0],u*u*u*start[1]+3*u*u*t*a[1]+3*u*t*t*b[1]+t*t*t*c[1]])}previous=c};
 cubic([145,151],[117,160],[117,184]);cubic([117,201],[158,198],[158,215]);cubic([158,233],[139,242],[120,242]);
 const left=[],right=[],half=6;
 for(let i=0;i<points.length;i++){const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy)||1,nx=-dy/length*half,ny=dx/length*half;left.push([points[i][0]+nx,points[i][1]+ny]);right.push([points[i][0]-nx,points[i][1]-ny])}
 return {points,polygon:[...left,...right.reverse()],inlet:[158,151],end:[120,242],width:12,d:'M169 151C145 151 117 160 117 184C117 201 158 198 158 215C158 233 139 242 120 242'};
}
function sessionSurfaceSpan(polygon,y) {
 const xs=[];for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length];if((a[1]>y)!==(b[1]>y))xs.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]))}xs.sort((a,b)=>a-b);
 let span=[160,172];for(let i=0;i+1<xs.length;i+=2)if(i===0||xs[i+1]-xs[i]>span[1]-span[0])span=[xs[i],xs[i+1]];return span;
}
function bambooPoint(p) {return [191+(p[0]-191)*.44,136+(p[1]-136)*.44]}
function rotateFluidPoint(p,angle) {
 const a=angle*Math.PI/180,x=p[0]-191,y=p[1]-136;return[191+x*Math.cos(a)-y*Math.sin(a),136+x*Math.sin(a)+y*Math.cos(a)]
}
function fluidGeometry() {return FLUID_GEOMETRY}
const FLUID_GEOMETRY=(()=>{
 const W=[[124,23],[137,23],[146,65],[157,35],[168,65],[177,23],[190,23],[176,84],[164,84],[157,62],[150,84],[138,84]].map(p=>[172+(p[0]-144)*1.4,100+(p[1]-84)*1.4]);
 const channel=makeSessionChannel(),S=channel.polygon;
 const bamboo=[[148,120],[254,120],[254,152],[119,152]].map(bambooPoint),rest=bamboo.map(p=>rotateFluidPoint(p,45));
 return {W,S,channel,bamboo,capacity:polygonArea(polygonBelow(rest,rotateFluidPoint(bambooPoint([113,158]),45)[1]))}
})();
function fluidPath(p) {return p.length?'M'+p.map(a=>a.map(n=>Number(n.toFixed(3))).join(' ')).join('L')+'Z':''}
function dumpFluidState(u) {
 const clamp=n=>Math.max(0,Math.min(1,n)),ease=n=>{n=clamp(n);return n*n*(3-2*n)};
 const angle=u<.7?45-73*ease((u-.12)/.43):-28+73*ease((u-.7)/.3);
 const p=FLUID_GEOMETRY.bamboo.map(a=>rotateFluidPoint(a,angle)),lip=rotateFluidPoint(bambooPoint([113,158]),angle);
 const capacity=polygonArea(polygonBelow(p,lip[1]));
 return {angle,fraction:u>=.7?0:Math.max(0,Math.min(1,capacity/FLUID_GEOMETRY.capacity)),polygon:p,lip}
}
function fluidFrame(sessionLeft,weeklyLeft,cycle={},nowDoc=0,nowWall=Date.now(),reduced=false) {
 const known=n=>typeof n==='number'&&Number.isFinite(n),clamp=n=>Math.max(0,Math.min(1,n));
 const fraction=n=>known(n)?clamp(n/100):null;
 const elapsed=known(cycle.animationStart)&&known(nowDoc)?nowDoc-cycle.animationStart:known(cycle.animationWallStart)?nowWall-cycle.animationWallStart:0,u=clamp(elapsed/2100);
 const dumping=cycle.dumping&&!reduced;
 const state=dumping?dumpFluidState(u):{angle:45,polygon:FLUID_GEOMETRY.bamboo.map(p=>rotateFluidPoint(p,45)),lip:rotateFluidPoint(bambooPoint([113,158]),45)};
 let progress=known(cycle.progress)?clamp(cycle.progress):null;
 if(known(cycle.resetMs)&&known(cycle.durationSeconds)&&cycle.durationSeconds>0)progress=clamp(1-(cycle.resetMs-nowWall)/(cycle.durationSeconds*1000));
 const buffer=dumping?state.fraction:progress;
 let session=fraction(sessionLeft);
 if(dumping&&session!==null&&known(cycle.refillFrom)){const from=Math.min(session,fraction(cycle.refillFrom));session=from+(session-from)*(1-buffer)}
 const liquid=(polygon,value,capacity=polygonArea(polygon))=>({polygon,fraction:value,capacity,volume:value===null?null:value*capacity,level:liquidLevel(polygon,value,capacity)});
 const flux=dumping&&u>0?Math.max(0,dumpFluidState(Math.max(0,u-.008)).fraction-state.fraction)/.008:0;
 return {angle:state.angle,W:liquid(FLUID_GEOMETRY.W,fraction(weeklyLeft)),S:liquid(FLUID_GEOMETRY.S,session),
  bamboo:liquid(state.polygon,buffer,FLUID_GEOMETRY.capacity),
  jet:{source:state.lip,target:FLUID_GEOMETRY.channel.inlet,opacity:Math.min(1,flux*.45),width:Math.min(5,1.4+Math.sqrt(flux)*1.3)},
  flowing:known(weeklyLeft)&&weeklyLeft>0&&progress!==null&&progress<1&&!dumping,
  motion:reduced?0:1,time:nowDoc}
}
function waveArea(p,points,offset=0) {
 let area=0;const left=points[0][0],step=points[1][0]-left;
 for(let e=0;e<p.length;e++){
  const a=p[e],b=p[(e+1)%p.length],dx=b[0]-a[0];if(Math.abs(dx)<1e-12)continue;
  const lo=Math.min(a[0],b[0]),hi=Math.max(a[0],b[0]),slope=(b[1]-a[1])/dx,sign=dx>0?1:-1;
  const first=Math.max(0,Math.floor((lo-left)/step)),last=Math.min(points.length-2,Math.floor((hi-left)/step));
  for(let i=first;i<=last;i++){
   const c=points[i],d=points[i+1],l=Math.max(lo,c[0]),r=Math.min(hi,d[0]);if(r<=l)continue;
   const m=(d[1]-c[1])/(d[0]-c[0]);
   const yl=a[1]+(l-a[0])*slope-c[1]-(l-c[0])*m-offset,yr=a[1]+(r-a[0])*slope-c[1]-(r-c[0])*m-offset;
   if(yl>=0&&yr>=0)area+=sign*(yl+yr)*(r-l)/2;
   else if(yl>0||yr>0){const positive=Math.max(yl,yr);area+=sign*positive*positive*(r-l)/(2*Math.abs(yr-yl))}
  }
 }return Math.abs(area)
}
function liquidWave(liquid,time,motion=1,impact=0) {
 const xs=liquid.polygon.map(p=>p[0]),ys=liquid.polygon.map(p=>p[1]),left=Math.min(...xs)-3,right=Math.max(...xs)+3,bottom=Math.max(...ys)+4;
 const f=liquid.fraction,amplitude=f===null||f<=0||f>=1?0:motion*Math.min(1.1,(bottom-Math.min(...ys))*.025)*Math.pow(Math.sin(Math.PI*f),.7)*(1+impact);
 const points=Array.from({length:19},(_,i)=>{const x=left+(right-left)*i/18;return[x,liquid.level+amplitude*(.65*Math.sin(x*.15+time*.0026)+.35*Math.sin(x*.29-time*.0038))]});
 // Solve the area of the ACTUAL piecewise-linear wave, not just its mean.
 // The signed edge integral is exact for concave W/S polygons too.
 if(amplitude>0&&liquid.volume!==null){
  let low=-Math.max(...points.map(p=>p[1]-liquid.level)),high=-Math.min(...points.map(p=>p[1]-liquid.level));
  for(let i=0;i<14;i++){const offset=(low+high)/2;if(waveArea(liquid.polygon,points,offset)>liquid.volume)low=offset;else high=offset}
  const offset=(low+high)/2;for(const point of points)point[1]+=offset;
 }
 const surface='M'+points.map(p=>p.map(n=>Number(n.toFixed(3))).join(' ')).join('L');
 return {surface,fill:surface+`L${right} ${bottom}L${left} ${bottom}Z`,amplitude,points}
}
function fluidJetPath(jet) {
 const [x,y]=jet.source,[tx,ty]=jet.target,w=jet.width/2,dy=ty-y;
 return `M${x-w} ${y}C${x-w} ${y+dy*.45} ${tx-w*.65} ${ty-dy*.2} ${tx-w*.65} ${ty}L${tx+w*.65} ${ty}C${tx+w*.65} ${ty-dy*.2} ${x+w} ${y+dy*.45} ${x+w} ${y}Z`
}
function applyFluidFrame(svg,frame) {
 const round=n=>String(Number(n.toFixed(6)));
 const gradient=svg.querySelector('[data-siri-gradient]');if(gradient)gradient.setAttribute('gradientTransform',`rotate(${frame.motion?(frame.time%12000)/12000*360:0} .5 .5)`);
 const receiver=svg.querySelector('[data-bamboo-receiver]');if(receiver)receiver.style.transform=`rotate(${frame.angle}deg) scale(0.44)`;
 const cavity=svg.querySelector('[data-fluid-cavity]');if(cavity)cavity.setAttribute('points',frame.bamboo.polygon.map(p=>p.join(',')).join(' '));
 for(const name of ['W','S','cycle']){
  const liquid=name==='cycle'?frame.bamboo:frame[name],wave=liquidWave(liquid,frame.time,frame.motion,name==='S'?frame.jet.opacity*.8:0);
  const node=svg.querySelector(`[data-fluid-liquid="${name}"]`),surface=svg.querySelector(`[data-fluid-surface="${name}"]`);
  if(node){node.setAttribute('d',wave.fill);node.setAttribute('data-visual-fraction',liquid.fraction===null?'unknown':round(liquid.fraction));node.setAttribute('data-liquid-level',round(liquid.level));node.setAttribute('data-liquid-volume',liquid.volume===null?'unknown':round(liquid.volume));node.style.opacity=liquid.fraction===null||liquid.fraction<=0?'0':'1'}
  if(surface){surface.setAttribute('d',wave.surface);surface.style.opacity=liquid.fraction===null||liquid.fraction<=0?'0':'.85'}
  if(name==='S'){const clip=svg.querySelector('[data-session-flow-clip]');if(clip)clip.setAttribute('d',wave.fill);const current=svg.querySelector('[data-session-current]');if(current){current.setAttribute('stroke-dashoffset',frame.motion?String(-(frame.time*.028%36)):'0');current.style.opacity=liquid.fraction!==null&&liquid.fraction>0?'.5':'0'}}
 }
 const jet=svg.querySelector('[data-bamboo-pour]');if(jet){jet.setAttribute('d',fluidJetPath(frame.jet));jet.style.opacity=String(frame.jet.opacity)}
 const internal=svg.querySelector('[data-fluid-internal]');if(internal)internal.style.opacity=String(frame.jet.opacity*.65);
 const inlet=svg.querySelector('[data-bamboo-inflow]');if(inlet){inlet.style.opacity=frame.flowing?'.9':'0';inlet.setAttribute('data-bamboo-flow',frame.flowing?'running':'stopped')}
 const splash=svg.querySelector('[data-fluid-splash]');if(splash){const y=frame.S.level,[a,b]=sessionSurfaceSpan(frame.S.polygon,y),cx=(a+b)/2;splash.setAttribute('d',`M${a} ${y}Q${cx} ${y-3.6*frame.jet.opacity} ${b} ${y}`);splash.style.opacity=String(frame.jet.opacity*.7)}
 svg.setAttribute('data-physical-angle',round(frame.angle));svg.setAttribute('data-fluid-motion',frame.motion?'waves':'reduced');
}
function bambooScene(sessionLeft,weeklyLeft,id,expanded=false,cycle={progress:null,dumping:false}) {
 const m=bambooMetrics(sessionLeft,weeklyLeft,cycle),g=fluidGeometry(),frame=fluidFrame(sessionLeft,weeklyLeft,cycle,typeof document==='undefined'?0:document.timeline?.currentTime||0);
 const gid='bamboo-'+Array.from(String(id),c=>c.codePointAt(0).toString(16)).join('-'),uid=n=>`${gid}-${n}`,paint=n=>`url(#${uid(n)})`;
 const tint=(l,c,h)=>`oklch(from var(--ui-accent) ${l} ${c} ${h})`,white='var(--ui-text-primary)',muted='var(--ui-text-secondary, var(--ui-text-primary))';
 const rainbow='usage-liquid-color 8s ease-in-out infinite';
 const palette=['#087bff','#6424c8','#c41ddf','#e91e9a','#ff4fae','#ff8a18','#087bff'];
 const stops=palette.map((stopColor,i)=>jsx('stop',{offset:`${i/(palette.length-1)*100}%`,stopColor},`siri-${i}`));
 const glassBody='M145 114Q163 112 178 114Q184 109 190 114H226Q232 109 238 114H258Q271 136 258 158H238Q232 163 226 158H190Q184 163 178 158H113Z';
 const liquid=(name,data)=>{const wave=liquidWave(data,frame.time);return jsx('g',{'data-fluid-glow':name,filter:paint('liquid-glow'),children:jsxs('g',{clipPath:paint(name==='cycle'?'cavity':`tank-${name}`),className:'usage-aurora-reservoir',style:{animation:rainbow},children:[
  jsx('path',{'data-fluid-liquid':name,'data-bamboo-level':name==='cycle'?'cycle':undefined,'data-visual-fraction':data.fraction===null?'unknown':data.fraction,'data-liquid-volume':data.volume??'unknown','data-liquid-level':data.level,d:wave.fill,fill:paint('liquid'),style:{opacity:data.fraction===null||data.fraction<=0?0:1}}),
  jsx('path',{'data-fluid-surface':name,d:wave.surface,fill:'none',stroke:paint('liquid'),strokeOpacity:.9,strokeWidth:.45,vectorEffect:'non-scaling-stroke',style:{opacity:data.fraction===null||data.fraction<=0?0:.85}})
 ]})})};
 const tank=(name,value)=>jsxs('g',{'data-bamboo-reservoir':name,'data-reservoir-remaining':value,children:[
  jsx('path',{d:fluidPath(g[name]),fill:paint('glass-body'),stroke:paint('glass-edge'),strokeWidth:1.3}),liquid(name,frame[name]),
  name==='S'?jsxs('g',{clipPath:paint('tank-S'),children:[jsx('g',{clipPath:paint('session-water'),children:jsx('path',{'data-session-current':true,d:g.channel.d,fill:'none',stroke:'#b176ff',strokeOpacity:.7,strokeWidth:1.1,strokeDasharray:'6 30',strokeLinecap:'round'})}),jsx('path',{'data-fluid-internal':'S','data-session-channel':true,d:g.channel.d,fill:'none',stroke:paint('liquid'),strokeWidth:2.2,strokeLinecap:'round',style:{opacity:frame.jet.opacity*.65,animation:rainbow}}),jsx('path',{'data-fluid-splash':'S',fill:'none',stroke:white,strokeWidth:.8,style:{opacity:0}})]}):null,
  jsx('path',{d:fluidPath(g[name]),fill:'none',stroke:name==='S'?'#9c7bff':paint('glass-edge'),strokeOpacity:name==='S'?.8:1,strokeWidth:name==='S'?.55:.45,vectorEffect:'non-scaling-stroke'}),
  value===null?jsx('text',{x:name==='W'?172+(157-144)*1.4:154,y:name==='W'?100+(58-84)*1.4:226,textAnchor:'middle',fontFamily:'system-ui',fontSize:name==='W'?21:15*.9,fontWeight:650,fill:muted,children:'؟'}):null
 ]});
 return jsxs('svg',{'data-bamboo-scene':expanded?'expanded':'compact','data-material':'glass-bamboo','data-colour-style':'apple-reference-v10','data-bamboo-scale':.44,'data-weekly-scale':1.4,'data-session-shape':'s-watercourse','data-fluid-engine':'gravity-volume-v7',
  'data-flow-from':'W','data-flow-via':'cycle','data-flow-to':'S','data-outlet-position':'bottom','data-source-pipe':'none',
  'data-cycle-state':m.tipped?'dumping':cycle.phase||'unknown','data-cycle-progress':cycle.progress,'data-cycle-reset':cycle.resetMs,'data-physical-angle':frame.angle,
  viewBox:'0 0 300 266',width:expanded?'100%':68,height:expanded?236:20,'aria-hidden':true,style:{display:'block',flexShrink:0,overflow:'hidden'},children:[
   jsxs('defs',{children:[
    jsxs('filter',{id:uid('liquid-glow'),filterUnits:'userSpaceOnUse',x:-20,y:-20,width:340,height:306,colorInterpolationFilters:'sRGB',children:[
     jsx('feGaussianBlur',{in:'SourceGraphic',stdDeviation:4.5,result:'wide-halo'}),
     jsx('feGaussianBlur',{in:'SourceGraphic',stdDeviation:1.4,result:'near-halo'}),
     jsxs('feMerge',{children:[jsx('feMergeNode',{in:'wide-halo'}),jsx('feMergeNode',{in:'near-halo'}),jsx('feMergeNode',{in:'SourceGraphic'})]})
    ]}),
    jsxs('linearGradient',{id:uid('liquid'),'data-siri-gradient':true,x1:'0%',y1:'0%',x2:'100%',y2:'65%',children:stops}),
    jsxs('linearGradient',{id:uid('glass-body'),x1:'0%',y1:'0%',x2:'0%',y2:'100%',children:[jsx('stop',{offset:'0%',stopColor:tint('.95','.03','155'),stopOpacity:.25}),jsx('stop',{offset:'25%',stopColor:tint('.80','.05','160'),stopOpacity:.045}),jsx('stop',{offset:'67%',stopColor:tint('.8','.04','185'),stopOpacity:.025}),jsx('stop',{offset:'100%',stopColor:tint('.75','.06','170'),stopOpacity:.2})]}),
    jsxs('linearGradient',{id:uid('glass-edge'),x1:'0%',y1:'0%',x2:'100%',y2:'90%',children:[jsx('stop',{offset:'0%',stopColor:white,stopOpacity:.55}),jsx('stop',{offset:'35%',stopColor:tint('.8','.07','160'),stopOpacity:.5}),jsx('stop',{offset:'70%',stopColor:white,stopOpacity:.4}),jsx('stop',{offset:'100%',stopColor:tint('.65','.06','175'),stopOpacity:.45})]}),
    ...['W','S'].map(name=>jsx('clipPath',{id:uid(`tank-${name}`),children:jsx('path',{d:fluidPath(g[name])})},`clip-${name}`)),
    jsx('clipPath',{id:uid('session-water'),children:jsx('path',{'data-session-flow-clip':true,d:liquidWave(frame.S,frame.time).fill})}),
    jsx('clipPath',{id:uid('cavity'),children:jsx('polygon',{'data-fluid-cavity':true,points:frame.bamboo.polygon.map(p=>p.join(',')).join(' ')})})
   ]}),
   tank('W',weeklyLeft),
   !cycle.artOnly?jsx('text',{'data-weekly-remaining':weeklyLeft,'data-text-state':Number.isFinite(weeklyLeft)?'actual':'unknown',x:76,y:54,textAnchor:'middle',fontFamily:'system-ui',fontSize:16,fontWeight:650,fill:white,children:Number.isFinite(weeklyLeft)?`${weeklyLeft.toLocaleString('en-US',{maximumFractionDigits:1})}%`:'—'}):null,
   !cycle.artOnly?jsx('text',{x:76,y:71,textAnchor:'middle',fontFamily:'system-ui',fontSize:9.5,fill:muted,children:Number.isFinite(weeklyLeft)?'متبقٍ أسبوعيًا':'الحصة غير متاحة'}):null,
   jsx('path',{d:'M185 143L175 199M197 143L209 199',style:{transform:'scale(0.44)',transformOrigin:'191px 136px'},fill:'none',stroke:paint('glass-edge'),strokeWidth:4,strokeLinecap:'round'}),
   liquid('cycle',frame.bamboo),
   jsxs('g',{'data-bamboo-receiver':'cycle','data-bamboo-mouth':'bevel-upper-shorter','data-tipped':m.tipped,'data-upper-mouth-x':145,'data-lower-mouth-x':113,
    className:'usage-bamboo-receiver',style:{transform:`rotate(${frame.angle}deg) scale(0.44)`,transformOrigin:'191px 136px'},children:[
     jsx('path',{d:glassBody,fill:paint('glass-body'),stroke:'#a89bff',strokeWidth:.6,vectorEffect:'non-scaling-stroke'}),
     jsx('path',{d:'M149 117Q196 113 256 117M121 155Q195 159 256 155',fill:'none',stroke:white,strokeOpacity:.42,strokeWidth:.75}),
     jsx('path',{d:'M153 122Q196 119 252 122',fill:'none',stroke:white,strokeOpacity:.5,strokeWidth:1.8,strokeLinecap:'round'}),
     ...[184,232].map(x=>jsxs('g',{'data-glass-bamboo-node':x,children:[
      jsx('path',{d:`M${x-3} 114Q${x+6} 136 ${x-3} 158L${x+2} 158Q${x+11} 136 ${x+2} 114Z`,fill:tint('.85','.04','155'),fillOpacity:.1,stroke:tint('.75','.065','155'),strokeOpacity:.6,strokeWidth:.35,vectorEffect:'non-scaling-stroke'}),
      jsx('path',{d:`M${x-2} 115Q${x+6} 136 ${x-2} 157`,fill:'none',stroke:white,strokeOpacity:.65,strokeWidth:.7})
     ]},`glass-node-${x}`)),
     jsx('path',{d:'M145 114C137 108 105 151 113 158C122 168 154 123 145 114Z',fill:paint('glass-body'),stroke:'#d0b8ff',strokeWidth:.5,vectorEffect:'non-scaling-stroke'}),
     jsx('path',{d:'M143 116C134 121 119 142 115 154',fill:'none',stroke:white,strokeOpacity:.8,strokeWidth:.8}),
     jsx('path',{d:'M258 115Q269 136 258 157',fill:'none',stroke:white,strokeOpacity:.6,strokeWidth:1})
   ]},String(cycle.eventId||'idle')),
   frame.bamboo.fraction===null?jsx('text',{'data-bamboo-unknown':'cycle',x:bambooPoint([212,157])[0],y:bambooPoint([212,157])[1],textAnchor:'middle',fontSize:7,fontWeight:650,fill:muted,children:'؟'}):null,
   jsx('circle',{cx:191,cy:136,r:4.2*.44,fill:paint('glass-body'),stroke:paint('glass-edge'),strokeWidth:1}),
   jsx('circle',{cx:bambooPoint([190.3,135.3])[0],cy:bambooPoint([190.3,135.3])[1],r:1.4*.44,fill:white,fillOpacity:.65}),
   jsx('g',{filter:paint('liquid-glow'),children:jsx('path',{'data-bamboo-inflow':'W','data-bamboo-flow':frame.flowing?'running':'stopped',d:`M172 100Q172 109 ${bambooPoint([144.4,98]).join(' ')}`,fill:'none',stroke:paint('liquid'),strokeWidth:2.4,strokeLinecap:'round',strokeDasharray:'7 2',className:'usage-bamboo-flow',style:{opacity:frame.flowing?.9:0,animation:`usage-bamboo-flow 1.3s linear infinite, ${rainbow}`}})}),
   tank('S',sessionLeft),
   jsx('g',{filter:paint('liquid-glow'),children:jsx('path',{'data-bamboo-pour':'S',d:fluidJetPath(frame.jet),fill:paint('liquid'),style:{opacity:frame.jet.opacity,animation:rainbow}})})
  ]})
}
function startFluidPhysics(svg,read) {
 if(!svg||typeof window==='undefined')return()=>{};
 const media=window.matchMedia('(prefers-reduced-motion: reduce)');let raf=0,disposed=false,gain=1;
 const resize=()=>{const box=svg.getBoundingClientRect(),scale=Math.min(box.width/300,box.height/266);gain=scale>0?Math.min(2.8,Math.max(1,.55/scale)):1};resize();
 const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(resize):null;observer?.observe(svg);
 const step=()=>{if(disposed)return;const {session,weekly,cycle}=read(),frame=fluidFrame(session,weekly,cycle,document.timeline?.currentTime||0,Date.now(),media.matches);frame.motion*=gain;applyFluidFrame(svg,frame);if(!media.matches)raf=requestAnimationFrame(step)};
 const change=()=>{cancelAnimationFrame(raf);step()};media.addEventListener?.('change',change);step();
 return()=>{disposed=true;cancelAnimationFrame(raf);observer?.disconnect();media.removeEventListener?.('change',change)}
}

function syncFountainAnimations(node,cycle) {
 for(const animation of node?.getAnimations?.({subtree:true})||[]) {
  if(animation.animationName==='usage-liquid-color') animation.startTime=0
 }
}
function FountainView({provider,cycle,model='',dock=false,artOnly=false}) {
 const id=useId(), node=useRef(null),source=useRef(null)
 source.current={session:gaugeRemaining(provider),weekly:gaugeRemaining(provider,'weekly',model),cycle}
 useLayoutEffect(()=>syncFountainAnimations(node.current,cycle),[cycle?.eventId,cycle?.dumping])
 useLayoutEffect(()=>startFluidPhysics(node.current,()=>source.current),[provider,model,cycle?.eventId,cycle?.dumping,cycle?.now])
 const art=bambooScene(gaugeRemaining(provider),gaugeRemaining(provider,'weekly',model),id,true,{...cycle,artOnly})
 return jsx('svg',{...art.props,ref:node,height:dock?'100%':236,style:{...art.props.style,width:'100%',height:dock?'100%':236},'data-fountain-view':artOnly?'floating':dock?'dock':'details'})
}
function UsagePane(props={}) {
 const shared=useValue(usageView)
 const snapshot=props.snapshot||shared
 if(!snapshot)return jsx('div',{dir:'rtl',style:{padding:12},children:'جارٍ الاتصال ببيانات الموديل…'})
 const {usage,gateway,liveModel,sameProfile,query,data,provider,rawProvider,cycle,selectedAccount,onSelectAccount}=snapshot
 const now=cycle.now
 const number = n=>typeof n==='number' && Number.isFinite(n)?n.toLocaleString('en-US'):'—'
 const textStyle = {fontSize:12,color:'var(--ui-text-secondary)'}
 const cards=[]
 function addWindow(window,key) {
  const left=remaining(window)
  const expired=window.resets_at && Date.parse(window.resets_at)<=now
  cards.push(jsxs('section',{style:{borderTop:'1px solid var(--ui-stroke-secondary)',paddingTop:9,marginTop:9},children:[
   jsxs('div',{style:{display:'flex',justifyContent:'space-between',gap:8},children:[jsx('strong',{children:window.label||'حصة الحساب'}),jsx('span',{children:left===null?'النسبة غير متاحة':`${number(left)}% متبقٍ`})]}),
   left!==null?jsx('progress',{max:100,value:left,'aria-label':`المتبقي ${left}%`,style:{width:'100%',height:6,accentColor:'var(--ui-accent)',marginTop:7}}):null,
   jsx('div',{style:textStyle,children:left===null?'':`المستهلك: ${number(Math.min(100,Math.max(0,window.used_percent)))}%`}),
   jsx('div',{children:`التجدد: ${countdown(window.resets_at,now)}`}),
   window.resets_at && Number.isFinite(Date.parse(window.resets_at))?jsx('div',{style:textStyle,children:new Date(window.resets_at).toLocaleString('ar-MA')}):null,
   expired?jsx('div',{style:textStyle,children:'النسبة المعروضة آخر قراءة؛ لا نفترض تجدد الرصيد حتى يؤكده المزوّد.'}):null
  ]},key))
 }
 for(const w of (rawProvider||provider)?.usage?.windows||[]) addWindow(w,`single-${cards.length}`)
 for(const [i,account] of ((rawProvider||provider)?.usage?.accounts||[]).entries()) {
  cards.push(jsx('div',{style:{marginTop:8,fontWeight:600},children:`${account.label||`الحساب ${i+1}`} — ${account.state==='limited'?'بلغ الحد':account.state==='ready'?'متاح':account.state==='unavailable'?'غير متاح':'بيانات غير متاحة'}`},`account-${i}`))
  for(const w of account.windows||[]) addWindow(w,`account-${i}-${cards.length}`)
 }
 return jsxs('div',{'data-usage-meter':'true',dir:'rtl',style:{padding:12,height:'100%',overflow:'auto',fontSize:13,lineHeight:1.7,color:'var(--ui-text-primary)'},children:[
  jsx('div',{dir:'ltr',style:{marginBottom:8},children:jsx(FountainView,{provider,cycle,model:data?.model||liveModel||''})}),
  jsx('div',{'data-cycle-caption':true,style:{fontSize:12,color:'var(--ui-text-secondary)',marginBottom:10},children:cycle.dumping?'تجددت الحصة — تُسكب القصبة الآن في S':cycle.phase==='awaiting'?'القصبة ممتلئة — بانتظار تأكيد التجدد من المزوّد':cycle.progress===null?'موعد تجدد القصبة غير متاح':`امتلاء قصبة التجدد: ${Math.floor(cycle.progress*100)}% · المتبقي: ${countdown(new Date(cycle.resetMs).toISOString(),now)}`}),
  jsx('div',{style:{fontWeight:650},children:'الموديل والاستهلاك'}),
  (rawProvider?.usage?.accounts||[]).length>1?jsx('select',{'aria-label':'حساب مصدر بيانات الحصة',value:selectedAccount?.provider===rawProvider.slug?selectedAccount.id:'',onChange:e=>onSelectAccount?.(e.target.value),style:{maxWidth:'100%',color:'var(--ui-text-primary)',background:'var(--ui-bg-elevated)'},children:[jsx('option',{value:'',children:'تلقائي: الحساب الذي يوفّر بيانات الحصة'}),...rawProvider.usage.accounts.map(a=>jsx('option',{value:a.id,children:`${a.label||a.id} · ${a.id}`},a.id))]}):null,
  jsx('div',{dir:'ltr',style:{overflowWrap:'anywhere',fontWeight:600},children:data?.model||liveModel||'بانتظار اختيار الموديل'}),
  jsx('div',{dir:'ltr',style:textStyle,children:data?.provider||'بانتظار بيانات المزوّد'}),
  jsx('div',{style:{marginTop:10,fontWeight:600},children:'توكنز الجلسة الحالية'}),
  jsx('div',{children:`الإجمالي: ${number(usage?.total)}`}),
  jsx('div',{style:textStyle,children:`إدخال: ${number(usage?.input)} · إخراج: ${number(usage?.output)}`}),
  usage?.context_max?jsx('div',{style:textStyle,children:`السياق: ${number(usage.context_used)} / ${number(usage.context_max)} — ليس رصيد الاشتراك`}):null,
  jsx('div',{style:{marginTop:10,fontWeight:600},children:'حصة الحساب ومواعيد التجدد'}),
  ...cards,
  !cards.length?jsx('div',{style:textStyle,children:!sameProfile?'الحساب المعروض يتبع اتصالًا آخر؛ لا نعرض رصيد اتصال مختلف.':query.isPending?'جارٍ قراءة حصة الحساب…':query.isError?'تعذّرت قراءة حصة الحساب؛ اضغط تحديث للمحاولة.':quotaUnavailableReason(data?.provider||provider?.slug,provider)}):null,
  jsx('p',{style:{...textStyle,marginTop:10},children:'W هو الرصيد الأسبوعي، وS هو الرصيد المتبقي للحصة الحالية وينخفض مع الاستهلاك. القصبة بينهما تمثل الوقت المنقضي حتى التجدد الفعلي، وليس مقدار الرصيد. تمتلئ ثم تسكب دفعة واحدة بعد تأكيد التجدد من المزوّد؛ التدفق رسم توضيحي وليس تحويلًا حقيقيًا للحصة. حصة الحساب قد تكون مشتركة بين الموديلات، والنسبة ليست عدد توكنز.'}),
  query.isError && cards.length?jsx('div',{style:textStyle,children:'فشل آخر تحديث؛ المعروض آخر قراءة متاحة.'}):null,
  jsx('button',{type:'button',onClick:()=>query.refetch(),disabled:query.isFetching||!sameProfile||gateway!=='open',style:{border:'1px solid var(--ui-stroke-secondary)',borderRadius:6,padding:'3px 10px',color:'var(--ui-text-primary)',background:'transparent'},children:query.isFetching?'جارٍ التحديث…':'تحديث'}),
  jsx('div',{style:textStyle,children:'تحديث تلقائي كل دقيقة؛ إعادة محاولة سريعة عند التشغيل أو انقطاع الاتصال.'})
 ]})
}
function clampFloatingRect(rect={},viewport={width:1024,height:768}) {
 const w=Number.isFinite(viewport.width)&&viewport.width>100?viewport.width:1024
 const h=Number.isFinite(viewport.height)&&viewport.height>100?viewport.height:768
 const value=(n,fallback)=>typeof n==='number'&&Number.isFinite(n)?n:fallback
 const width=Math.max(44,Math.min(360,w-16,value(rect.width,64)))
 const height=Math.max(40,Math.min(320,h-64,value(rect.height,56)))
 return {x:Math.max(8,Math.min(w-width-8,value(rect.x,w-width-18))),y:Math.max(36,Math.min(h-height-24,value(rect.y,h-height-40))),width,height}
}
function floatingViewport(){return typeof window==='undefined'?{width:1024,height:768}:{width:window.innerWidth,height:window.innerHeight}}
function initialFloatingRect() {
 const viewport=floatingViewport()
 let saved=null
 try{saved=widgetStorage?.get('floating-art-v1',null)}catch{}
 if(saved)return clampFloatingRect(saved,viewport)
 const base=clampFloatingRect({},viewport)
 if(typeof document==='undefined')return base
 const controls=[...document.querySelectorAll('button,a,input,textarea,[role="button"]')].map(el=>({el,box:el.getBoundingClientRect()})).filter(({box})=>box.width>0&&box.height>0)
 const channels=controls.filter(({el,box})=>box.top>viewport.height*.6&&/whatsapp|telegram|واتساب|تيليجرام|تليجرام|تلجرام|تلغرام|تيليغرام/i.test([el.getAttribute('aria-label'),el.getAttribute('title'),el.textContent].filter(Boolean).join(' ')))
 const candidates=channels.flatMap(({box})=>[{...base,x:box.right+8,y:box.bottom-base.height},{...base,x:box.left-base.width-8,y:box.bottom-base.height}])
 candidates.push(base,{...base,x:12},{...base,x:viewport.width-base.width-12,y:viewport.height-base.height-100})
 const score=r=>controls.filter(({box})=>r.x<box.right&&r.x+r.width>box.left&&r.y<box.bottom&&r.y+r.height>box.top).length
 return candidates.map(r=>clampFloatingRect(r,viewport)).sort((a,b)=>score(a)-score(b))[0]||base
}
// Stay in the app's base layer. Native file panes may not create a z-index
// context, so yield the tiny figure while they overlap it instead of painting
// through them. Never move/modify native surfaces or lose the saved geometry.
function observeNativeSurfaces(node) {
 if(!node||typeof document==='undefined')return()=>{};
 let raf=0,disposed=false;
 const intersects=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
 const apply=()=>{
  raf=0;if(disposed)return;
  const boxes=[node.getBoundingClientRect()];const detail=node.querySelector('#usage-meter-details');if(detail)boxes.push(detail.getBoundingClientRect());
  const covered=[...document.querySelectorAll('[data-overlay-surface],[role="dialog"],[role="alertdialog"],[aria-modal="true"],[role="menu"],[data-floating-pane],aside')].some(el=>{
   if(node.contains(el)||el.contains(node)||el.closest('[hidden],[inert],[data-pane-hidden],[aria-hidden="true"]'))return false;
   const css=getComputedStyle(el),rect=el.getBoundingClientRect();
   return css.display!=='none'&&css.visibility!=='hidden'&&Number(css.opacity)>0&&rect.width>0&&rect.height>0&&boxes.some(box=>intersects(box,rect));
  });
  const visibility=covered?'hidden':'visible',pointer=covered?'none':'auto';
  if(node.style.visibility!==visibility)node.style.visibility=visibility;
  if(node.style.pointerEvents!==pointer)node.style.pointerEvents=pointer;
  node.setAttribute('data-native-covered',String(covered));if(covered)node.setAttribute('aria-hidden','true');else node.removeAttribute('aria-hidden');
 };
 const schedule=()=>{if(!disposed&&!raf)raf=requestAnimationFrame(apply)};
 const observer=typeof MutationObserver!=='undefined'?new MutationObserver(records=>{
  if(records.some(r=>(r.target===node&&(r.type==='childList'||r.attributeName==='style'))||!node.contains(r.target)))schedule();
 }):null;
 observer?.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','hidden','inert','aria-hidden','data-state','data-pane-hidden']});
 window.addEventListener('resize',schedule);window.addEventListener('scroll',schedule,true);document.addEventListener('transitionend',schedule,true);apply();
 return()=>{disposed=true;observer?.disconnect();cancelAnimationFrame(raf);window.removeEventListener('resize',schedule);window.removeEventListener('scroll',schedule,true);document.removeEventListener('transitionend',schedule,true)};
}
function UsageCorner() {
 const [open,setOpen]=useState(false)
 const [hover,setHover]=useState(false)
 const [geometry,setGeometry]=useState(initialFloatingRect)
 const [selectedAccount,setSelectedAccount]=useState(null)
 const geometryRef=useRef(geometry),drag=useRef(null),layerNode=useRef(null)
 const source=useUsageData(selectedAccount)
 const {provider,rawProvider,data,liveModel,cycleKey}=source
 const cycle=useQuotaCycle(provider,cycleKey)
 const left=gaugeRemaining(provider),weekly=gaugeRemaining(provider,'weekly',data?.model||liveModel||'')
 useEffect(()=>{usageView.set({...source,cycle,selectedAccount,onSelectAccount:id=>setSelectedAccount({provider:rawProvider?.slug,id})})})
 useEffect(()=>()=>usageView.set(null),[])
 useEffect(()=>observeNativeSurfaces(layerNode.current),[])
 useEffect(()=>{try{widgetStorage?.set('floating-art-v1',geometryRef.current);widgetStorage?.set('fluid-engine-v7',true);widgetStorage?.set('proportions-v8',true);widgetStorage?.set('siri-neon-v9',true);widgetStorage?.set('apple-reference-v10',true);widgetStorage?.set('s-watercourse-v11',true)}catch{}},[])
 useEffect(()=>{if(!open)return;const key=e=>{if(e.key==='Escape')setOpen(false)};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key)},[open])
 useEffect(()=>{const fit=()=>{const next=clampFloatingRect(geometryRef.current,floatingViewport());geometryRef.current=next;setGeometry(next)};window.addEventListener('resize',fit);return()=>window.removeEventListener('resize',fit)},[])
 function move(next,persist=false) {
  const fitted=clampFloatingRect(next,floatingViewport());geometryRef.current=fitted;setGeometry(fitted)
  if(persist)try{widgetStorage?.set('floating-art-v1',fitted)}catch{}
 }
 function pointerDown(event) {
  if(event.button!==0)return
  const resize=!!event.target.closest?.('[data-usage-resize]')
  drag.current={...geometryRef.current,px:event.clientX,py:event.clientY,resize}
  event.currentTarget.setPointerCapture?.(event.pointerId);event.preventDefault();setOpen(false)
 }
 function pointerMove(event) {
  const start=drag.current;if(!start)return
  const dx=event.clientX-start.px,dy=event.clientY-start.py
  move(start.resize?{x:start.x,y:start.y,width:start.width+dx,height:start.height+dy}:{x:start.x+dx,y:start.y+dy,width:start.width,height:start.height})
 }
 function pointerUp(event) {
  if(!drag.current)return
  drag.current=null;event.currentTarget.releasePointerCapture?.(event.pointerId);move(geometryRef.current,true)
 }
 const style={position:'fixed',zIndex:1,left:geometry.x,top:geometry.y,width:geometry.width,height:geometry.height,background:'transparent',border:0,padding:0,touchAction:'none',userSelect:'none',cursor:'grab',outline:'none'}
 const popupPlacement=geometry.y>280?{bottom:floatingViewport().height-geometry.y+8}:{top:geometry.y+geometry.height+8}
 return jsxs('div',{ref:layerNode,'data-usage-corner':true,'data-usage-floating':true,'data-expanded':open,'data-session-remaining':left,'data-weekly-quota':weekly,'data-provider':data?.provider,'data-model':data?.model||liveModel,'data-token-total':source.usage?.total,role:'button',tabIndex:0,'aria-label':'استهلاك الموديل — اسحب للتحريك واسحب الزاوية لتغيير الحجم',style,
  onPointerDown:pointerDown,onPointerMove:pointerMove,onPointerUp:pointerUp,onPointerCancel:pointerUp,
  onMouseEnter:()=>setHover(true),onMouseLeave:()=>setHover(false),
  onDoubleClick:()=>setOpen(true),onContextMenu:event=>{event.preventDefault();setOpen(true)},
  onKeyDown:event=>{if(event.key==='Escape')setOpen(false);if(event.key==='Enter'){event.preventDefault();setOpen(true)}},children:[
   jsx('div',{style:{width:'100%',height:'100%',pointerEvents:'none'},children:jsx(FountainView,{provider,cycle,model:data?.model||liveModel||'',dock:true,artOnly:true})}),
   jsx('div',{'data-usage-resize':true,role:'slider',tabIndex:0,'aria-label':'تغيير حجم الرسمة',onKeyDown:event=>{if(event.key==='ArrowRight'||event.key==='ArrowUp'){event.preventDefault();move({...geometryRef.current,width:geometryRef.current.width+8,height:geometryRef.current.height+8},true)}if(event.key==='ArrowLeft'||event.key==='ArrowDown'){event.preventDefault();move({...geometryRef.current,width:geometryRef.current.width-8,height:geometryRef.current.height-8},true)}},style:{position:'absolute',right:0,bottom:0,width:14,height:14,cursor:'nwse-resize',opacity:hover?1:0,transition:'opacity 150ms'},children:jsx('span',{style:{position:'absolute',right:2,bottom:2,width:7,height:7,borderRight:'1.5px solid var(--ui-text-secondary)',borderBottom:'1.5px solid var(--ui-text-secondary)',borderRadius:1,pointerEvents:'none'}})}),
   open?jsx('div',{id:'usage-meter-details',role:'region','aria-label':'تفاصيل استهلاك الموديل والرصيد',onPointerDown:event=>event.stopPropagation(),onDoubleClick:event=>event.stopPropagation(),style:{position:'fixed',zIndex:10,left:Math.max(12,Math.min(geometry.x,floatingViewport().width-352)),...popupPlacement,width:'min(340px,calc(100vw - 24px))',maxHeight:Math.max(120,Math.min(640,geometry.y>280?geometry.y-20:floatingViewport().height-geometry.y-geometry.height-28)),overflow:'auto',cursor:'auto',border:'1px solid var(--ui-stroke-secondary)',borderRadius:14,background:'var(--ui-bg-elevated)'},children:jsxs('div',{children:[jsx('button',{'aria-label':'إغلاق التفاصيل',onClick:()=>setOpen(false),style:{position:'absolute',left:8,top:8,border:0,background:'transparent',color:'var(--ui-text-primary)',cursor:'pointer'},children:'×'}),jsx(UsagePane,{})]})}):null,
   jsx('style',{children:'@keyframes usage-bamboo-flow{to{stroke-dashoffset:-28}}@keyframes usage-liquid-color{0%,100%{filter:brightness(.98) saturate(1.25)}50%{filter:brightness(1.04) saturate(1.3)}}@media(prefers-reduced-motion:reduce){[data-bamboo-scene] *{animation:none!important;transition:none!important}[data-usage-resize]{transition:none!important}}'})
  ]})
}
export default {
 id:'usage-meter',name:'استهلاك الموديل والرصيد',
 register(ctx) {
  widgetStorage=ctx.storage||null
  console.info('[usage-meter] s-watercourse-v11 loaded')
  ctx.register({id:'usage-corner-auto-v2',area:'statusBar.left',order:-10000,render:()=>jsx(UsageCorner,{})})
 }
}
