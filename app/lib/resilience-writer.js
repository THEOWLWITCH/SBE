// כתיבה ברוח חוסן — עשרת עקרונות השפה המחזקת (ארגז הכלים של ד״ר יעל שדה, SadeTools2026).
// מקור אמת אחד לפרקטי, לנוגי ולמסך "כתיבה מקדמת חוסן":
//  - rule: כלל לפרסונה של היועצות — כל נוסח שהן מציעות נכתב מראש לפי העקרונות.
//  - system(): ההנחיה לכותבת ההודעות — כותבת הודעה חדשה לפי העקרונות (לא שכתוב בדיעבד).
//  - mount(h): מחבר את הטופס (#rw-aud, #rw-kind, #rw-text, #rw-local, #rw-go, #rw-err, #rw-out)
//    בעזרת פונקציות העזר של הדף: {F, el, inlineRich, richText, complete, onStart}.
(function(){
'use strict';
const PRINCIPLES=['גוף ראשון רבים ("אנחנו", "כולנו") ליצירת שייכות','מסר מרגיע יחד עם קריאה לפעולה','תחושת שליטה וניהול — מה כבר נעשה ומה מתוכנן','קישור בין הפרט לכלל','דימויים או סיפורים מקומיים שמקרבים','הומור עדין ומותאם — רק כשמתאים להקשר','שמות, דמויות או מקומות מוכרים מבית הספר','קריאה להתנדבות, לשיתוף או למעורבות פעילה','שפה פשוטה, נגישה, לא פורמלית מדי ולא בירוקרטית','סיום במסר חיובי, אופטימי ומעורר תקווה'];
const LIST=PRINCIPLES.map((p,i)=>(i+1)+'. '+p).join('; ');
const SAFE='אל תמציאי עובדות, שמות או סיפורים — כשעיקרון דורש פרט שאין לך (שם, מקום, סיפור קטן מבית הספר), השאירי מקום למילוי בסוגריים מרובעים בעברית, למשל [שם התלמיד/ה] או [סיפור קטן מהשבוע]. בהודעה על אירוע קשה, על אבל או בחירום — בלי הומור, בטון רגוע, אמפתי ומכבד, עם מידע ברור על מה עושים עכשיו.';
const rule='כתיבה ברוח חוסן — תמיד, ומההתחלה: כל נוסח שאת מציעה כדי שיישלח או ייאמר (הודעה או מכתב להורים, עדכון לצוות, פנייה לתלמידים, פתיח לשיחה כיתתית או לישיבה, הודעה בקבוצה, עלון) נכתב כבר בטיוטה הראשונה לפי עשרת העקרונות של השפה המחזקת (SadeTools2026), ולא כטיוטה רגילה שצריך לשכתב אחר כך: '+LIST+'. בכל נוסח — לפחות 5–7 עקרונות, באופן טבעי ואותנטי ובהתאמה לקהל ולגיל. '+SAFE+' גם הדוחות והתשובות שלך עצמן כתובים ברוח הזאת: שפה פשוטה, תחושת שליטה (מה כבר קיים ומה הצעד הבא), הזמנה לשותפות, וסיום בכיוון של תקווה.';
function system(){return ['את כותבת ההודעות של מערכת Begood, ומומחית לשפה מחזקת חוסן בקהילות חינוך (ארגז הכלים של ד״ר יעל שדה). את עונה בעברית.',
  'המשימה: לכתוב, מההתחלה, הודעה לקהילת בית הספר — לפי מה שהכותב/ת רוצה לומר — כך שהיא תבטא לפחות 5–7 מעשרת העקרונות הבאים בצורה ברורה, אותנטית ונגישה, ותכלול את כל העובדות והפרטים המעשיים שנמסרו (תאריכים, שעות, מקומות, הנחיות). אם נמסרה טיוטה קיימת — כתבי אותה מחדש באותה רוח ושמרי על המסר ועל העובדות.',
  'העקרונות:',PRINCIPLES.map((p,i)=>(i+1)+'. '+p).join('\n'),
  'כללים: '+SAFE+' שלבי פרטים מקומיים רק אם נמסרו. התאימי את השפה לקהל (לתלמידים — לפי הגיל). הודעה קצרה וממוקדת שמתאימה לסוג ההודעה; פסקאות קצרות. שפה מכלילה מגדרית כשצריך. בלי אימוג׳ים, ובלי הדגשות או כוכביות בגוף ההודעה. אם נמסרה חתימה — סיימי בה.',
  'קובץ מצורף (אם יש — תמונה, ציור, שיר, מכתב, ידיעה מהעיתון או מסמך): פעלי לפי ההנחיה של הכותב/ת מה לעשות בו, ושלבי אותו בהודעה ברוח העקרונות. ציטוט — מדויק, מילה במילה, וקצר; תיאור של ציור או תמונה — רק מה שבאמת רואים, בלי לפרש מעבר לזה; ידיעה מהעיתון — להתייחס בהגינות, לציין את המקור, ולא להעתיק את כולה. יצירה של ילד/ה — רק בשם פרטי ורק אם נמסר, ובטיפים להזכיר לבקש רשות מהילד/ה ומההורים לפני השיתוף. אם אי אפשר לקרוא את הקובץ — כתבי זאת בטיפים, ואל תנחשי את תוכנו.',
  'החזירי אך ורק JSON תקין במבנה: {"message":""ההודעה — פסקאות קצרות עם שורה ריקה ביניהן","used":[{"n":1,"how":"משפט קצר: איך העיקרון בא לידי ביטוי בהודעה"}],"tips":["טיפ קצר — למשל מה כדאי למלא במקום הסוגריים או מה אפשר להוסיף"]}. ב-used — רק העקרונות שבאמת שולבו, לפי המספר שלהם.'].join('\n');}
// ── קובץ מצורף: תמונה (מוקטנת בדפדפן), PDF, Word או טקסט → בלוק שנשלח למודל יחד עם הבקשה ──
const ATT_IDEAS=['לצטט שורות מהשיר או מהמכתב','לתאר את הציור ולהזכיר את היוצר/ת','להגיב לידיעה מהעיתון','להשתמש כהשראה לפתיחה','לסכם את המסמך בשפה פשוטה'];
function toB64(buf){let s='';const b=new Uint8Array(buf);for(let i=0;i<b.length;i+=0x8000)s+=String.fromCharCode.apply(null,b.subarray(i,i+0x8000));return btoa(s);}
function loadScript(src){return new Promise((ok,no)=>{const sc=document.createElement('script');sc.src=src;sc.onload=ok;sc.onerror=()=>no(new Error('טעינה נכשלה'));document.head.appendChild(sc);});}
async function readAttachment(file){
  const name=file.name||'קובץ',low=name.toLowerCase(),type=file.type||'';
  if(type.startsWith('image/')){
    const url=URL.createObjectURL(file);
    try{const img=await new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=()=>no(new Error('התמונה לא נפתחה'));i.src=url;});
      const k=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));const cv=document.createElement('canvas');cv.width=Math.round(img.naturalWidth*k);cv.height=Math.round(img.naturalHeight*k);
      const cx=cv.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,cv.width,cv.height);cx.drawImage(img,0,0,cv.width,cv.height);
      const data=cv.toDataURL('image/jpeg',0.85);return {kind:'image',name,mediaType:'image/jpeg',data:data.split(',')[1],preview:data};}
    finally{URL.revokeObjectURL(url);}
  }
  if(low.endsWith('.pdf')||type==='application/pdf'){
    if(file.size>1300000)throw new Error('קובץ PDF גדול מדי (עד 1.3MB). אפשר לצלם את העמוד הרלוונטי ולצרף כתמונה.');
    return {kind:'pdf',name,mediaType:'application/pdf',data:toB64(await file.arrayBuffer())};
  }
  if(low.endsWith('.docx')){
    if(!window.mammoth)await loadScript('https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js');
    const r=await window.mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});return {kind:'text',name,text:String(r.value||'').slice(0,15000)};
  }
  if(low.endsWith('.txt')||type.startsWith('text/'))return {kind:'text',name,text:(await file.text()).slice(0,15000)};
  throw new Error('סוג הקובץ לא נתמך. אפשר לצרף תמונה, PDF, Word (docx) או טקסט.');
}
function attachBlocks(att,instruction){
  if(!att)return {text:'',blocks:[]};
  const head='\n\nקובץ מצורף: '+att.name+'\nמה לעשות עם הקובץ: '+(instruction||'לשלב בהודעה באופן שמתאים לה');
  if(att.kind==='text')return {text:head+'\nתוכן הקובץ:\n<<<\n'+att.text+'\n>>>',blocks:[]};
  return {text:head,blocks:[att.kind==='image'?{type:'image',source:{type:'base64',media_type:att.mediaType,data:att.data}}:{type:'document',source:{type:'base64',media_type:att.mediaType,data:att.data}}]};
}
function wireAttachment(h){
  const {F,el}=h;let att=null;
  if(!F('rw-file'))return ()=>null;
  const st=F('rw-file-status'),pv=F('rw-file-prev'),chips=F('rw-file-chips'),todo=F('rw-file-do');
  if(chips&&!chips.childNodes.length)ATT_IDEAS.forEach(x=>{const b=el('button','chip',x);b.type='button';b.addEventListener('click',()=>{todo.value=todo.value?todo.value.replace(/\s*$/,'')+'; '+x:x;todo.focus();});chips.appendChild(b);});
  F('rw-file').addEventListener('change',async e=>{
    const f=e.target.files[0];att=null;if(pv){pv.hidden=true;pv.removeAttribute('src');}
    if(!f){st.textContent='';return;}
    st.textContent='קוראת את הקובץ...';
    try{att=await readAttachment(f);st.textContent='צורף: '+att.name+(att.kind==='image'?' (תמונה)':att.kind==='pdf'?' (PDF)':' (טקסט)')+' ✓';if(att.preview&&pv){pv.src=att.preview;pv.hidden=false;}}
    catch(x){st.textContent=x.message;e.target.value='';}
  });
  const clr=F('rw-file-clear');if(clr)clr.addEventListener('click',()=>{att=null;F('rw-file').value='';st.textContent='';if(pv)pv.hidden=true;});
  return ()=>att?{att,instruction:(todo&&todo.value.trim())||''}:null;
}
function mount(h){
  const {F,el,inlineRich,richText,complete}=h;let busy=false;const LABEL='כתיבת ההודעה';
  const getAtt=wireAttachment(h);
  F('rw-go').addEventListener('click',async()=>{
    if(busy)return;const txt=F('rw-text').value.trim(),err=F('rw-err'),out=F('rw-out');
    const A=getAtt();
    if(txt.length<10&&!A){err.textContent='צריך לכתוב בכמה מילים מה רוצים לומר (לפחות משפט אחד), או לצרף קובץ ולכתוב מה לעשות איתו.';err.hidden=false;return;}
    err.hidden=true;busy=true;const b=F('rw-go');b.disabled=true;b.textContent='כותבת... (עד דקה)';
    out.textContent='';out.appendChild(el('p','muted','כותבת את ההודעה לפי עשרת עקרונות החוסן...'));
    if(h.onStart)h.onStart();
    try{
      const loc=F('rw-local')?F('rw-local').value.trim():'',sign=F('rw-sign')?F('rw-sign').value.trim():'';
      const user='קהל: '+F('rw-aud').value+'\nסוג ההודעה: '+F('rw-kind').value+(loc?'\nפרטים מקומיים שאפשר לשלב: '+loc:'')+(sign?'\nחתימה: '+sign:'')+'\n\nמה רוצים לומר (נקודות, עובדות או טיוטה):\n'+txt;
      const ab=A?attachBlocks(A.att,A.instruction):{text:'',blocks:[]};
      const content=ab.blocks.length?[...ab.blocks,{type:'text',text:user+ab.text}]:user+ab.text;
      const res=await complete(system(),[{role:'user',content}],8000);
      const m=res.match(/\{[\s\S]*\}/);if(!m)throw new Error('לא התקבל מבנה תקין');
      const d=JSON.parse(m[0]);const msg=String(d.message||'').replace(/\*\*/g,'');if(!msg)throw new Error('לא התקבלה הודעה');
      out.textContent='';
      out.appendChild(el('h3',null,'ההודעה'));
      const box=richText(msg);box.classList.add('rw-new');out.appendChild(box);
      const acts=el('div','btns');const cp=el('button','btn','העתקת ההודעה');cp.type='button';
      cp.addEventListener('click',()=>{const done=()=>{cp.textContent='הועתק ✓';setTimeout(()=>cp.textContent='העתקת ההודעה',2000);};
        if(navigator.clipboard)navigator.clipboard.writeText(msg).then(done).catch(()=>{});});
      acts.appendChild(cp);out.appendChild(acts);
      const used={};(d.used||[]).forEach(u=>{const n=+u.n;if(n>=1&&n<=10)used[n]=u.how||'';});
      out.appendChild(el('h3',null,'עקרונות החוסן בהודעה — '+Object.keys(used).length+' מתוך 10'));
      const ul=el('ul','rw-check');PRINCIPLES.forEach((p,i)=>{const on=(i+1) in used;const li=el('li',on?'on':'off');
        li.appendChild(el('b',null,(on?'✓ ':'○ ')+p));if(on&&used[i+1]){li.appendChild(document.createTextNode(' — '));li.appendChild(inlineRich(used[i+1]));}ul.appendChild(li);});
      out.appendChild(ul);
      if((d.tips||[]).length){out.appendChild(el('h3',null,'טיפים'));const tl=el('ul','tl');d.tips.forEach(t=>{const li=el('li');li.appendChild(inlineRich(t));tl.appendChild(li);});out.appendChild(tl);}
      out.appendChild(el('p','muted','ההודעה היא הצעה — כדאי לקרוא, לבדוק את הפרטים ולהתאים לפני שליחה. מקומות בסוגריים מרובעים ממלאים בעצמכם.'));
    }catch(e){out.textContent='';err.textContent='הכתיבה לא הצליחה ('+(e.name==='AbortError'?'לקח יותר מדי זמן':e.message)+'). נסו שוב.';err.hidden=false;}
    finally{busy=false;b.disabled=false;b.textContent=LABEL;}
  });
}
// ── בדוח עצמו: בחינה של עשרת העקרונות לפי השאלון + הודעות מוכנות שכתובות לפיהם (בלי טופס נוסף) ──
// who — של מי התקשורת שנבחנת ("המחנך/ת והכיתה" / "ההנהגה"); aud — למי נכתבות ההודעות.
const STATES=['קיים','חלקי','חסר','לא ידוע'];
function reportRule(who,aud){return ['בחינת עקרונות החוסן (SadeTools2026) — חלק מהדוח, בלי לבקש מהכותב/ת מידע נוסף:',
  '- ב-"principles": רק העקרונות של השפה המחזקת שרלוונטיים לתמונת המצב (בדרך כלל 2–5) — אלה שכבר בולטים כחוזקה או שחיזוקם חשוב כאן; לא את כל העשרה ולא עקרונות שאין עליהם מידע. לכל אחד: "state" ('+STATES.map(x=>'"'+x+'"').join(' / ')+') — עד כמה הוא בא לידי ביטוי בתקשורת של '+who+' לפי תמונת המצב; ו-"note" — 1–2 משפטים: על מה זה נשען בתשובות, ואיך לחזק אותו בפועל (דוגמה לניסוח במירכאות).',
  '- ב-"messages": 1–2 הודעות מוכנות לשליחה ('+aud+') שנובעות ישירות מהממצאים ומהמצב, כתובות מההתחלה לפי העקרונות — לפחות 5–7 מהם. '+SAFE+' בגוף ההודעה — בלי הדגשות ובלי כוכביות; פסקאות קצרות עם \\n\\n ביניהן.'].join('\n');}
