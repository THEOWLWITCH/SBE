// Usage returned by an adapter can describe only its final physical attempt.
// Reconcile a reservation only when a single successful attempt has a complete,
// finite measurement. Null means invalid usage: callers reject and retain it.
export function completionUsageCharge(usage,{reservation,maxOutputTokens,attempts=1}) {
  const measured=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
  if(!measured(reservation)||!measured(maxOutputTokens)||![1,2].includes(attempts))return null;
  usage=usage||{};
  for(const key of ['inputTokens','outputTokens','totalTokens'])
    if(usage[key]!=null&&!measured(usage[key]))return null;
  if(usage.outputTokens>maxOutputTokens)return null;
  const known=(usage.inputTokens||0)+(usage.outputTokens||0);
  if(!Number.isFinite(known)||measured(usage.totalTokens)&&usage.totalTokens<known)return null;
  const used=measured(usage.totalTokens)?usage.totalTokens:
    measured(usage.inputTokens)&&measured(usage.outputTokens)?known:reservation;
  if(!Number.isFinite(used))return null;
  return attempts===1?used:reservation;
}
