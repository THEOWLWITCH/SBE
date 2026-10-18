import test from 'node:test';
import assert from 'node:assert/strict';
import { createSignwellTrial, trialDocument } from '../lib/signwell-trial.mjs';
const documentText=bytes=>[...bytes.toString().matchAll(/<w:t[^>]*>(.*?)<\/w:t>/g)].map(match=>match[1]).join('');

test('the isolated trial sends synthetic Hebrew DOCX only in mandatory provider test mode',async()=>{
 const calls=[];
 const probe=createSignwellTrial({apiKey:'synthetic-private-key',fetchImpl:async(url,options)=>{
  calls.push({url,options});
  return Response.json({id:'synthetic-doc',test_mode:true,status:'Created',recipients:[{id:'owner',name:'בעלת מערכת בדויה',email:'owner@example.invalid',embedded_signing_url:'https://www.signwell.com/docs/synthetic-owner'},{id:'partner',name:'חוקרת בדויה',email:'partner@example.invalid',embedded_signing_url:'https://www.signwell.com/docs/synthetic-partner'}]});
 }});
 const created=await probe.create();assert.equal(created.testMode,true);assert.equal(created.legallyVerified,false);
 const {url,options}=calls[0],payload=JSON.parse(options.body);
 assert.equal(url,'https://www.signwell.com/api/v1/documents');
 assert.equal(options.headers['X-TestMode-Enabled'],'true');assert.equal(payload.test_mode,true);assert.equal(options.redirect,'error');
 assert.equal(payload.embedded_signing,true);assert.equal(payload.embedded_signing_notifications,false);assert.equal(payload.reminders,false);
 assert.equal(payload.with_signature_page,true);assert.equal(payload.language,'en');
 assert.ok(payload.recipients.every(p=>p.email.endsWith('@example.invalid')&&p.send_email===false&&!p.phone_number&&!p.send_sms));
 const bytes=Buffer.from(payload.files[0].file_base64,'base64');assert.equal(bytes.readUInt32LE(),0x04034b50);assert.ok(documentText(bytes).includes('מסמך בדיקה בלבד'));assert.ok(documentText(bytes).includes('English 123'));
 assert.equal(JSON.stringify(created).includes('synthetic-private-key'),false);
 assert.equal((await probe.create()).documentId,'synthetic-doc');assert.equal(calls.length,1,'double click does not create a second test envelope');
});

test('an unset key, production-mode provider response or foreign embedded host fails closed',async()=>{
 assert.throws(()=>createSignwellTrial({apiKey:''}),/not_configured/);
 const valid={id:'synthetic-doc',test_mode:true,recipients:[{id:'owner',name:'בעלת מערכת בדויה',email:'owner@example.invalid',embedded_signing_url:'https://www.signwell.com/docs/owner'},{id:'partner',name:'חוקרת בדויה',email:'partner@example.invalid',embedded_signing_url:'https://www.signwell.com/docs/partner'}]};
 for(const unsafe of [{...valid,test_mode:false},{...valid,recipients:[{...valid.recipients[0],embedded_signing_url:'https://evil.example/docs/x'},valid.recipients[1]]}]){
  const probe=createSignwellTrial({apiKey:'synthetic-private-key',fetchImpl:async()=>Response.json(unsafe)});
  await assert.rejects(probe.create(),/unsafe_provider_response/);
 }
});

test('provider errors and incomplete signatures cannot yield completed evidence or disclose response secrets',async()=>{
 const probe=createSignwellTrial({apiKey:'synthetic-private-key',fetchImpl:async()=>new Response('sensitive provider response',{status:401})});
 await assert.rejects(probe.create(),error=>error.message==='provider_auth_failed'&&!error.message.includes('sensitive'));
 const trial=createSignwellTrial({apiKey:'synthetic-private-key',fetchImpl:async(url)=>Response.json(url.endsWith('/documents')?{id:'synthetic-doc',test_mode:true,status:'Created',recipients:[{id:'owner',name:'בעלת מערכת בדויה',email:'owner@example.invalid',embedded_signing_url:'https://www.signwell.com/docs/owner'},{id:'partner',name:'חוקרת בדויה',email:'partner@example.invalid',embedded_signing_url:'https://www.signwell.com/docs/partner'}]}:{id:'synthetic-doc',test_mode:true,status:'Sent',recipients:[]})});
 await trial.create();assert.deepEqual(await trial.completed(),{completed:false,testMode:true,legallyVerified:false});
});

test('the trial artifact marks its synthetic scope and uses the existing Hebrew export engine',()=>{
 const document=trialDocument();assert.equal(document.mediaType,'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
 const text=documentText(Buffer.from(document.contentBase64,'base64'));assert.ok(text.includes('אינו הסכם'));assert.ok(text.includes('2026-10-18'));
});

test('completed test documents bind exact parties despite server recipient IDs and retrieve PDF with audit page',async()=>{
 const calls=[];let completionStatus='completed';
 const recipients=[{id:'server-owner-id',name:'בעלת מערכת בדויה',email:'owner@example.invalid',status:'signed',embedded_signing_url:'https://www.signwell.com/docs/owner'},{id:'server-partner-id',name:'חוקרת בדויה',email:'partner@example.invalid',status:'signed',embedded_signing_url:'https://www.signwell.com/docs/partner'}];
 const trial=createSignwellTrial({apiKey:'synthetic-private-key',fetchImpl:async(url,options)=>{
  calls.push({url,options});
  return url.includes('/completed_pdf?')?new Response('%PDF-synthetic-audit',{headers:{'content-type':'application/pdf'}}):Response.json({id:'synthetic-doc',test_mode:true,status:completionStatus,recipients});
 }});
 await trial.create();const result=await trial.completed();assert.equal(result.completed,true);assert.equal(result.testMode,true);assert.equal(result.legallyVerified,false);assert.equal(result.auditPageRequested,true);assert.equal(result.sha256.length,64);
 assert.ok(calls[2].url.endsWith('/completed_pdf?url_only=false&audit_page=true&file_format=pdf'));
 assert.ok(calls.every(c=>c.options.headers['X-TestMode-Enabled']==='true'&&c.options.redirect==='error'));
 completionStatus='Completed';assert.equal((await trial.completed()).completed,true);
 completionStatus='Manually completed';assert.equal((await trial.completed()).completed,false);
 completionStatus='completed';
 recipients[1].email='different@example.invalid';await assert.rejects(trial.completed(),/unsafe_provider_response/);
});
