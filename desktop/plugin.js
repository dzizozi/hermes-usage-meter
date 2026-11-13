// Local read-only widget. No credentials, external services, or paid API calls.
import { host, useValue, useQuery, atom } from '@hermes/plugin-sdk'
import * as hermesSdk from '@hermes/plugin-sdk'
import { useEffect, useState, useId, useRef, useMemo, useLayoutEffect } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'

// Interface languages. The widget follows Hermes' own UI language unless the user
// picks one in the details panel (saved in plugin storage).
const USAGE_LANGUAGES=['ar','en','fr','es','zh']
const USAGE_ENDONYMS={ar:'العربية',en:'English',fr:'Français',es:'Español',zh:'中文'}
const USAGE_TEXT={
 ar:{dir:'rtl',dateLocale:'ar-MA',unknownMark:'؟',
  connecting:'جارٍ الاتصال ببيانات الموديل…',accountQuota:'حصة الحساب',pctUnavailable:'النسبة غير متاحة',left:n=>`${n}% متبقٍ`,remainingAria:n=>`المتبقي ${n}%`,used:n=>`المستهلك: ${n}%`,renewal:c=>`التجدد: ${c}`,
  lastReading:'النسبة المعروضة آخر قراءة؛ لا نفترض تجدد الرصيد حتى يؤكده المزوّد.',accountN:i=>`الحساب ${i}`,states:{limited:'بلغ الحد',ready:'متاح',unavailable:'غير متاح',unknown:'بيانات غير متاحة'},
  captionDumping:'تجددت الحصة — تُسكب القصبة الآن في S',captionAwaiting:'القصبة ممتلئة — بانتظار تأكيد التجدد من المزوّد',captionNoReset:'موعد تجدد القصبة غير متاح',captionFilling:(p,c)=>`امتلاء قصبة التجدد: ${p}% · المتبقي: ${c}`,
  modelUsage:'الموديل والاستهلاك',sourceAccount:'حساب مصدر بيانات الحصة',autoAccount:'تلقائي: الحساب الذي يوفّر بيانات الحصة',waitingModel:'بانتظار اختيار الموديل',waitingProvider:'بانتظار بيانات المزوّد',
  sessionTokens:'توكنز الجلسة الحالية',total:n=>`الإجمالي: ${n}`,inout:(i,o)=>`إدخال: ${i} · إخراج: ${o}`,context:(u,m)=>`السياق: ${u} / ${m} — ليس رصيد الاشتراك`,quotaHeading:'حصة الحساب ومواعيد التجدد',
  otherProfile:'الحساب المعروض يتبع اتصالًا آخر؛ لا نعرض رصيد اتصال مختلف.',readingQuota:'جارٍ قراءة حصة الحساب…',readFailed:'تعذّرت قراءة حصة الحساب؛ اضغط تحديث للمحاولة.',
  explanation:'W، المجرى المحفور في الصخرة، هو الرصيد الأسبوعي: يجف من جهة المنبع ويبقى الماء عند المصب. S، المجرى في الأرض، هو رصيد الجلسة الحالية (5 ساعات): يتجمع الماء في آخره وينحسر من جهة القصبة مع الاستهلاك. القصبة بينهما تمثل الوقت المنقضي حتى التجدد الفعلي، وليس مقدار الرصيد. تمتلئ ثم تسكب دفعة واحدة بعد تأكيد التجدد من المزوّد؛ التدفق والأرقام 0/1 المتطايرة رسم توضيحي وليس تحويلًا حقيقيًا للحصة. حصة الحساب قد تكون مشتركة بين الموديلات، والنسبة ليست عدد توكنز.',
  staleAfterFail:'فشل آخر تحديث؛ المعروض آخر قراءة متاحة.',refreshing:'جارٍ التحديث…',refresh:'تحديث',autoRefresh:'تحديث تلقائي كل دقيقة؛ إعادة محاولة سريعة عند التشغيل أو انقطاع الاتصال.',
  timeUnavailable:'موعد غير متاح',due:'حان الموعد — بانتظار تحديث المزوّد',duration:(d,h,m)=>(d?`${d} يوم و`:'')+`${h} س و${m} د`,
  reasonMulti:'هناك عدة حسابات؛ تعرض البطاقة بيانات كل حساب دون دمج نسبها.',reasonGemini:'تكامل Gemini الحالي في Hermes لا يوفّر بيانات الحصة المتبقية ومواعيد التجدد. توكنز الجلسة تُعرض أعلاه، ولا نحوّلها إلى نسبة تخمينية.',
  reasonClaude:'لم تصل بيانات حصة Claude في هذه القراءة. تحقق من حساب مصدر الحصة؛ لا نعرض نسبة تخمينية أو ندمج حسابين.',reasonGeneric:'لم يوفّر المزوّد بيانات الرصيد في هذه القراءة، أو لا يدعم التكامل عرضها.',
  weeklyLeft:'متبقٍ أسبوعيًا',quotaUnavailable:'الحصة غير متاحة',widgetAria:'استهلاك الموديل — اسحب للتحريك واسحب الزاوية لتغيير الحجم',resizeAria:'تغيير حجم الرسمة',detailsAria:'تفاصيل استهلاك الموديل والرصيد',close:'إغلاق التفاصيل',
  language:'اللغة',autoLanguage:'تلقائي (لغة Hermes)'},
 en:{dir:'ltr',dateLocale:'en-US',unknownMark:'?',
  connecting:'Connecting to model data…',accountQuota:'Account quota',pctUnavailable:'Percentage unavailable',left:n=>`${n}% left`,remainingAria:n=>`${n}% remaining`,used:n=>`Used: ${n}%`,renewal:c=>`Resets: ${c}`,
  lastReading:'Showing the last reading; a reset is not assumed until the provider confirms it.',accountN:i=>`Account ${i}`,states:{limited:'Limit reached',ready:'Available',unavailable:'Unavailable',unknown:'No data'},
  captionDumping:'Quota renewed — the bamboo is pouring into S',captionAwaiting:'Bamboo full — waiting for the provider to confirm the reset',captionNoReset:'Bamboo reset time unavailable',captionFilling:(p,c)=>`Bamboo reset fill: ${p}% · remaining: ${c}`,
  modelUsage:'Model and usage',sourceAccount:'Quota source account',autoAccount:'Auto: the account that reports quota',waitingModel:'Waiting for a model',waitingProvider:'Waiting for provider data',
  sessionTokens:'Current session tokens',total:n=>`Total: ${n}`,inout:(i,o)=>`Input: ${i} · Output: ${o}`,context:(u,m)=>`Context: ${u} / ${m} — not subscription quota`,quotaHeading:'Account quota and reset times',
  otherProfile:'This account belongs to another connection; its quota is not shown here.',readingQuota:'Reading account quota…',readFailed:'Could not read account quota; press Refresh to retry.',
  explanation:'W, the channel carved in the rock, is your weekly quota: it dries from its spring while the outlet end stays wet. S, the stream in the ground, is the current session (5-hour) quota: water gathers downstream and recedes from the inlet as you use it. The bamboo between them shows the time elapsed until the actual reset, not quota. It fills, then pours once the provider confirms the reset; the flow and the drifting 0/1 digits are illustration, not a real transfer of quota. Account quota may be shared across models, and the percentage is not a token count.',
  staleAfterFail:'The last refresh failed; showing the last available reading.',refreshing:'Refreshing…',refresh:'Refresh',autoRefresh:'Refreshes automatically every minute, with quick retries at startup or after a dropped connection.',
  timeUnavailable:'Time unavailable',due:'Due — waiting for the provider to update',duration:(d,h,m)=>(d?`${d} d `:'')+`${h} h ${m} min`,
  reasonMulti:'Several accounts: each card shows its own data; percentages are never merged.',reasonGemini:"Hermes' current Gemini integration does not report remaining quota or reset times. Session tokens are shown above and are never turned into a guessed percentage.",
  reasonClaude:'No Claude quota arrived in this reading. Check the quota source account; we never show a guessed percentage or merge two accounts.',reasonGeneric:'The provider did not report quota in this reading, or the integration cannot show it.',
  weeklyLeft:'weekly left',quotaUnavailable:'quota unavailable',widgetAria:'Model usage — drag to move, drag the corner to resize',resizeAria:'Resize drawing',detailsAria:'Model usage and quota details',close:'Close details',
  language:'Language',autoLanguage:'Auto (Hermes language)'},
 fr:{dir:'ltr',dateLocale:'fr-FR',unknownMark:'?',
  connecting:'Connexion aux données du modèle…',accountQuota:'Quota du compte',pctUnavailable:'Pourcentage indisponible',left:n=>`${n} % restant`,remainingAria:n=>`${n} % restant`,used:n=>`Consommé : ${n} %`,renewal:c=>`Renouvellement : ${c}`,
  lastReading:'Dernière lecture affichée ; le renouvellement n’est pas supposé tant que le fournisseur ne l’a pas confirmé.',accountN:i=>`Compte ${i}`,states:{limited:'Limite atteinte',ready:'Disponible',unavailable:'Indisponible',unknown:'Données indisponibles'},
  captionDumping:'Quota renouvelé — le bambou se déverse dans S',captionAwaiting:'Bambou plein — en attente de la confirmation du fournisseur',captionNoReset:'Heure de renouvellement du bambou indisponible',captionFilling:(p,c)=>`Remplissage du bambou : ${p} % · restant : ${c}`,
  modelUsage:'Modèle et consommation',sourceAccount:'Compte source du quota',autoAccount:'Auto : le compte qui fournit le quota',waitingModel:'En attente d’un modèle',waitingProvider:'En attente des données du fournisseur',
  sessionTokens:'Jetons de la session actuelle',total:n=>`Total : ${n}`,inout:(i,o)=>`Entrée : ${i} · Sortie : ${o}`,context:(u,m)=>`Contexte : ${u} / ${m} — ce n’est pas le quota de l’abonnement`,quotaHeading:'Quota du compte et heures de renouvellement',
  otherProfile:'Ce compte dépend d’une autre connexion ; son quota n’est pas affiché ici.',readingQuota:'Lecture du quota du compte…',readFailed:'Impossible de lire le quota du compte ; appuyez sur Actualiser pour réessayer.',
  explanation:'W, le canal creusé dans le rocher, est votre quota hebdomadaire : il s’assèche depuis sa source tandis que l’exutoire reste en eau. S, le ruisseau dans le sol, est le quota de la session actuelle (5 heures) : l’eau s’accumule en aval et recule depuis l’entrée à mesure que vous consommez. Le bambou entre les deux indique le temps écoulé jusqu’au renouvellement réel, pas le quota. Il se remplit puis se déverse une fois le renouvellement confirmé par le fournisseur ; l’écoulement et les chiffres 0/1 qui s’envolent sont illustratifs, pas un vrai transfert de quota. Le quota peut être partagé entre modèles, et le pourcentage n’est pas un nombre de jetons.',
  staleAfterFail:'La dernière actualisation a échoué ; la dernière lecture disponible est affichée.',refreshing:'Actualisation…',refresh:'Actualiser',autoRefresh:'Actualisation automatique chaque minute ; nouvelles tentatives rapides au démarrage ou après une coupure.',
  timeUnavailable:'Heure indisponible',due:'Échéance atteinte — en attente de la mise à jour du fournisseur',duration:(d,h,m)=>(d?`${d} j `:'')+`${h} h ${m} min`,
  reasonMulti:'Plusieurs comptes : chaque carte affiche ses propres données, sans fusionner les pourcentages.',reasonGemini:'L’intégration Gemini actuelle de Hermes ne fournit ni le quota restant ni les heures de renouvellement. Les jetons de session sont affichés ci-dessus et ne sont jamais convertis en pourcentage estimé.',
  reasonClaude:'Aucune donnée de quota Claude dans cette lecture. Vérifiez le compte source du quota ; nous n’affichons jamais de pourcentage estimé et ne fusionnons pas deux comptes.',reasonGeneric:'Le fournisseur n’a pas transmis de quota dans cette lecture, ou l’intégration ne permet pas de l’afficher.',
  weeklyLeft:'restant cette semaine',quotaUnavailable:'quota indisponible',widgetAria:'Consommation du modèle — glisser pour déplacer, tirer le coin pour redimensionner',resizeAria:'Redimensionner le dessin',detailsAria:'Détails de consommation et de quota',close:'Fermer les détails',
  language:'Langue',autoLanguage:'Auto (langue de Hermes)'},
 es:{dir:'ltr',dateLocale:'es-ES',unknownMark:'?',
  connecting:'Conectando con los datos del modelo…',accountQuota:'Cuota de la cuenta',pctUnavailable:'Porcentaje no disponible',left:n=>`${n} % restante`,remainingAria:n=>`${n} % restante`,used:n=>`Consumido: ${n} %`,renewal:c=>`Renovación: ${c}`,
  lastReading:'Se muestra la última lectura; no se asume la renovación hasta que el proveedor la confirme.',accountN:i=>`Cuenta ${i}`,states:{limited:'Límite alcanzado',ready:'Disponible',unavailable:'No disponible',unknown:'Sin datos'},
  captionDumping:'Cuota renovada: el bambú se vierte en S',captionAwaiting:'Bambú lleno: esperando la confirmación del proveedor',captionNoReset:'Hora de renovación del bambú no disponible',captionFilling:(p,c)=>`Llenado del bambú: ${p} % · restante: ${c}`,
  modelUsage:'Modelo y consumo',sourceAccount:'Cuenta de origen de la cuota',autoAccount:'Automático: la cuenta que informa la cuota',waitingModel:'Esperando un modelo',waitingProvider:'Esperando datos del proveedor',
  sessionTokens:'Tokens de la sesión actual',total:n=>`Total: ${n}`,inout:(i,o)=>`Entrada: ${i} · Salida: ${o}`,context:(u,m)=>`Contexto: ${u} / ${m}; no es la cuota de la suscripción`,quotaHeading:'Cuota de la cuenta y horas de renovación',
  otherProfile:'Esta cuenta pertenece a otra conexión; aquí no se muestra su cuota.',readingQuota:'Leyendo la cuota de la cuenta…',readFailed:'No se pudo leer la cuota de la cuenta; pulse Actualizar para reintentar.',
  explanation:'W, el canal tallado en la roca, es su cuota semanal: se seca desde el manantial mientras el extremo de salida sigue con agua. S, el arroyo en el suelo, es la cuota de la sesión actual (5 horas): el agua se acumula río abajo y retrocede desde la entrada a medida que la usa. El bambú entre ambos muestra el tiempo transcurrido hasta la renovación real, no la cuota. Se llena y se vierte cuando el proveedor confirma la renovación; el flujo y los dígitos 0/1 que se dispersan son ilustrativos, no una transferencia real de cuota. La cuota puede compartirse entre modelos y el porcentaje no es un número de tokens.',
  staleAfterFail:'Falló la última actualización; se muestra la última lectura disponible.',refreshing:'Actualizando…',refresh:'Actualizar',autoRefresh:'Se actualiza automáticamente cada minuto; reintentos rápidos al iniciar o tras perder la conexión.',
  timeUnavailable:'Hora no disponible',due:'Plazo cumplido: esperando la actualización del proveedor',duration:(d,h,m)=>(d?`${d} d `:'')+`${h} h ${m} min`,
  reasonMulti:'Varias cuentas: cada tarjeta muestra sus propios datos, sin combinar porcentajes.',reasonGemini:'La integración actual de Gemini en Hermes no informa la cuota restante ni las horas de renovación. Los tokens de la sesión se muestran arriba y nunca se convierten en un porcentaje estimado.',
  reasonClaude:'No llegaron datos de cuota de Claude en esta lectura. Revise la cuenta de origen de la cuota; nunca mostramos un porcentaje estimado ni combinamos dos cuentas.',reasonGeneric:'El proveedor no informó la cuota en esta lectura, o la integración no permite mostrarla.',
  weeklyLeft:'restante semanal',quotaUnavailable:'cuota no disponible',widgetAria:'Consumo del modelo: arrastre para mover y arrastre la esquina para cambiar el tamaño',resizeAria:'Cambiar el tamaño del dibujo',detailsAria:'Detalles de consumo y cuota',close:'Cerrar detalles',
  language:'Idioma',autoLanguage:'Automático (idioma de Hermes)'},
 zh:{dir:'ltr',dateLocale:'zh-CN',unknownMark:'?',
  connecting:'正在连接模型数据…',accountQuota:'账户额度',pctUnavailable:'百分比不可用',left:n=>`剩余 ${n}%`,remainingAria:n=>`剩余 ${n}%`,used:n=>`已用：${n}%`,renewal:c=>`重置：${c}`,
  lastReading:'显示的是最近一次读取；在提供方确认之前，不假定额度已重置。',accountN:i=>`账户 ${i}`,states:{limited:'已达上限',ready:'可用',unavailable:'不可用',unknown:'无数据'},
  captionDumping:'额度已重置——竹筒正在向 S 倾倒',captionAwaiting:'竹筒已满——等待提供方确认重置',captionNoReset:'竹筒重置时间不可用',captionFilling:(p,c)=>`竹筒重置进度：${p}% · 剩余：${c}`,
  modelUsage:'模型与用量',sourceAccount:'额度来源账户',autoAccount:'自动：提供额度数据的账户',waitingModel:'等待选择模型',waitingProvider:'等待提供方数据',
  sessionTokens:'当前会话 Token',total:n=>`总计：${n}`,inout:(i,o)=>`输入：${i} · 输出：${o}`,context:(u,m)=>`上下文：${u} / ${m}——不是订阅额度`,quotaHeading:'账户额度与重置时间',
  otherProfile:'此账户属于另一个连接；此处不显示其额度。',readingQuota:'正在读取账户额度…',readFailed:'无法读取账户额度；请点击刷新重试。',
  explanation:'W（刻在岩石中的水道）是每周额度：从源头开始干涸，出水口一端保持有水。S（地面上的溪流）是当前会话（5 小时）额度：水聚在下游，随着使用从入口处逐渐退去。两者之间的竹筒表示距离实际重置已过去的时间，而非额度。它会注满，并在提供方确认重置后一次倒出；水流和飘散的 0/1 数字只是示意，并非额度的真实转移。账户额度可能由多个模型共享，百分比也不是 Token 数量。',
  staleAfterFail:'上次刷新失败；显示的是最近一次可用读取。',refreshing:'正在刷新…',refresh:'刷新',autoRefresh:'每分钟自动刷新；启动或断线后会快速重试。',
  timeUnavailable:'时间不可用',due:'已到时间——等待提供方更新',duration:(d,h,m)=>(d?`${d} 天 `:'')+`${h} 小时 ${m} 分`,
  reasonMulti:'存在多个账户：每张卡片显示各自的数据，不合并百分比。',reasonGemini:'Hermes 当前的 Gemini 集成不提供剩余额度和重置时间。会话 Token 显示在上方，且不会被换算为估计的百分比。',
  reasonClaude:'本次读取未收到 Claude 额度数据。请检查额度来源账户；我们不会显示估计的百分比，也不会合并两个账户。',reasonGeneric:'提供方在本次读取中未提供额度，或该集成不支持显示额度。',
  weeklyLeft:'本周剩余',quotaUnavailable:'额度不可用',widgetAria:'模型用量——拖动可移动，拖动角落可调整大小',resizeAria:'调整图形大小',detailsAria:'模型用量与额度详情',close:'关闭详情',
  language:'语言',autoLanguage:'自动（Hermes 语言）'}
}
let currentLang='en'
var languageAtom=atom(null)
function resolveUsageLanguage(preference,hermesLocale) {
 if(USAGE_LANGUAGES.includes(preference))return preference
 const base=String(hermesLocale||'').toLowerCase().split(/[-_]/)[0]
 return USAGE_LANGUAGES.includes(base)?base:'en'
}
function usageText(lang=currentLang) {return USAGE_TEXT[lang]||USAGE_TEXT.en}
function setUsageLanguage(lang) {currentLang=USAGE_LANGUAGES.includes(lang)?lang:'en';return currentLang}
// Optional on older Hermes builds: a namespace import never fails to link.
function useUsageLanguage() {
 const preference=useValue(languageAtom)
 let locale=null
 try{locale=typeof hermesSdk!=='undefined'&&typeof hermesSdk.useI18n==='function'?hermesSdk.useI18n()?.locale:null}catch{}
 return setUsageLanguage(resolveUsageLanguage(preference,locale))
}
function chooseUsageLanguage(lang) {
 const value=USAGE_LANGUAGES.includes(lang)?lang:'auto'
 try{widgetStorage?.set('language',value)}catch{}
 languageAtom.set(value)
}

