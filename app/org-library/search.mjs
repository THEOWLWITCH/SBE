/* Local, deterministic search. Concept links are retrieval aids, not evidence of construct equivalence. */
const STOP = new Set(`a an the and or of to for in on at by with from this that these those is are be as not does do when how which what can source sources scientific library absent another person across during between using about its it we our into through has have was were than any particular על של את עם או גם זה זו לא אינו אינה שאינו היא הוא בין מתוך כדי האם מתי כיצד מה איך מקור מקורות מדעי מדעית מאגר במאגר הספרייה ספריה יש אין כבר כל מסוים מסוימת באמצעות`.split(/\s+/));
const cache = new WeakMap();

export function normalizeText(value='') {
  return String(value).normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
}
function words(value) { return normalizeText(value).split(' ').filter(x=>x&&!STOP.has(x)); }
function forms(word) {
  const out = [word];
  if (/^[a-z]{5,}$/.test(word)) {
    if(word.endsWith('ing')&&word.length>6) out.push(word.slice(0,-3));
    else if(word.endsWith('ies')) out.push(word.slice(0,-3)+'y');
    else if(word.endsWith('s')&&!word.endsWith('ss')) out.push(word.slice(0,-1));
  }
  if (/^[ובל][\u05d0-\u05ea]{4,}$/.test(word)) out.push(word.slice(1));
  return out;
}
function sameWord(a,b) {return forms(a).some(x=>forms(b).includes(x));}
function termFound(text,term) {
  const normalized=normalizeText(term);
  if(!normalized) return false;
  if((' '+text+' ').includes(' '+normalized+' ')) return true;
  const tw=words(term), dw=words(text);
  return tw.length>1&&tw.every(t=>dw.some(w=>sameWord(t,w)));
}
function reason(kind,he,en,concept_id) {
  return {kind,label:he,label_he:he,label_en:en,...(concept_id?{concept_id}:{})};
}

// Additional bilingual editorial retrieval labels. They neither change source summaries nor grade evidence.
const EXTRA = [
  {concept_id:'PSY',label_he:'בטיחות פסיכולוגית',label_en:'psychological safety',related_terms:['ביטחון פסיכולוגי'],source_ids:['BG-SRC-005']},
  {concept_id:'JDR',label_he:'דרישות ומשאבי עבודה',label_en:'job demands resources',related_terms:['JD-R','שחיקה בעבודה','עומס בעבודה','workload','burnout'],source_ids:['BG-SRC-002']},
  {concept_id:'EDU',label_he:'רציפות חינוכית',label_en:'educational continuity',related_terms:['חינוך בחירום','education in emergencies','school continuity'],domain:'educational_continuity'},
  {concept_id:'DEBRIEF',label_he:'תחקיר',label_en:'debrief',related_terms:['תחקירים','debriefing','after action review'],source_ids:['BG-EXT-SRC-006']},
  {concept_id:'WEAK',label_he:'קשרים חלשים',label_en:'weak ties',related_terms:['weak tie'],source_ids:['BG-SRC-008']},
  {concept_id:'COMB',label_he:'שינוי התנהגות',label_en:'behavior change',related_terms:['behaviour change','COM-B','גלגל שינוי ההתנהגות'],source_ids:['BG-SRC-011']},
  {concept_id:'IMPL',label_he:'כוונות יישום',label_en:'implementation intentions',related_terms:['if then plans','תוכניות אם אז'],source_ids:['BG-SRC-007']},
  {concept_id:'READY',label_he:'מוכנות לשינוי',label_en:'readiness for change',related_terms:['מוכנות ארגונית','organizational readiness'],source_ids:['BG-SRC-018']},
  {concept_id:'AI',label_he:'בינה מלאכותית',label_en:'artificial intelligence',related_terms:['generative AI','AI governance','ממשל AI'],source_ids:['BG-SRC-009','BG-SRC-017','BG-SRC-019']},
  {concept_id:'EMP-SEARCH',label_he:'אמפתיה',label_en:'empathy',related_terms:['double empathy','אמפתיה כפולה','perspective getting'],source_ids:['BG-EXT-SRC-002','BG-EXT-SRC-009']},
  {concept_id:'FAIR',label_he:'צדק ארגוני',label_en:'organizational justice',related_terms:['הוגנות','fairness'],source_ids:['BG-SRC-003']}
];
const AUTHOR_ALIASES=[{he:'אייל לוין',en:'Eyal Lewin',source_ids:['BG-EXT-SRC-001','BG-EXT-SRC-008']}];

