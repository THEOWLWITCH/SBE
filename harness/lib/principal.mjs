import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

export const usageError = (code, status = 503) => Object.assign(new Error(code), { code, status });
const hash = value => createHash('sha256').update(value).digest('hex');
const copy = value => structuredClone(value);

// This adapter is deliberately explicit and only for local fixtures. Persistent
// stores must implement these operations at their database transaction boundary.
export function createAtomicMemoryStore(seed = {}) {
  const data = new Map(Object.entries(copy(seed)));
  function settle({ownerId,tenantId,requestId,outcome,now}) {
    const key='aiq:'+hash(ownerId+'\0'+requestId),rec=data.get(key);
    if(!rec||rec.ownerId!==ownerId||rec.tenantId!==tenantId) throw usageError('reservation_missing',409);
    if(rec.state!=='reserved') {
      if(outcome==='commit'&&rec.state!=='committed') throw usageError('reservation_closed',409);
      return {...copy(rec),duplicate:true};
    }
    if(rec.expiresAt<=now) { rec.state='released';data.set(key,rec);throw usageError('reservation_expired',409); }
    if(outcome==='commit'&&rec.quota?.codeKey) {
      const code=data.get(rec.quota.codeKey);if(!code||code.revoked) throw usageError('revoked',403);
      if(rec.quota.kind==='student') code.uses=(code.uses||0)+1;
      if(rec.quota.kind==='course') { code.taken=code.taken||{};code.taken[rec.quota.sid]=(code.taken[rec.quota.sid]||0)+1;code.uses=(code.uses||0)+1; }
      data.set(rec.quota.codeKey,code);
    }
    rec.state=outcome==='commit'?'committed':'released';rec.settledAt=now;data.set(key,rec);return {...copy(rec),duplicate:false};
  }
  const store = {
    data,
    async get(key) { return copy(data.get(key) ?? null); },
    async set(key,value) { data.set(key,copy(value)); },
    async del(key) { data.delete(key); },
    async list(prefix,{keysOnly=false}={}) { return [...data].filter(([k])=>k.startsWith(prefix)).map(([key,value])=>keysOnly?{key}:{key,value:copy(value)}); },
    async delPrefix(prefix) { for(const key of data.keys()) if(key.startsWith(prefix)) data.delete(key); },
    async putIfAbsent({key,value}) {
      if(data.has(key)) return {created:false,value:copy(data.get(key))};
      data.set(key,copy(value));return {created:true,value:copy(value)};
    },
    async compareAndSet({key,expected,value}) {
      const current=data.get(key)??null;
      if(!isDeepStrictEqual(current,expected)) return {updated:false,value:copy(current)};
      data.set(key,copy(value));return {updated:true,value:copy(value)};
    },
    async atomicAppendWorkshop({workshopId,submissionId,entry,maxEntries}) {
      const ws=data.get('wf:'+workshopId);if(!ws) throw usageError('no such workshop',404);
      const entries=ws.entries??[],prior=entries.find(e=>e.submissionId===submissionId);
      if(prior) {
        if(!isDeepStrictEqual({role:prior.role,entry:prior.entry},{role:entry.role,entry:entry.entry})) throw usageError('submission_conflict',409);
        return {ok:true,duplicate:true};
      }
      if(entries.length>=maxEntries) throw usageError('full',429);
      data.set('wf:'+workshopId,{...ws,entries:[...entries,{...copy(entry),submissionId}]});
      return {ok:true,duplicate:false};
    },
    async atomicOpenWorkshop({workshop,code,now}) {
      const key='wf:'+workshop.w,prior=data.get(key);
      if(prior) {
        if(prior.ownerId!==workshop.ownerId||prior.tenantId!==workshop.tenantId) throw usageError('unauthorized',403);
        return {existed:true};
      }
      const taken=code&&data.get('wfc:'+code);
      if(taken&&Date.parse(now)-Date.parse(taken.at)<864e5) throw usageError('code taken',409);
      data.set(key,copy(workshop));
      if(code) data.set('wfc:'+code,{w:workshop.w,at:now});
      return {existed:false};
    },
    async atomicReserveUsage(args) {
      const {ownerId,tenantId,requestId,requestHash,maxTokens,tokenBudget=maxTokens,now,expiresAt,limits,quota}=args;
      for(const row of data.values()) if(row?.type==='ai-usage'&&row.tenantId===tenantId&&row.state==='reserved'&&row.expiresAt<=now) {row.state='released';row.settledAt=now;}
      const key='aiq:'+hash(ownerId+'\0'+requestId),prior=data.get(key);
      if(prior) {
        if(prior.tenantId!==tenantId||prior.requestHash!==requestHash||prior.maxTokens!==maxTokens||prior.tokenBudget!==tokenBudget) throw usageError('idempotency_conflict',409);
        if(prior.state==='reserved'&&prior.expiresAt<=now) { prior.state='released';data.set(key,prior); }
        return {...copy(prior),duplicate:true};
      }
      const tenantRows=[...data.values()].filter(v=>v?.type==='ai-usage'&&v.tenantId===tenantId);
      const rows=tenantRows.filter(v=>v.ownerId===ownerId);
      const active=rows.filter(v=>v.state==='reserved'&&v.expiresAt>now);
      // An unsuccessful provider attempt may still incur cost. Release only
      // concurrent/academic capacity; daily admission retains its full budget.
      const daily=rows.filter(v=>v.createdAt.slice(0,10)===now.slice(0,10));
      const tenantActive=tenantRows.filter(v=>v.state==='reserved'&&v.expiresAt>now);
      const tenantDaily=tenantRows.filter(v=>v.createdAt.slice(0,10)===now.slice(0,10));
      if(active.length>=limits.concurrent||daily.length>=limits.dailyRequests||daily.reduce((sum,v)=>sum+(v.tokenBudget??v.maxTokens),0)+tokenBudget>limits.dailyTokens
        ||tenantActive.length>=limits.tenantConcurrent||tenantDaily.length>=limits.tenantDailyRequests||tenantDaily.reduce((sum,v)=>sum+(v.tokenBudget??v.maxTokens),0)+tokenBudget>limits.tenantDailyTokens) throw usageError('quota_exceeded',429);
      if(quota?.codeKey) {
        const rec=data.get(quota.codeKey);if(!rec||rec.revoked) throw usageError('revoked',403);
        const codeActive=[...data.values()].filter(v=>v?.type==='ai-usage'&&v.quota?.codeKey===quota.codeKey&&v.state==='reserved'&&v.expiresAt>now);
        if(quota.kind==='student'&&(rec.uses||0)+codeActive.length>=rec.maxUses) throw usageError('used-up',429);
        if(quota.kind==='course') {
          const taken=rec.taken||{},pendingSids=new Set(codeActive.map(v=>v.quota.sid));
          const sidActive=codeActive.filter(v=>v.quota.sid===quota.sid).length;
          if((taken[quota.sid]||0)+sidActive>=rec.usesPer) throw usageError('used-up',429);
          const seats=new Set([...Object.keys(taken),...pendingSids]);
          if(!seats.has(quota.sid)&&seats.size>=rec.seats) throw usageError('full',429);
        }
      }
      const record={type:'ai-usage',ownerId,tenantId,requestId,requestHash,maxTokens,tokenBudget,quota,state:'reserved',createdAt:now,expiresAt};
      data.set(key,record);return {...copy(record),duplicate:false};
    },
    async atomicSettleUsage(args) { return settle(args); },
    async finalizeAIJob({key,expected,value,principal,requestId,outcome}) {
      const current=data.get(key)??null;
      if(!isDeepStrictEqual(current,expected)) return {updated:false,value:copy(current)};
      if(current?.ownerId!==principal.ownerId||current?.tenantId!==principal.tenantId||value.ownerId!==principal.ownerId||value.tenantId!==principal.tenantId) throw usageError('unauthorized',403);
      const usage=settle({...principal,requestId,outcome,now:new Date().toISOString()});
      data.set(key,copy(value));return {updated:true,value:copy(value),usage};
    },
  };
  return store;
}