const reportSchema=' "principles":[{"n":1,"state":"קיים / חלקי / חסר / לא ידוע","note":"על מה זה נשען ואיך לחזק"}],\n "messages":[{"to":"למי","purpose":"מטרת ההודעה בכמה מילים","text":"ההודעה המלאה"}],';
function reportSection(d,h,title,msgTitle,lvl){
  const {el,inlineRich,richText}=h;const frag=document.createDocumentFragment();
  const pr=(d.principles||[]).filter(p=>+p.n>=1&&+p.n<=10&&p.state!=='לא ידוע');const ms=(d.messages||[]).filter(m=>m&&m.text);
  if(pr.length){frag.appendChild(el(lvl||'h3',null,title));
    frag.appendChild(el('p','muted','עקרונות השפה המחזקת שרלוונטיים לתמונת המצב — מה כבר קיים ומה כדאי לחזק.'));
    const ul=el('ul','rw-check');pr.forEach(p=>{const st=STATES.includes(p.state)?p.state:'לא ידוע';const li=el('li','st-'+STATES.indexOf(st));
      li.appendChild(el('span','rw-st',st));li.appendChild(el('b',null,PRINCIPLES[p.n-1]));if(p.note){li.appendChild(document.createTextNode(' — '));li.appendChild(inlineRich(p.note));}ul.appendChild(li);});
    frag.appendChild(ul);}
  if(ms.length){frag.appendChild(el('h3',null,msgTitle));
    ms.forEach(m=>{const c=el('div','act rw-msg');c.appendChild(el('div','act-t',[m.to?'אל: '+m.to:'',m.purpose].filter(Boolean).join(' — ')));
      const t=String(m.text).replace(/\*\*/g,'');const box=richText(t);box.classList.add('rw-new');c.appendChild(box);
      const cp=el('button','btn btn-ghost no-print','העתקת ההודעה');cp.type='button';cp.style.marginTop='.5rem';
      cp.addEventListener('click',()=>{const done=()=>{cp.textContent='הועתק ✓';setTimeout(()=>cp.textContent='העתקת ההודעה',2000);};if(navigator.clipboard)navigator.clipboard.writeText(t).then(done).catch(()=>{});});
      c.appendChild(cp);frag.appendChild(c);});
    frag.appendChild(el('p','muted','ההודעות הן הצעה — כדאי לקרוא, לבדוק את הפרטים ולהתאים לפני שליחה. מקומות בסוגריים מרובעים ממלאים בעצמכם.'));}
  return frag;
}
function reportPlain(d,title,msgTitle){const L=[];const pr=(d.principles||[]).filter(p=>+p.n>=1&&+p.n<=10&&p.state!=='לא ידוע');const ms=(d.messages||[]).filter(m=>m&&m.text);
  if(pr.length){L.push('',title);pr.forEach(p=>L.push('• '+PRINCIPLES[p.n-1]+' ['+(p.state||'לא ידוע')+']'+(p.note?'\n  '+p.note:'')));}
  if(ms.length){L.push('',msgTitle);ms.forEach(m=>L.push('• '+[m.to?'אל: '+m.to:'',m.purpose].filter(Boolean).join(' — ')+'\n'+String(m.text).replace(/\*\*/g,'')+'\n'));}
  return L;}
window.SBE_WRITER={PRINCIPLES,rule,system,mount,reportRule,reportSchema,reportSection,reportPlain};
})();
