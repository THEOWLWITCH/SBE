// כתיבה ברוח חוסן — עשרת עקרונות השפה המחזקת (ארגז הכלים של ד״ר יעל שדה, SadeTools2026).
// מקור אמת אחד לפרקטי, לנוגי ולמסך "כתיבת הודעה ברוח חוסן":
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
  'החזירי אך ורק JSON תקין במבנה: {"message":"ההודעה — פסקאות קצרות עם שורה ריקה ביניהן","used":[{"n":1,"how":"משפט קצר: איך העיקרון בא לידי ביטוי בהודעה"}],"tips":["טיפ קצר — למשל מה כדאי למלא במקום הסוגריים או מה אפשר להוסיף"]}. ב-used — רק העקרונות שבאמת שולבו, לפי המספר שלהם.'].join('\n');}
function mount(h){
  const {F,el,inlineRich,richText,complete}=h;let busy=false;const LABEL='כתיבת ההודעה';
  F('rw-go').addEventListener('click',async()=>{
    if(busy)return;const txt=F('rw-text').value.trim(),err=F('rw-err'),out=F('rw-out');
    if(txt.length<10){err.textContent='צריך לכתוב בכמה מילים מה רוצים לומר (לפחות משפט אחד).';err.hidden=false;return;}
    err.hidden=true;busy=true;const b=F('rw-go');b.disabled=true;b.textContent='כותבת... (עד דקה)';
    out.textContent='';out.appendChild(el('p','muted','כותבת את ההודעה לפי עשרת עקרונות החוסן...'));
    if(h.onStart)h.onStart();
    try{
      const loc=F('rw-local')?F('rw-local').value.trim():'',sign=F('rw-sign')?F('rw-sign').value.trim():'';
      const user='קהל: '+F('rw-aud').value+'\nסוג ההודעה: '+F('rw-kind').value+(loc?'\nפרטים מקומיים שאפשר לשלב: '+loc:'')+(sign?'\nחתימה: '+sign:'')+'\n\nמה רוצים לומר (נקודות, עובדות או טיוטה):\n'+txt;
      const res=await complete(system(),[{role:'user',content:user}],8000);
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
window.SBE_WRITER={PRINCIPLES,rule,system,mount};
})();