function remaining(window) {
 return typeof window?.used_percent === 'number' && Number.isFinite(window.used_percent) ? Math.max(0, Math.min(100, 100-window.used_percent)) : null
}
function countdown(reset, now, lang=currentLang) {
 const t=usageText(lang), stamp = reset ? Date.parse(reset) : NaN
 if (!Number.isFinite(stamp)) return t.timeUnavailable
 const seconds = Math.ceil((stamp-now)/1000)
 if (seconds <= 0) return t.due
 const minutes = Math.ceil(seconds/60)
 return t.duration(Math.floor(minutes/1440), Math.floor(minutes%1440/60), minutes%60)
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
function quotaUnavailableReason(slug,provider,lang=currentLang) {
 const t=usageText(lang)
 if(provider?.usage?.accounts?.length>1) return t.reasonMulti
 if(/^(gemini|google|google-gemini|google-ai-studio|solstice|solstice-oauth)$/.test(slug||'')) return t.reasonGemini
 if(slug==='anthropic') return t.reasonClaude
 return t.reasonGeneric
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
// 45-degree oblique camera: every horizontal surface (the ground and the top of
// the rock) is foreshortened by cos45, so the channels lie flat on what carved them.
const CAMERA_K=Math.SQRT1_2;
function catmullRom(knots,steps=6,closed=false) {
 const n=knots.length,out=closed?[]:[knots[0]],count=closed?n:n-1,at=i=>closed?knots[(i+n)%n]:knots[Math.max(0,Math.min(n-1,i))];
 for(let i=0;i<count;i++){const p0=at(i-1),p1=at(i),p2=at(i+1),p3=at(i+2);
  for(let s=closed?0:1;s<=(closed?steps-1:steps);s++){const t=s/steps,t2=t*t,t3=t2*t;out.push([0,1].map(k=>.5*(2*p1[k]+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t2+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t3)))}}
 return out
}
// Built in ground coordinates, then projected: the width is foreshortened exactly
// like the surface the water carved it into.
function carvedChannel(ground,half,project) {
 const left=[],right=[];
 for(let i=0;i<ground.length;i++){const a=ground[Math.max(0,i-1)],b=ground[Math.min(ground.length-1,i+1)],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1,nx=-dz/l*half,nz=dx/l*half;
  left.push(project([ground[i][0]+nx,ground[i][1]+nz]));right.push(project([ground[i][0]-nx,ground[i][1]-nz]))}
 // Tight meanders can fold the inner bank onto itself; collapse each fold to its
 // crossing point (keeping indices aligned) so the bank stays a simple outline.
 const meet=(a,b,c,d)=>{const r=[b[0]-a[0],b[1]-a[1]],s=[d[0]-c[0],d[1]-c[1]],den=r[0]*s[1]-r[1]*s[0];if(Math.abs(den)<1e-12)return null;const t=((c[0]-a[0])*s[1]-(c[1]-a[1])*s[0])/den,u=((c[0]-a[0])*r[1]-(c[1]-a[1])*r[0])/den;return t>0&&t<1&&u>0&&u<1?[a[0]+t*r[0],a[1]+t*r[1]]:null};
 for(const line of [left,right])for(let i=0;i<line.length-3;i++)for(let j=Math.min(line.length-2,i+16);j>i+1;j--){const p=meet(line[i],line[i+1],line[j],line[j+1]);if(p){for(let q=i+1;q<=j;q++)line[q]=p;i=j;break}}
 const points=ground.map(project);let length=0;for(let i=1;i<points.length;i++)length+=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);
 return {ground,points,left,right,polygon:[...left,...[...right].reverse()],half,length,d:'M'+points.map(p=>p.map(n=>Number(n.toFixed(3))).join(' ')).join('L')}
}
function makeSessionChannel() {
 const project=p=>[p[0],151+p[1]*CAMERA_K],start=[160,0],ground=[start];let previous=start;
 // The last bend runs on past the left edge of the drawing, so the stream has no visible end.
 const curves=[[[125,0],[90,10],[90,36]],[[90,56],[162,60],[168,84]],[[174,106],[156,133],[118,133]],[[86,133],[46,140],[1.6,150]]];
 for(const [a,b,c] of curves){const s=previous;for(let i=1;i<=28;i++){const t=i/28,u=1-t;ground.push([0,1].map(k=>u*u*u*s[k]+3*u*u*t*a[k]+3*u*t*t*b[k]+t*t*t*c[k]))}previous=c}
 const channel=carvedChannel(ground,7,project),pr=p=>project(p).map(n=>Number(n.toFixed(3))).join(' ');
 // The stream runs downhill from the bamboo; water pools at its far end first.
 return {...channel,inlet:[158,151],end:project([1.6,150]),exitsView:true,width:14,surface:'ground',drainsFrom:'upstream',d:'M'+pr(start)+curves.map(c=>'C'+c.map(pr).join(' ')).join('')}
}
// W is carved into the flat top of a boulder that sits on the ground behind the
// bamboo. Water rises at the right-hand spring and leaves from the left end.
// One 45-degree camera for everything: ground point (x,z) at height h appears at
// (x, 151+(z-h)cos45). The rock is a real extruded block standing on the ground
// behind the bamboo; its top, where W is carved, is parallel to the ground.
function groundToScreen(x,z,h=0) {return [x,151+(z-h)*CAMERA_K]}
// Without convergence a level top reads as tilted toward the viewer, so the rock
// recedes with mild perspective behind z=0 (its front stays aligned with the ground).
var ROCK_PERSPECTIVE={cx:150,depth:380};
function rockToScreen(x,z,h=0) {const s=1+Math.min(0,z)/ROCK_PERSPECTIVE.depth;return [ROCK_PERSPECTIVE.cx+(x-ROCK_PERSPECTIVE.cx)*s,151+z*CAMERA_K-h*CAMERA_K*s]}
function convexHull(points) {
 const p=[...points].sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]),lower=[],upper=[];
 for(const q of p){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),q)<=0)lower.pop();lower.push(q)}
 for(const q of p.reverse()){while(upper.length>1&&cross(upper.at(-2),upper.at(-1),q)<=0)upper.pop();upper.push(q)}
 return [...lower.slice(0,-1),...upper.slice(0,-1)]
}
var ROCK_3D={height:96,footprint:[[199,-97],[224,-104],[252,-105],[278,-100],[298,-90],[307,-66],[307,-24],[298,-6],[278,2.5],[252,5],[226,1.5],[208,-5],[197,-19],[194.5,-46],[196,-76]]};
// A large rocky mountain fills the back of the scene; the boulder stands at its foot.
// Ridges are layered smooth noise; light comes from the upper left, so every slope
// that falls to the right is in shade and each valley sends a gully down the face.
function makeMountain() {
 const ridge=(base,amp,seed,step=3)=>{const out=[];for(let x=-12;x<=312;x+=step){const n=.5*Math.sin(x*.019+seed)+.28*Math.sin(x*.047+seed*2.3)+.14*Math.sin(x*.11+seed*3.7)+.08*Math.sin(x*.29+seed*5.1);out.push([x,Number((base-amp*n-14*Math.exp(-(((x-70)/60)**2))).toFixed(2))])}return out};
 const farRidge=ridge(30,22,1.3,4),nearRidge=ridge(50,30,4.1,3),base=112;
 const far=[[-12,base],...farRidge,[312,base]],near=[[-12,base],...nearRidge,[312,base]];
 const shade=[],gullies=[],highlights=[];let i=1;
 const extreme=(j,dir)=>{while(j<nearRidge.length-1&&Math.sign(nearRidge[j+1][1]-nearRidge[j][1])===dir)j++;return j};
 while(i<nearRidge.length-2){
  if(nearRidge[i][1]<nearRidge[i-1][1]&&nearRidge[i][1]<=nearRidge[i+1][1]){
   const v=extreme(i,1),p=nearRidge[i],q=nearRidge[v],w=q[0]-p[0];
   if(w>4){const hq=base-q[1],hp=base-p[1];
    // a tapering wedge of shade on the slope that faces away from the light
    const deep=Math.min(hq*.62,w*1.5);
    shade.push([...nearRidge.slice(i,v+1),[q[0]-w*.08,q[1]+deep*.6],[p[0]+w*.5,Math.max(p[1],q[1])+deep],[p[0]+w*.18,p[1]+Math.min(hp*.32,w*.8)]]);
    gullies.push([q,[q[0]+w*.04,q[1]+deep*.35],[q[0]-w*.06,q[1]+deep*.65]]);
    highlights.push([p,[p[0]-w*.1,p[1]+hp*.22],[p[0]-w*.04,p[1]+hp*.4]])}
   i=Math.max(v,i+1)
  }else i++
 }
 const shrubs=[];for(let k=0;k<40;k++){const x=sceneHash(k*4.3+.7)*300,y=78+sceneHash(k*6.1+.2)*32;if(pointInPolygon([x,y-3],near))shrubs.push([Number(x.toFixed(2)),Number(y.toFixed(2)),Number((1+sceneHash(k*8.9)*1.6).toFixed(2))])}
 return {far,near,shade,gullies,highlights,shrubs,base}
}
function makeWeeklyChannel() {
 const k=CAMERA_K,H=ROCK_3D.height,knots=[[174.5,32],[181,31],[187,33],[192,38],[195,44],[196,50],[200,57],[203,62],[207,66],[212,66.5],[216,62.5],[218,56],[221,50],[223,44],[226,40],[230,37.5],[234,37.5],[238,40],[240,44],[241,49],[246,55],[249,61],[253,65.5],[258,66.5],[262,63],[265,57],[268,51],[272,43],[276,35],[281,28],[288,23]];
 // The W lies in the level top of the block (height H), read by the viewer with
 // its top edge away from them; the groove deepens toward the outlet.
 const toGround=p=>[203+(p[0]-174.5)*.78,-66+(p[1]-23)/k*.82],project=p=>rockToScreen(p[0],p[1],H);
 const channel=carvedChannel(catmullRom(knots.map(toGround),5),5,project);
 const last=channel.left.length-1,bedDepth=channel.left.map((_,i)=>1.2+3.4*(1-i/last));
 const bed=[...channel.left.map((p,i)=>[p[0],p[1]+bedDepth[i]]),...channel.right.map((p,i)=>[p[0],p[1]+bedDepth[i]]).reverse()];
 const foot=ROCK_3D.footprint,tops=foot.map((_,i)=>H-1+2.4*Math.sin(i*2.3));
 const plateau=foot.map((p,i)=>rockToScreen(p[0],p[1],tops[i])),base=foot.map(p=>rockToScreen(p[0],p[1],0));
 // Only side faces whose outward normal points toward the camera are visible.
 const cx=foot.reduce((s,p)=>s+p[0],0)/foot.length,cz=foot.reduce((s,p)=>s+p[1],0)/foot.length,facets=[];
 for(let i=0;i<foot.length;i++){const j=(i+1)%foot.length,a=foot[i],b=foot[j];let n=[b[1]-a[1],-(b[0]-a[0])];const l=Math.hypot(n[0],n[1])||1;n=[n[0]/l,n[1]/l];
  if(n[0]*((a[0]+b[0])/2-cx)+n[1]*((a[1]+b[1])/2-cz)<0)n=[-n[0],-n[1]];
  const mx=(a[0]+b[0])/2,seen=n[1]>.05||(n[0]<-.3&&mx>ROCK_PERSPECTIVE.cx)||(n[0]>.3&&mx<ROCK_PERSPECTIVE.cx);
  if(seen)facets.push({shade:n[0]<-.35?'lit':n[0]>.35?'shade':'mid',normal:n,depth:(a[1]+b[1])/2,points:[base[i],base[j],plateau[j],plateau[i]]})}
 facets.sort((a,b)=>a.depth-b.depth);
 const rock=convexHull([...plateau,...base]);
 // Kakei: a bamboo as thick as the rocker, split lengthwise so only its lower
 // half remains; it carries the W water, sloping down, to just above the mouth.
 const mouth=bambooPoint([144.4,98]),postZ=(BAMBOO_POST.base-151)/k,mouthH=(151+postZ*k-mouth[1])/k,r=9.7;
 const start=[channel.ground[0][0],channel.ground[0][1],H-1],end=[mouth[0]-1.5,postZ,mouthH+r+4],mid=[0,1,2].map(i=>(start[i]+end[i])/2);
 const gl=Math.hypot(end[0]-start[0],end[1]-start[1]),n3=[-(end[1]-start[1])/gl,(end[0]-start[0])/gl];
 const pt=(p,side,dh=0)=>rockToScreen(p[0]+n3[0]*r*side,p[1]+n3[1]*r*side,p[2]+dh),along=t=>[0,1,2].map(i=>start[i]+(end[i]-start[i])*t);
 const rimA=[pt(start,1),pt(start,-1)],rimB=[pt(end,1),pt(end,-1)],profile=(p,steps=12)=>Array.from({length:steps+1},(_,i)=>{const a=i/steps*Math.PI;return pt(p,Math.cos(a),-r*Math.sin(a))});
 const crossH=mid[2]-r-1.5,spread=7.5;
 const kakei={start,end,radius:r,mouthHeight:mouthH,postDepth:postZ,screenStart:rockToScreen(...start),screenEnd:rockToScreen(...end),
  outer:convexHull([...rimA,...rimB,...profile(start),...profile(end)]),inner:[rimA[0],rimB[0],rimB[1],rimA[1]],
  water:[pt(start,.5,-r*.45),pt(end,.5,-r*.45),pt(end,-.5,-r*.45),pt(start,-.5,-r*.45)],waterAxis:[pt(start,0,-r*.4),pt(end,0,-r*.4)],
  endProfile:profile(end),nodes:[.32,.66].map(t=>profile(along(t),8)),
  trestle:{depth:mid[1],crossHeight:crossH,feet:[mid[0]-spread,mid[0]+spread],sticks:[[groundToScreen(mid[0]-spread,mid[1],0),groundToScreen(mid[0]+spread*.5,mid[1],crossH*1.5)],[groundToScreen(mid[0]+spread,mid[1],0),groundToScreen(mid[0]-spread*.5,mid[1],crossH*1.5)]]}};
 // A rock outcrop at the spring hides where the water comes from. Its edge stops
 // just past the channel's end, so no quota-bearing water is ever covered.
 const end2=channel.points.at(-1),back=channel.points.at(-6),dl=Math.hypot(end2[0]-back[0],end2[1]-back[1]),d=[(end2[0]-back[0])/dl,(end2[1]-back[1])/dl],nn=[-d[1],d[0]];
 const at=(a,b)=>[end2[0]+d[0]*a+nn[0]*b,end2[1]+d[1]*a+nn[1]*b];
 // A weathered boulder sits on the slab over the spring; its near edge stops just
 // past the channel end and its body rises above it.
 const oc=[end2[0]+12,end2[1]-7],outcrop=Array.from({length:14},(_,i)=>{const a=i/14*Math.PI*2,s=Math.sin(a),rr=1+.12*Math.sin(i*2.7);return [oc[0]+17*Math.cos(a)*rr,oc[1]+(s>0?6.5*s:12*s)*rr]});
 return {...channel,lip:channel.points[0],spring:end2,springDirection:d,plateau,base,rock,facets,outcrop,kakei,rock3d:{footprint:foot,height:H,tops},surfaceTilt:{tiltDegrees:0,k,height:H},bed,bedDepth,surface:'rock',drainsFrom:'source'}
}
function pointInPolygon(p,poly) {let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])c=!c}return c}
function distanceToPolygon(p,poly) {let d=Infinity;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l));d=Math.min(d,Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy))}return d}
function sceneHash(n) {const x=Math.sin(n*127.1+17.3)*43758.5453;return x-Math.floor(x)}
// Grass, stones and pebbles grow on the banks and the ground, never in the water.
function makeGarden(S,W,rock,ground) {
 const k=CAMERA_K,blocked=(p,gap)=>pointInPolygon(p,S.polygon)||pointInPolygon(p,W.polygon)||pointInPolygon(p,rock)||distanceToPolygon(p,S.polygon)<gap||!pointInPolygon(p,ground);
 const bank=(frac,dist,far)=>{const n=S.ground.length-1,i=Math.round(frac*n),a=S.ground[Math.max(0,i-1)],b=S.ground[Math.min(n,i+1)],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1;let nx=-dz/l,nz=dx/l;if((nz<0)!==far){nx=-nx;nz=-nz}return[S.ground[i][0]+nx*dist,151+(S.ground[i][1]+nz*dist)*k]};
 const grass=[],tryGrass=(p,s)=>{for(let up=0;up<=4;up++)if(blocked([p[0],p[1]-up],1.2))return;if(grass.some(q=>Math.hypot(q[0]-p[0],q[1]-p[1])<8))return;grass.push([Number(p[0].toFixed(2)),Number(p[1].toFixed(2)),s])};
 [.02,.1,.19,.27,.36,.45,.53,.62,.71,.8,.88,.97].forEach((f,i)=>tryGrass(bank(f,9.5+sceneHash(i)*3,i%3!==2),Number((1+sceneHash(i+9)*.45).toFixed(2))));
 [[34,176,1.1],[56,232,1.2],[250,168,1.15],[284,196,1.25],[236,238,1.35],[272,248,1.05],[150,120,.95],[286,132,1],[214,128,.85]].forEach(([x,y,s])=>tryGrass([x,y],s));
 const stones=[];
 // Stones that always guard the spot where the bamboo pours into S.
 [[169.5,148.6,4.6],[149,139.6,3.8],[165,161.4,3.4],[140.5,138.4,2.6]].forEach(([x,y,r],i)=>{const cz=(y-151)/k,footprint=[],outline=[];
  for(let j=0;j<12;j++){const a=j/12*Math.PI*2,rr=r*(.82+.3*sceneHash(i*41+j+5)),p=[x+Math.cos(a)*rr*1.15,151+(cz+Math.sin(a)*rr)*k];footprint.push(p);outline.push([p[0],p[1]-Math.max(0,-Math.sin(a))*r*1.05*k])}
  if(!footprint.some(p=>pointInPolygon(p,S.polygon)||distanceToPolygon(p,S.polygon)<.6))stones.push({x,y,r,footprint,outline,source:true})});
 [[.06,1],[.24,0],[.33,1],[.5,0],[.66,1],[.83,0],[.93,1]].forEach(([f,far],i)=>{const r=3.6+sceneHash(i*7.7)*2.6,c=bank(f,7+r*1.15+1.8,!!far),cz=(c[1]-151)/k,footprint=[],outline=[];
  for(let j=0;j<11;j++){const a=j/11*Math.PI*2,rr=r*(.8+.32*sceneHash(i*31+j)),p=[c[0]+Math.cos(a)*rr*1.15,151+(cz+Math.sin(a)*rr)*k];footprint.push(p);outline.push([p[0],p[1]-Math.max(0,-Math.sin(a))*r*.95*k])}
  if(footprint.some(p=>pointInPolygon(p,S.polygon)||distanceToPolygon(p,S.polygon)<.8||pointInPolygon(p,W.polygon)||!pointInPolygon(p,ground))||stones.some(s=>Math.hypot(s.x-c[0],s.y-c[1])<s.r+r+2))return;
  stones.push({x:c[0],y:c[1],r,footprint,outline})});
 const pebbles=[];for(let i=0;pebbles.length<34&&i<500;i++){const p=[20+sceneHash(i*3.1)*276,100+sceneHash(i*5.7)*160];if(blocked(p,1.5)||stones.some(s=>Math.hypot(s.x-p[0],s.y-p[1])<s.r*1.6))continue;pebbles.push([Number(p[0].toFixed(2)),Number(p[1].toFixed(2)),Number((.6+sceneHash(i*9.3)*1.1).toFixed(2))])}
 return {grass,stones,pebbles}
}
const BUTTERFLY_PERIOD=30000,BUTTERFLY_VISIT=11000;
// Support post: thicker than the glass rocker (diameter 19.4), hollow, slotted from the top.
var BAMBOO_POST={x:191,top:127,slot:149,base:173,outer:12.5,inner:10.6,slotHalf:10.2};
// Where S leaves the picture, its water dissolves into tiny 0/1 digits that drift
// up and fade. Purely decorative: only while S holds water, never under reduced motion.
const BINARY_SLOTS=16,BINARY_LIFE=2600,BINARY_COLOURS=['#3d9bff','#8f5bff','#c41ddf','#ff4fae','#ff8a18'];
function binaryDigit(time,index,sessionFraction) {
 if(!Number.isFinite(time)||time<0||!(sessionFraction>0))return null;
 const ch=FLUID_GEOMETRY.channel,n=ch.points.length-1,phase=time+index*BINARY_LIFE/BINARY_SLOTS,cycle=Math.floor(phase/BINARY_LIFE),u=phase/BINARY_LIFE-cycle,h=k=>sceneHash(cycle*7.31+index*3.17+k);
 if(h(9)>.8)return null;
 const i=n-1-Math.floor(h(1)*9),side=.2+.6*h(2),start=[ch.left[i][0]+(ch.right[i][0]-ch.left[i][0])*side,ch.left[i][1]+(ch.right[i][1]-ch.left[i][1])*side];
 return {x:start[0]-(4+12*h(4))*u+1.6*Math.sin(u*6.3+h(5)*6),y:start[1]-(10+16*h(3))*u*(1-.35*u),char:h(6)<.5?'0':'1',opacity:Math.min(1,u/.15)*Math.pow(1-u,1.3),size:4.4+2.4*h(7)*(1-.25*u),colour:BINARY_COLOURS[Math.floor(h(8)*BINARY_COLOURS.length)]}
}
// Every 30 s one or two butterflies arrive with an erratic, bobbing flight, rest
// on a grass tip (slowly opening and closing their wings) and fly away.
function butterflyFlight(time,index) {
 if(!Number.isFinite(time)||time<0)return null;
 const grass=FLUID_GEOMETRY.grass,cycle=Math.floor(time/BUTTERFLY_PERIOD),count=sceneHash(cycle*3.7)>.5?2:1;if(index>=count||!grass.length)return null;
 const local=time-cycle*BUTTERFLY_PERIOD-index*1900;if(local<0||local>BUTTERFLY_VISIT)return null;
 const h=k=>sceneHash(cycle*13.1+index*5.3+k),ease=n=>n*n*(3-2*n),lerp=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
 const tuft=grass[Math.floor(h(1)*grass.length)],rest=[tuft[0]+(h(2)-.5)*4,tuft[1]-13*tuft[2]-2];
 const fromLeft=h(3)<.5,entry=[fromLeft?-16:316,120+h(4)*90],exit=[fromLeft?316:-16,30+h(5)*70];
 const place=t=>{const u=t/BUTTERFLY_VISIT,base=u<.33?lerp(entry,rest,ease(u/.33)):u<.68?rest:lerp(rest,exit,ease((u-.68)/.32));
  const perched=u>=.4&&u<.62,jitter=perched?0:u<.33||u>=.68?1:Math.min(1,Math.max(0,(Math.abs(u-.51)-.11)/.07));
  return {p:[base[0]+jitter*(2.6*Math.sin(t*.0047+h(7)*6)+1.1*Math.sin(t*.013)),base[1]+jitter*3.2*Math.sin(t*.014+h(8)*6)],perched,u}};
 const now=place(local),before=place(Math.max(0,local-24)),dx=now.p[0]-before.p[0],dy=now.p[1]-before.p[1];
 const heading=now.perched||Math.hypot(dx,dy)<.02?Math.atan2(rest[1]-entry[1],rest[0]-entry[0]):Math.atan2(dy,dx);
 const flap=now.perched?.1+.9*Math.pow(.5+.5*Math.sin(local*.0017+1),4):.14+.86*Math.abs(Math.sin(local*.032));
 return {x:now.p[0],y:now.p[1],angle:heading*180/Math.PI+90,flap,opacity:Math.min(1,now.u/.05,(1-now.u)/.05),perched:now.perched,variant:index}
}
function easeShownQuota(shown,target,dt,reduced=false) {
 if(reduced||typeof target!=='number'||!Number.isFinite(target)||typeof shown!=='number'||!Number.isFinite(shown))return target;
 const next=shown+(target-shown)*(1-Math.exp(-Math.max(0,dt)/1100));return Math.abs(target-next)<.02?target:next
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
 const weekly=makeWeeklyChannel(),W=weekly.polygon,mountain=makeMountain();
 const channel=makeSessionChannel(),S=channel.polygon;
 // The ground runs to every edge of the scene; its far edge meets the mountain foot.
 const ground=[[-40,104],[40,98],[120,94],[200,90],[260,86],[340,88],[340,300],[-40,300]];
 const garden=makeGarden(channel,weekly,weekly.rock,ground);
 const bamboo=[[148,120],[254,120],[254,152],[119,152]].map(bambooPoint),rest=bamboo.map(p=>rotateFluidPoint(p,45));
 return {W,S,channel,weekly,mountain,rock:weekly.rock,plateau:weekly.plateau,outcrop:weekly.outcrop,ground,...garden,camera:{elevation:45,k:CAMERA_K},bamboo,capacity:polygonArea(polygonBelow(rest,rotateFluidPoint(bambooPoint([113,158]),45)[1]))}
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
 return {angle:state.angle,W:channelLiquid(FLUID_GEOMETRY.weekly,fraction(weeklyLeft)),S:channelLiquid(FLUID_GEOMETRY.channel,session),
  bamboo:liquid(state.polygon,buffer,FLUID_GEOMETRY.capacity),
  jet:{source:state.lip,target:FLUID_GEOMETRY.channel.inlet,opacity:Math.min(1,flux*.45),width:Math.min(5,1.4+Math.sqrt(flux)*1.3)},
  flowing:known(weeklyLeft)&&weeklyLeft>0&&progress!==null&&progress<1&&!dumping,
  motion:reduced?0:1,time:nowDoc}
}
// Water in a flat channel has no tilted level: it fills from the end it drains
// toward. W keeps water at its outlet and dries from the spring; S pools at its
// downstream end and dries from the inlet. Filled area equals the real quota.
function channelLiquid(channel,value) {const capacity=polygonArea(channel.polygon);return {polygon:channel.polygon,channel,fraction:value,capacity,volume:value===null?null:value*capacity,level:null,kind:'channel'}}
function channelFill(liquid,time=0,motion=1) {
 const ch=liquid.channel,f=liquid.fraction,format=p=>p.map(n=>Number(n.toFixed(3))).join(' ');
 if(f===null||!(f>0))return {polygon:[],fill:'',surface:'',amplitude:0,front:null};
 if(f>=1)return {polygon:ch.polygon,fill:fluidPath(ch.polygon),surface:'',amplitude:0,front:null};
 const fromEnd=ch.drainsFrom==='upstream',L=fromEnd?[...ch.left].reverse():ch.left,R=fromEnd?[...ch.right].reverse():ch.right,n=L.length-1;
 const amplitude=Math.max(0,motion)*1.1*Math.min(1,f*8,(1-f)*8),delta=amplitude*Math.sin(time*.0042)/(ch.length/n);
 const at=(a,s)=>{const i=Math.max(0,Math.min(n-1,Math.floor(s))),t=Math.max(0,Math.min(n,s))-i;return[a[i][0]+(a[i+1][0]-a[i][0])*t,a[i][1]+(a[i+1][1]-a[i][1])*t]};
 const build=s=>{const sl=Math.max(0,Math.min(n,s+delta)),sr=Math.max(0,Math.min(n,s-delta)),l=L.slice(0,Math.floor(sl)+1),r=R.slice(0,Math.floor(sr)+1),a=at(L,sl),b=at(R,sr);l.push(a);r.push(b);return {polygon:[...l,...r.reverse()],front:[a,b]}};
 const target=f*liquid.capacity;let lo=-Math.abs(delta),hi=n+Math.abs(delta);
 for(let i=0;i<40;i++){const m=(lo+hi)/2;if(polygonArea(build(m).polygon)<target)lo=m;else hi=m}
 const r=build((lo+hi)/2);
 return {polygon:r.polygon,fill:fluidPath(r.polygon),surface:`M${format(r.front[0])}L${format(r.front[1])}`,amplitude,front:r.front}
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
  const liquid=name==='cycle'?frame.bamboo:frame[name],impact=name==='S'?frame.jet.opacity*.8:0;
  const wave=liquid.kind==='channel'?channelFill(liquid,frame.time,frame.motion*(1+impact)):liquidWave(liquid,frame.time,frame.motion,impact);
  const node=svg.querySelector(`[data-fluid-liquid="${name}"]`),surface=svg.querySelector(`[data-fluid-surface="${name}"]`),empty=liquid.fraction===null||liquid.fraction<=0;
  if(node){node.setAttribute('d',wave.fill);node.setAttribute('data-visual-fraction',liquid.fraction===null?'unknown':round(liquid.fraction));node.setAttribute('data-liquid-level',liquid.level===null?'channel':round(liquid.level));node.setAttribute('data-liquid-volume',liquid.volume===null?'unknown':round(liquid.volume));node.style.opacity=empty?'0':'1'}
  if(surface){surface.setAttribute('d',wave.surface);surface.style.opacity=empty?'0':'.85'}
  if(liquid.kind==='channel'){
   const key=name==='W'?'weekly':'session',clip=svg.querySelector(`[data-${key}-flow-clip]`),current=svg.querySelector(`[data-${key}-current]`);if(clip)clip.setAttribute('d',wave.fill);
   // W flows from its spring toward the outlet (path start); S flows downstream (path end).
   if(current){current.setAttribute('stroke-dashoffset',frame.motion?String((name==='W'?1:-1)*(frame.time*.028%36)):'0');current.style.opacity=empty?'0':'.5'}
  }
 }
 const jet=svg.querySelector('[data-bamboo-pour]');if(jet){jet.setAttribute('d',fluidJetPath(frame.jet));jet.style.opacity=String(frame.jet.opacity)}
 const internal=svg.querySelector('[data-fluid-internal]');if(internal)internal.style.opacity=String(frame.jet.opacity*.65);
 const inlet=svg.querySelector('[data-bamboo-inflow]');if(inlet){inlet.style.opacity=frame.flowing?'.9':'0';inlet.setAttribute('data-bamboo-flow',frame.flowing?'running':'stopped')}
 for(const node of svg.querySelectorAll('[data-kakei-water],[data-kakei-current]'))node.style.opacity=frame.flowing?(node.hasAttribute('data-kakei-water')?'.95':'.7'):'0';
 const splash=svg.querySelector('[data-fluid-splash]');if(splash){const [x,y]=FLUID_GEOMETRY.channel.inlet,o=frame.jet.opacity,r=2.5+4.5*((frame.time%650)/650),ry=r*CAMERA_K*.55;splash.setAttribute('d',`M${round(x-r)} ${y}A${round(r)} ${round(ry)} 0 1 0 ${round(x+r)} ${y}A${round(r)} ${round(ry)} 0 1 0 ${round(x-r)} ${y}`);splash.style.opacity=String(o*.7)}
 for(const node of svg.querySelectorAll('[data-binary-digit]')){
  const d=frame.motion?binaryDigit(frame.time,Number(node.getAttribute('data-binary-digit')),frame.S.fraction):null;
  node.style.opacity=d?String(Number(d.opacity.toFixed(3))):'0';
  if(d){node.setAttribute('x',round(d.x));node.setAttribute('y',round(d.y));node.setAttribute('font-size',round(d.size));node.setAttribute('fill',d.colour);if(node.textContent!==d.char)node.textContent=d.char}
 }
 for(const node of svg.querySelectorAll('[data-butterfly]')){
  const b=frame.motion?butterflyFlight(frame.time,Number(node.getAttribute('data-butterfly'))):null;
  node.setAttribute('data-butterfly-state',b?(b.perched?'resting':'flying'):'away');node.style.opacity=b?String(Number(b.opacity.toFixed(3))):'0';
  if(b){node.setAttribute('transform',`translate(${round(b.x)} ${round(b.y)}) rotate(${round(b.angle)}) scale(.9)`);const wings=node.querySelector('[data-butterfly-wings]');if(wings)wings.setAttribute('transform',`scale(${round(b.flap)} 1)`)}
 }
 svg.setAttribute('data-physical-angle',round(frame.angle));svg.setAttribute('data-fluid-motion',frame.motion?'waves':'reduced');
}
function bambooScene(sessionLeft,weeklyLeft,id,expanded=false,cycle={progress:null,dumping:false}) {
 const m=bambooMetrics(sessionLeft,weeklyLeft,cycle),g=fluidGeometry(),frame=fluidFrame(sessionLeft,weeklyLeft,cycle,typeof document==='undefined'?0:document.timeline?.currentTime||0);
 const gid='bamboo-'+Array.from(String(id),c=>c.codePointAt(0).toString(16)).join('-'),uid=n=>`${gid}-${n}`,paint=n=>`url(#${uid(n)})`;
 const tint=(l,c,h)=>`oklch(from var(--ui-accent) ${l} ${c} ${h})`,white='var(--ui-text-primary)',muted='var(--ui-text-secondary, var(--ui-text-primary))';
 const rainbow='usage-liquid-color 8s ease-in-out infinite';
 const palette=['#087bff','#6424c8','#c41ddf','#e91e9a','#ff4fae','#ff8a18','#087bff'];
 const stops=palette.map((stopColor,i)=>jsx('stop',{offset:`${i/(palette.length-1)*100}%`,stopColor},`siri-${i}`));
 const gradient=(id,list,props={})=>jsxs('linearGradient',{id:uid(id),x1:'0%',y1:'0%',x2:'0%',y2:'100%',...props,children:list.map(([offset,stopColor,stopOpacity=1],i)=>jsx('stop',{offset,stopColor,stopOpacity},i))});
 const blur=(id,deviation)=>jsx('filter',{id:uid(id),filterUnits:'userSpaceOnUse',x:-20,y:-20,width:340,height:306,children:jsx('feGaussianBlur',{stdDeviation:deviation})});
 const glassBody='M145 114Q163 112 178 114Q184 109 190 114H226Q232 109 238 114H258Q271 136 258 158H238Q232 163 226 158H190Q184 163 178 158H113Z';
 const fillOf=data=>data.kind==='channel'?channelFill(data,frame.time):liquidWave(data,frame.time);
 const liquid=(name,data)=>{const wave=fillOf(data),flat=data.kind==='channel';return jsx('g',{'data-fluid-glow':name,filter:paint('liquid-glow'),children:jsxs('g',{clipPath:paint(name==='cycle'?'cavity':`tank-${name}`),className:'usage-aurora-reservoir',style:{animation:rainbow},children:[
  jsx('path',{'data-fluid-liquid':name,'data-bamboo-level':name==='cycle'?'cycle':undefined,'data-visual-fraction':data.fraction===null?'unknown':data.fraction,'data-liquid-volume':data.volume??'unknown','data-liquid-level':data.level??'channel',d:wave.fill,fill:paint('liquid'),style:{opacity:data.fraction===null||data.fraction<=0?0:1}}),
  jsx('path',{'data-fluid-surface':name,d:wave.surface,fill:'none',stroke:flat?'#ffffff':paint('liquid'),strokeOpacity:flat?.6:.9,strokeWidth:flat?.6:.45,strokeLinecap:'round',vectorEffect:'non-scaling-stroke',style:{opacity:data.fraction===null||data.fraction<=0?0:.85}})
 ]})})};
 // A carved bed: the far inner wall catches light, the floor sits lower, so it
 // shows shifted toward the camera inside the opening.
 const tank=(name,value)=>{const ch=name==='W'?g.weekly:g.channel,onRock=name==='W',key=onRock?'weekly':'session',mid=ch.points[Math.floor(ch.points.length/2)];
  return jsxs('g',{'data-bamboo-reservoir':name,'data-reservoir-remaining':value,'data-carved-in':onRock?'rock':'ground','data-drains-from':ch.drainsFrom,children:[
   jsx('path',{d:fluidPath(g[name]),fill:onRock?'#4d4856':'#5c4b3b'}),
   jsx('g',{clipPath:paint(`tank-${name}`),children:jsx('path',{'data-channel-bed':name,d:fluidPath(onRock?g.weekly.bed:g[name].map(p=>[p[0],p[1]+2.1])),fill:onRock?'#16141b':'#1a1510'})}),
   liquid(name,frame[name]),
   jsxs('g',{clipPath:paint(`tank-${name}`),children:[
    jsx('g',{clipPath:paint(`${key}-water`),children:jsx('path',{[`data-${key}-current`]:true,d:ch.d,fill:'none',stroke:'#f1e8ff',strokeOpacity:.6,strokeWidth:.8,strokeDasharray:'5 31',strokeLinecap:'round'})}),
    name==='S'?jsx('path',{'data-fluid-internal':'S','data-session-channel':true,d:ch.d,fill:'none',stroke:paint('liquid'),strokeWidth:2.2,strokeLinecap:'round',style:{opacity:frame.jet.opacity*.65,animation:rainbow}}):null,
    name==='S'?jsx('path',{'data-fluid-splash':'S',fill:'none',stroke:white,strokeWidth:.8,style:{opacity:0}}):null
   ]}),
   jsx('path',{d:fluidPath(g[name]),fill:'none',stroke:onRock?'#d7d0e4':'#b39b7c',strokeOpacity:onRock?.3:.32,strokeWidth:.5,vectorEffect:'non-scaling-stroke'}),
   value===null?jsx('text',{x:onRock?g.weekly.points[Math.floor(g.weekly.points.length/2)][0]:mid[0],y:onRock?g.weekly.points[Math.floor(g.weekly.points.length/2)][1]-6:mid[1]-6,textAnchor:'middle',fontFamily:'system-ui',fontSize:onRock?16:13.5,fontWeight:650,fill:muted,children:usageText().unknownMark}):null
  ]})};
 const moss=(cx,cy,rx,ry,key)=>jsx('ellipse',{cx,cy,rx,ry,fill:paint('moss')},key);
 const w3=g.weekly,lerp2=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],line=pts=>'M'+pts.map(p=>p.map(n=>Number(n.toFixed(2))).join(' ')).join('L');
 // Cracks run down some faces; moss gathers along the top edge and the foot.
 const cracks=w3.facets.filter((_,i)=>i%3===1).map((f,i)=>{const [ba,bb,tb,ta]=f.points,t=.3+.4*sceneHash(i+3),top=lerp2(ta,tb,t),bottom=lerp2(ba,bb,t+.08),m1=lerp2(top,bottom,.35),m2=lerp2(top,bottom,.7);return line([top,[m1[0]+2.2,m1[1]],[m2[0]-1.5,m2[1]],bottom])}).join('');
 const rockMoss=w3.facets.flatMap((f,i)=>{const [ba,bb,tb,ta]=f.points,top=lerp2(ta,tb,.5),foot=lerp2(ba,bb,.5),w=Math.hypot(tb[0]-ta[0],tb[1]-ta[1]);return [moss(top[0],top[1]+1.5,w*.35,2,`top-moss-${i}`),moss(foot[0],foot[1]-2,w*.42,3,`foot-moss-${i}`)]});
 const groundNode=jsxs('g',{'data-ground':'oblique-45',children:[
  jsx('path',{'data-ground-plane':true,d:fluidPath(g.ground),fill:paint('earth'),mask:`url(#${uid('ground-fade')})`,filter:paint('grain')}),
  jsx('path',{d:fluidPath(g.S),fill:'none',stroke:'#130e0a',strokeOpacity:.6,strokeWidth:7,strokeLinejoin:'round',filter:paint('soft')}),
  ...g.grass.map(([x,y,s],i)=>moss(x,y+.4,5.6*s,1.9*s,`moss-${i}`)),
  ...g.pebbles.map(([x,y,r],i)=>jsx('ellipse',{cx:x,cy:y,rx:r,ry:r*.66,fill:i%3?'#6d6672':'#8a828f',fillOpacity:.7},`pebble-${i}`)),
 ]});
 const rock=jsxs('g',{'data-rock':'W',children:[
  jsx('path',{'data-contact-shadow':'rock',d:fluidPath(convexHull(w3.base).map(p=>[p[0]+3,p[1]+2.5])),fill:'#000',fillOpacity:.6,filter:paint('soft')}),
  jsxs('g',{filter:paint('grain'),children:[
   jsx('path',{'data-rock-body':true,d:fluidPath(g.rock),fill:paint('rock-face'),stroke:'#110f15',strokeOpacity:.6,strokeWidth:.6,strokeLinejoin:'round',vectorEffect:'non-scaling-stroke'}),
   ...w3.facets.map((f,i)=>jsx('path',{'data-rock-facet':f.shade,d:fluidPath(f.points),fill:f.shade==='lit'?'#8a8494':f.shade==='mid'?'#55505f':'#2a2731',fillOpacity:.5},`facet-${i}`)),
   jsx('path',{d:fluidPath(convexHull([...w3.plateau,...w3.base])),fill:paint('face-depth')}),
   jsx('path',{d:cracks,fill:'none',stroke:'#0d0b10',strokeOpacity:.5,strokeWidth:.75,strokeLinecap:'round',strokeLinejoin:'round'}),
   jsx('path',{d:fluidPath(g.plateau.map(p=>[p[0],p[1]+2.2])),fill:'#9b96a6',fillOpacity:.55}),
   jsx('path',{'data-rock-top':true,d:fluidPath(g.plateau),fill:paint('rock-top')}),
   jsx('path',{d:fluidPath(g.plateau),fill:'none',stroke:'#ece6f6',strokeOpacity:.26,strokeWidth:.7,vectorEffect:'non-scaling-stroke'}),
   ...rockMoss
  ]})
 ]});
 const stoneNode=(s,i)=>jsxs('g',{'data-stone':i,children:[
  jsx('path',{d:fluidPath(s.footprint.map(p=>[p[0]+1.5,p[1]+1.1])),fill:'#000',fillOpacity:.5,filter:paint('soft')}),
  jsx('path',{d:fluidPath(s.outline),fill:paint('stone'),stroke:'#0e0c11',strokeOpacity:.45,strokeWidth:.4}),
  jsx('ellipse',{cx:s.x-s.r*.35,cy:s.y-s.r*.72*CAMERA_K,rx:s.r*.45,ry:s.r*.2,fill:'#fff',fillOpacity:.17})
 ]},`stone-${i}`);
 const blades=[[-3.6,8,-3.2],[-2.4,11.5,-1.6],[-1,13,-.4],[.3,12,1],[1.5,10,2.4],[2.8,7.5,3.6],[-.4,9,-2.4],[.9,6.5,.2]];
 const tuftNode=([x,y,s],i)=>jsx('g',{'data-grass':i,className:'usage-grass',style:{transformBox:'fill-box',transformOrigin:'50% 100%',animation:`usage-grass-sway ${(3.1+(i%4)*.55).toFixed(2)}s ease-in-out ${(-i*.83).toFixed(2)}s infinite alternate`},
  children:blades.map(([dx,h,lean],k)=>{const w=.5*s,bx=x+dx*s,tx=bx+lean*s,ty=y-h*s,cx=bx+lean*.25*s;return jsx('path',{d:`M${(bx-w).toFixed(2)} ${y}Q${cx.toFixed(2)} ${(y-h*.6*s).toFixed(2)} ${tx.toFixed(2)} ${ty.toFixed(2)}Q${(cx+w*.9).toFixed(2)} ${(y-h*.55*s).toFixed(2)} ${(bx+w).toFixed(2)} ${y}Z`,fill:paint(k===5?'grass-dry':k%3===0?'grass-b':'grass-a')},k)})},`grass-${i}`);
 const wings=variant=>{const fill=paint(variant?'wing-b':'wing-a'),edge=variant?'#0a1330':'#1a0e07',side=sx=>jsxs('g',{transform:`scale(${sx} 1)`,children:[
   jsx('path',{d:'M.5 .5C4.6 .5 6.1 2.8 5.1 4.8C4.1 6.3 1.6 5.4 .4 1.8Z',fill,stroke:edge,strokeWidth:.45}),
   jsx('path',{d:'M.4 -1.1C2.4 -5.4 6.7 -6.7 7.4 -5.3C7.9 -3.7 5.7 -.9 .5 .3Z',fill,stroke:edge,strokeWidth:.5}),
   jsx('path',{d:'M.6 -.7L6.4 -5M.6 -.3L6.9 -3.4M.6 0L5.2 -1.3M.6 .9L4.3 4.4M.6 .7L5.1 2.4',fill:'none',stroke:edge,strokeWidth:.28,strokeOpacity:.85}),
   jsx('path',{d:'M7.4 -5.3C7.9 -3.7 5.7 -.9 3.6 -.3M5.1 4.8C4.1 6.3 2.6 5.9 1.8 4.8',fill:'none',stroke:edge,strokeWidth:.9}),
   ...[[6.9,-4.6],[6.4,-3.3],[5.6,-2.1],[4.4,4.9],[5.2,3.4]].map(([cx,cy],k)=>jsx('circle',{cx,cy,r:.27,fill:'#fff',fillOpacity:.9},k))
  ]},sx);return [side(1),side(-1)]};
 const butterflies=[0,1].map(i=>jsx('g',{'data-butterfly':i,'data-butterfly-state':'away','data-butterfly-variant':i?'blue-morpho':'monarch',style:{opacity:0},children:jsxs('g',{children:[
  jsx('g',{'data-butterfly-wings':true,children:wings(i)}),
  jsx('ellipse',{cx:0,cy:2,rx:.55,ry:2.6,fill:'#1c1510'}),jsx('ellipse',{cx:0,cy:-.9,rx:.8,ry:1.15,fill:'#2a2019'}),jsx('circle',{cx:0,cy:-2.5,r:.6,fill:'#1c1510'}),
  jsx('path',{d:'M-.2 -2.9Q-1 -5.4 -1.9 -6.6M.2 -2.9Q1 -5.4 1.9 -6.6',fill:'none',stroke:'#1c1510',strokeWidth:.35,strokeLinecap:'round'}),
  jsx('circle',{cx:-1.9,cy:-6.6,r:.38,fill:'#1c1510'}),jsx('circle',{cx:1.9,cy:-6.6,r:.38,fill:'#1c1510'})
 ]})},`butterfly-${i}`));
 const lip=g.weekly.lip,mouth=bambooPoint([144.4,98]),from=g.weekly.points[3],post=BAMBOO_POST,feet=post.base,mt=g.mountain;
 // Thick natural bamboo post, its hollow top split by a slot along the rocker:
 // the back prong and the shoulders sit behind the glass, the front prong and
 // the peg in front, so the rocker visibly rides inside the fork.
 const pk=CAMERA_K,{x:px,top:pt,slot:ps,base:pb,outer:R0,inner:R1,slotHalf:sw}=post,xa=Math.sqrt(R0*R0-sw*sw),f=n=>Number(n.toFixed(3));
 const backPost=jsxs('g',{'data-bamboo-post':'back',children:[
  jsx('ellipse',{'data-contact-shadow':'stand',cx:px+2,cy:pb+R0*pk*.3,rx:R0*1.5,ry:R0*pk*.75,fill:'#000',fillOpacity:.5,filter:paint('soft')}),
  jsx('path',{d:`M${f(px-xa)} ${f(pt-sw*pk)}A${R0} ${f(R0*pk)} 0 0 1 ${f(px+xa)} ${f(pt-sw*pk)}L${f(px+xa)} ${f(ps-sw*pk)}L${f(px-xa)} ${f(ps-sw*pk)}Z`,fill:paint('post'),stroke:'#2a2a10',strokeOpacity:.5,strokeWidth:.4}),
  jsx('path',{d:`M${f(px-Math.sqrt(R1*R1-sw*sw*.81))} ${f(pt-sw*.9*pk)}A${R1} ${f(R1*pk)} 0 0 1 ${f(px+Math.sqrt(R1*R1-sw*sw*.81))} ${f(pt-sw*.9*pk)}L${f(px+Math.sqrt(R1*R1-sw*sw*.81))} ${f(ps-sw*pk)}L${f(px-Math.sqrt(R1*R1-sw*sw*.81))} ${f(ps-sw*pk)}Z`,fill:'#2b2612',fillOpacity:.85}),
  jsx('ellipse',{'data-post-shoulders':true,cx:px,cy:f(ps+2),rx:R0,ry:f(R0*pk),fill:'#59603a'}),
  jsx('ellipse',{cx:px,cy:f(ps+2),rx:R1,ry:f(R1*pk),fill:'#1f1b0d'})
 ]});
 const frontPost=jsxs('g',{'data-bamboo-post':'front',children:[
  jsx('path',{'data-post-front-prong':true,d:`M${f(px-xa)} ${f(pt+sw*pk)}A${R0} ${f(R0*pk)} 0 0 0 ${f(px+xa)} ${f(pt+sw*pk)}L${f(px+xa)} ${f(ps+2)}Q${f(px+xa+.5)} ${f(ps+R0*pk+1)} ${f(px+R0)} ${f(ps+R0*pk+2)}L${f(px+R0)} ${f(pb)}A${R0} ${f(R0*pk)} 0 0 1 ${f(px-R0)} ${f(pb)}L${f(px-R0)} ${f(ps+R0*pk+2)}Q${f(px-xa-.5)} ${f(ps+R0*pk+1)} ${f(px-xa)} ${f(ps+2)}Z`,fill:paint('post'),stroke:'#2a2a10',strokeOpacity:.55,strokeWidth:.45,strokeLinejoin:'round'}),
  jsx('path',{d:`M${f(px-xa)} ${f(pt+sw*pk)}A${R0} ${f(R0*pk)} 0 0 0 ${f(px+xa)} ${f(pt+sw*pk)}A${R1} ${f(R1*pk)} 0 0 1 ${f(px-xa)} ${f(pt+sw*pk)}Z`,fill:paint('post-cut')}),
  jsx('path',{d:`M${f(px-R0)} ${f(pb-9)}A${R0} ${f(R0*pk)} 0 0 0 ${f(px+R0)} ${f(pb-9)}`,fill:'none',stroke:'#e2d995',strokeOpacity:.55,strokeWidth:1.1}),
  jsx('path',{d:`M${f(px-R0)} ${f(pb-7.8)}A${R0} ${f(R0*pk)} 0 0 0 ${f(px+R0)} ${f(pb-7.8)}`,fill:'none',stroke:'#2d2c10',strokeOpacity:.5,strokeWidth:.7}),
  jsx('path',{d:`M${f(px-xa*.45)} ${f(pt+R0*pk+2)}L${f(px-xa*.45)} ${f(pb+R0*pk-3)}`,fill:'none',stroke:'#fff8cf',strokeOpacity:.22,strokeWidth:1.6,strokeLinecap:'round'}),
  jsx('path',{d:[-.6,-.25,.3,.65].map(t=>`M${f(px+xa*t)} ${f(pt+R0*pk+4)}L${f(px+xa*t)} ${f(pb+R0*pk*Math.sqrt(1-t*t)-2)}`).join(''),fill:'none',stroke:'#20280e',strokeOpacity:.22,strokeWidth:.35}),
  jsx('path',{d:`M${f(px-xa)} ${f(ps-4)}Q${px} ${f(ps-4+R0*pk*.35)} ${f(px+xa)} ${f(ps-4)}`,fill:'none',stroke:'#d9d29a',strokeOpacity:.5,strokeWidth:.9}),
  jsx('circle',{'data-bamboo-peg':true,cx:px,cy:f(136+R0*pk),r:2.3,fill:paint('peg'),stroke:'#2a1d0e',strokeWidth:.5}),
  jsx('circle',{cx:px-.6,cy:f(136+R0*pk-.6),r:.8,fill:'#fff3cf',fillOpacity:.55})
 ]});
 const sprAngle=Math.atan2(g.weekly.springDirection[1],g.weekly.springDirection[0])*180/Math.PI,spr=g.weekly.spring;
 const backdrop=jsxs('g',{'data-mountain':'backdrop',children:[
  jsx('rect',{x:-10,y:-10,width:320,height:130,fill:paint('sky')}),
  jsx('path',{'data-mountain-range':'far',d:fluidPath(mt.far),fill:paint('mountain-far')}),
  jsxs('g',{filter:paint('grain-dark'),children:[
   jsx('path',{'data-mountain-body':true,d:fluidPath(mt.near),fill:paint('mountain'),stroke:'#0e0c13',strokeOpacity:.5,strokeWidth:.5,strokeLinejoin:'round'}),
   jsx('g',{clipPath:paint('mountain-clip'),children:[
    ...mt.shade.map((p,i)=>jsx('path',{d:fluidPath(p),fill:'#0d0b13',fillOpacity:.42},`mountain-shade-${i}`)),
    jsx('path',{d:mt.gullies.map(r=>'M'+r.map(p=>p.join(' ')).join('L')).join(''),fill:'none',stroke:'#08070c',strokeOpacity:.55,strokeWidth:1.1,strokeLinecap:'round',strokeLinejoin:'round'}),
    jsx('path',{d:mt.highlights.map(r=>'M'+r.map(p=>p.join(' ')).join('L')).join(''),fill:'none',stroke:'#e2dcef',strokeOpacity:.13,strokeWidth:.9,strokeLinecap:'round',strokeLinejoin:'round'})
   ]}),
   ...mt.shrubs.map(([x,y,r],i)=>jsx('ellipse',{cx:x,cy:y,rx:r,ry:r*.7,fill:i%2?'#26402a':'#2f4a2b',fillOpacity:.85},`shrub-${i}`))
  ]}),
  jsx('rect',{x:-10,y:72,width:320,height:40,fill:paint('mist')})
 ]});
 const outcrop=jsxs('g',{'data-spring-outcrop':true,children:[
  jsx('path',{d:fluidPath(g.outcrop.map(p=>[p[0]+1.2,p[1]+1.6])),fill:'#000',fillOpacity:.45,filter:paint('soft')}),
  jsxs('g',{filter:paint('grain'),children:[
   jsx('path',{'data-outcrop-body':true,d:fluidPath(g.outcrop),fill:paint('rock-face'),stroke:'#110f15',strokeOpacity:.6,strokeWidth:.6,strokeLinejoin:'round'}),
   jsx('path',{'data-outcrop-top':true,d:fluidPath(g.outcrop.map(p=>[p[0],p[1]-3.5]).filter((p,i,a)=>p[1]<g.weekly.spring[1]+2)),fill:paint('rock-top'),fillOpacity:.75}),
   jsx('path',{d:fluidPath(g.outcrop),fill:'none',stroke:'#e9e3f3',strokeOpacity:.2,strokeWidth:.7,vectorEffect:'non-scaling-stroke'})
  ]}),
  jsx('ellipse',{'data-spring':'W',cx:spr[0]+g.weekly.springDirection[0]*2.2,cy:spr[1]+g.weekly.springDirection[1]*2.2,rx:3.2,ry:7.5,transform:`rotate(${sprAngle} ${spr[0]+g.weekly.springDirection[0]*2.2} ${spr[1]+g.weekly.springDirection[1]*2.2})`,fill:paint('crevice')})
 ]});
 const kk=w3.kakei,kf=p=>p.map(n=>Number(n.toFixed(2))).join(' '),kb=kk.waterAxis[1];
 const kakei=jsxs('g',{'data-kakei':'half-pipe',children:[
  ...kk.trestle.sticks.map((s,i)=>jsx('path',{'data-kakei-trestle':i,d:line(s),fill:'none',stroke:paint('post'),strokeWidth:2.6,strokeLinecap:'round'},`stick-${i}`)),
  jsx('path',{d:line([groundToScreen(kk.start[0],kk.start[1],0),groundToScreen(kk.end[0],kk.end[1],0)]),fill:'none',stroke:'#000',strokeOpacity:.35,strokeWidth:12,strokeLinecap:'round',filter:paint('soft')}),
  jsx('path',{'data-kakei-pipe':true,d:fluidPath(kk.outer),fill:paint('kakei'),stroke:'#252b10',strokeOpacity:.5,strokeWidth:.5,strokeLinejoin:'round'}),
  jsx('path',{'data-kakei-inside':true,d:fluidPath(kk.inner),fill:paint('kakei-inside')}),
  jsx('g',{filter:paint('liquid-glow'),children:[
   jsx('path',{'data-kakei-water':true,d:fluidPath(kk.water),fill:paint('liquid'),style:{opacity:0,animation:rainbow}}),
   jsx('path',{'data-kakei-current':true,d:line(kk.waterAxis),fill:'none',stroke:'#f6eeff',strokeOpacity:.7,strokeWidth:.9,strokeDasharray:'4 9',strokeLinecap:'round',className:'usage-bamboo-flow',style:{opacity:0,animation:'usage-bamboo-flow 1.1s linear infinite'}})
  ]}),
  ...kk.nodes.map((n,i)=>jsx('path',{d:line(n),fill:'none',stroke:'#efe6b0',strokeOpacity:.6,strokeWidth:.9},`kakei-node-${i}`)),
  jsx('path',{d:line([kk.inner[0],kk.inner[1]]),fill:'none',stroke:'#f3ecc2',strokeOpacity:.65,strokeWidth:.9}),
  jsx('path',{d:line([kk.inner[3],kk.inner[2]]),fill:'none',stroke:'#f3ecc2',strokeOpacity:.45,strokeWidth:.8}),
  jsx('path',{'data-kakei-mouth':true,d:line(kk.endProfile),fill:'none',stroke:'#e9dfa6',strokeWidth:1.3,strokeLinecap:'round'})
 ]});
 const digits=jsx('g',{'data-binary-stream':'S',filter:paint('liquid-glow'),children:Array.from({length:BINARY_SLOTS},(_,i)=>jsx('text',{'data-binary-digit':i,x:0,y:0,textAnchor:'middle',fontFamily:'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',fontWeight:700,fontSize:3.6,fill:'#3d9bff',style:{opacity:0},children:'0'},`digit-${i}`))});
 const decor=[...g.stones.map((s,i)=>({y:s.y,node:stoneNode(s,i)})),...g.grass.map((t,i)=>({y:t[1],node:tuftNode(t,i)}))].sort((a,b)=>a.y-b.y);
 return jsxs('svg',{'data-bamboo-scene':expanded?'expanded':'compact','data-material':'glass-bamboo','data-colour-style':'apple-reference-v10','data-scene':'half-pipe-v17','data-camera':'oblique-45','data-bamboo-scale':.44,'data-weekly-shape':'w-watercourse-rock','data-session-shape':'s-watercourse','data-fluid-engine':'gravity-volume-v7',
  'data-flow-from':'W','data-flow-via':'cycle','data-flow-to':'S','data-outlet-position':'bottom','data-source-pipe':'none',
  'data-cycle-state':m.tipped?'dumping':cycle.phase||'unknown','data-cycle-progress':cycle.progress,'data-cycle-reset':cycle.resetMs,'data-physical-angle':frame.angle,
  viewBox:'0 0 300 266',width:expanded?'100%':68,height:expanded?236:20,'aria-hidden':true,style:{display:'block',flexShrink:0,overflow:'hidden'},children:[
   jsxs('defs',{children:[
    jsxs('filter',{id:uid('liquid-glow'),filterUnits:'userSpaceOnUse',x:-20,y:-20,width:340,height:306,colorInterpolationFilters:'sRGB',children:[
     jsx('feGaussianBlur',{in:'SourceGraphic',stdDeviation:4.5,result:'wide-halo'}),
     jsx('feGaussianBlur',{in:'SourceGraphic',stdDeviation:1.4,result:'near-halo'}),
     jsxs('feMerge',{children:[jsx('feMergeNode',{in:'wide-halo'}),jsx('feMergeNode',{in:'near-halo'}),jsx('feMergeNode',{in:'SourceGraphic'})]})
    ]}),
    // Static mineral grain for stone and soil, so surfaces read as material, not flat fills.
    jsxs('filter',{id:uid('grain'),filterUnits:'userSpaceOnUse',x:-20,y:-20,width:340,height:306,children:[
     jsx('feTurbulence',{type:'fractalNoise',baseFrequency:1.1,numOctaves:2,seed:11,result:'noise'}),
     jsx('feColorMatrix',{in:'noise',type:'matrix',values:'0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.1 0 0 0 -.5',result:'dark'}),
     jsx('feColorMatrix',{in:'noise',type:'matrix',values:'0 0 0 0 .85  0 0 0 0 .82  0 0 0 0 .8  -.9 0 0 0 .3',result:'light'}),
     jsx('feComposite',{in:'dark',in2:'SourceGraphic',operator:'in',result:'dark-in'}),
     jsx('feComposite',{in:'light',in2:'SourceGraphic',operator:'in',result:'light-in'}),
     jsxs('feMerge',{children:[jsx('feMergeNode',{in:'SourceGraphic'}),jsx('feMergeNode',{in:'dark-in'}),jsx('feMergeNode',{in:'light-in'})]})
    ]}),
    blur('soft',2.2),blur('fade-blur',11),
    jsx('mask',{id:uid('ground-fade'),maskUnits:'userSpaceOnUse',x:-20,y:-20,width:340,height:306,children:jsx('path',{d:fluidPath(g.ground),fill:'#fff',filter:paint('fade-blur')})}),
    jsxs('linearGradient',{id:uid('liquid'),'data-siri-gradient':true,x1:'0%',y1:'0%',x2:'100%',y2:'65%',children:stops}),
    jsxs('linearGradient',{id:uid('glass-body'),x1:'0%',y1:'0%',x2:'0%',y2:'100%',children:[jsx('stop',{offset:'0%',stopColor:tint('.95','.03','155'),stopOpacity:.25}),jsx('stop',{offset:'25%',stopColor:tint('.80','.05','160'),stopOpacity:.045}),jsx('stop',{offset:'67%',stopColor:tint('.8','.04','185'),stopOpacity:.025}),jsx('stop',{offset:'100%',stopColor:tint('.75','.06','170'),stopOpacity:.2})]}),
    jsxs('linearGradient',{id:uid('glass-edge'),x1:'0%',y1:'0%',x2:'100%',y2:'90%',children:[jsx('stop',{offset:'0%',stopColor:white,stopOpacity:.55}),jsx('stop',{offset:'35%',stopColor:tint('.8','.07','160'),stopOpacity:.5}),jsx('stop',{offset:'70%',stopColor:white,stopOpacity:.4}),jsx('stop',{offset:'100%',stopColor:tint('.65','.06','175'),stopOpacity:.45})]}),
    gradient('post',[['0%','#3e4a22'],['28%','#6f7d3c'],['46%','#a9ad6c'],['60%','#86904c'],['100%','#323c1a']],{x2:'100%',y2:'0%'}),
    gradient('kakei',[['0%','#59652d'],['45%','#8f9a52'],['100%','#323c1a']],{x2:'100%'}),
    gradient('kakei-inside',[['0%','#e2d6a0'],['55%','#bba970'],['100%','#8c7c48']],{x2:'60%'}),
    gradient('face-depth',[['0%','#000',0],['55%','#000',.08],['100%','#000',.45]]),
    gradient('post-cut',[['0%','#e3dcb0'],['100%','#a99f6c']]),
    jsxs('radialGradient',{id:uid('peg'),cx:'40%',cy:'38%',children:[jsx('stop',{offset:'0%',stopColor:'#c89a5a'}),jsx('stop',{offset:'100%',stopColor:'#6b4720'})]}),
    jsx('clipPath',{id:uid('mountain-clip'),children:jsx('path',{d:fluidPath(g.mountain.near)})}),
    jsxs('filter',{id:uid('grain-dark'),filterUnits:'userSpaceOnUse',x:-20,y:-20,width:340,height:306,children:[
     jsx('feTurbulence',{type:'fractalNoise',baseFrequency:1.1,numOctaves:2,seed:5,result:'noise'}),
     jsx('feColorMatrix',{in:'noise',type:'matrix',values:'0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.1 0 0 0 -.5',result:'dark'}),
     jsx('feComposite',{in:'dark',in2:'SourceGraphic',operator:'in',result:'dark-in'}),
     jsxs('feMerge',{children:[jsx('feMergeNode',{in:'SourceGraphic'}),jsx('feMergeNode',{in:'dark-in'})]})
    ]}),
    jsxs('radialGradient',{id:uid('crevice'),children:[jsx('stop',{offset:'0%',stopColor:'#020103',stopOpacity:1}),jsx('stop',{offset:'70%',stopColor:'#050408',stopOpacity:.75}),jsx('stop',{offset:'100%',stopColor:'#050408',stopOpacity:0})]}),
    jsx('clipPath',{id:uid('frame'),children:jsx('rect',{x:0,y:0,width:300,height:266,rx:16})}),
    gradient('sky',[['0%','#120f22'],['70%','#2a2340'],['100%','#3b3150']]),
    gradient('mountain-far',[['0%','#6f6884',1],['100%','#4a4560',1]]),
    gradient('mountain',[['0%','#58536a'],['55%','#3a3647'],['100%','#262330']],{x2:'25%'}),
    gradient('mist',[['0%','#cfc8e6',0],['70%','#cfc8e6',.2],['100%','#cfc8e6',.08]]),
    jsxs('radialGradient',{id:uid('vignette'),cx:'50%',cy:'48%',r:'72%',children:[jsx('stop',{offset:'60%',stopColor:'#000',stopOpacity:0}),jsx('stop',{offset:'100%',stopColor:'#000',stopOpacity:.42})]}),
    gradient('earth',[['0%','#544a3f'],['45%','#3f372e'],['100%','#28221b']]),
    gradient('rock-face',[['0%','#625d6c'],['45%','#403c48'],['100%','#24212a']],{x2:'30%'}),
    gradient('rock-top',[['0%','#a29dab'],['50%','#7d7887'],['100%','#5f5b69']],{x2:'100%'}),
    gradient('stone',[['0%','#9a94a2'],['55%','#56515e'],['100%','#2a2730']]),
    gradient('grass-a',[['0%','#a3e06e'],['100%','#1d5a32']]),gradient('grass-b',[['0%','#c6ec84'],['100%','#245f2c']]),gradient('grass-dry',[['0%','#d9c47a'],['100%','#4f6a2c']]),
    gradient('wing-a',[['0%','#ffb04a'],['60%','#ea731c'],['100%','#b8430e']],{x2:'100%'}),gradient('wing-b',[['0%','#8fd6ff'],['55%','#2f7dff'],['100%','#1b3db4']],{x2:'100%'}),
    jsxs('radialGradient',{id:uid('moss'),children:[jsx('stop',{offset:'0%',stopColor:'#5e7d36',stopOpacity:.75}),jsx('stop',{offset:'100%',stopColor:'#5e7d36',stopOpacity:0})]}),
    ...['W','S'].map(name=>jsx('clipPath',{id:uid(`tank-${name}`),children:jsx('path',{d:fluidPath(g[name])})},`clip-${name}`)),
    jsx('clipPath',{id:uid('session-water'),children:jsx('path',{'data-session-flow-clip':true,d:fillOf(frame.S).fill})}),
    jsx('clipPath',{id:uid('weekly-water'),children:jsx('path',{'data-weekly-flow-clip':true,d:fillOf(frame.W).fill})}),
    jsx('clipPath',{id:uid('cavity'),children:jsx('polygon',{'data-fluid-cavity':true,points:frame.bamboo.polygon.map(p=>p.join(',')).join(' ')})})
   ]}),
   jsxs('g',{'data-scene-frame':true,clipPath:paint('frame'),children:[
   backdrop,
   groundNode,
   rock,
   tank('S',sessionLeft),
   tank('W',weeklyLeft),
   outcrop,
   kakei,
   !cycle.artOnly?jsx('text',{'data-weekly-remaining':weeklyLeft,'data-text-state':Number.isFinite(weeklyLeft)?'actual':'unknown',x:76,y:54,textAnchor:'middle',fontFamily:'system-ui',fontSize:16,fontWeight:650,fill:white,stroke:'#0b0a10',strokeOpacity:.7,strokeWidth:3,paintOrder:'stroke',children:Number.isFinite(weeklyLeft)?`${weeklyLeft.toLocaleString('en-US',{maximumFractionDigits:1})}%`:'—'}):null,
   !cycle.artOnly?jsx('text',{x:76,y:71,textAnchor:'middle',fontFamily:'system-ui',fontSize:9.5,fill:muted,children:Number.isFinite(weeklyLeft)?usageText().weeklyLeft:usageText().quotaUnavailable}):null,
   ...decor.filter(d=>d.y<feet).map(d=>d.node),
   backPost,
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
   frame.bamboo.fraction===null?jsx('text',{'data-bamboo-unknown':'cycle',x:bambooPoint([212,157])[0],y:bambooPoint([212,157])[1],textAnchor:'middle',fontSize:7,fontWeight:650,fill:muted,children:usageText().unknownMark}):null,
   frontPost,
   jsx('g',{filter:paint('liquid-glow'),children:jsx('path',{'data-bamboo-inflow':'W','data-bamboo-flow':frame.flowing?'running':'stopped',d:`M${from.join(' ')}L${lip.join(' ')}M${kb[0]} ${kb[1]}L${mouth.join(' ')}`,fill:'none',stroke:paint('liquid'),strokeWidth:2.4,strokeLinecap:'round',strokeDasharray:'7 2',className:'usage-bamboo-flow',style:{opacity:frame.flowing?.9:0,animation:`usage-bamboo-flow 1.3s linear infinite, ${rainbow}`}})}),
   ...decor.filter(d=>d.y>=feet).map(d=>d.node),
   jsx('g',{filter:paint('liquid-glow'),children:jsx('path',{'data-bamboo-pour':'S',d:fluidJetPath(frame.jet),fill:paint('liquid'),style:{opacity:frame.jet.opacity,animation:rainbow}})}),
   digits,
   ...butterflies,
   jsx('rect',{'data-vignette':true,x:0,y:0,width:300,height:266,fill:paint('vignette'),pointerEvents:'none'})
   ]}),
   jsx('rect',{x:.5,y:.5,width:299,height:265,rx:16,fill:'none',stroke:'#ffffff',strokeOpacity:.12,strokeWidth:1,vectorEffect:'non-scaling-stroke'})
  ]})
}
function startFluidPhysics(svg,read) {
 if(!svg||typeof window==='undefined')return()=>{};
 const media=window.matchMedia('(prefers-reduced-motion: reduce)');let raf=0,disposed=false,gain=1;
 const resize=()=>{const box=svg.getBoundingClientRect(),scale=Math.min(box.width/300,box.height/266);gain=scale>0?Math.min(2.8,Math.max(1,.55/scale)):1};resize();
 const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(resize):null;observer?.observe(svg);
 const step=()=>{if(disposed)return;const {session,weekly,cycle}=read(),now=document.timeline?.currentTime||0,memory=svg.__usageShown||{},dt=now-(memory.time??now);
  const shown={session:cycle?.dumping?session:easeShownQuota(memory.session,session,dt,media.matches),weekly:easeShownQuota(memory.weekly,weekly,dt,media.matches),time:now};svg.__usageShown=shown;
  const frame=fluidFrame(shown.session,shown.weekly,cycle,now,Date.now(),media.matches);frame.motion*=gain;applyFluidFrame(svg,frame);if(!media.matches)raf=requestAnimationFrame(step)};
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
 const lang=useUsageLanguage(),t=usageText(lang),languagePreference=useValue(languageAtom)
 const snapshot=props.snapshot||shared
 if(!snapshot)return jsx('div',{dir:t.dir,style:{padding:12},children:t.connecting})
 const {usage,gateway,liveModel,sameProfile,query,data,provider,rawProvider,cycle,selectedAccount,onSelectAccount}=snapshot
 const now=cycle.now
 const number = n=>typeof n==='number' && Number.isFinite(n)?n.toLocaleString('en-US'):'—'
 const textStyle = {fontSize:12,color:'var(--ui-text-secondary)'}
 const cards=[]
 function addWindow(window,key) {
  const left=remaining(window)
  const expired=window.resets_at && Date.parse(window.resets_at)<=now
  cards.push(jsxs('section',{style:{borderTop:'1px solid var(--ui-stroke-secondary)',paddingTop:9,marginTop:9},children:[
   jsxs('div',{style:{display:'flex',justifyContent:'space-between',gap:8},children:[jsx('strong',{children:window.label||t.accountQuota}),jsx('span',{children:left===null?t.pctUnavailable:t.left(number(left))})]}),
   left!==null?jsx('progress',{max:100,value:left,'aria-label':t.remainingAria(left),style:{width:'100%',height:6,accentColor:'var(--ui-accent)',marginTop:7}}):null,
   jsx('div',{style:textStyle,children:left===null?'':t.used(number(Math.min(100,Math.max(0,window.used_percent))))}),
   jsx('div',{children:t.renewal(countdown(window.resets_at,now,lang))}),
   window.resets_at && Number.isFinite(Date.parse(window.resets_at))?jsx('div',{style:textStyle,children:new Date(window.resets_at).toLocaleString(t.dateLocale)}):null,
   expired?jsx('div',{style:textStyle,children:t.lastReading}):null
  ]},key))
 }
 for(const w of (rawProvider||provider)?.usage?.windows||[]) addWindow(w,`single-${cards.length}`)
 for(const [i,account] of ((rawProvider||provider)?.usage?.accounts||[]).entries()) {
  cards.push(jsx('div',{style:{marginTop:8,fontWeight:600},children:`${account.label||t.accountN(i+1)} — ${t.states[account.state]||t.states.unknown}`},`account-${i}`))
  for(const w of account.windows||[]) addWindow(w,`account-${i}-${cards.length}`)
 }
 return jsxs('div',{'data-usage-meter':'true','data-usage-language':lang,lang,dir:t.dir,style:{padding:12,height:'100%',overflow:'auto',fontSize:13,lineHeight:1.7,color:'var(--ui-text-primary)'},children:[
  jsx('div',{dir:'ltr',style:{marginBottom:8},children:jsx(FountainView,{provider,cycle,model:data?.model||liveModel||''})}),
  jsx('div',{'data-cycle-caption':true,style:{fontSize:12,color:'var(--ui-text-secondary)',marginBottom:10},children:cycle.dumping?t.captionDumping:cycle.phase==='awaiting'?t.captionAwaiting:cycle.progress===null?t.captionNoReset:t.captionFilling(Math.floor(cycle.progress*100),countdown(new Date(cycle.resetMs).toISOString(),now,lang))}),
  jsxs('label',{style:{display:'flex',alignItems:'center',gap:8,marginBottom:8,fontSize:12,color:'var(--ui-text-secondary)'},children:[t.language,jsx('select',{'data-usage-language-select':true,'aria-label':t.language,value:USAGE_LANGUAGES.includes(languagePreference)?languagePreference:'auto',onChange:e=>chooseUsageLanguage(e.target.value),style:{color:'var(--ui-text-primary)',background:'var(--ui-bg-elevated)'},children:[jsx('option',{value:'auto',children:t.autoLanguage},'auto'),...USAGE_LANGUAGES.map(code=>jsx('option',{value:code,lang:code,children:USAGE_ENDONYMS[code]},code))]})]}),
  jsx('div',{style:{fontWeight:650},children:t.modelUsage}),
  (rawProvider?.usage?.accounts||[]).length>1?jsx('select',{'aria-label':t.sourceAccount,value:selectedAccount?.provider===rawProvider.slug?selectedAccount.id:'',onChange:e=>onSelectAccount?.(e.target.value),style:{maxWidth:'100%',color:'var(--ui-text-primary)',background:'var(--ui-bg-elevated)'},children:[jsx('option',{value:'',children:t.autoAccount}),...rawProvider.usage.accounts.map(a=>jsx('option',{value:a.id,children:`${a.label||a.id} · ${a.id}`},a.id))]}):null,
  jsx('div',{dir:'ltr',style:{overflowWrap:'anywhere',fontWeight:600},children:data?.model||liveModel||t.waitingModel}),
  jsx('div',{dir:'ltr',style:textStyle,children:data?.provider||t.waitingProvider}),
  jsx('div',{style:{marginTop:10,fontWeight:600},children:t.sessionTokens}),
  jsx('div',{children:t.total(number(usage?.total))}),
  jsx('div',{style:textStyle,children:t.inout(number(usage?.input),number(usage?.output))}),
  usage?.context_max?jsx('div',{style:textStyle,children:t.context(number(usage.context_used),number(usage.context_max))}):null,
  jsx('div',{style:{marginTop:10,fontWeight:600},children:t.quotaHeading}),
  ...cards,
  !cards.length?jsx('div',{style:textStyle,children:!sameProfile?t.otherProfile:query.isPending?t.readingQuota:query.isError?t.readFailed:quotaUnavailableReason(data?.provider||provider?.slug,provider,lang)}):null,
  jsx('p',{style:{...textStyle,marginTop:10},children:t.explanation}),
  query.isError && cards.length?jsx('div',{style:textStyle,children:t.staleAfterFail}):null,
  jsx('button',{type:'button',onClick:()=>query.refetch(),disabled:query.isFetching||!sameProfile||gateway!=='open',style:{border:'1px solid var(--ui-stroke-secondary)',borderRadius:6,padding:'3px 10px',color:'var(--ui-text-primary)',background:'transparent'},children:query.isFetching?t.refreshing:t.refresh}),
  jsx('div',{style:textStyle,children:t.autoRefresh})
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
 const lang=useUsageLanguage(),t=usageText(lang)
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
 useEffect(()=>{try{widgetStorage?.set('floating-art-v1',geometryRef.current);widgetStorage?.set('fluid-engine-v7',true);widgetStorage?.set('proportions-v8',true);widgetStorage?.set('siri-neon-v9',true);widgetStorage?.set('apple-reference-v10',true);widgetStorage?.set('s-watercourse-v11',true);widgetStorage?.set('rock-garden-v12',true);widgetStorage?.set('rock-garden-v13',true);widgetStorage?.set('mountain-i18n-v14',true);widgetStorage?.set('flat-rock-post-v15',true);widgetStorage?.set('kakei-block-v16',true);widgetStorage?.set('half-pipe-v17',true)}catch{}},[])
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
 return jsxs('div',{ref:layerNode,'data-usage-corner':true,'data-usage-floating':true,'data-expanded':open,'data-session-remaining':left,'data-weekly-quota':weekly,'data-provider':data?.provider,'data-model':data?.model||liveModel,'data-token-total':source.usage?.total,role:'button',tabIndex:0,'aria-label':t.widgetAria,lang,style,
  onPointerDown:pointerDown,onPointerMove:pointerMove,onPointerUp:pointerUp,onPointerCancel:pointerUp,
  onMouseEnter:()=>setHover(true),onMouseLeave:()=>setHover(false),
  onDoubleClick:()=>setOpen(true),onContextMenu:event=>{event.preventDefault();setOpen(true)},
  onKeyDown:event=>{if(event.key==='Escape')setOpen(false);if(event.key==='Enter'){event.preventDefault();setOpen(true)}},children:[
   jsx('div',{style:{width:'100%',height:'100%',pointerEvents:'none'},children:jsx(FountainView,{provider,cycle,model:data?.model||liveModel||'',dock:true,artOnly:true})}),
   jsx('div',{'data-usage-resize':true,role:'slider',tabIndex:0,'aria-label':t.resizeAria,onKeyDown:event=>{if(event.key==='ArrowRight'||event.key==='ArrowUp'){event.preventDefault();move({...geometryRef.current,width:geometryRef.current.width+8,height:geometryRef.current.height+8},true)}if(event.key==='ArrowLeft'||event.key==='ArrowDown'){event.preventDefault();move({...geometryRef.current,width:geometryRef.current.width-8,height:geometryRef.current.height-8},true)}},style:{position:'absolute',right:0,bottom:0,width:14,height:14,cursor:'nwse-resize',opacity:hover?1:0,transition:'opacity 150ms'},children:jsx('span',{style:{position:'absolute',right:2,bottom:2,width:7,height:7,borderRight:'1.5px solid var(--ui-text-secondary)',borderBottom:'1.5px solid var(--ui-text-secondary)',borderRadius:1,pointerEvents:'none'}})}),
   open?jsx('div',{id:'usage-meter-details',role:'region','aria-label':t.detailsAria,dir:t.dir,onPointerDown:event=>event.stopPropagation(),onDoubleClick:event=>event.stopPropagation(),style:{position:'fixed',zIndex:10,left:Math.max(12,Math.min(geometry.x,floatingViewport().width-352)),...popupPlacement,width:'min(340px,calc(100vw - 24px))',maxHeight:Math.max(120,Math.min(640,geometry.y>280?geometry.y-20:floatingViewport().height-geometry.y-geometry.height-28)),overflow:'auto',cursor:'auto',border:'1px solid var(--ui-stroke-secondary)',borderRadius:14,background:'var(--ui-bg-elevated)'},children:jsxs('div',{children:[jsx('button',{'aria-label':t.close,onClick:()=>setOpen(false),style:{position:'absolute',...(t.dir==='rtl'?{left:8}:{right:8}),top:8,border:0,background:'transparent',color:'var(--ui-text-primary)',cursor:'pointer'},children:'×'}),jsx(UsagePane,{})]})}):null,
   jsx('style',{children:'@keyframes usage-bamboo-flow{to{stroke-dashoffset:-28}}@keyframes usage-grass-sway{0%{transform:rotate(-3.5deg)}100%{transform:rotate(4deg)}}@keyframes usage-liquid-color{0%,100%{filter:brightness(.98) saturate(1.25)}50%{filter:brightness(1.04) saturate(1.3)}}@media(prefers-reduced-motion:reduce){[data-bamboo-scene] *{animation:none!important;transition:none!important}[data-usage-resize]{transition:none!important}}'})
  ]})
}
export default {
 id:'usage-meter',name:'Usage Meter · استهلاك الموديل',
 register(ctx) {
  widgetStorage=ctx.storage||null
  // Installs from before the language choice were Arabic-only: keep them Arabic.
  try{let saved=widgetStorage?.get('language',null);if(saved==null&&widgetStorage?.get('floating-art-v1',null)!=null){saved='ar';widgetStorage.set('language','ar')}languageAtom.set(saved||'auto')}catch{}
  console.info('[usage-meter] half-pipe-v17 loaded')
  ctx.register({id:'usage-corner-auto-v2',area:'statusBar.left',order:-10000,render:()=>jsx(UsageCorner,{})})
 }
}
