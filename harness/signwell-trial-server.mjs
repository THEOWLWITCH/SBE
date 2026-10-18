import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { pathToFileURL } from 'node:url';
import { createSignwellTrial, trialDocument } from './lib/signwell-trial.mjs';

function page(base,nonce){return `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BE GOOD — ניסיון חתימה חינמי</title>
<style nonce="${nonce}">*{box-sizing:border-box}[hidden]{display:none!important}body{margin:0;background:#f3f7fa;color:#173b47;font:18px/1.7 Arial,sans-serif}header,main{max-width:850px;margin:auto;padding:24px}header{background:#fff4bc;max-width:none;text-align:center}section{background:white;padding:24px;border-radius:14px;margin:18px 0}h1{font-size:28px}input,button,a{font:inherit}input{display:block;width:100%;padding:12px;margin:12px 0}button,a.button{background:#126a74;color:white;border:0;border-radius:8px;padding:10px 16px;margin:6px;text-decoration:none;display:inline-block;cursor:pointer}button:disabled{opacity:.6}a{color:#126a74}#signing{min-height:680px}#signing:empty{display:none}#signing iframe{width:100%;min-height:680px;border:0}#status{white-space:pre-wrap}small{display:block}input{direction:ltr;text-align:left}</style>
<header>ניסוי מקומי בלבד · מסמכים וזהויות בדויים · אין תוקף של הסכם או חתימה מאומתת</header><main><h1>ניסיון SignWell ללא חיוב</h1>
<section><p>הניסוי משתמש במצב בדיקות של הספק. המפתח נשמר בזיכרון של התהליך המקומי בלבד, ואינו נשמר בקוד או נשלח לצ׳אט.</p><p>המסמך בעברית; מסך החתימה של הספק באנגלית. <span lang="en" dir="ltr">Start / Next / Finish</span> הם התחלה, המשך וסיום.</p><a href="${base}/source.docx" download>מסמך הבדיקה הבדוי</a></section>
<section id="setup"><form id="key-form"><label for="key">מפתח API מחשבון SignWell החינמי שלך</label><input id="key" type="password" autocomplete="off" spellcheck="false" required maxlength="2048" aria-describedby="key-help"><small id="key-help">אין צורך באשראי. אפשר ליצור מפתח בחשבון דרך Settings → API. אין להדביק כאן סיסמה.</small><button id="start">יצירת מסמך בדיקה בלבד</button></form></section>
<p id="status" role="status">טרם בוצעה פנייה לספק.</p><section id="actions" hidden><p>במסמך הבדוי אפשר לבדוק את שני תפקידי החתימה. אלו אינם הסכם או אימות זהות.</p><div id="parties"></div><button id="refresh">בדיקת השלמה מול הספק</button><a id="result" class="button" href="${base}/final.pdf" hidden>פתיחת PDF בדיקה עם עמוד ביקורת</a></section><section id="signing"></section></main>
<script nonce="${nonce}">
const base=${JSON.stringify(base)},status=document.getElementById('status');let loading;
async function post(action,payload={}){const response=await fetch(base+'/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),cache:'no-store'});const data=await response.json();if(!response.ok)throw new Error(data.message||'הבדיקה לא הושלמה.');return data;}
function sdk(){if(!loading)loading=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://static.signwell.com/assets/embedded.js';script.onload=resolve;script.onerror=()=>reject(new Error('לא ניתן לטעון את תצוגת הספק.'));document.head.append(script);});return loading;}
document.getElementById('key-form').addEventListener('submit',async event=>{event.preventDefault();const key=document.getElementById('key'),button=document.getElementById('start');button.disabled=true;const apiKey=key.value;key.value='';status.textContent='יוצרת מסמך בדיקה...';try{const result=await post('start',{apiKey});document.getElementById('setup').remove();document.getElementById('actions').hidden=false;for(const signer of result.signers){const button=document.createElement('button');button.textContent='בדיקת חתימה: '+signer.name;button.onclick=async()=>{try{await sdk();document.getElementById('signing').replaceChildren();new SignWellEmbed({url:signer.embeddedUrl,containerId:'signing',allowRedirect:false,allowDownload:false,signatureDefaultName:true,events:{completed:()=>{status.textContent='הספק דיווח על חתימת בדיקה. יש ללחוץ על בדיקת השלמה מול הספק.';},error:()=>{status.textContent='תצוגת החתימה נכשלה; לא הושלמה בדיקה.';}}}).open();}catch(error){status.textContent=error.message;}};document.getElementById('parties').append(button);}status.textContent='מסמך בדיקה נוצר. לא נבדקו עדיין שתי החתימות, העברית או קובץ ה־PDF הסופי.';}catch(error){status.textContent=error.message;button.disabled=false;}});
document.getElementById('refresh').onclick=async()=>{const button=document.getElementById('refresh');if(button.disabled)return;button.disabled=true;status.textContent='בודקת סטטוס מול הספק...';try{const result=await post('refresh');status.textContent=result.completed?'שתי חתימות הבדיקה הושלמו ונשלף PDF מהספק עם בקשה לעמוד ביקורת. יש לבדוק עימוד ועברית; אין בכך אימות משפטי.':'הבדיקה טרם הושלמה אצל הספק.';document.getElementById('result').hidden=!result.completed;}catch(error){status.textContent=error.message;}finally{button.disabled=false;}};
</script></html>`;}