export function typeGroup(source) {
  const type=source.source_type_he||source.publication_type||'';
  if(/תקן|standard/i.test(type))return 'standard';
  if(/ספר|book/i.test(type))return 'book';
  if(/סקירה|מטא.אנליזה|review|meta.analysis/i.test(type))return 'review';
  if(/מחקר|ניסוי|ניסויים|empirical|experiment/i.test(type))return 'empirical';
  if(/מושגי|תיאורטי|תיאוריה|conceptual|theor/i.test(type))return 'theory';
  if(/דוח|דו״ח|דו"ח|report/i.test(type))return 'report';
  return 'other';
}
export function readingScopeGroup(source) {
  const value=source.verification?.inspected_scope||'';
  if(value==='website_snapshot_metadata_only')return 'snapshot';
  if(/metadata_only|edition_metadata|^metadata$/.test(value))return 'metadata';
  if(/sections|introduction|results_and_discussion|selected_text|selected_reporting_items|abstract_and_opening|abstract_plus/.test(value))return 'sections';
  if(/abstract/.test(value))return 'abstract';
  return 'overview';
}

function buildIndex(sources) {
  if(cache.has(sources)) return cache.get(sources);
  const documents=sources.map(source=>{
    const title=normalizeText([source.title_he,source.title_en].join(' '));
    const citation=normalizeText([source.apa,source.authors_display,source.year,source.source_id,source.canonical_identifier].join(' '));
    const summary=normalizeText([source.summary_he,source.summary_en].join(' '));
    const tags=normalizeText((source.tags||[]).join(' '));
    const text=[title,citation,summary,tags].join(' ');
    return {source,title,citation,summary,tags,text,words:[...new Set(words(text))],fuzzyWords:[...new Set(words(title+' '+citation+' '+tags))]};
  });
  const frequency=new Map();
  for(const d of documents)for(const w of d.words)frequency.set(w,(frequency.get(w)||0)+1);
  const index={documents,frequency}; cache.set(sources,index);return index;
}

function editDistanceOneOrTwo(a,b,max) {
  if(Math.abs(a.length-b.length)>max)return max+1;
  let prev=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++) {
    const row=[i];
    for(let j=1;j<=b.length;j++)row[j]=Math.min(row[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
    if(Math.min(...row)>max)return max+1;
    prev=row;
  }
  return prev[b.length];
}
function matchesFilters(source,o) {
  if(!o.includeMetadata&&source.default_search_eligible===false)return false;
  const view={education:'educational',organization:'organizational',educational:'educational',organizational:'organizational'}[o.view];
  if(view&&!(source.context_views||[]).includes(view))return false;
  if(o.domain&&!(source.training_domains||[]).includes(o.domain))return false;
  if(o.model&&!(source.model_ids||[]).includes(o.model))return false;
  if(o.exercise&&!(source.exercise_ids||[]).includes(o.exercise))return false;
  if(o.type&&typeGroup(source)!==o.type&&source.source_type_he!==o.type)return false;
  if(o.scope&&readingScopeGroup(source)!==o.scope&&source.verification?.inspected_scope!==o.scope)return false;
  const from=Number(o.yearFrom),to=Number(o.yearTo);
  if(o.yearFrom!==undefined&&o.yearFrom!==''&&(!Number.isFinite(source.year)||source.year<from))return false;
  if(o.yearTo!==undefined&&o.yearTo!==''&&(!Number.isFinite(source.year)||source.year>to))return false;
  return true;
}

export function searchSources(sources,vocabulary={},options={}) {
  const o={query:'',mode:'expanded',view:'combined',includeMetadata:false,sort:'relevance',...options};
  const query=normalizeText(o.query), queryWords=[...new Set(words(o.query))];
  const index=buildIndex(sources);
  const concepts=o.mode==='keyword'?[]:[...(vocabulary?.concepts||[]),...EXTRA].filter(c=>[c.label_he,c.label_en,...(c.related_terms||[])].some(term=>termFound(query,term)));
  const authors=AUTHOR_ALIASES.filter(a=>termFound(query,a.he)||termFound(query,a.en));
  // The supplied vocabulary explicitly distinguishes these two authors. Topic words cannot override an explicit conflicting name.
  const conflictingLewin=(termFound(query,'Kurt Lewin')||termFound(query,'קורט לוין'))&&!authors.length;
  const exactIdentifier=String(o.query).trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,'').toLowerCase();
  const results=[];
  for(const d of index.documents) {
    const s=d.source;if(!matchesFilters(s,o))continue;
    if(conflictingLewin&&AUTHOR_ALIASES[0].source_ids.includes(s.source_id))continue;
    let score=0;const reasons=[];
    if(!query){results.push({source:s,score:0,reasons});continue;}
    const doi=String(s.canonical_identifier||'').replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,'').toLowerCase();
    if(exactIdentifier&&doi===exactIdentifier){score+=300;reasons.push(reason('identifier','התאמה מדויקת למזהה','Exact identifier match'));}
    if(query===normalizeText(s.source_id)){score+=300;reasons.push(reason('identifier','התאמה מדויקת למזהה מקור','Exact source ID match'));}
    if(query.length>2&&(d.title===query||normalizeText(s.title_en)===query||normalizeText(s.title_he)===query)){score+=160;reasons.push(reason('title','התאמה לכותרת','Title match'));}
    else if(query.length>3&&(' '+d.title+' ').includes(' '+query+' ')){score+=70;reasons.push(reason('title','מילים בכותרת','Words in title'));}
    const matched=queryWords.filter(q=>d.words.some(w=>sameWord(q,w)));
    const coverage=queryWords.length?matched.length/queryWords.length:0;
    // Require enough of a question to match; a common incidental word must not invent an answer.
    const minimum=queryWords.length<=2?1:0.5;
    if(matched.length&&coverage>=minimum) {
      for(const q of matched) {
        const df=index.frequency.get(q)||1;
        const weight=1+Math.log(1+sources.length/df);
        score+=weight*(termFound(d.title,q)?7:termFound(d.tags,q)?5:termFound(d.citation,q)?4:2);
      }
      score+=coverage*16;
      reasons.push(reason('keyword','התאמת מילות חיפוש','Search words match'));
    }
    for(const c of concepts)if((c.source_ids||[]).includes(s.source_id)||(c.domain&&(s.training_domains||[]).includes(c.domain))) {
      score+=55;
      reasons.push(reason('concept','מושג קשור: '+c.label_he,'Related concept: '+c.label_en,c.concept_id));
    }
    for(const a of authors)if(a.source_ids.includes(s.source_id)) {
      score+=65;reasons.push(reason('author','שם מחבר: '+a.he,'Author name: '+a.en));
    }
    if(!score&&o.mode!=='keyword'&&queryWords.length===1&&queryWords[0].length>=5) {
      const q=queryWords[0], max=q.length>=10?2:1;
      if(d.fuzzyWords.some(w=>w.length>=5&&editDistanceOneOrTwo(q,w,max)<=max)) {
        score=9;reasons.push(reason('spelling','כתיב קרוב למילת חיפוש','Nearby spelling match'));
      }
    }
    if(score>0)results.push({source:s,score:Number(score.toFixed(3)),reasons});
  }
  results.sort((a,b)=>{
    if(o.sort==='newest')return (b.source.year??-Infinity)-(a.source.year??-Infinity)||a.source.source_id.localeCompare(b.source.source_id);
    if(o.sort==='oldest')return (a.source.year??Infinity)-(b.source.year??Infinity)||a.source.source_id.localeCompare(b.source.source_id);
    if(o.sort==='title')return String(a.source.title_he||a.source.title_en).localeCompare(String(b.source.title_he||b.source.title_en),'he')||a.source.source_id.localeCompare(b.source.source_id);
    return b.score-a.score||a.source.source_id.localeCompare(b.source.source_id);
  });
  return results;
}

export function safeSourceUrl(value) {
  if(typeof value!=='string')return null;
  try {
    const url=new URL(value);
    if(!['https:','http:'].includes(url.protocol)||url.username||url.password)return null;
    return url.href;
  } catch{return null;}
}
export function resolveSource(sources,hashOrId) {
  let id=String(hashOrId||'').replace(/^#/,'');
  try{id=decodeURIComponent(id);}catch{return null;}
  return sources.find(s=>s.source_id===id||(s.educational_aliases||[]).some(a=>String(a.legacy_id)===id||a.namespace+':'+a.legacy_id===id))||null;
}
