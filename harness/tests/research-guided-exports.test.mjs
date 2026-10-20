import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { exportPartnership, contentHash } from '../lib/research-partnership-exports.mjs';

const C=createRequire(import.meta.url)('../../app/lib/research-partnership-core.js');
const catalog=JSON.parse(readFileSync(new URL('../content/research-agreement-guidance-v4.json',import.meta.url)));
const id='11111111-1111-4111-8111-111111111111';
const occurrences=(text,value)=>text.split(value).length-1;
function sample(f,prefix='בדיקה') {
 if(f.type==='rows')return [Object.fromEntries(f.fields.map(n=>[n.id,sample(n,prefix+' '+f.id)]))];
 if(f.type==='tags')return [f.itemType==='id'?id:f.choices?f.choices[0]:prefix+' '+f.id];
 return {text:prefix+' ⟦'+f.id+'⟧',email:'synthetic@example.invalid',date:'2026-11-02',id,money:'1234.56',integer:7,boolean:true}[f.type]??Object.keys(f.choices)[0];
}
function data(){const out=Object.fromEntries(C.RECORD_SCHEMAS.agreement.fields.map(f=>[f.id,sample(f)]));out.guidedVersion='4';out.customClauses=[{sectionId:'study',title:'סעיף מקומי יחיד',text:'תוכן סעיף מותאם יחיד'}];for(const a of C.GUIDED_AGREEMENT.annexes)out[a.statusField]='applicable';return out;}
function context(agreement){return {record:{id,kind:'agreement'},version:{id,number:8,contentHash:contentHash(agreement),data:agreement},template:{data:catalog.templateData}};}
const bytes=(ctx,format)=>Buffer.from(exportPartnership(ctx,format).contentBase64,'base64');
function zipText(buffer,name){let at=0;while(buffer.readUInt32LE(at)===0x04034b50){const len=buffer.readUInt32LE(at+18),n=buffer.readUInt16LE(at+26),extra=buffer.readUInt16LE(at+28),file=buffer.subarray(at+30,at+30+n).toString(),start=at+30+n+extra;if(file===name)return buffer.subarray(start,start+len).toString();at=start+len;}throw new Error('missing ZIP member');}
const wordText=buffer=>[...zipText(buffer,'word/document.xml').matchAll(/<w:t[^>]*>(.*?)<\/w:t>/gs)].map(m=>m[1]).join('');