export async function startTrialServer({fetchImpl,ttlMs=30*60*1000}={}){
 const token=randomBytes(24).toString('base64url'),base='/'+token,nonce=randomBytes(18).toString('base64');
 let origin,creation,trial,finalPdf,expired=false;
 const server=http.createServer(async(req,res)=>{
  const send=(code,type,content)=>{res.writeHead(code,{'Content-Type':type,'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; script-src 'nonce-"+nonce+"' https://static.signwell.com; style-src 'unsafe-inline'; connect-src 'self'; frame-src https://www.signwell.com; frame-ancestors 'none'; form-action 'self'; base-uri 'none'"});res.end(content);};
  const json=(code,value)=>send(code,'application/json; charset=utf-8',JSON.stringify(value));
  try{
   if(req.headers.host!==new URL(origin).host)return json(403,{message:'הכתובת אינה מורשית.'});
   if(expired)return json(410,{message:'זמן הניסוי הסתיים. יש לפתוח תהליך מקומי חדש.'});
   const path=new URL(req.url,origin).pathname;
   if(![base,base+'/source.docx',base+'/start',base+'/refresh',base+'/final.pdf'].includes(path))return json(404,{message:'לא נמצא.'});
   if(req.method==='GET'&&path===base)return send(200,'text/html; charset=utf-8',page(base,nonce));
   if(req.method==='GET'&&path===base+'/source.docx')return send(200,'application/vnd.openxmlformats-officedocument.wordprocessingml.document',Buffer.from(trialDocument().contentBase64,'base64'));
   if(req.method==='GET'&&path===base+'/final.pdf'&&finalPdf)return send(200,'application/pdf',finalPdf);
   if(req.method!=='POST'||![base+'/start',base+'/refresh'].includes(path))return json(405,{message:'פעולה לא נתמכת.'});
   if(req.headers.origin!==origin||req.headers['content-type']!=='application/json')return json(403,{message:'הבקשה אינה מהדף המקומי.'});
   let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>8192)return json(413,{message:'הבקשה גדולה מדי.'});}
   let payload;try{payload=JSON.parse(raw);}catch{return json(400,{message:'בקשה לא תקינה.'});}
   if(!payload||Array.isArray(payload)||typeof payload!=='object'||Object.keys(payload).some(k=>k!==(path.endsWith('/start')?'apiKey':'')))return json(400,{message:'בקשה לא תקינה.'});
   if(path===base+'/start'){
    if(!creation){
     const candidate=createSignwellTrial({apiKey:payload.apiKey,fetchImpl});
     creation=candidate.create().then(value=>{if(expired)throw new Error('expired');trial=candidate;return value;}).catch(error=>{if(error.message==='provider_auth_failed')creation=undefined;throw error;});
    }
    const result=await creation;
    if(expired)return json(410,{message:'זמן הניסוי הסתיים.'});
    return json(200,result);
   }
   if(!trial)return json(409,{message:'יש ליצור תחילה מסמך בדיקה.'});
   const result=await trial.completed();
   if(expired)return json(410,{message:'זמן הניסוי הסתיים.'});
   if(result.completed)finalPdf=result.bytes;
   return json(200,{completed:result.completed,testMode:true,legallyVerified:false,...(result.completed?{sha256:result.sha256,auditPageRequested:result.auditPageRequested}:{})});
  }catch(error){
   if(expired)return json(410,{message:'זמן הניסוי הסתיים.'});
   if(error.message==='provider_rejected_input')return json(422,{message:'הספק דחה את מסמך הבדיקה ('+error.providerStatus+'). שדות לבדיקה: '+(error.fields.join(', ')||'לא פורטו')+'. מילות אבחון מסוננות: '+error.words.join(' ')+'.'});
   const details=['test_mode','document_id','parties','embedded_url'].includes(error.stage)?' שלב: '+error.stage+'.':Number.isInteger(error.providerStatus)&&error.providerStatus>0?' קוד HTTP: '+error.providerStatus+'.':'';
   return json(503,{message:error.message==='provider_auth_failed'?'המפתח נדחה. אפשר להזין מפתח תקף ולנסות שוב.':'הבדיקה לא הושלמה.'+details+' כדי להימנע מיצירה חוזרת אחרי תשובה לא ודאית, יש לפתוח תהליך ניסיון מקומי חדש. פרטי הספק והמפתח לא נרשמו ביומן.'});
  }
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');origin='http://127.0.0.1:'+server.address().port;
 const timer=setTimeout(()=>{expired=true;trial=undefined;creation=undefined;finalPdf=undefined;},ttlMs);timer.unref();
 return {url:origin+base,origin,async close(){expired=true;clearTimeout(timer);trial=undefined;creation=undefined;finalPdf=undefined;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const running=await startTrialServer();console.log(JSON.stringify({url:running.url,testOnly:true,apiKeyPersistent:false,productionEnabled:false}));for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await running.close();process.exit(0);});}
