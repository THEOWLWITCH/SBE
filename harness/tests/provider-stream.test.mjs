import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';

const event=value=>'data: '+JSON.stringify(value)+'\r\n\r\n';
async function fixture(t) {
  let abortStarted;
  const started=new Promise(resolve=>abortStarted=resolve);
  const server=createServer(async(req,res)=>{
    let raw='';for await(const chunk of req)raw+=chunk;
    const mode=JSON.parse(raw).messages[0].content[0].text;
    res.writeHead(200,{'content-type':'text/event-stream'});
    res.write(event({type:'message_start',message:{usage:{input_tokens:9}}}));
    if(mode==='abort'){abortStarted();return;}
    if(mode==='early'){res.end();return;}
    const events=[
      {type:'content_block_start',index:0,content_block:{type:'thinking',thinking:''}},
      {type:'content_block_delta',index:0,delta:{type:'thinking_delta',thinking:'private synthetic thought'}},
      {type:'content_block_delta',index:0,delta:{type:'signature_delta',signature:'synthetic-signature'}},
      {type:'content_block_start',index:1,content_block:{type:'text',text:''}},
      {type:'content_block_delta',index:1,delta:{type:'text_delta',text:'שלום'}},
      {type:'content_block_start',index:2,content_block:{type:'tool_use',id:'tool-1',name:'report_turn',input:{}}},
      {type:'content_block_delta',index:2,delta:{type:'input_json_delta',partial_json:'{"turn":'}},
      {type:'content_block_delta',index:2,delta:{type:'input_json_delta',partial_json:mode==='malformed'?'invalid}':'2}'}},
      {type:'content_block_stop',index:2},
      {type:'message_delta',delta:{stop_reason:'tool_use'},usage:{output_tokens:6}},
      {type:'message_stop'}
    ];
    const bytes=Buffer.from(events.map(event).join(''));
    // Split both SSE delimiters and Hebrew UTF-8 characters across network chunks.
    for(let i=0;i<bytes.length;i+=7)res.write(bytes.subarray(i,i+7));res.end();
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const previous=process.env.ANTHROPIC_BASE_URL;
  let module;
  try {
    process.env.ANTHROPIC_BASE_URL='http://127.0.0.1:'+server.address().port;
    module=await import('../lib/providers.mjs?stream-fixture='+server.address().port);
  }finally{if(previous===undefined)delete process.env.ANTHROPIC_BASE_URL;else process.env.ANTHROPIC_BASE_URL=previous;}
  return {provider:module.getProvider('anthropic',{apiKey:'synthetic-only'}),started};
}
test('default SSE transport reconstructs split Hebrew, incremental tool JSON, thinking and measured usage',async t=>{
  const {provider}=await fixture(t);
  const result=await provider.complete({prompt:'success',maxTokens:100,maxAttempts:1});
  assert.equal(result.text,'שלום');assert.ok(!result.text.includes('private synthetic thought'));
  assert.deepEqual(result.toolCalls,[{id:'tool-1',name:'report_turn',input:{turn:2}}]);
  assert.equal(result.usage.inputTokens,9);assert.equal(result.usage.outputTokens,6);assert.equal(result.usage.totalTokens,15);
  assert.equal(result.raw.content[0].thinking,'private synthetic thought');
  assert.equal(result.raw.content[0].signature,'synthetic-signature');
});
test('default SSE transport rejects malformed tool JSON and premature closure with partial usage',async t=>{
  const {provider}=await fixture(t);
  for(const [mode,code] of [['malformed','malformed_response'],['early','transport']]) {
    await assert.rejects(provider.complete({prompt:mode,maxTokens:100,maxAttempts:1}),error=>{
      assert.equal(error.code,code);assert.equal(error.usage.inputTokens,9);return true;
    });
  }
});
test('default SSE transport aborts an open stream without retrying or discarding partial usage',async t=>{
  const {provider,started}=await fixture(t),ctrl=new AbortController();
  const pending=provider.complete({prompt:'abort',maxTokens:100,maxAttempts:1,signal:ctrl.signal});
  await started;await new Promise(resolve=>setTimeout(resolve,100));ctrl.abort();
  await assert.rejects(pending,error=>{assert.equal(error.code,'aborted');assert.equal(error.usage.inputTokens,9);return true;});
});
