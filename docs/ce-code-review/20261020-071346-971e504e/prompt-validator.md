# Validator Batch Prompt Template

Use one fresh validator subagent for one batch of already-merged findings. Eight findings is the normal cap. When more than eight P0/P1 findings survive, expand that same batch to include every surviving P0/P1; never omit a blocker or split the work into another batch. The validator is independent of the originating reviewers and the orchestrator. Fill `C:/Users/yaels/Documents/Codex/2026-10-13/files-pasted-by-the-user-codex/work/research-partnerships/docs/ce-code-review/20261020-071346-971e504e` with the review's run directory; the orchestrator waits on the verdicts file there, so the file, not the in-band return, is the contract.

```
You are the independent validation gate for the code-review findings below. Evaluate every finding separately under fresh inspection and under the shared protected-subject policy below. Outside a protected subject, false positives are common; reject a finding when the cited code does not prove it, it predates and is unaffected by this diff, surrounding code handles it, or it is only an unsupported preference. Inside a protected subject, a rejection requires one of the evidence forms the policy names.

Do not let one finding's outcome influence another. Do not invent new findings.

<findings-to-validate>
[
  {
    "#": 1,
    "autofix_class": "manual",
    "confidence": 100,
    "evidence": [
      "app/lib/research-intake-ui.js:122 --       const studies=bootstrap.studies||[],study=D.field(approval,'מחקר לאישור','select',saved?.studyId||'',{choices:{'':'בחירת מחקר',...Object.fromEntries(studies.map(s=>[s.id,s.title||s.config?.title||'מחקר']))}}),identity=D.field(approval,'זהות אישית מאומתת','select',saved?.individualCode||'',{choices:{'':'בחירת קוד אישי',...Object.fromEntries((ownerInfo.identities||[]).map(i=>[i.code,i.label+' · '+i.institution]))}}),verified=D.field(approval,'וידוא זהות הפונה הושלם','checkbox',saved?.verified===true);",
      "app/lib/research-partnership-ui.js:25,37 -- load assigns bootstrap from request('workspaceBootstrap'); openIntake passes that bootstrap directly to IUI.mountOwner.",
      "harness/migrations/20261018-research-partnerships.sql:248,251-258,263 -- studies is appended only inside the partnership_partners loop and the study membership/record/document/invitation/snapshot predicate.",
      "Executed the actual in-memory database fixture: createdStudy=646221a5-6531-40c4-97a8-3652aaf80bb1; partnershipStudyIds=[]; generalStudyIds=[646221a5-6531-40c4-97a8-3652aaf80bb1].",
      "app/lib/research-partnership-ui.js:37 --     async function openIntake(view,saved){if(!bootstrap?.owner)return;workspace=null;editor=null;intakePage=IUI.mountOwner({document,root,client,bootstrap,onBack:()=>load()});if(saved)await intakePage.restore(saved);else await intakePage[view]();}",
      "app/lib/research-partnership-ui.js:25 sets bootstrap from workspaceBootstrap; app/lib/research-intake-ui.js:122 builds every approval study option from bootstrap.studies.",
      "harness/migrations/20261018-research-partnerships.sql:248-264 appends studies only inside the existing-partner loop and only for memberships or partner records/documents/invitations/snapshots.",
      "Read-only PGlite reproduction using the frozen implementation: studyCreate created study 4d7c85bc-61f6-40e3-ab4c-5f48358f487d at revision 0; workspaceBootstrap immediately returned studies: [].",
      "harness/migrations/20261013-research-management.sql:132-139 implements the ordinary bootstrap over all owner-visible studies, including this first study without partners."
    ],
    "file": "app/lib/research-intake-ui.js",
    "first_evidence": "app/lib/research-intake-ui.js:122 --       const studies=bootstrap.studies||[],study=D.field(approval,'מחקר לאישור','select',saved?.studyId||'',{choices:{'':'בחירת מחקר',...Object.fromEntries(studies.map(s=>[s.id,s.title||s.config?.title||'מחקר']))}}),identity=D.field(approval,'זהות אישית מאומתת','select',saved?.individualCode||'',{choices:{'':'בחירת קוד אישי',...Object.fromEntries((ownerInfo.identities||[]).map(i=>[i.code,i.label+' · '+i.institution]))}}),verified=D.field(approval,'וידוא זהות הפונה הושלם','checkbox',saved?.verified===true);",
    "independent_reviewers": [
      "correctness",
      "adversarial"
    ],
    "line": 122,
    "owner": "downstream-resolver",
    "pre_existing": false,
    "requires_verification": true,
    "reviewers": [
      "correctness",
      "adversarial"
    ],
    "severity": "P2",
    "suggested_fix": "In the owner intake initialization, fetch the authenticated general bootstrap and use its complete studies array for the approval selector instead of workspaceBootstrap.studies; preserve the existing server-side study authorization and CAS checks.",
    "title": "Populate approval choices from the complete owner study list",
    "why_it_matters": "An owner cannot approve an incoming applicant into an existing study that has no partnership yet: the study selector is empty even though the ordinary research dashboard lists that study. This screen receives workspaceBootstrap.studies, which is built only inside the existing-partner/workspace loops, rather than the owner's complete study list. I reproduced an ordinary studyCreate followed by workspaceBootstrap returning studies: [] while bootstrap returned that study; loading the general owner bootstrap for the selector makes the promised existing-study path available."
  },
  {
    "#": 2,
    "autofix_class": "gated_auto",
    "confidence": 100,
    "evidence": [
      "app/lib/research-intake-ui.js:129 --       approval.append(D.button('אישור הבקשה וההרשאות שנבחרו',async()=>{if(!study.value||!identity.value||!verified.checked||!rights.values().includes('view_study')){note('להשלמת האישור אפשר לבחור מחקר, זהות אישית שנבדקה והרשאת צפייה במחקר, ולסמן את וידוא הזהות.',true);return;}let selected=(bootstrap.studies||[]).find(s=>s.id===study.value);if(!Number.isSafeInteger(selected?.revision)){const fresh=await call('studyGet',{studyId:study.value});if(!fresh)return;selected=fresh.study;}await review('approved',{studyId:study.value,studyExpectedRevision:selected.revision,individualCode:identity.value,permissions:rights.values()});}));",
      "app/lib/research-intake-ui.js:126 -- created.study is appended directly to bootstrap.studies; line 119 returns to inbox after approval without updating this cached study.",
      "harness/migrations/20261020-partnership-intake.sql:125 -- approval calls memberSet using studyExpectedRevision; harness/migrations/20261013-research-management.sql:289 -- s:=research_private.bump(sid).",
      "Executed the actual in-memory database fixture: createdRevision=0, approvedRevision=1, secondApprovalUsingCachedRevision={error:conflict,status:409}."
    ],
    "file": "app/lib/research-intake-ui.js",
    "first_evidence": "app/lib/research-intake-ui.js:129 --       approval.append(D.button('אישור הבקשה וההרשאות שנבחרו',async()=>{if(!study.value||!identity.value||!verified.checked||!rights.values().includes('view_study')){note('להשלמת האישור אפשר לבחור מחקר, זהות אישית שנבדקה והרשאת צפייה במחקר, ולסמן את וידוא הזהות.',true);return;}let selected=(bootstrap.studies||[]).find(s=>s.id===study.value);if(!Number.isSafeInteger(selected?.revision)){const fresh=await call('studyGet',{studyId:study.value});if(!fresh)return;selected=fresh.study;}await review('approved',{studyId:study.value,studyExpectedRevision:selected.revision,individualCode:identity.value,permissions:rights.values()});}));",
    "independent_reviewers": [
      "correctness"
    ],
    "line": 129,
    "owner": "downstream-resolver",
    "pre_existing": false,
    "requires_verification": true,
    "reviewers": [
      "correctness"
    ],
    "severity": "P2",
    "suggested_fix": "Always call studyGet for the selected study immediately before constructing the approval payload and use fresh.study.revision, rather than refreshing only when the cached revision is missing.",
    "title": "Refresh a created study revision before each approval",
    "why_it_matters": "After the owner creates a draft study from one application and approves it, approving another applicant into that same study fails with conflict until the intake page is reloaded. The locally appended created.study retains revision 0, the first memberSet increments the real study to revision 1, and the approval handler deliberately skips studyGet because the cached revision is an integer. Reading the current study immediately before every approval prevents this self-created stale revision while preserving genuine concurrent-edit conflicts."
  },
  {
    "#": 3,
    "autofix_class": "gated_auto",
    "confidence": 100,
    "evidence": [
      "app/lib/research-intake-ui.js:25 --         const response=await fetchImpl(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),credentials:'omit',cache:'no-store'}),data=await response.json();",
      "app/lib/research-intake-ui.js:84 -- const at=epoch;submitting=true;",
      "app/lib/research-intake-ui.js:85 -- try{const result=await client.call('intakeSubmit',{termsVersionId:info.terms.versionId,termsHash:info.terms.hash,acknowledged:true,application});if(at!==epoch)return;receipt=result.receipt;draft={};render();}"
    ],
    "file": "app/lib/research-intake-ui.js",
    "first_evidence": "app/lib/research-intake-ui.js:25 --         const response=await fetchImpl(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),credentials:'omit',cache:'no-store'}),data=await response.json();",
    "independent_reviewers": [
      "reliability"
    ],
    "line": 25,
    "owner": "downstream-resolver",
    "pre_existing": false,
    "requires_verification": true,
    "reviewers": [
      "reliability"
    ],
    "severity": "P2",
    "suggested_fix": "Add a finite AbortController deadline to createPublicClient.call, clear its timer in finally, and retain pending.requestId on timeout; test that an unresolved fetch returns a network error and a retry reuses the same request ID.",
    "title": "Time out a stalled public submission",
    "why_it_matters": "If the browser connection stalls without a response, the public form remains in its submitting state and its button stays disabled indefinitely. The user cannot retry the uncertain submission without reloading, which discards the in-memory request ID and can create a second application if the first one committed. A client deadline lets the current page surface the network error and retry with the preserved request ID."
  },
  {
    "#": 4,
    "autofix_class": "manual",
    "confidence": 100,
    "evidence": [
      "app/lib/research-intake-ui.js:77 --       try{const data=await client.call('intakePublicInfo');if(at!==epoch)return;info=data;const changed=Boolean(previous&&(previous.versionId!==info.terms?.versionId||previous.hash!==info.terms?.hash));render(changed,readAcknowledged);}catch(e){if(at===epoch)note(e.userMessage||R.MESSAGES.network,true);}",
      "app/lib/research-intake-ui.js:76 --       read();const previous=info?.terms,readAcknowledged=ack?.checked===true,at=++epoch;",
      "app/lib/research-intake-ui.js:54,61,69 -- render replaces all children and initializes the new inputs from draft; the browser entry point invokes load on every window focus.",
      "Executed mountPublic with the existing test DOM pattern and a delayed intakePublicInfo response: an edit made after load started was replaced with the pre-request title.",
      "app/lib/research-intake-ui.js:77 awaits intakePublicInfo and then calls render(changed,readAcknowledged); lines 53-54 replace the form and clear its references, and line 71 restores the pre-request checkbox state when terms are unchanged.",
      "app/lib/research-intake-ui.js:3 invokes load on window focus and persisted pageshow, making the pending-refresh editing window reachable during ordinary use.",
      "In-memory reproduction evaluating the exact 44eca17 JavaScript: start refresh with title 'Earlier title' and acknowledgement checked; type 'Later title typed while refreshing' and uncheck acknowledgement; resolve the refresh with unchanged terms. Observed result: {\"titleAfterRefresh\":\"Earlier title\",\"acknowledgedAfterRefresh\":true}.",
      "app/lib/research-intake-ui.js:77 -- try{const data=await client.call('intakePublicInfo');if(at!==epoch)return;info=data;const changed=Boolean(previous&&(previous.versionId!==info.terms?.versionId||previous.hash!==info.terms?.hash));render(changed,readAcknowledged);}catch(e){if(at===epoch)note(e.userMessage||R.MESSAGES.network,true);}",
      "app/lib/research-intake-ui.js:76 -- read();const previous=info?.terms,readAcknowledged=ack?.checked===true,at=++epoch;",
      "app/lib/research-intake-ui.js:2 -- else{root.SBE_RESEARCH_INTAKE_UI=factory(root.SBE_RESEARCH_INTAKE,root.SBE_RESEARCH_PARTNERSHIPS,root.SBE_RESEARCH_CLIENT);document.addEventListener('DOMContentLoaded',()=>{const target=document.getElementById('intake-root');if(!target)return;const page=root.SBE_RESEARCH_INTAKE_UI.mountPublic({root:target});page.load();window.addEventListener('focus',()=>page.load());window.addEventListener('pageshow',event=>{if(event.persisted)page.load();});});}"
    ],
    "file": "app/lib/research-intake-ui.js",
    "first_evidence": "app/lib/research-intake-ui.js:77 --       try{const data=await client.call('intakePublicInfo');if(at!==epoch)return;info=data;const changed=Boolean(previous&&(previous.versionId!==info.terms?.versionId||previous.hash!==info.terms?.hash));render(changed,readAcknowledged);}catch(e){if(at===epoch)note(e.userMessage||R.MESSAGES.network,true);}",
    "independent_reviewers": [
      "correctness",
      "adversarial",
      "julik-frontend-races"
    ],
    "line": 77,
    "owner": "downstream-resolver",
    "pre_existing": false,
    "requires_verification": true,
    "reviewers": [
      "correctness",
      "adversarial",
      "julik-frontend-races"
    ],
    "severity": "P2",
    "suggested_fix": "After intakePublicInfo resolves and the epoch is verified, read the still-live form and current acknowledgement again before rebuilding it; reset acknowledgement only when the exact terms version/hash changed. Alternatively avoid replacing the form at all for unchanged terms.",
    "title": "Preserve current edits and acknowledgement during terms refresh",
    "why_it_matters": "Returning to the public tab can silently erase text entered while its terms request is pending and recheck an acknowledgement the applicant deliberately unchecked during that request. load snapshots the controls before awaiting the network, then rebuilds the form using those earlier values even when the exact terms have not changed. The reviewers reproduced both lost text and restored acknowledgement using the committed implementation. Read the current controls after the response or keep the existing controls when no rebuild is needed, while still clearing acknowledgement for changed terms."
  },
  {
    "#": 5,
    "autofix_class": "manual",
    "confidence": 100,
    "evidence": [
      "harness/migrations/20261020-partnership-intake.sql:122 --    IF d.revision<>(p_payload->>'expectedRevision')::integer OR d.status NOT IN ('submitted','under_review') OR d.status=p_payload->>'decision' THEN PERFORM research_private.fail('conflict');END IF;",
      "harness/migrations/20261020-partnership-intake.sql:122 --     IF d.revision<>(p_payload->>'expectedRevision')::integer OR d.status NOT IN ('submitted','under_review') OR d.status=p_payload->>'decision' THEN PERFORM research_private.fail('conflict');END IF;",
      "app/lib/research-intake-ui.js:118,120 -- only approved/rejected return before the UI unconditionally renders D.button('שמירה בבדיקה',()=>review('under_review'),'r-secondary').",
      "harness/migrations/20261020-partnership-intake.sql:135-136 -- accepted decisions increment revision and append an immutable intake_reviews entry containing the note.",
      "Executed the actual in-memory database fixture: the first under_review note succeeded at revision 1; a second under_review save using expectedRevision 1 and a different note returned {error:conflict,status:409}.",
      "app/lib/research-intake-ui.js:117 initializes an editable notes field from the latest note; line 118 exits only for approved/rejected; lines 119-120 keep sending decision under_review from the save-in-review button for an already-under-review application.",
      "Read-only PGlite reproduction using the frozen implementation: a first intakeReview with expectedRevision 0, decision under_review and 'First note' succeeds; a second request with the returned revision 1, decision under_review and 'Second note' returns {\"error\":\"conflict\",\"status\":409}.",
      "harness/migrations/20261020-partnership-intake.sql:135-136 already increments revision and appends intake_reviews for accepted review events, providing the history-preserving path for this save."
    ],
    "file": "harness/migrations/20261020-partnership-intake.sql",
    "first_evidence": "harness/migrations/20261020-partnership-intake.sql:122 --    IF d.revision<>(p_payload->>'expectedRevision')::integer OR d.status NOT IN ('submitted','under_review') OR d.status=p_payload->>'decision' THEN PERFORM research_private.fail('conflict');END IF;",
    "independent_reviewers": [
      "correctness",
      "adversarial"
    ],
    "line": 122,
    "owner": "downstream-resolver",
    "pre_existing": false,
    "requires_verification": true,
    "reviewers": [
      "correctness",
      "adversarial"
    ],
    "severity": "P2",
    "suggested_fix": "Remove the same-status rejection for an under_review application while retaining expectedRevision and the submitted/under_review terminal-state guard, so saving another review note increments the revision and appends an immutable review event.",
    "title": "Allow saving notes on an application already under review",
    "why_it_matters": "Once an owner marks an application under review, the still-visible 'שמירה בבדיקה' button can no longer save any further review note: every click returns conflict despite a correct current revision. The UI offers that action for both submitted and under_review applications, but SQL rejects the latter solely because its status already equals the requested decision. Letting the CAS-protected under_review save append a new immutable review entry supports the displayed action without changing grants or permitting edits to a final decision."
  },
  {
    "#": 6,
    "autofix_class": "gated_auto",
    "confidence": 75,
    "evidence": [
      "app/lib/research-intake-ui.js:111 --     async function detail(id,saved){if(!await ready())return;const result=await call('intakeGet',{applicationId:id});if(!result)return;route='detail';applicationId=id;const application=result.application,data=application.application||application.data||{},box=heading(data.title||'פרטי הפנייה');",
      "app/lib/research-intake-ui.js:111 -- const result=await call('intakeGet',{applicationId:id});if(!result)return;route='detail';applicationId=id;const application=result.application,data=application.application||application.data||{},box=heading(data.title||'פרטי הפנייה');",
      "app/lib/research-intake-ui.js:96 -- async function call(action,payload={}){const at=epoch;try{const data=await client.call(action,payload);return at===epoch?data:null;}catch(e){if(e.code!=='stale'&&at===epoch)note(e.userMessage||R.MESSAGES[e.code]||R.MESSAGES.invalid,true);return null;}",
      "app/lib/research-intake-ui.js:99 -- async function terms(saved){if(!await ready())return;route='terms';applicationId=null;const state=ownerInfo.termsState||{revision:0,draftVersion:null,publishedVersionId:null},version=state.draftVersion,seed=saved||version||I.DEFAULT_TERMS_DRAFT,box=heading('תנאי פנייה');"
    ],
    "file": "app/lib/research-intake-ui.js",
    "first_evidence": "app/lib/research-intake-ui.js:111 --     async function detail(id,saved){if(!await ready())return;const result=await call('intakeGet',{applicationId:id});if(!result)return;route='detail';applicationId=id;const application=result.application,data=application.application||application.data||{},box=heading(data.title||'פרטי הפנייה');",
    "independent_reviewers": [
      "julik-frontend-races"
    ],
    "line": 111,
    "owner": "downstream-resolver",
    "pre_existing": false,
    "requires_verification": true,
    "reviewers": [
      "julik-frontend-races"
    ],
    "severity": "P2",
    "suggested_fix": "Increment a separate owner-view sequence at the start of inbox(), terms(), and detail(); capture it locally and check it after every awaited bootstrap or view request before changing route or replacing root. Include a deferred intakeGet response test that navigates to terms first and verifies terms remain visible.",
    "title": "Late application detail response replaces a newer owner view",
    "why_it_matters": "An owner who opens an application and switches to the terms page before the detail request returns is sent back to that application when the late response arrives. The request guard only tracks clear or account refresh, while navigating between owner intake views leaves its epoch unchanged. A navigation sequence check before rendering would make the latest selected view win."
  },
  {
    "#": 8,
    "autofix_class": "gated_auto",
    "confidence": 75,
    "evidence": [
      "harness/practice-server.mjs:200 --       const [status, out] = await handleIntake(jobStore(), supabaseResearchStore(url, key), body, { clientAddress: req.socket.remoteAddress });",
      "harness/practice-server.mjs:200 -- const [status, out] = await handleIntake(jobStore(), supabaseResearchStore(url, key), body, { clientAddress: req.socket.remoteAddress });",
      "harness/practice-server.mjs:171 -- const jobStore = () => authStore || ((process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) ? supabaseStore(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY) : null);",
      "harness/lib/access.mjs:1770 -- const request = (target, options) => fetchImpl(target, timeoutMs === undefined ? options : { ...options, signal: AbortSignal.timeout(timeoutMs) });",
      "harness/lib/research-intake.mjs:35 -- const secret = (await accessStore?.get?.('token-secret'))?.secret;"
    ],
    "file": "harness/practice-server.mjs",
    "first_evidence": "harness/practice-server.mjs:200 --       const [status, out] = await handleIntake(jobStore(), supabaseResearchStore(url, key), body, { clientAddress: req.socket.remoteAddress });",
    "independent_reviewers": [
      "reliability"
    ],
    "line": 200,
    "owner": "downstream-resolver",
    "pre_existing": false,
    "requires_verification": true,
    "reviewers": [
      "reliability"
    ],
    "severity": "P2",
    "suggested_fix": "Pass a dedicated supabaseStore(url, key, { timeoutMs: 8000 }) to handleIntake in the new route, and keep injected authStore behavior bounded by the same intake deadline; verify a stalled access-store fetch returns unavailable within that deadline.",
    "title": "Bound the new intake access-store calls",
    "why_it_matters": "A slow or unresponsive access-settings request can leave each public submission open before it reaches the SQL RPC, because the new route passes an access store whose Supabase fetch has no timeout. Concurrent submissions then retain server connections and callers receive no result, even though the research RPC itself has an eight-second limit. Give the intake access store a bounded timeout so these requests fail with the existing unavailable response and clients can retry using their request ID."
  },
  {
    "#": 11,
    "autofix_class": "gated_auto",
    "confidence": 75,
    "evidence": [
      "app/research-partnership.html:18 -- <body class=\"r-public-intake\">",
      "CLAUDE.md:443 -- **מסך חדש:** מוסיפים ל-`screens-menu.js`, ובודקים שה\"מי רואה\" תואם ל-`app/lib/access-guard.js`.",
      "app/lib/screens-menu.js:20-24 -- the public gateway group lists entry.html, map.html, examples.html, sources-library.html, and system-select.html but omits research-partnership.html; repository search finds no research-partnership entry in this menu."
    ],
    "file": "app/research-partnership.html",
    "first_evidence": "app/research-partnership.html:18 -- <body class=\"r-public-intake\">",
    "independent_reviewers": [
      "project-standards"
    ],
    "line": 18,
    "owner": "downstream-resolver",
    "pre_existing": false,
    "requires_verification": true,
    "reviewers": [
      "project-standards"
    ],
    "severity": "P3",
    "suggested_fix": "Add research-partnership.html to the public gateway group in app/lib/screens-menu.js with who set to everyone, including visitors without sign-in; verify that this agrees with the page’s public access route.",
    "title": "Add the new intake page to the screens menu",
    "why_it_matters": "The owner’s central screen menu omits the new public intake page, so the menu no longer inventories all screens or documents who may view this one. Adding the page with an explicit public audience restores the repository’s documented navigation contract."
  }
]
</findings-to-validate>

<diff>
C:/Users/yaels/Documents/Codex/2026-10-13/files-pasted-by-the-user-codex/work/research-partnerships/docs/ce-code-review/20261020-071346-971e504e/full.diff
</diff>

<scope-context>
Standalone review of committed head 44eca17ae55ba59eaa16b94c71b5f651e1822a4b against ce688a195443917321deac30d773ed39305b6a97. The staged full.diff/files.txt are canonical. Inspect every file and test with git show 44eca17:<path> (or full reviewed SHA) because parent has since added uncommitted test-only reproductions outside this target. Working-tree followup tests do not change the reviewed scope.
Intent: Add a Hebrew public application for individual researchers or institution representatives under owner-published exact conditions. Submission grants no identity or access; private owner review binds a live selected personal code to a study and explicit permissions, atomically imports a draft, and partner folders show each partner's actual current grants across authorized studies. Preserve existing owner authentication, personal-code/current-credential checks, RLS, revocation, consent, released-document rules and immutable signatures; no production, email, paid service, or provider activation.
Constraints: [
  "No independent shipping/commits/source fixes; only read-only review and skill artifacts in its resolved docs_root run directory (config.yaml absent=>docs).",
  "Diff namedbase..HEAD contains ONLY this task (plan+U0-U4+small simplification); don't inspect unrelated historicalbranchchanges as scope.",
  "No productiondeploy/migration/push/emails/paidservice/provideractivation authorized. Use syntheticlocal evidence only, no credentials/secrets/rawrealdata.",
  "No reviewdepthoverride requested; skill choosesdepthfromscope. Final receipt needed beforeparentlocaldelivery.",
  "Approval must assign exactly owner-selected explicit permissions; parent plan clarification: \"plan says atomic approval 'הקצאת הרשאות שנבחרו', 'grants רק הרשאות שנבחרו', frozen intakeReview requires exact permissions list. Root/tests deliberately enforce exact memberSet replacement, never requestedpermissions/automaticunion. Union would retain grants owner didn't select and violate verification#4. Reject automatic-union proposal; a current-grants UX note could be separate optional assessment, not changed authorization.\"",
  "Review target remains committed snapshot44eca17; parent added uncommitted followup tests only in intake-ui/intake-database/security after dispatch. These are validation-followup context, outside staged full.diff/files.txt; source implementation and HEAD remain unchanged. Do not broaden reviewed diff to these followups."
]
</scope-context>

<protected-subject-policy>
Return status "confirmed", "rejected", or "unresolved". Never use lack of disproof as evidence of confirmation.

Set protected_subject to the best-fitting key below, or JSON null when none applies:
- memory-safety: allocation sizes, buffer lengths, index bounds, use-after-free, invalid memory access, or null dereferences.
- concurrency: locks, atomics, data races, ordering, or synchronization whose failure can affect observable behavior.
- data-loss: destructive writes, deletes, truncation, overwrite-in-place, or irreversible migrations and backfills.
- authorization-authentication: identity, permissions, ownership, session/token handling, or privilege boundaries.
- injection: attacker-influenced or untrusted data that can alter SQL, commands, templates, paths, or markup across a trust boundary, including stored input. Text assembly alone is not proof.
- public-contract: an evidenced compatibility concern involving an externally consumed response field, status code, error path, default, message, or published signature. An internal export or intentional contract change alone is not a defect.
- secrets-exposure: hardcoded credentials, API keys, tokens, or private keys in source or configuration; credentials, session tokens, or personal data written to logs, error messages, URLs, or responses; secrets committed to a repository or shipped in a built artifact.
- cryptography: weak or broken algorithms and modes, a fast general-purpose hash used for passwords, static or predictable keys, salts, or IVs, disabled certificate or signature verification, insufficient randomness, or a misused primitive whose failure breaks a security guarantee.

For every subject, confirm only when inspected evidence establishes the issue, the diff introduces or newly exposes it, and surrounding code or applicable runtime guarantees do not prevent it.

A finding that is real in the code may still describe a state that never occurs. For every finding, name the precondition the defect needs (the input, data shape, or ordering) and say what would show it occurs or is reachable: a test, a query against available data, a caller that produces it. When that evidence is in reach with the budget, obtain it; when it is not, confirm on the code alone and state in `reason` that incidence was not measured. Unmeasured incidence does not lower confidence or block confirmation; it is what the reader needs to weigh the severity.

Treat a finding as protected when the actual failure it alleges falls within a subject above. Read its category, title, and body together; keywords only prompt inspection and never establish protection. A naming preference about a token helper is not a token-handling defect. Your classification cannot remove protection established by the claim; the consumer applies this test independently.

On a protected subject, reject only by citing specific evidence that refutes the claim or establishes that it is unrelated pre-existing behavior: quote the file and line number that refutes it, name the version-specific or configuration-specific documentation and the version in force, give short-hash provenance, or cite a discriminating test result. Test evidence must identify the reviewed revision, engine/runtime version, configuration, exercised trigger, assertion, and observed result, and explain why it disproves the exact claim. A general passing suite or a test that did not exercise the alleged trigger is not disproof. An assumed framework guarantee is not evidence. Without one of these evidence forms, return status "unresolved", not "rejected". Inspect existing test evidence or use a read-only reproduction within your authority; do not mutate files or application state to obtain it.

If a protected claim remains uncertain, return status "unresolved" and state the missing evidence. Low confidence alone does not justify rejecting or confirming it.

Outside protected subjects, keep the ordinary conservative evidence bar: after inspection, reject an unsupported claim and explain why. Missing required inspection is different from inspected-but-unsupported evidence. If the cited file or required context cannot be accessed, return status "unresolved" for any subject, state the access limit, and do not guess.

Classify the claim itself, not its title. Never raise severity or confidence to preserve it. Do not invent findings or propose that uncertainty is a confirmed defect.
</protected-subject-policy>

For local-aligned scope, inspect the cited files, callers, guards, project contracts, and targeted history with read-only tools. For pr-remote or branch-remote scope, use the provided diff and reviewed head ref, never the unrelated workspace copy.

Budget: the batch has 15 minutes of wall clock and about five tool calls per finding. Inspect findings in the order given. When the budget runs out, stop inspecting and give every remaining finding `"status": "unresolved"` with the reason `budget exhausted, uninspected`; never guess a verdict you did not inspect.

Write the JSON object below to `C:/Users/yaels/Documents/Codex/2026-10-13/files-pasted-by-the-user-codex/work/research-partnerships/docs/ce-code-review/20261020-071346-971e504e/validator-verdicts.json` before you return, then return the same object:
{
  "verdicts": [
    {
      "#": <input stable number>,
      "status": "confirmed" | "rejected" | "unresolved",
      "protected_subject": "<one of the eight policy keys>" | null,
      "reason": "<one sentence grounded in inspected evidence, or naming the evidence you could not obtain>"
    }
  ]
}

Each entry carries exactly those four fields. Return one verdict for every input # exactly once; unknown, duplicate, or missing numbers and invalid status or subject values are malformed output. Do not emit the legacy `validated` boolean. No prose outside JSON. Writing the verdicts file above is the one permitted write; do not edit project files, commit, push, or otherwise mutate the checkout.
```

