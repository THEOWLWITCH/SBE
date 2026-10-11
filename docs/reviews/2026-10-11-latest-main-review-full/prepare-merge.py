import json, pathlib, re, subprocess, os
RUN = pathlib.Path(__file__).parent
SKILL = pathlib.Path('C:/Users/yaels/.codex/plugins/cache/compound-engineering-plugin/compound-engineering/3.30.4/skills/ce-code-review')
returns = json.loads((RUN/'raw-returns.json').read_text(encoding='utf-8-sig'))
detail = {}
def fingerprint(reviewer, f):
    return json.dumps([reviewer, f['file'].replace('\\','/'), str(f['line']), re.sub(r'\s+', ' ', f['title']).strip().lower()], ensure_ascii=False)
for r in returns:
    artifact = json.loads((RUN/(r['reviewer']+'.json')).read_text(encoding='utf-8-sig'))
    for f in artifact.get('findings',[]):
        detail[fingerprint(r['reviewer'],f)] = f
    for f in r.get('findings',[]):
        source = detail.get(fingerprint(r['reviewer'],f))
        if source: f['evidence'] = source['evidence']
agent = {
 'title':'Include recorded decisions in routines revision context', 'severity':'P2', 'file':'app/lib/routines-ui.js', 'line':422,
 'confidence':75, 'autofix_class':'gated_auto', 'owner':'downstream-resolver', 'requires_verification':True, 'pre_existing':False,
 'suggested_fix':"Add each request's recorded decision status and note, plus the relevant decision journal, to the existing anonymized revision context. Instruct revision to preserve recorded human decisions unless explicitly asked to reconsider them. Keep approval human-owned. Capture a synthetic request with rejected and adapted requests and assert both notes arrive without participant names.",
 'first_evidence':"app/lib/routines-ui.js:422 -- const reqs = allRequests().map((x, i) => (i + 1) + '. ' + (x.q.role ? x.q.role + ' מבקש/ת: ' : '') + x.q.what + (x.q.why ? ' (כי ' + x.q.why + ')' : '')).join('\\n');",
 'why_it_matters':"A revision request omits the rejection or adaptation already recorded for each proposed change, and omits the decision journal. The model cannot distinguish unresolved requests from decisions the team has settled, so subsequent advice can repeat a rejected change or replace an agreed adaptation. Human approval still applies, but the advice loses material workspace context.",
 'evidence':[
  "app/lib/routines-ui.js:422 -- const reqs = allRequests().map((x, i) => (i + 1) + '. ' + (x.q.role ? x.q.role + ' מבקש/ת: ' : '') + x.q.what + (x.q.why ? ' (כי ' + x.q.why + ')' : '')).join('\\n');",
  "app/lib/routines-ui.js:324-325 reads I.decided[x.id] and exposes editable status and note, but :427-428 serializes only form, plan, observations and requests into the anonymized model input.",
  "app/lib/routines-ui.js:330-334 exposes I.log as the decision journal, while :427-428 omits it from the revision request.",
  "Source: agent-native.md, one bounded changed-path context gap; read-only source inspection, no model or browser run. The originally supplied quote line 421 is corrected to canonical line 422."
 ]
}
detail[fingerprint('agent-native',agent)] = agent
returns.append({'reviewer':'agent-native','findings':[agent],'residual_risks':[],'testing_gaps':[]})
(RUN/'source-detail-map.json').write_text(json.dumps(detail,ensure_ascii=False,indent=2),encoding='utf-8')
enriched = RUN/'raw-returns-enriched.json'
enriched.write_text(json.dumps(returns,ensure_ascii=False,indent=2),encoding='utf-8')
with enriched.open('rb') as inp, (RUN/'mechanical-findings.json').open('wb') as out:
    subprocess.run(['python',str(SKILL/'scripts/findings-mechanics.py')],stdin=inp,stdout=out,check=True,env={**os.environ,'PYTHONUTF8':'1'})
result=json.loads((RUN/'mechanical-findings.json').read_text(encoding='utf-8'))
print(json.dumps({'findings':[{'#':f['#'],'title':f['title'],'reviewers':f['reviewers']} for f in result['findings']], 'first_evidence_backfilled':result['first_evidence_backfilled'],'malformed_findings':result['malformed_findings'],'malformed_returns':result['malformed_returns'],'suppressed_by_confidence':result['suppressed_by_confidence']},ensure_ascii=True))
