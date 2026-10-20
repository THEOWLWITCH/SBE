(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./research-core.js'),require('./research-partnership-core.js'),require('./research-intake-core.js'));
  else root.SBE_RESEARCH_CLIENT = factory(root.SBE_RESEARCH,root.SBE_RESEARCH_PARTNERSHIPS,root.SBE_RESEARCH_INTAKE);
})(typeof self !== 'undefined' ? self : this, function (C,P,I) {
  'use strict';
  const ACTIONS=new Set([...C.CLIENT_ACTIONS,...(P?.CLIENT_ACTIONS||[]),...(I?.CLIENT_ACTIONS||[])]);
  const READS = new Set(['bootstrap','studyGet','memberList','versionList','participantList','contactGet','resultsGet','exportData','auditList','mailList','inviteInfo','myStudies','participationGet','sampleGet',...(P?.READ_ACTIONS||[]),...(I?.READ_ACTIONS||[])]);
  const MESSAGES = { unauthorized:'הכניסה או ההרשאה הסתיימו. אפשר להיכנס מחדש בקוד האישי.', not_found:'המחקר או הנתונים אינם זמינים לחשבון הזה.', invalid:'אפשר לבדוק את הפרטים ולנסות שוב.', conflict:'המחקר השתנה בזמן העריכה. אפשר לרענן את המחקר לפני שמירה נוספת.', consent_changed:'טופס ההסכמה השתנה. אפשר לפתוח את הטופס העדכני ולאשר את הבחירה מחדש.', rate_limited:'בקשת האימות האחרונה עדיין בטיפול. אפשר לבדוק את תיבת הדוא״ל ולנסות שוב בהמשך.', not_configured:'השירות עדיין לא מוגדר. אפשר לפנות לבעלת המערכת להשלמת ההגדרה.', network:'החיבור לא הושלם. הפרטים שהוקלדו נשארים כאן ואפשר לנסות שוב.', stale:'התצוגה התחלפה.' };
  function error(code, status) { const e=new Error(code); e.code=code; e.status=status||0; e.userMessage=MESSAGES[code]||'הפעולה לא הושלמה. אפשר לנסות שוב.'; return e; }
  function create(options={}) {
    const getToken=options.getToken||(()=>{try{return sessionStorage.getItem('sbe.session.token')||'';}catch(_){return '';}});
    const fetchImpl=options.fetchImpl||((...args)=>fetch(...args));
    const uuid=options.uuid||(()=>crypto.randomUUID());
    const endpoint=options.endpoint||((typeof location!=='undefined' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname))?'/api/research':'https://sbe-server.onrender.com/api/research');
    let generation=0, scope='', seenToken=getToken(); const pending=new Map(), controllers=new Set();
    function invalidate(reason='refresh') { const sameSessionRefresh=reason==='refresh'&&seenToken===getToken();generation++;if(!sameSessionRefresh){pending.clear();scope='';}controllers.forEach(c=>c.abort());controllers.clear();seenToken=getToken();options.onClear?.(reason); }
    function setScope(next) { next=String(next||''); if(scope!==next || seenToken!==getToken()) { invalidate('scope'); scope=next; } }
    async function call(action,payload={}) {
      if(!ACTIONS.has(action)) throw error('invalid',400);
      if(seenToken!==getToken()) invalidate('account');
      const token=getToken(); if(!token) {invalidate('unauthorized');throw error('unauthorized',403);}
      if(payload.studyId && scope && payload.studyId!==scope) throw error('stale');
      const epoch=generation; const body=Object.assign({},payload,{action,token});
      let key;
      if(!READS.has(action)) { key=action+':'+JSON.stringify(payload); if(!pending.has(key))pending.set(key,payload.requestId||uuid()); body.requestId=pending.get(key); }
      const controller=typeof AbortController!=='undefined'?new AbortController():null; if(controller)controllers.add(controller);
      try {
        const res=await fetchImpl(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store',credentials:'omit',signal:controller?.signal});
        const data=await res.json();
        if(epoch!==generation || token!==getToken()) { if(token!==getToken())invalidate('account'); throw error('stale'); }
        if(!res.ok || data.ok===false) { const code=Object.hasOwn(MESSAGES,data.code)?data.code:Object.hasOwn(MESSAGES,data.error)?data.error:'invalid'; if(res.status===403||res.status===404)invalidate(code); if(key && res.status>=400 && res.status<500)pending.delete(key); throw error(code,res.status); }
        if(key)pending.delete(key); return data;
      } catch(e) { if(e.code)throw e; if(epoch!==generation || token!==getToken())throw error('stale'); throw error('network'); }
      finally {if(controller)controllers.delete(controller);}
    }
    return Object.freeze({call,setScope,invalidate,getToken,getSessionToken:()=>seenToken});
  }
  function dom(document) {
    function node(tag,cls,text) {const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=String(text);return n;}
    function button(text,fn,cls='') {const b=node('button','r-btn '+cls,text);b.type='button';b.addEventListener('click',async e=>{e.preventDefault();if(b.disabled)return;b.disabled=true;try{await fn();}finally{b.disabled=false;}});return b;}
    function field(parent,label,type='text',value='',options={}) { const box=node('label','r-field');box.append(node('span','',label));let n;
      if(type==='textarea')n=node('textarea');else if(type==='select'){n=node('select');for(const [id,title] of Object.entries(options.choices||{})){const o=node('option','',title);o.value=id;n.append(o);}}
      else{n=node('input');n.type=type;} n.value=value==null?'':String(value);if(type==='checkbox'){n.checked=value===true;box.className='r-check';}
      if(options.min!=null)n.min=options.min;if(options.max!=null)n.max=options.max;if(options.placeholder)n.placeholder=options.placeholder;if(options.required)n.required=true;if(options.disabled)n.disabled=true;
      n.setAttribute('dir','rtl');n.setAttribute('aria-label',label);n.setAttribute('data-research-field',label);box.append(n);parent.append(box);return n;
    }
    function card(parent,title){const n=node('section','r-card');if(title)n.append(node('h2','',title));parent.append(n);return n;}
    function paragraph(parent,text,cls=''){const n=node('p',cls,text);parent.append(n);return n;}
    function choices(parent,labels,selected=[],attr) {const out={};for(const [key,label]of Object.entries(labels)){out[key]=field(parent,label,'checkbox',selected.includes(key));if(attr)out[key].setAttribute(attr,key);}return {fields:out,values:()=>Object.keys(out).filter(k=>out[k].checked)};}
    function table(parent,rows,columns){if(!rows?.length){paragraph(parent,'אין נתונים להצגה.','r-muted');return;}const wrap=node('div','r-table-scroll'),t=node('table'),head=node('thead'),tr=node('tr');for(const col of columns)tr.append(node('th','',col.label));head.append(tr);t.append(head);const body=node('tbody');for(const row of rows){const line=node('tr');for(const col of columns){const td=node('td');td.setAttribute('data-label',col.label);const v=col.render?col.render(row):row[col.key];if(v && typeof v==='object' && v.tagName)td.append(v);else td.textContent=display(v);line.append(td);}body.append(line);}t.append(body);wrap.append(t);parent.append(wrap);}
    return {node,button,field,card,paragraph,choices,table};
  }
  function display(value) {if(value==null)return '';if(typeof value==='boolean')return value?'כן':'לא';if(Array.isArray(value))return value.map(display).join(', ');if(typeof value==='object')return Object.entries(value).map(([k,v])=>k+': '+display(v)).join(' · ');return String(value);}
  function download(filename,text,type='application/json') {const blob=new Blob([text],{type:type+';charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),0);}
  function controls(root){const out=[];function walk(n){if(/^(input|textarea|select)$/i.test(n.tagName||'')&&n.type!=='file')out.push(n);Array.from(n.children||[]).forEach(walk);}walk(root);return out;}
  function snapshot(root){const counts={};return controls(root).map(n=>{const key=n.getAttribute?n.getAttribute('data-research-field'):n.attributes?.['data-research-field'];const index=counts[key]||0;counts[key]=index+1;return {key,index,value:n.value,checked:n.checked===true};});}
  function restore(root,values){const counts={};for(const n of controls(root)){const key=n.getAttribute?n.getAttribute('data-research-field'):n.attributes?.['data-research-field'];const index=counts[key]||0;counts[key]=index+1;const saved=values.find(v=>v.key===key&&v.index===index);if(!saved||n.disabled)continue;if(n.type==='checkbox')n.checked=saved.checked;else if(n.tagName.toLowerCase()!=='select'||Array.from(n.children).some(o=>o.value===saved.value))n.value=saved.value;}}
  function lifecycle(page,client,environment=window){let suspended=null,loading=false,again=false;
    function suspend(){if(!suspended)suspended={token:client.getSessionToken?.()||client.getToken(),pending:page.capture?.()};client.invalidate('refresh');}
    async function refresh(){if(loading){again=true;return;}loading=true;const saved=suspended||{token:client.getSessionToken?.()||client.getToken(),pending:page.capture?.()};suspended=null;client.invalidate('refresh');try{await page.load(saved.token===client.getToken()?saved.pending:undefined);}finally{loading=false;if(again){again=false;refresh();}}}
    environment.addEventListener('pageshow',refresh);environment.addEventListener('focus',refresh);environment.addEventListener('pagehide',()=>{suspended=null;client.invalidate('leave');});environment.addEventListener('storage',()=>{suspended=null;refresh();});environment.document?.addEventListener('visibilitychange',()=>{if(environment.document.visibilityState==='visible')refresh();else suspend();});
    return Object.freeze({refresh});
  }
  return Object.freeze({create,dom,display,download,lifecycle,snapshot,restore,error,MESSAGES});
});
