import test from 'node:test';
import assert from 'node:assert/strict';
import {completionUsageCharge} from '../lib/token-budget.mjs';

const cap={reservation:30000,maxOutputTokens:2400};

test('Only a complete single-attempt measurement can release reserved budget',()=>{
  assert.equal(completionUsageCharge({inputTokens:9000,outputTokens:40,totalTokens:9040},cap),9040);
  assert.equal(completionUsageCharge({inputTokens:9000,outputTokens:40},cap),9040);
  assert.equal(completionUsageCharge({inputTokens:null,outputTokens:40,totalTokens:9040},cap),9040);
  for(const usage of [undefined,{}, {inputTokens:null,outputTokens:40,totalTokens:null},{inputTokens:9000}])
    assert.equal(completionUsageCharge(usage,cap),30000);
});

test('Final-attempt measurements cannot discount a reservation that permits a retry',()=>{
  // Attempt one can have been charged even when only attempt two supplied usage.
  for(const usage of [{inputTokens:9000,outputTokens:40,totalTokens:9040},{inputTokens:9000,outputTokens:40},{}])
    assert.equal(completionUsageCharge(usage,{...cap,attempts:2}),30000);
});

test('Invalid, inconsistent and overflowing usage never releases a reservation',()=>{
  for(const attempts of [1,2])for(const usage of [
    {inputTokens:-1,outputTokens:40,totalTokens:9040},{inputTokens:9000,outputTokens:2401,totalTokens:11401},
    {inputTokens:9000,outputTokens:40,totalTokens:40},{inputTokens:9000,outputTokens:40,totalTokens:'9040'},
    {inputTokens:Infinity},{totalTokens:NaN},{inputTokens:Number.MAX_VALUE,outputTokens:Number.MAX_VALUE}
  ])assert.equal(completionUsageCharge(usage,{...cap,attempts}),null);
  assert.equal(completionUsageCharge({totalTokens:31000},cap),31000,'measured excess is charged, not clamped');
});
