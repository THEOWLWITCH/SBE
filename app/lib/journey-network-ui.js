(function () {
  'use strict';
  const N=window.SBE_JOURNEY_NETWORK;
  const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=String(text);return n;};
  const button=(text,fn,secondary=true)=>{const b=node('button','btn'+(secondary?' btn-ghost':''),text);b.type='button';b.addEventListener('click',fn);return b;};
  const details=(parent,title,open=false)=>{const d=node('details','jnw-detail');d.open=open;d.append(node('summary','',title));parent.append(d);return d;};
  const clone=v=>JSON.parse(JSON.stringify(v));
  const label=r=>r && (r.title || r.id) || 'רשומה ללא שם';
  const classifications={direct:'שינוי או קשר הנראים בעותק',conditional:'השלכה מותנית בהנחות',inquiry:'שאלה לבירור'};
  function create(options) {
    if(!N) throw Error('כלי בחינת הרשת לא נטען');
    let selectedAlternative='',selectedFuture='',kind='mechanisms',view='futures',selectedRecord=Object.create(null);
    let generation=0,pending=null,reviewed=null,approved=false,alive=true,error='',notice='';
    const workspace=()=>options.getWorkspace();
    const lab=()=>workspace().lab;
    const alternative=()=>lab().alternatives.find(a=>a.id===selectedAlternative);
    const rerender=()=>{if(alive)options.rerender();};
    const message=(text,bad=false)=>options.message(text,bad);
    function invalidate() {
      generation++;reviewed=null;approved=false;
      if(pending){clearInterval(pending.timer);pending=null;notice='הנתונים או הבחירה השתנו. התשובה הקודמת לא תתווסף לחלופה; אפשר לבחון שוב את המידע.';}
    }
    function changed(render=false) {options.changed();if(render)rerender();}
    function inputFor(a) {return N.buildInput(a,lab().futures,options.unit,options.cleanMap);}
    function inputField(parent,key,title,record,onChange,prefix,multiline=true) {
      const wrap=node('div','jws-field'),id='jnw-'+prefix+'-'+key,l=node('label','',title);
      l.htmlFor=id;const input=node(key==='reviewAt' || !multiline?'input':'textarea');
      if(input.tagName==='INPUT')input.type=key==='reviewAt'?'date':'text';
      input.id=id;input.value=record[key] || '';input.maxLength=4000;input.dataset.networkField=key;
      input.addEventListener(key==='reviewAt'?'change':'input',()=>onChange(input.value));wrap.append(l,input);parent.append(wrap);return input;
    }
    function fieldList(parent,definitions,record,onChange,prefix) {
      Object.entries(definitions).forEach(([key,title])=>inputField(parent,key,title,record,value=>onChange(key,value),prefix,key!=='title' && key!=='horizon'));
    }
    function select(parent,title,records,value,onChange) {
      const wrap=node('div','jws-field'),id='jnw-select-'+title,l=node('label','',title),s=node('select');l.htmlFor=id;s.id=id;
      records.forEach(r=>{const o=node('option','',label(r));o.value=r.id;s.append(o);});s.value=value || '';s.addEventListener('change',()=>onChange(s.value));wrap.append(l,s);parent.append(wrap);return s;
    }
    function futureEditor(parent) {
      parent.append(node('h3','','כמה תנאי עתיד אפשריים'),node('p','','אפשר לתאר כמה עתידים שונים, לצד המטרה הרצויה שכבר הגדרתם. כל עתיד מתאר תנאים אפשריים; החלופות מתארות מה אתם מציעים לעשות. אין כאן תחזית, הסתברות או דירוג חוסן.'));
      parent.append(button('הוספת עתיד אפשרי',()=>{
        if(lab().futures.length>=20)return message('אפשר לשמור עד 20 עתידים אפשריים. אפשר לבחון עם הצוות את העתידים שתרצו להשאיר.',true);
        const f={id:options.uid()};lab().futures.push(f);selectedFuture=f.id;changed(true);
      },false));
      if(!lab().futures.length){parent.append(node('p','jnw-notice','עוד לא תוארו תנאי עתיד. אפשר להתחיל בשני עתידים הנבדלים בזמן, במשאבים, בהשתתפות או בקשרים עם הסביבה.'));return;}
      if(!lab().futures.some(f=>f.id===selectedFuture))selectedFuture=lab().futures[0].id;
      select(parent,'בחירת עתיד אפשרי',lab().futures,selectedFuture,value=>{selectedFuture=value;rerender();});
      const f=lab().futures.find(f=>f.id===selectedFuture),fields=node('div','jnw-fields');parent.append(fields);
      fieldList(fields,N.FUTURE_FIELDS,f,(key,value)=>{f[key]=value;changed();},f.id);
      parent.append(button('הסרת העתיד האפשרי',()=>{
        if(!window.confirm('להסיר את העתיד "'+label(f)+'" ואת בחינות הצוות המקושרות אליו מכל החלופות? המשובים הקודמים ישמרו את המידע שנבדק אז.'))return;
        lab().futures=lab().futures.filter(x=>x.id!==f.id);
        lab().alternatives.forEach(a=>{a.assessments=a.assessments.filter(c=>c.futureId!==f.id);});changed(true);
      }));
    }
    function mapEditor(parent,a) {
      parent.append(node('h3','','עריכת הרשת בחלופה'),node('p','jnw-notice','העריכה כאן היא בעותק משוער של החלופה. מפת המצב הקיים נשארת ללא שינוי. הצעת קשר או פריט חדש אינה תצפית שנאספה.'));
      const nav=node('nav','jnw-nav');nav.setAttribute('aria-label','רשימות בחלופה');parent.append(nav);
      N.EDIT_KEYS.forEach(key=>{const s=options.schema.find(s=>s.key===key),b=button(s.label,()=>{kind=key;rerender();});b.dataset.networkKind=key;if(kind===key)b.setAttribute('aria-current','page');nav.append(b);});
      const schema=options.schema.find(s=>s.key===kind),records=a.proposal[kind];
      if(!records.some(r=>r.id===selectedRecord[kind]))selectedRecord[kind]=records[0] && records[0].id;
      if(records.length)select(parent,'בחירת פריט מוצע',records,selectedRecord[kind],value=>{selectedRecord[kind]=value;rerender();});
      parent.append(button('הוספת פריט מוצע',()=>{
        if(records.length>=80)return message('אפשר לשמור עד 80 פריטים בכל רשימה. אפשר לבחון יחד מה מתאים להמשך התיעוד.',true);
        const record={id:options.uid(),title:''};if(kind==='links')record.status='proposed';
        records.push(record);selectedRecord[kind]=record.id;changed(true);
      },false));
      const record=records.find(r=>r.id===selectedRecord[kind]);
      if(!record){parent.append(node('p','','הרשימה בחלופה עדיין ריקה. אפשר להוסיף פריט מוצע ולתאר את ההנחות לגביו.'));return;}
      const inactive=a.inactiveIds.includes(record.id),bar=node('div','jnw-actions');parent.append(bar);
      bar.append(button(inactive?'ביטול ההשהיה בחלופה':'השהיית הפעולה בחלופה',()=>{
        a.inactiveIds=inactive?a.inactiveIds.filter(v=>v!==record.id):[...a.inactiveIds,record.id];changed(true);
      }),button('הסרת הפריט מהחלופה',()=>{
        if(!window.confirm('להסיר את "'+label(record)+'" מהעותק של החלופה? קשרים שנוגעים למנגנון והפניות לפריט תומך יוסרו מן העותק ויופיעו בהשוואה. אין בכך קביעה שתפקידו החברתי אבד. מפת המקור נשארת.'))return;
        const next=N.remove(a,kind,record.id);lab().alternatives[lab().alternatives.findIndex(x=>x.id===a.id)]=next;changed(true);
      }));
      parent.append(node('p','',inactive?'בחלופה זו הפעולה הושהתה. ההסדר נשמר; אפשר לברר מה ימשיך להתקיים, מה ייפגע ואילו חלופות נגישות.':'אפשר להבחין בין שינוי בהסדר, השהיית הפעולה ואובדן התפקיד שהוא ממלא. תפקיד סמוי או פעולה משותפת יכולים להישמר גם כשההסדר משתנה.'));
      options.renderFields(parent,kind,record,a.proposal,()=>changed(),a.id+'-'+record.id);
      if(kind==='mechanisms' || kind==='infrastructures') {
        const d=details(parent,'כיצד בוחנים תמיכה של תשתית');
        d.append(node('p','','אפשר להשוות את דרישות המנגנון לתשתית: נגישות לקבוצות שונות, קיבולת וזמן, זמינות, פרטיות, הרשאות, תחזוקה וגיבוי. עצם קיום התשתית אינו מבטיח שתענה על הדרישות. אפשר לתעד מידע חסר ולבקש במשוב הצעות מנומקות לחיבור. כל חיבור נשאר לבחירת הצוות.'));
        if(kind==='mechanisms')d.append(node('p','','דרישות שתועדו למנגנון: '+(record.supportRequirements || 'טרם תועדו. אפשר להוסיף בפרטי המנגנון.')));
      }
    }
    function recordValue(map,field,value) {
      if(Array.isArray(value))return value.map(v=>field.type==='refs'?label((map[field.target] || []).find(r=>r.id===v))+' ('+v+')':((field.options || []).find(o=>o.value===v)||{}).label || v).join('; ');
      if(field.type==='select')return ((field.options || []).find(o=>o.value===value)||{}).label || value || '';
      return value || '';
    }
    function exactChanges(parent,a,open=false) {
      const d=details(parent,'השוואה מפורטת של השדות והקשרים',open);
      N.EDIT_KEYS.forEach(key=>{
        const schema=options.schema.find(s=>s.key===key),before=a.baseline[key],after=a.proposal[key];
        const ids=[...new Set([...before,...after].map(r=>r.id))];
        ids.forEach(id=>{
          const old=before.find(r=>r.id===id),now=after.find(r=>r.id===id);
          if(JSON.stringify(old)===JSON.stringify(now))return;
          const card=node('article','jnw-card');card.append(node('h4','',schema.label+': '+label(now || old)));
          if(!old)card.append(node('p','','נוסף בחלופה; לא היה בתמונת המוצא.'));
          if(!now)card.append(node('p','','הוסר מהחלופה; נשמר בתמונת המוצא.'));
          const values=node('dl');schema.fields.forEach(f=>{
            if(JSON.stringify(old && old[f.key])===JSON.stringify(now && now[f.key]))return;
            values.append(node('dt','',f.label),node('dd','','תמונת מוצא: '+(recordValue(a.baseline,f,old && old[f.key]) || 'לא תועד')+'\nהחלופה: '+(recordValue(a.proposal,f,now && now[f.key]) || 'לא תועד')));
          });card.append(values);d.append(card);
        });
      });
      const paused=a.inactiveIds.map(id=>label(N.EDIT_KEYS.flatMap(k=>a.proposal[k]).find(r=>r.id===id)));
      if(paused.length)d.append(node('p','','פריטים שהושהו בחלופה: '+paused.join('; ')));
    }
    function structural(parent,a,open=false) {
      parent.append(node('h3','','מה השתנה ברשת שבחלופה'),node('p','','ההשוואה מציגה את השינוי בעותק ואת ההנחות שהזנתם. היא אינה קובעת כיצד אנשים יפעלו במציאות. חפיפה עשויה להכביד או לתת גיבוי; שימוש מועט או תפקיד לא ברור אינם ראיה לייתור.'));
      const findings=N.inspect(a);
      if(!findings.length)parent.append(node('p','','עדיין לא תועד שינוי בין תמונת המוצא לחלופה. אפשר לשנות פריט או קשר ולהמשיך לבחון.'));
      Object.entries(classifications).forEach(([key,title])=>{
        const entries=findings.filter(f=>f.classification===key);if(!entries.length)return;
        const card=node('section','jnw-card');card.append(node('h4','',title));const list=node('ul');entries.forEach(f=>list.append(node('li','',f.text)));card.append(list);parent.append(card);
      });
      exactChanges(parent,a,open);
      const d=details(parent,'הקשרים המכוונים בעותק החלופה',open);
      if(!a.proposal.links.length)d.append(node('p','','לא תועדו קשרים בחלופה. היעדר התיעוד אינו הוכחה שאין קשרים במציאות.'));
      a.proposal.links.forEach(l=>{
        const title=id=>label(a.proposal.mechanisms.find(m=>m.id===id));
        const type=options.schema.find(s=>s.key==='links').fields.find(f=>f.key==='type');
        const status=options.schema.find(s=>s.key==='links').fields.find(f=>f.key==='status');
        const inactive=a.inactiveIds.includes(l.id) || [...(l.from || []),...(l.to || [])].some(id=>a.inactiveIds.includes(id));
        d.append(node('p','',((l.from || []).map(title).join(', ') || 'מקור טרם נבחר')+' ← אל '+((l.to || []).map(title).join(', ') || 'יעד טרם נבחר')+'; '+recordValue(a.proposal,type,l.type)+'; '+recordValue(a.proposal,status,l.status)+(inactive?'; השתתפות הושהתה בהנחת החלופה.':'.')));
      });
    }
    function assessments(parent,a) {
      parent.append(node('h3','','אותה חלופה בכמה עתידים'),node('p','','אפשר לבחון בכל עתיד את איכות החיים בהווה ואת המוכנות לעתיד, אילו קשרים עשויים להתחזק או להתערער, מה יאפשר פעולה ואילו סימנים יביאו לבחינה מחדש. אין חיבור אוטומטי לציון או לדירוג.'));
      if(!lab().futures.length)parent.append(node('p','jnw-notice','אפשר לתאר תנאי עתיד בחלק ״עתידים אפשריים״ ולחזור לבחון את החלופה.'));
      lab().futures.forEach(f=>{
        const card=node('article','jnw-card');card.dataset.futureAssessment=f.id;card.append(node('h4','',label(f)),node('p','','תנאים: '+(f.conditions || 'טרם תוארו')+(f.horizon?'\nאופק זמן: '+f.horizon:'')));
        let row=a.assessments.find(c=>c.futureId===f.id);
        const state=node('p','muted',row?'בחינת צוות שנכתבה בחלופה. אלו הערכות לבחינה, לא תוצאות שנצפו.':'טרם נבחן. השדות הריקים נשארים שאלות פתוחות.');card.append(state);
        fieldList(card,N.ASSESSMENT_FIELDS,row || {},(key,value)=>{
          if(!row){row={futureId:f.id};a.assessments.push(row);}row[key]=value;state.textContent='בחינת צוות שנכתבה בחלופה. אלו הערכות לבחינה, לא תוצאות שנצפו.';changed();
        },a.id+'-'+f.id);parent.append(card);
      });
    }
    function feedbackHistorical(a) {
      try{return JSON.stringify(a.feedback.input)!==JSON.stringify(inputFor(a));}catch(e){return true;}
    }
    function displayFeedback(parent,a,print=false) {
      if(!a.feedback)return;
      const f=a.feedback,historical=feedbackHistorical(a),box=node('section','jnw-feedback');parent.append(box);
      box.append(node('h3','','משוב לבחינת הצוות'),node('p','jnw-notice','טיוטת פרשנות בסיוע AI. נבדקה מול המידע שנשלח בתאריך '+new Date(f.createdAt).toLocaleString('he-IL')+'. '+(historical?'החלופה או העתידים השתנו מאז; זהו משוב על תמונה קודמת.':'המשוב תואם למידע הנוכחי בחלופה.')),
        node('p','jnw-summary',f.output.summary));
      const d=details(box,'הרחבת ההסברים, ההנחות והחלופות',print);
      f.output.direct.forEach(item=>{const s=f.input.structure.find(x=>x.id===item.structuralId);d.append(node('h4','','פירוש שינוי שנראה בעותק'),node('p','',s.text),node('p','',item.comment));});
      for(const [key,title] of [['conditional','השלכות מותנות'],['hypotheses','השערות לבירור']]) {
        if(!f.output[key].length)continue;d.append(node('h4','',title));
        f.output[key].forEach(item=>{
          const article=node('article','jnw-card');article.append(node('h5','',item.title),node('p','',item.explanation),node('p','','הנחות: '+(item.assumptions || 'טרם פורטו')),node('p','','מה אפשר לברר: '+(item.inquiry || 'טרם פורט')));
          const refs=item.refs.map(id=>label([{id:f.input.alternativeId,title:f.input.title},...f.input.futures,...N.MAP_KEYS.filter(k=>k!=='context').flatMap(k=>[...f.input.baseline[k],...f.input.proposal[k]])].find(r=>r.id===id))+' ('+id+')');
          if(refs.length)article.append(node('p','muted','הפניות למידע שנבדק: '+refs.join('; ')));d.append(article);
        });
      }
      f.output.comparisons.forEach(c=>{
        const future=f.input.futures.find(x=>x.id===c.futureId),article=node('article','jnw-card');article.append(node('h4','','הצעת פרשנות בתנאי: '+label(future)));
        const dl=node('dl');Object.entries(N.ASSESSMENT_FIELDS).filter(([key])=>key!=='reviewAt').forEach(([key,title])=>{if(c[key])dl.append(node('dt','',title),node('dd','',c[key]));});article.append(dl);d.append(article);
      });
      if(f.output.supportSuggestions.length)d.append(node('h4','','הצעות לחיבור תשתיות לבחירת הצוות'));
      f.output.supportSuggestions.forEach(s=>{
        const m=f.input.proposal.mechanisms.find(m=>m.id===s.mechanismId),i=f.input.proposal.infrastructures.find(i=>i.id===s.infrastructureId),card=node('article','jnw-card');
        card.append(node('h5','',label(i)+' לתמיכה ב'+label(m)),node('p','',s.reason),node('p','','תנאים ומידע חסר: '+(s.gaps || 'טרם פורטו')));
        if(!print){
          const current=a.proposal.mechanisms.find(m=>m.id===s.mechanismId),already=current && (current.infrastructureIds || []).includes(s.infrastructureId);
          const b=button(already?'התשתית כבר מקושרת בחלופה':'אישור חיבור התשתית בעותק החלופה',()=>{
            if(!current || historical || !a.proposal.infrastructures.some(i=>i.id===s.infrastructureId))return;
            if((current.infrastructureIds || []).length>=40)return message('אפשר לקשר עד 40 תשתיות למנגנון. אפשר לבחון את ההפניות לפני הוספה.',true);
            current.infrastructureIds=[...(current.infrastructureIds || []),s.infrastructureId];changed(true);message('החיבור נוסף כהצעת הצוות בעותק החלופה. מפת המצב הקיים לא השתנתה.');
          });b.disabled=historical || already || !current;card.append(b);
          if(historical)card.append(node('p','muted','אפשר לבחון מחדש מול הנתונים המעודכנים או לערוך את החיבור ידנית בחלופה.'));
        }d.append(card);
      });
      const exact=details(box,'המידע המקורי שנשלח למשוב הזה',print);const pre=node('pre','jnw-json',JSON.stringify(f.input,null,2));pre.dir='ltr';exact.append(pre);
    }
    function currentRequest(request) {
      if(!alive || pending!==request || request.generation!==generation || selectedAlternative!==request.alternativeId)return false;
      const a=alternative();if(!a)return false;
      try{return JSON.stringify(inputFor(a))===JSON.stringify(request.input);}catch(e){return false;}
    }
    async function generate() {
      const a=alternative();
      if(!a || pending || !reviewed || !approved)return;
      let input;try{input=inputFor(a);}catch(e){return message('אפשר לתקן את המידע לפני הבקשה: '+e.message,true);}
      if(JSON.stringify(input)!==JSON.stringify(reviewed.payload))return message('המידע השתנה. אפשר להציג אותו שוב ולאשר את השליחה.',true);
      if(a.feedback && !window.confirm('בקשת משוב חדש תחליף את המשוב האחרון בחלופה רק לאחר קבלת תשובה תקינה. אפשר לייצא עותק של המרחב לפני ההחלפה. להמשיך?'))return;
      const request={input:clone(input),alternativeId:a.id,generation:++generation,stage:'draft',started:Date.now()};pending=request;error='';notice='';rerender();
      request.timer=setInterval(()=>{const progress=document.querySelector('[data-network-progress]');if(progress && pending===request)progress.textContent=progressText(request);},1000);
      try {
        const check=value=>{try{N.validateReport(value,request.input);return true;}catch(e){return false;}};
        const draft=N.validateReport(await options.completeJson(N.AI_SYSTEM,[{role:'user',content:JSON.stringify(request.input)}],12000,true,check),request.input);
        if(!currentRequest(request))return;
        request.stage='audit';rerender();
        const output=N.validateReport(await options.completeJson(N.AUDIT_SYSTEM,[{role:'user',content:JSON.stringify({reviewedInput:request.input,draft})}],12000,true,check),request.input);
        if(!currentRequest(request))return;
        const target=alternative();target.feedback={createdAt:new Date().toISOString(),input:request.input,output};clearInterval(request.timer);pending=null;changed();
        message('התקבלה טיוטת משוב לאחר בדיקה מול אותו מידע. אפשר לבחון אותה עם הצוות ולשמור את השינויים במרחב.');
      } catch(e) {
        if(currentRequest(request)){error='הבקשה לא הושלמה בשני שלבי הבדיקה. '+e.message+'. העבודה והמשוב הקודם נשארו במרחב. אפשר לנסות שוב.';message(error,true);}
      } finally {clearInterval(request.timer);if(pending===request)pending=null;rerender();}
    }
    function progressText(request){return (request.stage==='audit'?'בחינת הטיוטה מול המידע שנשלח.':'הכנת טיוטת משוב מותנה.')+' חלפו '+Math.floor((Date.now()-request.started)/1000)+' שניות.';}
    function feedbackEditor(parent,a) {
      parent.append(node('h3','','סיוע בניתוח החלופה'),node('p','','הניתוח הזה כולל את המפה שנלכדה, השינויים המוצעים, הנחות הצוות וכל העתידים שתוארו. הוא נפרד מניתוח הראיות במסע. אפשר לבקש הסבר לחוזקות, למתחים, לתנאים ולהיערכות, ולעיין בכל המידע לפני שליחתו.'));
      if(error)parent.append(node('p','jws-error',error));if(notice)parent.append(node('p','jnw-notice',notice));
      const eligible=!!a.title.trim() && lab().futures.length>=2 && lab().futures.every(f=>(f.title || '').trim() && (f.conditions || '').trim());
      if(!eligible)parent.append(node('p','jnw-notice','כדי לקבל השוואה בכמה עתידים, אפשר לתת שם לחלופה ולתאר לפחות שני עתידים עם שם ותנאים. אפשר לשמור את הטיוטות גם לפני השלמתם.'));
      const preview=button('הצגת המידע לתרחיש',()=>{
        try{reviewed={alternativeId:a.id,payload:inputFor(a)};approved=false;error='';rerender();}
        catch(e){message('אפשר להשלים או לתקן את ההפניות לפני השליחה: '+e.message,true);}
      });preview.disabled=!eligible || !!pending;parent.append(preview);
      if(reviewed && reviewed.alternativeId===a.id) {
        const d=details(parent,'המידע המדויק לשליחה לסיוע בניתוח');const pre=node('pre','jnw-json',JSON.stringify(reviewed.payload,null,2));pre.dir='ltr';d.append(pre);
        parent.append(node('p','muted','כל פרטי המיפוי שנכללו בתמונת המוצא ובחלופה עשויים להישלח, כולל הערות וראיות. אפשר להימנע מפרטים מזהים ולשמור חומרי מקור במאגר המאושר של המסגרת.'));
        const l=node('label','jnw-approval'),c=node('input');c.type='checkbox';c.dataset.networkReviewed='1';c.checked=approved;c.disabled=!!pending;
        c.addEventListener('change',()=>{approved=c.checked;const b=parent.querySelector('[data-network-generate]');if(b)b.disabled=!approved || !!pending;});
        l.append(c,node('span','','עיינו במידע ובחנו שהוא מתאים לשליחה. ברור לנו שהחלופה והעתידים הם הצעות והנחות לבחינה.'));parent.append(l);
        const b=button('בקשת משוב לתרחיש',generate,false);b.dataset.networkGenerate='1';b.disabled=!approved || !!pending;parent.append(b);
      }
      if(pending){const p=node('p','jnw-notice',progressText(pending));p.dataset.networkProgress='1';p.setAttribute('role','status');parent.append(p,button('הפסקת ההמתנה למשוב',()=>{invalidate();rerender();}));}
      displayFeedback(parent,a);
    }
    function render(parent) {
      const root=node('section','jnw');parent.append(root);root.append(node('h2','','בחינת שינויים וכמה עתידים'),node('p','','אפשר לבנות חלופות ברשת החוסן החברתי, להשוות אותן למצב שמופה ולבחון כל חלופה בכמה תנאי עתיד. הנתונים וההנחות נשמרים במרחב לאחר שמירת השינויים.'));
      const goal=workspace().context && workspace().context.goal;if(goal)root.append(node('p','jnw-notice','התמונה שרוצים לקדם: '+goal+'. זו מטרה רצויה, בנפרד מתנאי העתיד האפשריים.'));
      root.append(button('חלופה חדשה מהמיפוי הקיים',()=>{
        if(lab().alternatives.length>=20)return message('אפשר לשמור עד 20 חלופות. אפשר לבחון יחד את החלופות שתרצו להשאיר.',true);
        let a;try{a=N.createAlternative(options.cleanMap(N.mapOf(workspace())),options.uid(),options.getRevision(),new Date().toISOString());}catch(e){return message('תמונת המוצא לא נלכדה: '+e.message,true);}
        lab().alternatives.push(a);selectedAlternative=a.id;changed(true);
      },false));
      if(!lab().alternatives.some(a=>a.id===selectedAlternative))selectedAlternative=lab().alternatives[0] && lab().alternatives[0].id || '';
      if(lab().alternatives.length)select(root,'בחירת חלופה',lab().alternatives,selectedAlternative,value=>{invalidate();selectedAlternative=value;selectedRecord=Object.create(null);rerender();});
      const a=alternative();
      if(a) {
        inputField(root,'title','שם החלופה',a,value=>{a.title=value;changed();},a.id,false);
        root.append(node('p','muted','תמונת המוצא נלכדה ב'+new Date(a.createdAt).toLocaleString('he-IL')+', לפי גרסה '+a.sourceRevision+'. '+(N.isHistorical(a,options.cleanMap(N.mapOf(workspace())))?'המיפוי הנוכחי השתנה מאז. החלופה נשארת מבוססת על התמונה שנלכדה; אפשר ליצור חלופה חדשה מהמיפוי העדכני.':'תמונת המוצא תואמת למיפוי הנוכחי.')));
        const d=details(root,'מטרת החלופה, הנחות ומה משתנה');
        for(const [key,title] of [['purpose','מה רוצים לקדם בחלופה'],['assumptions','הנחות ואי ודאות בחלופה'],['changeNotes','מה מציעים לשנות, לשמר או להפסיק']])inputField(d,key,title,a,value=>{a[key]=value;changed();},a.id);
      }
      const nav=node('nav','jnw-nav');nav.setAttribute('aria-label','בחינת חלופות ועתידים');root.append(nav);
      for(const [key,title] of [['futures','עתידים אפשריים'],['map','הרשת בחלופה'],['comparison','השוואה לתמונת המוצא'],['assessment','חלופה בכל עתיד'],['feedback','ניתוח ומשוב לתרחיש']]) {
        const b=button(title,()=>{view=key;rerender();});b.dataset.networkView=key;b.disabled=key!=='futures' && !a;if(key===view)b.setAttribute('aria-current','page');nav.append(b);
      }
      const body=node('div','jnw-view');root.append(body);
      if(view==='futures')futureEditor(body);
      else if(a) {if(view==='map')mapEditor(body,a);else if(view==='comparison')structural(body,a);else if(view==='assessment')assessments(body,a);else if(view==='feedback')feedbackEditor(body,a);}
      else body.append(node('p','jnw-notice','אפשר ליצור חלופה חדשה מהמיפוי הקיים כדי לבחון שינוי.'));
      if(a){
        const actions=node('div','jnw-actions');actions.append(button('יצירת טיוטת החלטה מהחלופה',()=>{options.draftDecision(N.decisionDraft(a));},false),button('הסרת החלופה',()=>{
          if(!window.confirm('להסיר את החלופה "'+label(a)+'", את ההערכות ואת המשוב שלה? מפת המקור והעתידים האפשריים יישארו.'))return;
          lab().alternatives=lab().alternatives.filter(x=>x.id!==a.id);invalidate();changed(true);
        }));root.append(actions,node('p','muted','טיוטת ההחלטה מיועדת להנמקה ולאישור אנושי. לאחר הבחירה אפשר להמשיך לתכנית העבודה וללמידה במסע. אין כאן הסמכה חיצונית או תוקף מחקרי מנבא.'));
      }
    }
    function printFields(parent,definitions,record) {
      const dl=node('dl');Object.entries(definitions).forEach(([key,title])=>{if(record[key])dl.append(node('dt','',title),node('dd','',record[key]));});parent.append(dl);
    }
    function printMap(parent,title,map) {
      const d=details(parent,title,true);
      options.schema.filter(s=>N.MAP_KEYS.includes(s.key)).forEach(s=>{
        d.append(node('h4','',s.label));if(!map[s.key].length)d.append(node('p','','טרם תועדו רשומות.'));
        map[s.key].forEach(record=>{d.append(node('h5','',label(record)+' ('+record.id+')'));const dl=node('dl');s.fields.forEach(f=>{const value=recordValue(map,f,record[f.key]);if(value)dl.append(node('dt','',f.label),node('dd','',value));});d.append(dl);});
      });
    }
    function report() {
      const root=node('section','jnw jnw-report');root.append(node('h2','','חלופות וכמה עתידים ברשת החוסן החברתי'),node('p','','עותקי החלופות והעתידים שלהלן הם הנחות והצעות לבחינה. הם נפרדים ממפת המצב הקיים ואינם תחזית או ציון חוסן.'));
      lab().futures.forEach(f=>{root.append(node('h3','','עתיד אפשרי: '+label(f)));printFields(root,N.FUTURE_FIELDS,f);});
      lab().alternatives.forEach(a=>{
        root.append(node('h3','','חלופה: '+label(a)),node('p','','מזהה '+a.id+'; תמונת מוצא מתאריך '+a.createdAt+'; גרסה '+a.sourceRevision+'.'));
        printFields(root,{purpose:'מה רוצים לקדם',assumptions:'הנחות ואי ודאות',changeNotes:'מה מציעים לשנות'},a);
        printMap(root,'תמונת המוצא שנלכדה',a.baseline);printMap(root,'העותק המשוער של החלופה',a.proposal);structural(root,a,true);
        lab().futures.forEach(f=>{root.append(node('h4','','בחינת החלופה בתנאי '+label(f)));const c=a.assessments.find(c=>c.futureId===f.id);if(c)printFields(root,N.ASSESSMENT_FIELDS,c);else root.append(node('p','','טרם נבחן. המידע נשאר שאלה פתוחה.'));});
        displayFeedback(root,a,true);
      });return root;
    }
    return {render,report,hasPending:()=>!!pending,invalidate,destroy(){alive=false;invalidate();}};
  }
  const PRINT_CSS='.jnw-report{direction:rtl;max-width:100%}.jnw-report h2,.jnw-report h3,.jnw-report h4,.jnw-report h5{color:#000;border:0!important;break-after:avoid}.jnw-report p,.jnw-report li,.jnw-report dd{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.7}.jnw-report dt,.jnw-report summary{font-weight:700}.jnw-report dd{margin:.2rem 0 .8rem}.jnw-report details{display:block;margin:.8rem 0}.jnw-report .jnw-json{direction:ltr;text-align:left;max-height:none;overflow:visible;white-space:pre-wrap;overflow-wrap:anywhere;font:9pt/1.5 monospace}.jnw-report .jnw-card,.jnw-report .jnw-detail,.jnw-report .jnw-feedback{padding:0;border:0;break-inside:auto}';
  window.SBE_NETWORK_UI={create,PRINT_CSS};
})();