test('guided completed model includes each selected value, custom clause and signature anchor once',()=>{
 const agreement=data(),rendered=C.renderAgreement(agreement,catalog.templateData);
 assert.ok(rendered.document?.blocks?.length,'completed document model');
 assert.equal(rendered.text,rendered.document.blocks.map(b=>b.text).join('\n\n'));
 for(const key of ['title','ownerName','partnerName','leadResearcher','studyIdentifier','studyTitle','centralResearchQuestion','signatureProvider','signatureVerification'])assert.equal(occurrences(rendered.text,agreement[key]),1,key);
 for(const value of ['סעיף מקומי יחיד','תוכן סעיף מותאם יחיד','חתימת בעלת המערכת','חתימת החוקרת',...catalog.sourceDocument.sections[7].paragraphs.slice(0,2)])assert.equal(occurrences(rendered.text,value),1,value);
 assert.equal(rendered.sections.flatMap(s=>s.fields).find(f=>f.id==='customClauses'),undefined);
 assert.doesNotMatch(rendered.text,/30 ימים|21 ימי עסקים|זו אפשרות לדיון|זו רשימת מסמכים להכנה|\[להשלמה/);
 const covered=new Set(rendered.document.blocks.flatMap(b=>b.fieldIds||[]));
 for(const f of C.RECORD_SCHEMAS.agreement.fields)if(!['customClauses','guidedVersion','ipReadAcknowledgement'].includes(f.id)&&!f.id.endsWith('Reason'))assert.ok(covered.has(f.id),f.id);
 assert.doesNotMatch(rendered.text,/קראתי את הסבר הקניין הרוחני|גרסת תבנית מאושרת/);
});

test('guided annex applicability excludes stale rows and mutually exclusive reasons without mutating drafts',()=>{
 const agreement=data();agreement.annexBStatus='not_applicable';agreement.annexBReason='נימוק בלעדי לאי תחולה';agreement.annexB[0].tool='תוכן ישן שאסור לפרסם';agreement.annexAReason='נימוק ישן שאינו חל';
 const snapshot=structuredClone(agreement),rendered=C.renderAgreement(agreement,catalog.templateData);
 assert.match(rendered.text,/נימוק בלעדי לאי תחולה/);
 assert.doesNotMatch(rendered.text,/תוכן ישן שאסור לפרסם|נימוק ישן שאינו חל/);
 assert.deepEqual(agreement,snapshot);
 for(const format of ['text','html','docx']){const raw=bytes(context(agreement),format),output=format==='docx'?wordText(raw):raw.toString().replace(/<[^>]*>/g,'');assert.ok(!/תוכן ישן שאסור לפרסם|נימוק ישן שאינו חל/.test(output),format);assert.ok(output.includes('נימוק בלעדי לאי תחולה'),format);}
 const incomplete=C.renderAgreement({guidedVersion:'4',annexBStatus:'applicable'},catalog.templateData);
 assert.match(incomplete.text,/חסר: נספח B/);assert.equal(incomplete.ready,false);
});

test('guided model is shared by preview text HTML DOCX and signing bytes with distinct canonical and byte hashes',()=>{
 const agreement=data();agreement.title='כותרת עברית <script>& בדויה';agreement.annexB[0].tool='Tool Name v2';agreement.annexB[0].actions=['view_study','export_data'];
 const ctx=context(agreement),rendered=C.renderAgreement(agreement,catalog.templateData),text=bytes(ctx,'text').toString(),html=bytes(ctx,'html').toString(),word=zipText(bytes(ctx,'docx'),'word/document.xml');
 assert.equal(text,rendered.text);assert.equal(occurrences(html,'<h1'),1);assert.equal(occurrences(html.split('<body>')[1].replace(/<[^>]*>/g,''),'&lt;script&gt;'),1);assert.doesNotMatch(html,/<script>/);
 assert.match(html,/@page\{size:A4;margin:24mm\}/);assert.match(html,/dir="rtl"/);assert.match(html,/text-align:right/);assert.match(html,/break-after:avoid/);
 assert.match(word,/w:pgMar w:top="1361" w:right="1361" w:bottom="1361" w:left="1361"/);assert.match(word,/<w:keepNext\/>/);assert.match(word,/<w:rtl w:val="0"\/>/);assert.match(word,/w:bidi/);
 assert.match(word,/<w:pStyle w:val="Title"\/>/);assert.match(word,/<w:jc w:val="left"\/>/);assert.match(word,/<w:color w:val="000000"\/>/);assert.match(zipText(bytes(ctx,'docx'),'word/styles.xml'),/w:styleId="Title"/);
 assert.ok(html.includes('<bdi dir="ltr">BE GOOD</bdi> בהקשר'),'LTR trailing whitespace stays outside isolation');
 assert.match(text,/צפייה במחקר/);assert.doesNotMatch(text,/view_study|export_data/);assert.match(text,/02\.11\.2026/);assert.match(text,/1,234\.56/);
 assert.equal(occurrences(wordText(bytes(ctx,'docx')),'חתימת בעלת המערכת'),1);assert.equal(occurrences(text,'חתימת בעלת המערכת'),1);
 for(const format of ['text','html','docx']){const out=exportPartnership(ctx,format),raw=Buffer.from(out.contentBase64,'base64');assert.equal(out.documentHash,createHash('sha256').update(raw).digest('hex'));assert.notEqual(out.documentHash,ctx.version.contentHash);}
});

test('guided row rendering preserves zero decisions and escapes literal markup without altering source values',()=>{
 const agreement=data();agreement.annexA[0].populationSize=0;agreement.annexC[0].estimatedAmount='0.00';agreement.annexC[0].description='תנאי <b>בדוי</b> & סימן';agreement.ipReadAcknowledgement=false;
 const before=structuredClone(agreement),ctx=context(agreement),text=bytes(ctx,'text').toString(),html=bytes(ctx,'html').toString(),word=zipText(bytes(ctx,'docx'),'word/document.xml');
 assert.match(text,/היקף משתתפים: 0/);assert.match(text,/הערכה: 0\.00/);assert.ok(!html.includes('<b>בדוי</b>'));assert.ok(html.includes('&lt;'));assert.ok(!word.includes('<b>בדוי</b>'));assert.ok(word.includes('&amp;'));assert.doesNotMatch(text,/קראתי את הסבר הקניין הרוחני/);assert.deepEqual(agreement,before);
});

test('legacy agreement rendering and OOXML bytes retain the pre-guided export contract',()=>{
 const agreement={title:'הסכם קודם בדוי',ownerName:'בעלת המערכת הבדויה',partnerName:'Legacy Example',studyTitle:'מחקר קודם',purpose:'בדיקה בלבד',effectiveDate:'2026-11-02',templateVersionId:id,ipExplanationVersionId:id};
 const template={title:'תבנית בדויה',templateVersion:'legacy-1',explanationVersion:'legacy-ip-1',sectionClauses:C.AGREEMENT_SECTIONS.map(s=>({sectionId:s.id,text:s.id==='parties'?'צדדים: {{ownerName}} / {{partnerName}}':'סעיף קודם '+s.id})),ipExplanation:'הסבר קודם בדוי',mutualIPClause:'סעיף קודם בדוי'};
 const ctx={record:{kind:'agreement'},version:{id,data:agreement},template:{data:template}},rendered=C.renderAgreement(agreement,template);
 assert.equal(rendered.document,undefined);assert.match(rendered.text,/תחילת תוקף מוצעת: 2026-11-02/);
 assert.equal(createHash('sha256').update(bytes(ctx,'docx')).digest('hex'),'34ec3f3add032054cce57dca84f6aa1ef541056faf021b825896130a430228d3');
});
