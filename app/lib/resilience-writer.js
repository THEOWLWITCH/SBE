// Existing adviser-report helpers; standalone communication writing now uses the shared server engine.
(function(){
'use strict';
const PRINCIPLES=['גוף ראשון רבים ("אנחנו", "כולנו") ליצירת שייכות','מסר מרגיע יחד עם קריאה לפעולה','תחושת שליטה וניהול: מה כבר נעשה ומה מתוכנן','קישור בין הפרט לכלל','דימויים או סיפורים מקומיים שמקרבים','הומור עדין ומותאם: רק כשמתאים להקשר','שמות, דמויות או מקומות מוכרים מבית הספר','קריאה להתנדבות, לשיתוף או למעורבות פעילה','שפה פשוטה, נגישה, לא פורמלית מדי ולא בירוקרטית','סיום במסר חיובי, אופטימי ומעורר תקווה'];
const LIST=PRINCIPLES.map((p,i)=>(i+1)+'. '+p).join('; ');
const SAFE='אל תמציאי עובדות, שמות או סיפורים — כשעיקרון דורש פרט שאין לך (שם, מקום, סיפור קטן מבית הספר), השאירי מקום למילוי בסוגריים מרובעים בעברית, למשל [שם התלמיד/ה] או [סיפור קטן מהשבוע]. בהודעה על אירוע קשה, על אבל או בחירום — בלי הומור, בטון רגוע, אמפתי ומכבד, עם מידע ברור על מה עושים עכשיו.';
const rule='כתיבה ברוח חוסן — תמיד, ומההתחלה: כל נוסח שאת מציעה כדי שיישלח או ייאמר (הודעה או מכתב להורים, עדכון לצוות, פנייה לתלמידים, פתיח לשיחה כיתתית או לישיבה, הודעה בקבוצה, עלון) נכתב כבר בטיוטה הראשונה לפי עשרת העקרונות של השפה המחזקת (SadeTools2026), ולא כטיוטה רגילה שצריך לשכתב אחר כך: '+LIST+'. בכל נוסח: לפחות 5–7 עקרונות, באופן טבעי ואותנטי ובהתאמה לקהל ולגיל. '+SAFE+' גם הדוחות והתשובות שלך עצמן כתובים ברוח הזאת: שפה פשוטה, תחושת שליטה (מה כבר קיים ומה הצעד הבא), הזמנה לשותפות, וסיום בכיוון של תקווה.';
// ── בדוח עצמו: בחינה של עשרת העקרונות לפי השאלון + הודעות מוכנות שכתובות לפיהם (בלי טופס נוסף) ──
// who — של מי התקשורת שנבחנת ("המחנך/ת והכיתה" / "ההנהגה"); aud — למי נכתבות ההודעות.
const STATES=['קיים','חלקי','חסר','לא ידוע'];
function reportRule(who,aud){return ['בחינת עקרונות החוסן (SadeTools2026) — חלק מהדוח, בלי לבקש מהכותב/ת מידע נוסף:',
  '- ב-"principles": רק העקרונות של השפה המחזקת שרלוונטיים לתמונת המצב (בדרך כלל 2–5) — אלה שכבר בולטים כחוזקה או שחיזוקם חשוב כאן; לא את כל העשרה ולא עקרונות שאין עליהם מידע. לכל אחד: "state" ('+STATES.map(x=>'"'+x+'"').join(' / ')+'), עד כמה הוא בא לידי ביטוי בתקשורת של '+who+' לפי תמונת המצב; ו-"note", 1–2 משפטים: על מה זה נשען בתשובות, ואיך לחזק אותו בפועל (דוגמה לניסוח במירכאות).',
  '- ב-"messages": 1–2 הודעות מוכנות לשליחה ('+aud+') שנובעות ישירות מהממצאים ומהמצב, כתובות מההתחלה לפי העקרונות: לפחות 5 מהם. '+SAFE+' בגוף ההודעה, בלי הדגשות ובלי כוכביות; פסקאות קצרות עם \\n\\n ביניהן.'].join('\n');}
const reportSchema=' "principles":[{"n":1,"state":"קיים / חלקי / חסר / לא ידוע","note":"על מה זה נשען ואיך לחזק"}],\n "messages":[{"to":"למי","purpose":"מטרת ההודעה בכמה מילים","text":"ההודעה המלאה"}],';
function reportSection(d,h,title,msgTitle,lvl){
  const {el,inlineRich,richText}=h;const frag=document.createDocumentFragment();
  const pr=(d.principles||[]).filter(p=>+p.n>=1&&+p.n<=10&&p.state!=='לא ידוע');const ms=(d.messages||[]).filter(m=>m&&m.text);
  if(pr.length){frag.appendChild(el('p','muted no-print','עקרונות השפה המחזקת שרלוונטיים לתמונת המצב: מה כבר קיים ומה כדאי לחזק.'));
    frag.appendChild(el(lvl||'h3',null,title));
    if(window.SBE_TABLE){frag.appendChild(SBE_TABLE(['העיקרון','מצב','על מה זה נשען ואיך לחזק'],pr.map(p=>{const st=STATES.includes(p.state)?p.state:'לא ידוע';
      const w=el('span','rw-st-wrap st-'+STATES.indexOf(st));w.appendChild(el('span','rw-st',st));return [el('b',null,PRINCIPLES[p.n-1]),w,p.note?inlineRich(p.note):null];}),'rw-table'));}
    else{const ul=el('ul','rw-check');pr.forEach(p=>{const st=STATES.includes(p.state)?p.state:'לא ידוע';const li=el('li','st-'+STATES.indexOf(st));
      li.appendChild(el('span','rw-st',st));li.appendChild(el('b',null,PRINCIPLES[p.n-1]));if(p.note){li.appendChild(document.createTextNode(': '));li.appendChild(inlineRich(p.note));}ul.appendChild(li);});
    frag.appendChild(ul);}}
  if(ms.length){frag.appendChild(el('h3',null,msgTitle));
    const mrows=[];
    ms.forEach(m=>{const c=el('div','rw-msg');
      const t=String(m.text).replace(/\*\*/g,'');const box=richText(t);box.classList.add('rw-new');c.appendChild(box);
      const cp=el('button','btn btn-ghost no-print','העתקת ההודעה');cp.type='button';cp.style.marginTop='.5rem';
      cp.addEventListener('click',()=>{const done=()=>{cp.textContent='הועתק ✓';setTimeout(()=>cp.textContent='העתקת ההודעה',2000);};if(navigator.clipboard)navigator.clipboard.writeText(t).then(done).catch(()=>{});});
      c.appendChild(cp);
      const who=el('div');if(m.to)who.appendChild(el('b',null,m.to));if(m.purpose)who.appendChild(el('div','muted',m.purpose));
      if(window.SBE_TABLE)mrows.push([who,c]);else{const a=el('div','act rw-msg');a.appendChild(el('div','act-t',[m.to?'אל: '+m.to:'',m.purpose].filter(Boolean).join(' · ')));a.appendChild(c);frag.appendChild(a);}});
    if(mrows.length)frag.appendChild(SBE_TABLE(['אל · מטרה','ההודעה'],mrows,'rw-table'));
    frag.appendChild(el('p','muted no-print','ההודעות הן הצעה: כדאי לקרוא, לבדוק את הפרטים ולהתאים לפני שליחה. מקומות בסוגריים מרובעים ממלאים בעצמכם.'));}
  return frag;
}
function reportPlain(d,title,msgTitle){const L=[];const pr=(d.principles||[]).filter(p=>+p.n>=1&&+p.n<=10&&p.state!=='לא ידוע');const ms=(d.messages||[]).filter(m=>m&&m.text);
  if(pr.length){L.push('',title);pr.forEach(p=>L.push('• '+PRINCIPLES[p.n-1]+' ['+(p.state||'לא ידוע')+']'+(p.note?'\n  '+p.note:'')));}
  if(ms.length){L.push('',msgTitle);ms.forEach(m=>L.push('• '+[m.to?'אל: '+m.to:'',m.purpose].filter(Boolean).join(' · ')+'\n'+String(m.text).replace(/\*\*/g,'')+'\n'));}
  return L;}
window.SBE_WRITER={PRINCIPLES,rule,reportRule,reportSchema,reportSection,reportPlain};
})();
