(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./research-intake-core.js'),require('./research-partnership-core.js'),require('./research-client.js'));
  else{root.SBE_RESEARCH_INTAKE_UI=factory(root.SBE_RESEARCH_INTAKE,root.SBE_RESEARCH_PARTNERSHIPS,root.SBE_RESEARCH_CLIENT);document.addEventListener('DOMContentLoaded',()=>{const target=document.getElementById('intake-root');if(!target)return;const page=root.SBE_RESEARCH_INTAKE_UI.mountPublic({root:target});page.load();window.addEventListener('focus',()=>page.load());window.addEventListener('pageshow',event=>{if(event.persisted)page.load();});});}
})(typeof self!=='undefined'?self:this,function(I,P,R){
  'use strict';
  const LABELS={title:'כותרת הבקשה',objectives:'מטרות בקצרה'};
  const ACK='קראתי את תנאי הפנייה. אישור הקריאה אינו חתימה על הסכם';
  const PUBLIC_MESSAGES={rate_limited:'נשלחו כמה פניות. אפשר לנסות שוב בהמשך.',unavailable:'השירות אינו זמין כרגע. הפרטים נשארים כאן ואפשר לנסות שוב.'};
  const uuid=()=>crypto.randomUUID();
  const split=value=>[...new Set(String(value||'').split(/[\n,]/).map(s=>s.trim()).filter(Boolean))];
  const date=value=>value?new Intl.DateTimeFormat('he-IL',{dateStyle:'short',timeStyle:'short'}).format(new Date(value)):'טרם נרשם';
  function createPublicClient(options={}){
    const fetchImpl=options.fetchImpl||((...args)=>fetch(...args)),makeId=options.uuid||uuid;
    const endpoint=options.endpoint||((typeof location!=='undefined'&&/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname))?'/api/research-intake':'https://sbe-server.onrender.com/api/research-intake');
    let pending=null;
    async function call(action,payload={}){
      if(!I.PUBLIC_ACTIONS.includes(action))throw R.error('invalid',400);
      const body={...payload,action};
      if(action==='intakeSubmit'){
        const key=JSON.stringify(payload);
        if(pending?.key!==key)pending={key,requestId:makeId()};
        body.requestId=pending.requestId;
      }
      I.validatePayload(action,body);
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
      try{
        const response=await fetchImpl(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),credentials:'omit',cache:'no-store',signal:controller.signal}),data=await response.json();
        if(!response.ok||data.ok===false){if(response.status>=400&&response.status<500)pending=null;const code=data.code==='terms_changed'?'conflict':Object.hasOwn(PUBLIC_MESSAGES,data.code)||Object.hasOwn(R.MESSAGES,data.code)?data.code:'invalid',error=R.error(code,response.status);if(PUBLIC_MESSAGES[code])error.userMessage=PUBLIC_MESSAGES[code];throw error;}
        if(action==='intakeSubmit')pending=null;
        return data;
      }catch(e){if(typeof e.code==='string')throw e;throw R.error('network');}finally{clearTimeout(timer);}
    }
    return Object.freeze({call});
  }
  function valuesForm(D,parent,definitions,seed={},required=[]){
    const controls={};
    for(const def of definitions){
      const label=LABELS[def.id]||def.label,initial=seed[def.id];
      if(def.type==='tags'&&def.choices){
        const group=D.node('fieldset','r-multiple');group.append(D.node('legend','',label));
        const choices=D.choices(group,Object.fromEntries(def.choices.map(key=>[key,P.permissionLabel(key)])),initial||[]);parent.append(group);controls[def.id]={read:choices.values};continue;
      }
      const type=def.type==='enum'?'select':def.type==='tags'||['objectives','background','profileNotes','method','population','ethicsDetails','consentPlan','requestedSupport'].includes(def.id)?'textarea':def.type==='text'?'text':def.type;
      const input=D.field(parent,label,type,Array.isArray(initial)?initial.join('\n'):initial||'',{choices:def.choices?{'':'בחירה',...def.choices}:undefined});
      if(required.includes(def.id)){input.setAttribute('aria-required','true');input.parentNode.append(D.node('small','r-muted','שדה עיקרי'));}
      controls[def.id]={input,read:()=>def.type==='tags'?split(input.value):input.value.trim()};
    }
    return {controls,read:()=>Object.fromEntries(Object.entries(controls).map(([key,control])=>[key,control.read()]).filter(([,value])=>Array.isArray(value)?value.length:value!==''))};
  }
  function mountPublic(options={}){
    const document=options.document||window.document,root=options.root||document.getElementById('intake-root'),D=R.dom(document),client=options.client||createPublicClient(options);
    let info=null,draft={},form=null,ack=null,status=null,receipt=null,epoch=0,submitting=false;
    function note(text,bad=false){if(!status){status=D.node('p','r-notice');status.setAttribute('role','status');status.setAttribute('aria-live','polite');root.append(status);}status.className='r-notice'+(bad?' r-error':'');status.textContent=text;}
    function read(){if(form)draft=form.read();return draft;}
    function render(changed=false,readAcknowledged=false){
      root.replaceChildren();status=null;form=null;ack=null;
      if(receipt){const box=D.card(root,'הבקשה התקבלה לבדיקה');D.paragraph(box,'מספר הפנייה: '+receipt.id,'r-pre');D.paragraph(box,'מועד ההגשה: '+date(receipt.submittedAt));D.paragraph(box,'הגשת הבקשה אינה יוצרת חשבון, הרשאה, הסכם או אישור אתי. אפשר לשמור את מספר הפנייה לעיון בהמשך.');return;}
      const intro=D.card(root,'פנייה לשותפות במחקר');D.paragraph(intro,'אפשר לפנות בשם מוסד או כאדם פרטי. תחילה עיון בתנאים, ואחריו בקשה ראשונית קצרה לבדיקת בעלת המערכת.');
      if(!info?.acceptingApplications||!info.terms){D.paragraph(intro,'הפניות סגורות כרגע. תנאי פנייה שפורסמו אינם זמינים.','r-notice');return;}
      const terms=D.card(root,info.terms.title);D.paragraph(terms,'תנאי הפנייה · גרסה '+info.terms.number,'r-muted');const termsText=D.paragraph(terms,info.terms.text,'r-pre r-intake-terms');termsText.setAttribute('tabindex','0');termsText.setAttribute('aria-label','נוסח תנאי הפנייה');
      const box=D.card(root,'בקשה ראשונית');D.paragraph(box,'אפשר לתאר בקצרה את הרעיון. אין כאן צירוף מסמכים או נתוני משתתפים. כלים והרשאות נבדקים בנפרד לאחר הגשת הפנייה.');
      const primary=I.SUBMISSION_REQUIRED_FIELDS.map(key=>I.PUBLIC_FIELDS.find(def=>def.id===key));
      const primaryForm=valuesForm(D,box,primary,{applicationType:'partnership',applicantType:'individual',...draft},I.SUBMISSION_REQUIRED_FIELDS);
      const institution=valuesForm(D,box,[I.PUBLIC_FIELDS.find(f=>f.id==='institution')],draft);
      const applicant=primaryForm.controls.applicantType.input;
      const institutionHint=D.node('small','r-muted');institution.controls.institution.input.parentNode.append(institutionHint);
      function institutionLabel(){institution.controls.institution.input.setAttribute('aria-required',String(applicant.value==='institution'));institutionHint.textContent=applicant.value==='institution'?'שדה עיקרי לפנייה בשם מוסד':'לפי בחירה לאדם פרטי';}
      applicant.addEventListener('change',institutionLabel);institutionLabel();
      D.paragraph(box,'בכלים מבוקשים אפשר לציין שמות כגון פרקטי, נוגי, מיפוי החוסן או שאלוני מחקר. כל כלי בשורה נפרדת. הציון כאן הוא בקשה בלבד.','r-muted');
      const optional=D.node('details','r-fold');optional.append(D.node('summary','','פרטים מקצועיים ומחקריים נוספים, לפי בחירה'));
      const more=valuesForm(D,optional,I.PUBLIC_FIELDS.filter(def=>!I.SUBMISSION_REQUIRED_FIELDS.includes(def.id)&&def.id!=='institution'),draft);box.append(optional);
      form={read:()=>({...primaryForm.read(),...institution.read(),...more.read()})};
      ack=D.field(box,ACK,'checkbox',!changed&&readAcknowledged);box.append(D.button('הגשת בקשה',submit));
      if(changed)note('התנאים עודכנו. הפרטים שהוקלדו נשארו כאן. אפשר לעיין בגרסה החדשה ולאשר שוב את הקריאה.');
    }
    async function load(){
      if(submitting||receipt)return;
      read();const previous=info?.terms,at=++epoch;
      try{const data=await client.call('intakePublicInfo');if(at!==epoch||submitting||receipt)return;read();const readAcknowledged=ack?.checked===true;info=data;const changed=Boolean(previous&&(previous.versionId!==info.terms?.versionId||previous.hash!==info.terms?.hash));render(changed,readAcknowledged);}catch(e){if(at===epoch&&!submitting&&!receipt)note(e.userMessage||R.MESSAGES.network,true);}
    }
    async function submit(){
      const application=read(),missing=I.SUBMISSION_REQUIRED_FIELDS.filter(key=>!application[key]||(Array.isArray(application[key])&&!application[key].length));
      if(application.applicantType==='institution'&&!application.institution)missing.push('institution');
      if(missing.length){note('להשלמת הפנייה: '+missing.map(key=>LABELS[key]||I.PUBLIC_FIELDS.find(f=>f.id===key).label).join(', '),true);return;}
      if(!ack.checked){note('להמשך ההגשה, אפשר לעיין בתנאי הפנייה ולסמן את אישור הקריאה.',true);return;}
      const at=epoch;submitting=true;
      try{const result=await client.call('intakeSubmit',{termsVersionId:info.terms.versionId,termsHash:info.terms.hash,acknowledged:true,application});if(at!==epoch)return;receipt=result.receipt;draft={};render();}
      catch(e){if(at!==epoch)return;if(e.code==='conflict'){submitting=false;await load();if(ack)ack.checked=false;note('התנאים עודכנו. אפשר לעיין בנוסח העדכני ולאשר שוב את הקריאה. הפרטים שהוקלדו נשארו כאן.',true);}else note(e.userMessage||R.MESSAGES[e.code]||R.MESSAGES.invalid,true);}
      finally{submitting=false;}
    }
    return Object.freeze({load,clear(){epoch++;draft={};form=null;info=null;receipt=null;root.replaceChildren();}});
  }
  function mountOwner(options={}){
    const document=options.document||window.document,root=options.root,D=R.dom(document),client=options.client;
    let bootstrap=options.bootstrap||{},ownerInfo=null,epoch=0,viewSequence=0,status=null,readDraft=null,route=null,applicationId=null;
    function clear(){epoch++;viewSequence++;ownerInfo=null;bootstrap={};readDraft=null;route=null;applicationId=null;status=null;root.replaceChildren();}
    function note(text,bad=false){if(!status){status=D.node('p','r-notice');status.setAttribute('role','status');status.setAttribute('aria-live','polite');root.append(status);}status.className='r-notice'+(bad?' r-error':'');status.textContent=text;}
    async function call(action,payload={}){const at=epoch,view=viewSequence;try{const data=await client.call(action,payload);return at===epoch&&view===viewSequence?data:null;}catch(e){if(e.code!=='stale'&&at===epoch&&view===viewSequence)note(e.userMessage||R.MESSAGES[e.code]||R.MESSAGES.invalid,true);return null;}}
    async function ready(){if(ownerInfo)return true;const [info,studies]=await Promise.all([call('intakeOwnerBootstrap'),call('bootstrap')]);if(!info||!studies)return false;ownerInfo=info;bootstrap={...bootstrap,studies:studies.studies||[]};return true;}
    function heading(title){root.replaceChildren();status=null;readDraft=null;const box=D.card(root,title),nav=D.node('nav','r-toolbar');if(options.onBack)nav.append(D.button('כל השותפויות',options.onBack,'r-secondary'));nav.append(D.button('בקשות לשותפות',()=>inbox(),'r-secondary'),D.button('תנאי פנייה',()=>terms(),'r-secondary'));box.append(nav);return box;}
    async function terms(saved){const view=++viewSequence;if(!await ready()||view!==viewSequence)return;route='terms';applicationId=null;const state=ownerInfo.termsState||{revision:0,draftVersion:null,publishedVersionId:null},version=state.draftVersion,seed=saved||version||I.DEFAULT_TERMS_DRAFT,box=heading('תנאי פנייה');
      D.paragraph(box,state.publishedVersionId?'הפניות פתוחות לפי גרסה שפורסמה. מזהה הגרסה: '+state.publishedVersionId:'טרם פורסמו תנאי פנייה. הפניות הציבוריות סגורות.','r-notice r-pre');
      const proposed=version?.number===1&&version.title===I.DEFAULT_TERMS_DRAFT.title&&version.text===I.DEFAULT_TERMS_DRAFT.text;
      D.paragraph(box,version?(proposed?'טיוטה מוצעת':'טיוטה שמורה')+' · גרסה '+version.number+(state.publishedVersionId===version.versionId?' · הגרסה פורסמה':' · הנוסח טרם פורסם'):'נוסח מוצע לעיון בעלת המערכת. הנוסח טרם אושר או פורסם.');
      const title=D.field(box,'כותרת תנאי הפנייה','text',seed.title),text=D.field(box,'נוסח תנאי הפנייה','textarea',seed.text);text.className='r-intake-terms-editor';readDraft=()=>({title:title.value,text:text.value});
      box.append(D.button('שמירת טיוטת תנאים',async()=>{const result=await call('intakeTermsSave',{expectedRevision:state.revision,title:title.value,text:text.value});if(result){ownerInfo.termsState=result.termsState;await terms();note('הטיוטה נשמרה. פרסום הגרסה הוא פעולה נפרדת.');}}));
      if(version&&state.publishedVersionId!==version.versionId)box.append(D.button('פרסום הגרסה השמורה',async()=>{if(title.value!==version.title||text.value!==version.text){note('אפשר לשמור תחילה את השינויים כטיוטה, ולאחר מכן לפרסם את הגרסה השמורה.',true);return;}const result=await call('intakeTermsPublish',{expectedRevision:state.revision,versionId:version.versionId});if(result){ownerInfo.termsState=result.termsState;await terms();note('הגרסה השמורה פורסמה לתצוגה הציבורית.');}}));
    }
    async function inbox(){const view=++viewSequence;if(!await ready()||view!==viewSequence)return;route='inbox';applicationId=null;const box=heading('בקשות לשותפות'),filters=D.node('div','r-grid'),state=D.field(filters,'מצב הפנייה','select','',{choices:{'':'כל המצבים',...I.APPLICATION_STATUSES}}),query=D.field(filters,'חיפוש בפניות');box.append(filters);const listing=D.node('div');box.append(listing);let applications=[],cursor=null;
      async function fetchList(more=false){const data=await call('intakeList',{...(state.value?{status:state.value}:{}),...(query.value.trim()?{query:query.value.trim()}:{}),...(more&&cursor?{cursor}:{})});if(!data)return;applications=more?[...applications,...data.applications||[]]:data.applications||[];cursor=data.nextCursor;listing.replaceChildren();if(!applications.length)D.paragraph(listing,'אין כרגע פניות להצגה.','r-muted');for(const application of applications){const card=D.card(listing,application.fullName||application.application?.fullName||'פנייה לשותפות');card.append(D.button(application.title||application.application?.title||'פרטי הפנייה',()=>detail(application.id)));D.paragraph(card,(I.APPLICATION_STATUSES[application.status]||application.status)+' · '+date(application.submittedAt));}if(cursor)listing.append(D.button('פניות נוספות',()=>fetchList(true),'r-secondary'));}
      box.append(D.button('חיפוש בפניות',()=>fetchList()));await fetchList();
    }
    async function detail(id,saved){const view=++viewSequence;if(!await ready()||view!==viewSequence)return;const result=await call('intakeGet',{applicationId:id});if(!result)return;route='detail';applicationId=id;const application=result.application,data=application.application||application.data||{},box=heading(data.title||'פרטי הפנייה');
      D.paragraph(box,'מצב: '+(I.APPLICATION_STATUSES[application.status]||application.status)+' · מועד הגשה: '+date(application.submittedAt)+' · גרסת הפנייה: '+application.revision);if(application.reviewedAt)D.paragraph(box,'מועד בדיקה: '+date(application.reviewedAt));
      const original=D.card(box,'הפרטים המקוריים שהוגשו');for(const def of I.PUBLIC_FIELDS)if(data[def.id]!==undefined){D.paragraph(original,def.label,'r-intake-label');const value=def.type==='enum'?def.choices[data[def.id]]:def.id==='requestedPermissions'?(data[def.id]||[]).map(P.permissionLabel).join(', '):R.display(data[def.id]);D.paragraph(original,value,'r-pre');}
      const accepted=D.node('details','r-fold');accepted.append(D.node('summary','','תנאי הפנייה שנקראו בעת ההגשה'));if(result.terms){D.paragraph(accepted,result.terms.title+' · גרסה '+result.terms.number);D.paragraph(accepted,result.terms.text,'r-pre');D.paragraph(accepted,'מזהה גרסה: '+result.terms.versionId+' · טביעת תוכן: '+result.terms.hash,'r-muted r-pre');}D.paragraph(accepted,'אישור הקריאה אינו חתימה על הסכם.');box.append(accepted);
      if(application.acknowledgedAt)D.paragraph(accepted,'מועד אישור הקריאה: '+date(application.acknowledgedAt));
      const reviews=application.reviews||[];if(reviews.length){const history=D.node('details','r-fold');history.append(D.node('summary','','היסטוריית הבדיקה'));for(const review of reviews){D.paragraph(history,(I.APPLICATION_STATUSES[review.decision]||review.decision)+' · '+date(review.createdAt));if(review.note)D.paragraph(history,review.note,'r-pre');}box.append(history);}
      const noteField=D.field(box,'הערות לבדיקה','textarea',saved?.note??reviews.at(-1)?.note??'');
      if(['approved','rejected'].includes(application.status)){D.paragraph(box,'ההחלטה נרשמה. ההסכמים והאישורים ממשיכים בתיק השותפות.');return;}
      async function review(decision,extra={}){const result=await call('intakeReview',{applicationId:id,expectedRevision:application.revision,decision,...(noteField.value?{note:noteField.value}:{}),...extra});if(result){await inbox();note('החלטת הבדיקה נשמרה. אישור בקשה אינו חתימה או אישור אתי.');}}
      box.append(D.button('שמירה בבדיקה',()=>review('under_review'),'r-secondary'),D.button('דחיית הבקשה',()=>review('rejected'),'r-danger'));
      const approval=D.card(box,'בחירת מחקר וזהות אישית');D.paragraph(approval,'אפשר לבחור זהות אישית קיימת לאחר וידוא הפונה, מחקר והרשאות עבורו בלבד. ההרשאות המבוקשות בפנייה אינן מסומנות אוטומטית.');
      const studies=bootstrap.studies||[],study=D.field(approval,'מחקר לאישור','select',saved?.studyId||'',{choices:{'':'בחירת מחקר',...Object.fromEntries(studies.map(s=>[s.id,s.title||s.config?.title||'מחקר']))}}),identity=D.field(approval,'זהות אישית מאומתת','select',saved?.individualCode||'',{choices:{'':'בחירת קוד אישי',...Object.fromEntries((ownerInfo.identities||[]).map(i=>[i.code,i.label+' · '+i.institution]))}}),verified=D.field(approval,'וידוא זהות הפונה הושלם','checkbox',saved?.verified===true);
      identity.addEventListener('change',()=>{verified.checked=false;});
      const permissions=I.PUBLIC_FIELDS.find(f=>f.id==='requestedPermissions').choices,rights=D.choices(D.card(approval,'הרשאות שנבחרו לאישור'),Object.fromEntries(permissions.map(p=>[p,P.permissionLabel(p)])),saved?.permissions||P.ACCESS_PRESETS.approved_findings,'data-intake-permission');
      readDraft=()=>({note:noteField.value,studyId:study.value,individualCode:identity.value,verified:verified.checked,permissions:rights.values(),newInstitution:institution.value,newLabel:label.value});
      approval.append(D.button('יצירת מחקר כטיוטה מהבקשה',async()=>{const snapshot=readDraft(),created=await call('studyCreate',{config:{title:data.title,description:data.objectives||''}});if(created){bootstrap.studies=[...studies,created.study];await detail(id,{...snapshot,studyId:created.study.id});note('המחקר נשמר כטיוטה. אפשר להמשיך בבחירת הזהות וההרשאות.');}},'r-secondary'));
      const create=D.node('details','r-fold');create.append(D.node('summary','','קוד אישי חדש למחקר'));D.paragraph(create,'הקוד נוצר בהקשר כניסה קיים. יצירתו אינה פותחת כלים או מחקרים ואינה שולחת הודעה לפונה. אפשר למסור אותו באופן אישי לאחר וידוא זהות.');const institution=D.field(create,'הקשר כניסה לקוד החדש','select',saved?.newInstitution??ownerInfo.institutions?.[0]??'',{choices:{'':'בחירת מסגרת קיימת',...Object.fromEntries((ownerInfo.institutions||[]).map(i=>[i,i]))}}),label=D.field(create,'שם לקוד האישי','text',saved?.newLabel??data.fullName??'');
      create.append(D.button('יצירת קוד אישי למחקר',async()=>{const snapshot=readDraft(),created=await call('intakeIdentityCreate',{institution:institution.value,label:label.value});if(created){ownerInfo.identities=[...ownerInfo.identities||[],created.identity];await detail(id,{...snapshot,individualCode:created.identity.code,verified:false});note('נוצר קוד אישי למחקר: '+created.identity.code+'. הקוד אינו מקנה גישה עד לאישור ההרשאות.');}}));approval.append(create);
      approval.append(D.button('אישור הבקשה וההרשאות שנבחרו',async()=>{if(!study.value||!identity.value||!verified.checked||!rights.values().includes('view_study')){note('להשלמת האישור אפשר לבחור מחקר, זהות אישית שנבדקה והרשאת צפייה במחקר, ולסמן את וידוא הזהות.',true);return;}const fresh=await call('studyGet',{studyId:study.value});if(!fresh)return;await review('approved',{studyId:study.value,studyExpectedRevision:fresh.study.revision,individualCode:identity.value,permissions:rights.values()});}));
    }
    return Object.freeze({inbox,terms,detail,clear,capture:()=>({route,applicationId,draft:readDraft?.()}),async restore(saved){if(saved?.route==='terms')await terms(saved.draft);else if(saved?.route==='detail')await detail(saved.applicationId,saved.draft);else await inbox();}});
  }
  return Object.freeze({createPublicClient,mountPublic,mountOwner});
});
