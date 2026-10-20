import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const CORE=require('../../app/lib/research-partnership-core.js');
export function canonicalJson(value){
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(canonicalJson).join(',')+']';
 return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonicalJson(value[key])).join(',')+'}';
}
export const contentHash=value=>createHash('sha256').update(canonicalJson(value),'utf8').digest('hex');
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Keep adjacent spaces and punctuation in the RTL context instead of swallowing them into an LTR island.
const mixedRuns=value=>String(value).split(/([A-Za-z0-9](?:[A-Za-z0-9@._+/:,()&;=%?# -]*[A-Za-z0-9])?)/).map((text,i)=>({text,ltr:i%2===1})).filter(run=>run.text);
function render(record,version,template){
 if(record.kind==='agreement'){const rendered=CORE.renderAgreement(version.data,template?.data||template||null);return rendered.document?rendered:{...rendered,text:rendered.text+'\n\nחתימת בעלת המערכת\n\n\nהסכמה לחתימה אלקטרונית וחתימה אצל ספק החתימה\n\n\nחתימת החוקרת\n\n\nהסכמה לחתימה אלקטרונית וחתימה אצל ספק החתימה'};}
 const data=CORE.validateRecord(record.kind,version.data);
 function value(f,v){if(f.type==='boolean')return v?'כן':'לא';if(f.type==='enum')return f.choices[v];if(f.type==='tags')return (f.id==='requestedPermissions'?v.map(CORE.permissionLabel):v).join(', ');if(f.type==='rows')return v.map((row,i)=>(i+1)+'. '+f.fields.filter(n=>Object.hasOwn(row,n.id)).map(n=>n.label+': '+value(n,row[n.id])).join(' · ')).join('\n');return String(v);}
 return {title:data.title||CORE.RECORD_KINDS[record.kind],ready:true,missingFields:[],text:CORE.RECORD_SCHEMAS[record.kind].fields.filter(f=>Object.hasOwn(data,f.id)).map(f=>f.label+': '+value(f,data[f.id])).join('\n\n')};
}
export function agreementHtml(rendered){
 if(rendered.document){
  const mixed=value=>mixedRuns(value).map(run=>run.ltr?'<bdi dir="ltr">'+escape(run.text)+'</bdi>':escape(run.text)).join('');
  const blocks=rendered.document.blocks.map(block=>{
   if(block.type==='title')return '<h1>'+mixed(block.text)+'</h1>';
   if(block.type==='heading')return '<h2>'+mixed(block.text)+'</h2>';
   if(block.type==='row')return '<section class="agreement-row"><h3>'+mixed(block.label)+'</h3>'+block.lines.map(line=>'<p><strong>'+mixed(line.label)+':</strong> '+mixed(line.value)+'</p>').join('')+'</section>';
   if(block.type==='field')return '<p><strong>'+mixed(block.label)+':</strong> '+mixed(block.value)+'</p>';
   return '<p'+(block.type==='signature'?' class="signature"':'')+'>'+mixed(block.text)+'</p>';
  }).join('');
  return '<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><title>'+escape(rendered.title)+'</title><style>@page{size:A4;margin:24mm}*{box-sizing:border-box}body{direction:rtl;text-align:right;font-family:Arial,sans-serif;font-size:11pt;line-height:1.5;margin:0}p{white-space:pre-wrap;overflow-wrap:anywhere;orphans:2;widows:2;margin:0 0 6pt}h1,h2,h3{break-after:avoid;page-break-after:avoid;text-align:right}h1{font-size:18pt}h2{font-size:14pt;margin:16pt 0 7pt}h3{font-size:11pt;margin:9pt 0 5pt}.agreement-row{break-inside:auto;border-top:1px solid #bbb;padding-top:4pt}.signature{break-inside:avoid;min-height:72pt}bdi{unicode-bidi:isolate}@media screen{body{max-width:170mm;padding:16px;margin:auto}}</style></head><body>'+blocks+'</body></html>';
 }
 return '<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><title>'+escape(rendered.title)+'</title><style>@page{size:A4;margin:24mm}body{direction:rtl;text-align:right;font-family:Arial,sans-serif;line-height:1.65}p{white-space:pre-wrap;unicode-bidi:plaintext;overflow-wrap:anywhere}h1{font-size:22px}h2{font-size:17px}bdi{unicode-bidi:isolate}</style></head><body><h1>'+escape(rendered.title)+'</h1>'+rendered.text.split('\n\n').map(p=>'<p>'+escape(p)+'</p>').join('')+'</body></html>';
}
function crc32(bytes){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function zip(entries){
 const locals=[],central=[];let offset=0;
 for(const [name,text] of entries){const n=Buffer.from(name),b=Buffer.from(text),crc=crc32(b),local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt32LE(crc,14);local.writeUInt32LE(b.length,18);local.writeUInt32LE(b.length,22);local.writeUInt16LE(n.length,26);locals.push(local,n,b);const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt32LE(crc,16);c.writeUInt32LE(b.length,20);c.writeUInt32LE(b.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(offset,42);central.push(c,n);offset+=local.length+n.length+b.length;}
 const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...locals,directory,end]);
}
function docx(text,document){
 const runs=(line,style='')=>(document?mixedRuns(line):line.split(/([\x20-\x7e]+)/).filter(Boolean).map(text=>({text,ltr:/^[\x20-\x7e]+$/.test(text)}))).map(run=>'<w:r><w:rPr>'+style+'<w:rtl w:val="'+(run.ltr?'0':'1')+'"/><w:lang w:val="he-IL" w:bidi="he-IL"/></w:rPr><w:t xml:space="preserve">'+escape(run.text)+'</w:t></w:r>').join('');
 // Word resolves its physical alignment relative to w:bidi; left here renders at the right margin.
 const p=(line,heading,signature=false,keepNext=false)=>'<w:p><w:pPr>'+(document&&heading?'<w:pStyle w:val="'+(heading==='title'?'Title':'Heading1')+'"/>':'')+'<w:bidi/><w:jc w:val="'+(document?'left':'right')+'"/>'+(document?'<w:widowControl/><w:spacing w:after="120" w:line="360" w:lineRule="auto"/>'+(heading||keepNext?'<w:keepNext/>':'')+(signature?'<w:keepLines/>':''):'')+'</w:pPr>'+runs(line,document?'<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:color w:val="000000"/><w:sz w:val="'+(heading==='title'?'36':heading?'28':'22')+'"/><w:szCs w:val="'+(heading==='title'?'36':heading?'28':'22')+'"/>'+(heading?'<w:b/><w:bCs/>':''):'')+'</w:p>';
 const paragraphs=document?document.blocks.map(block=>{
  if(block.type==='row')return p(block.label,'row')+block.lines.flatMap(line=>(line.label+': '+line.value).split('\n').map(text=>p(text))).join('');
  return block.text.split('\n').map((line,i,lines)=>p(line,block.type==='title'?'title':block.type==='heading'?'section':false,block.type==='signature',block.type==='signature'&&i<lines.length-1)).join('');
 }).join(''):text.split('\n').map(line=>p(line)).join('');
 return zip([
 ['[Content_Types].xml','<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'+(document?'<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>':'')+'</Types>'],
 ['_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'],
 ['word/document.xml','<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+paragraphs+'<w:sectPr><w:bidi/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1361" w:right="1361" w:bottom="1361" w:left="1361" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>'],
 ...(document?[
 ['word/_rels/document.xml.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="styles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
 ['word/styles.xml','<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:color w:val="000000"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:bidi/><w:jc w:val="left"/><w:keepNext/></w:pPr><w:rPr><w:b/><w:bCs/><w:color w:val="000000"/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:bidi/><w:jc w:val="left"/><w:keepNext/></w:pPr><w:rPr><w:b/><w:bCs/><w:color w:val="000000"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:style></w:styles>']
 ]:[])]);
}
export function exportPartnership({record,version,template},format){
 const rendered=render(record,version,template);
 const formats={text:['txt','text/plain; charset=utf-8',()=>Buffer.from(rendered.text)],json:['json','application/json; charset=utf-8',()=>Buffer.from(canonicalJson({record,version,rendered}))],html:['html','text/html; charset=utf-8',()=>Buffer.from(agreementHtml(rendered))],docx:['docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document',()=>docx(rendered.text,rendered.document)]};
 if(!formats[format])throw CORE.safeError('invalid');const [extension,mediaType,bytes]=formats[format];
 const output=bytes();return {filename:'research-'+version.id+'.'+extension,mediaType,contentBase64:output.toString('base64'),versionId:version.id,documentHash:createHash('sha256').update(output).digest('hex')};
}
