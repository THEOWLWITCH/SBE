import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const JSZip = createRequire(import.meta.url)('../../app/lib/vendor/studies/jszip/jszip.min.js');
const source = await readFile(new URL('../../app/lib/communication-attachments.js', import.meta.url), 'utf8');

async function forgedDocx(members) {
  const zip = new JSZip();
  for (const [name, size] of members) zip.file(name, 'a'.repeat(size));
  const bytes = await zip.generateAsync({ type:'nodebuffer', compression:'DEFLATE' });
  for (let i=0;i<bytes.length-46;i++) if(bytes.readUInt32LE(i)===0x02014b50) bytes.writeUInt32LE(1,i+24);
  return {name:'synthetic-forged.docx',size:bytes.length,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length)};
}
function fixture() {
  let emitted=0,parsed=0,decoded=0;
  const window={JSZip:{async loadAsync(bytes) {
    const zip=await JSZip.loadAsync(bytes);
    for(const member of Object.values(zip.files)) {
      const original=member.internalStream.bind(member);
      member.internalStream=type=>{
        const stream=original(type);stream.on('data',chunk=>{emitted+=chunk.byteLength;});return stream;
      };
    }
    return zip;
  }}};
  class DOMParser { parseFromString(){parsed++;return {getElementsByTagName:()=>[],getElementsByTagNameNS:()=>[]};} }
  class CountingDecoder extends TextDecoder { decode(chunk,options){decoded+=chunk?.byteLength||0;return super.decode(chunk,options);} }
  runInNewContext(source,{window,TextDecoder:CountingDecoder,DOMParser});
  return {prepare:window.SBE_COMMUNICATION_ATTACHMENTS.prepare,counts:()=>({emitted,parsed,decoded})};
}
test('forged DOCX header cannot bypass actual decoded-byte cap or reach XML parser',async()=>{
  const f=fixture(),file=await forgedDocx([['word/document.xml',20*1024*1024]]);
  assert.ok(file.size<10*1024*1024);
  await assert.rejects(f.prepare(file),/גדול מדי/);
  assert.equal(f.counts().parsed,0);
  assert.ok(f.counts().decoded<=16*1024*1024,JSON.stringify(f.counts()));
});
test('decoded DOCX cap is cumulative across selected XML members',async()=>{
  const f=fixture(),file=await forgedDocx([['word/document.xml',10*1024*1024],['word/header1.xml',10*1024*1024]]);
  // Correct the first member's header so JSZip reaches the second one.
  const bytes=Buffer.from(await file.arrayBuffer());
  for(let i=0;i<bytes.length-46;i++) if(bytes.readUInt32LE(i)===0x02014b50&&bytes.toString('utf8',i+46,i+46+bytes.readUInt16LE(i+28))==='word/document.xml')bytes.writeUInt32LE(10*1024*1024,i+24);
  file.arrayBuffer=async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length);
  await assert.rejects(f.prepare(file),/גדול מדי/);
  assert.equal(f.counts().parsed,1);
  assert.ok(f.counts().decoded<=16*1024*1024,JSON.stringify(f.counts()));
});
