## Agent-Native Architecture Review

### Summary
Begood uses bounded AI calls to propose educational drafts, consultations and revisions within a shared user workspace. This incremental review examined the changed Studio wire preparation, model authorization, participation demo context and new continuity/family/routines prompts. Human selection and approval remain deliberately human-owned. One new revision path omits decisions already recorded by the user.

### Capability Map

| UI Action | Location | Agent Interface | Runtime Context | Priority | Status |
|-----------|----------|-----------------|-----------------|----------|--------|
| Analyze, generate, adapt and consult | `harness/lib/studio.mjs:296` | Native Responses with strict schemas | Brief, public sources, authorized mapping, previous draft or consultation history | Must have | Present |
| Review and repair Studio kit | `harness/lib/studio.mjs:411` | Bounded native continuation | Brief and draft; repair receives original input and critique | Must have | Present |
| Suggest participation routes and adjustments | `app/lib/participation-ui.js:85` | Authenticated JSON completion | Activity goals, selected routes and observations; isolated demo memory | Must have | Present |
| Generate joining/return kit | `app/lib/continuity-kit-ui.js:422` | Authenticated JSON completion | Continuity form, joining facts and existing group information | Should have | Present |
| Propose family follow-up | `app/lib/family-bridge-ui.js:348` | Authenticated JSON completion | Teacher story, family response and chosen support route | Must have | Present |
| Generate routines agreement | `app/lib/routines-ui.js:219` | Authenticated JSON completion | Form and explicitly selected action | Must have | Present |
| Revise routines agreement | `app/lib/routines-ui.js:414` | Authenticated JSON completion | Current agreement, observations and requests; recorded responses omitted | Must have | Context gap |

### Findings

#### Critical (Must Fix)
None.

#### Warnings (Should Fix)
1. **[P2] Include recorded decisions in routines revision context** — `app/lib/routines-ui.js:421` — After recording that a change request was rejected or adapted, a user can request another proposal, but the model receives only the original request. It cannot distinguish an unresolved request from a decision already made by the group or teacher, so it can propose the rejected change again or replace the agreed adaptation. The proposal remains subject to approval, but the regenerated advice loses a material part of the user's workspace.

   Evidence:

   - `app/lib/routines-ui.js:421`: `const reqs = allRequests().map((x, i) => (i + 1) + '. ' + (x.q.role ? x.q.role + ' מבקש/ת: ' : '') + x.q.what + (x.q.why ? ' (כי ' + x.q.why + ')' : '')).join('\n');`
   - `app/lib/routines-ui.js:324`: `const ai = I.ansAI[i] || {}, dec = I.decided[x.id] || (I.decided[x.id] = { status: '', note: '' });`
   - `app/lib/routines-ui.js:325` exposes editable decision status and note, while the revision call at lines 427–428 includes only `plan`, `log` and `reqs`. Neither the decision status/note nor the decision journal is serialized into that input.

   Suggested fix: Add each request's `I.decided[x.id].status` and `.note` to the existing request context, pass relevant decision-journal entries through the existing anonymization step, and instruct the revision prompt to preserve recorded human decisions unless the user explicitly asks to reconsider them. Keep all approvals human-owned.

   Calibration: confidence **75**; directly changed new file; pre-existing **false**; autofix class **gated_auto**; owner **downstream-resolver**; requires verification **true**. Verify with a synthetic captured revision request containing one rejected and one adapted request, checking that both decisions and their notes reach the model without participant names.

#### Observations
None.

### What's Working Well

- Studio prepares authenticated, normalized runtime context once before reserving the actual native request.
- Continuations retain the original source/context bank for repairs and pass through current authorization checks.
- Withdrawn manuscripts remain excluded from the public source bank and the model context.
- AI drafts and editable human artifacts share the same workspace; the educational prompts explicitly reserve decisions and approval for people.
- Participation demo state starts in fresh memory for each mount, preserving the ordinary user's storage boundary.

### Verification and Limits
Read-only source and test inspection only; no browser, live provider, production database or test execution. The routines tests verify prompt vocabulary, sources, parsing and the anonymization helper, but do not capture revision requests after human decisions are entered. No broader agent-tool retrofit or unrelated pre-existing parity audit was performed.

### Score
- **7/7 reviewed proposal capabilities have an AI interface; 6/7 carry the material inspected runtime context.**
- **Verdict: NEEDS WORK** — one bounded context-parity fix.
