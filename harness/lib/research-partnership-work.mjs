import {createHash} from 'node:crypto';
import {decryptResearchValue} from './research-mail.mjs';
import {createSigningAdapter,researchSigningWorkerToken} from './research-signing.mjs';
import {completeSigning,assertSignWellState} from './research-partnerships.mjs';
import {createPartnershipCopyTransport} from './research-partnership-copy-mail.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
const messageText={subject:'BE GOOD — עותק ההסכם החתום',text:'הסכם השותפות החתום מצורף. העותק המקורי ותיעוד החתימה זמינים בתיק המחקר בכפוף להרשאות העדכניות.',filename:'executed-agreement.pdf'};
const keyValid=key=>typeof key==='string'&&/^[A-Za-z0-9+/]{43}=$/.test(key)&&Buffer.from(key,'base64').length===32&&Buffer.from(key,'base64').toString('base64')===key;
async function rpc(store,token,action,payload){const result=await store.rpc(token,action,payload);if(result?.error)throw Object.assign(new Error('workflow'),{code:result.error});return result;}

// The scheduler claims one persisted session at a time. It never creates,
// publishes, sends for signature or opens a signing view to repair uncertainty.
export async function runPartnershipWork(accessStore,store,options={}){
 const result={checked:0,completed:0,pending:0,blocked:0,deliveryAccepted:0,deliveryPending:0};
 if(options.enabled!==true)return {...result,code:'disabled'};
 if(!accessStore?.get||!store?.rpc||!keyValid(options.documentKey))return {...result,code:'not_configured'};
 const worker=()=>researchSigningWorkerToken(accessStore),call=async(action,payload)=>rpc(store,await worker(),action,payload);
 const limit=Number.isInteger(options.limit)&&options.limit>=1&&options.limit<=10?options.limit:3;
 try{
  for(let n=0;n<limit;n++){
   const job=(await call('signingWorkClaim',{limit:1})).jobs?.[0];if(!job)break;
   const finish=(outcome,safeCode)=>call('signingWorkComplete',{signingId:job.signingId,leaseId:job.leaseId,outcome,...safeCode?{safeCode}:{}});
   try{
    const adapter=options.signingAdapterFactory?options.signingAdapterFactory(job.provider):createSigningAdapter({...options,signingProvider:job.provider});
    if(adapter.provider!==job.provider||!adapter.readiness().configured){await finish('blocked','not_configured');result.blocked++;continue;}
    const fresh=(await call('signingWorkClaim',{signingId:job.signingId,leaseId:job.leaseId})).jobs?.[0];if(!fresh)continue;
    const state=decryptResearchValue(fresh.providerStateCiphertext,options.documentKey),scope={studyId:fresh.studyId,partnerId:fresh.partnerId,recordId:fresh.recordId};
    const expected=fresh.provider==='signwell'?'signwell/'+state.providerSessionId:state.providerSessionId;
    if(expected!==fresh.providerSessionId||state.provider&&state.provider!==fresh.provider||state.versionId&&state.versionId!==fresh.signing.versionId||state.documentHash&&state.documentHash!==fresh.signing.documentHash)throw Object.assign(new Error(),{code:'conflict'});
    if(fresh.provider==='signwell')assertSignWellState((await call('signingIntentGet',{intentId:state.intentId})).intent,state,scope,fresh.signingId);
    result.checked++;const verification=await adapter.refresh(state);
    // Evidence retention for an already issued session does not authorize any
    // new disclosure. Every write still checks the exact live worker lease.
    if(verification.completed&&Date.parse(verification.completedAt)>Date.parse(fresh.signing.expiresAt)){await finish('blocked','completion_after_expiry');result.blocked++;continue;}
    if(verification.completed){await completeSigning({accessStore,store,scope,signing:fresh.signing,verification,key:options.documentKey,workLeaseId:fresh.leaseId});await finish('completed');result.completed++;}
    else{await call('signingStateUpdate',{...scope,signingId:fresh.signingId,workLeaseId:fresh.leaseId,state:verification.state});await finish('pending');result.pending++;}
   }catch{await finish('failed','reconciliation_failed').catch(()=>{});result.pending++;}
  }
  const transport=options.copyTransportFactory?options.copyTransportFactory():createPartnershipCopyTransport(options.copyMail);
  const readiness=transport.readiness();
  if(!readiness.configured||!options.copyMail?.from)return {...result,copyState:'not_configured'};
  for(let n=0;n<limit;n++){
   const job=(await call('partnershipCopyClaim',{limit:1})).messages?.[0];if(!job)break;
   // Immutable content, recipient and sender determine one payload/key. No
   // signed bytes or addresses enter logs or the runner's public counters.
   const payloadHash=hash(JSON.stringify({versionId:job.versionId,documentHash:job.documentHash,recipientHash:job.recipientHash,from:options.copyMail.from,...messageText}));
   const fresh=(await call('partnershipCopyClaim',{messageId:job.messageId,leaseId:job.leaseId,provider:readiness.provider,providerVersion:readiness.providerVersion,from:options.copyMail.from,payloadHash})).messages?.[0];
   if(!fresh){result.blocked++;continue;}
   const finish=(outcome,extra={})=>call('partnershipCopyComplete',{messageId:fresh.messageId,leaseId:fresh.leaseId,phase:fresh.phase,outcome,...extra});
   try{
    if(fresh.phase==='receipt'){
     const receipt=await transport.receipt({providerId:fresh.providerId,recipient:fresh.recipient,from:fresh.from});
     await finish(receipt.status,{providerId:fresh.providerId,...receipt.safeCode?{safeCode:receipt.safeCode}:{}});result.deliveryPending++;
    }else{
     const envelope=decryptResearchValue(fresh.documentCiphertext,options.documentKey);
     const bytes=Buffer.from(envelope.contentBase64||'','base64');
     if(envelope.purpose!=='research-partnership-document'||bytes.toString('base64')!==envelope.contentBase64||hash(bytes)!==fresh.documentHash)throw new Error();
     // One final SQL recheck after decryption, immediately before transport.
     const gate=(await call('partnershipCopyClaim',{messageId:job.messageId,leaseId:job.leaseId,provider:readiness.provider,providerVersion:readiness.providerVersion,from:options.copyMail.from,payloadHash})).messages?.[0];
     if(!gate){result.blocked++;continue;}
     const sent=await transport.send({...messageText,recipient:gate.recipient,from:gate.from,documentBytes:bytes,documentHash:fresh.documentHash,idempotencyKey:gate.idempotencyKey});
     await finish(sent.status==='unavailable'?'blocked':sent.status,{...sent.providerId?{providerId:sent.providerId}:{},...sent.safeCode?{safeCode:sent.safeCode}:{}});
     if(sent.status==='accepted')result.deliveryAccepted++;else result.deliveryPending++;
    }
   }catch{await finish(fresh.phase==='receipt'?'unavailable':'retry',{...fresh.providerId?{providerId:fresh.providerId}:{},safeCode:'provider_uncertain'}).catch(()=>{});result.deliveryPending++;}
  }
  return result;
 }catch{return {...result,code:'storage_unavailable'};}
}

export function startPartnershipWorkScheduler(accessStore,store,options={}){
 if(options.enabled!==true)return Object.freeze({state:'disabled',stop(){}});
 if(!accessStore?.get||!store?.rpc||!keyValid(options.documentKey)||!(typeof options.signingAdapterFactory==='function'||options.signingProviders||options.signing||options.copyMail))return Object.freeze({state:'not_configured',stop(){}});
 const intervalMs=Number.isInteger(options.intervalMs)&&options.intervalMs>=30000&&options.intervalMs<=3600000?options.intervalMs:60000;
 let running=false,stopped=false;
 const tick=async()=>{if(running||stopped)return;running=true;try{await runPartnershipWork(accessStore,store,options);}finally{running=false;}};
 const timer=setInterval(tick,intervalMs);timer.unref?.();
 return Object.freeze({state:'scheduled',tick,stop(){stopped=true;clearInterval(timer);}});
}
