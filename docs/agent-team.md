# Controlled narrative artifact and reviewer backend

This backend adds private versioned narrative drafts and bounded AI suggestions. It does not publish an activity, send messages, create participant records, or approve a proposal automatically. The team defaults to disabled; `teamEnabled:false` uses the configured single reviewer with `fallback:false`. All verification below uses local fixtures and no paid model or production database calls.

## Boundary and domain contract

`handleArtifacts(store, principal, body, options)` returns `[httpStatus, result]`. The server must resolve a **live** principal before calling it; a body-supplied owner, tenant, role or permission is not authoritative. The module checks the principal's permission and matches both owner and tenant on every artifact read. Other owners and tenants receive 404. Supported planning permissions are the existing `fac_trainee`, `fac_parent`, `fac_youth`, `activity`, `studio`, `resilience`, `leadership`, and `practi`.

The store must implement `get`, `putIfAbsent({key,value})`, and `compareAndSet({key,expected,value})` at its database transaction boundary. Every mutation uses compare-and-set; there is no fallback to a process-local lock or unconditional `set`. `createAtomicMemoryStore` is a test adapter only. Persistent transaction installation and permissions are deployment prerequisites.

This implementation supports `content.kind:'narrative'`. The original `pipelineOutput` and original generation `context` are required. It calls the production `runGates` and derives the renderer scenario with `toScenario`; it does not duplicate the pipeline or renderer schema. A caller cannot supply a different rendered scenario as a second editable truth. Studio/activity/conversation adapters are not implemented by this module.

The content shape is:

```javascript
{
  kind: 'narrative',
  pipelineOutput: /* original valid runPipeline output */,
  context: /* original input, including given/locked/language/skills */,
  purpose: '...',
  resilienceComponents: ['...'],
  individualSkills: ['...'],
  sharedSkills: ['...'],
  facilitatorGuide: '...',
  socialMechanism: '...',
  steps: [{id:'stable-step-id',title:'...',instructions:'...',minutes:5}]
}
```

Explanation fields may be missing or empty in an initial private draft. Approval and accepted model candidates require purpose, resilience components, individual/shared skills, facilitator guide, social mechanism, and at least one valid step. Step IDs must be unique and match `[a-zA-Z0-9_-]{1,80}`. The initial purpose is locked against model changes. Explicit human edits may change it and create a new version.

## API actions

| Action | Required body fields | Result |
|---|---|---|
| `create` | `content`; optional `privateConcerns` | 201 `{artifact}`; private `draft`, version 1 |
| `get` | `artifactId` | 200 `{artifact}` for its owner/tenant |
| `update` | `artifactId`, `expectedVersion`, `content`; optional `privateConcerns` | New private draft version, previous content in history |
| `review` | `artifactId`, `expectedVersion`; recommended `idempotencyKey`; optional `question`, `stepId`, `requestType`, `retry` | `{artifact,review}`; proposals do not replace content |
| `decide` | `artifactId`, `expectedVersion`, `proposalId`, `decision:'accept'` or `'reject'` | Explicit human decision; accept creates a new version |
| `approve` | `artifactId`, `expectedVersion`; `acknowledgeRisks:true` when accepted proposals retain unknowns or risk flags | Explicit human approval of the complete current version |
| `practice` | `artifactId`, exact approved `version` | `{artifactId,version,content,observations}` from the frozen approved snapshot |
| `observe` | `artifactId`, approved `version`, `observation`, `chosenNextStep` | Stores the observation and educator's decision against that version |

`requestType` is `refine`, `question`, or `concern`. A supplied `stepId` must exist in the base version. Review status is `complete`, `partial`, `failed`, `fallback`, `cancelled`, or `lost`; `mode` is `single` or `team`. A partial synthesis includes a machine-added `missing_reviewers:...` risk flag. The server route wraps reviews in its authenticated background job/quota lifecycle; the artifact handler itself does not bill or reserve quota.

`expectedVersion` is the optimistic content version. An old decision cannot overwrite a newer edit or restore a removed step. Reviews may retain their old private candidate after a concurrent edit, with `stale:true`; accepting that candidate returns 409. The content version changes on human update/accept, while proposal/history/approval/observation changes use atomic record compare-and-set. Concurrent conflicting human updates return 409; the caller must retain its rejected edit for reconciliation.

Approval records an exact content snapshot and the approving owner. A later draft edit does not mutate a previously approved snapshot. Practice returns only a version previously approved by the authorized owner. Observations are stored alongside the version actually practised, without modifying its approved content. There is no claim of demonstrated resilience improvement.

## Reviewer and proposal rules

Team mode runs `pedagogy`, `resilience_facilitation`, and `safety_sources` concurrently against one artifact/base version/run. Only the facilitation reviewer receives the separately stored private concern. The synthesis editor receives accepted reviewer changes and provenance, not their private rationale or a direct concern field. Model output remains private to the artifact owner.

The model output is a strict patch proposal:

```javascript
{
  artifactId: '...', baseVersion: 1,
  changes: [{path:'steps/stable-step-id/instructions',value:'...'}],
  rationale: '...', sourceIds: ['server-approved-id'],
  unknowns: [], riskFlags: []
}
```

Allowed paths are purpose, resilience components, individual/shared skills, facilitator guide, social mechanism, the complete step list, the gated pipeline output, and a known step's title/instructions/minutes. Identity, tenant, status, approval, locked context, history, and publication are not editable by the model. Prototype paths and extra contract keys are rejected. Source IDs must come from the separately supplied server-approved catalogue; a user source cannot approve itself. The patched candidate must pass the real domain gate before it becomes a stored proposal and again before human acceptance.

Successful reviewer proposals are stored as they finish, even if another reviewer fails. Retrying the same request with `retry:true` reuses successful reviewers and invokes missing work only. A recovered reviewer may produce a fresh synthesis while preserving the older partial candidate. Reusing an idempotency key with different request content returns 409. Repeating a finished review without `retry` returns its stored result without another provider call.

## Bounds, cancellation and traces

Default limits are four provider calls, 2,400 output tokens per call, a 100,000 conservative token allowance, 45 seconds for the run, and a 64,000-byte input envelope. Server-supplied limits may be lowered; browser payloads do not control these limits. Oversized reviewer input returns `review_input_too_large` before claiming a review run. The aggregate guard remains active, so a large team review with missing usage may still stop with retained private candidates; it never silently removes input or raises the allowance. Shipped educational guidance is covered in single/team fixture tests with synthetic measured usage. All calls use one deadline and an abort signal. A provider that ignores cancellation still cannot commit its late result.

Each running review records an attempt ID, job key and a lease lasting the deadline plus a ten-second persistence allowance. Owner requests reconcile an expired lease or terminal/missing job as lost, preserving prior valid candidates. An explicit retry can reuse the same logical key; a callback from its abandoned attempt cannot append a proposal or finish the new attempt. Owned jobs also record artifact ID, base version and run ID. Approval waits only for live reviews and requires acknowledgment for retained lost/failed/partial outcomes.

The server rechecks the live principal and owned job before every provider call (including adapter retry), after provider completion, and before review checkpoint/proposal writes. Revoked access or cancellation aborts the run and prevents synthesis or late content persistence. Terminal failure bookkeeping may still clear the run lock.

Every reviewer call uses `maxAttempts:1`, so a temporary adapter error cannot secretly double the transport attempts. Before launching any parallel call, the orchestrator reserves its UTF-8 input/system byte counts, output ceiling and 2,048 protocol tokens against the aggregate allowance. Byte counts are a conservative budget estimate, not measured model token usage. When measured usage is available it is recorded separately; missing usage retains the reservation rather than claiming a measured cost of zero. A dollar cost ceiling requires controlled model/pricing configuration outside this local fixture implementation.

`trace.mjs` writes only opaque identity/version links, fixed agent/outcome/error tags, hashes of model/prompt/schema/source versions, numeric latency/usage and gate status. It excludes prompts, replies, concerns, raw provider errors, names and phone numbers. Trace privacy is an explicit allowlist, not deletion of a few known sensitive fields. Private artifacts, proposals and observations still contain authorized educational text and require a retention/access policy before a real pilot.

## Proof-first verification

The first test run preceded the module implementation:

```powershell
node --preserve-symlinks --preserve-symlinks-main --test tests\agent-orchestrator.test.mjs
# Red: ERR_MODULE_NOT_FOUND for activity-artifact.mjs; 0 pass / 1 failed file.
```

After implementation and focused cap/cancel/source regression tests:

```powershell
node --preserve-symlinks --preserve-symlinks-main --test tests\agent-orchestrator.test.mjs
# Green: 12 passed / 0 failed.
```

The tests exercise owner/tenant isolation, missing atomic storage, the four-call team sequence, private concern scope, partial results and retry deduplication, single-agent default, explicit accept/approve, stale decision rejection, frozen approved practice, observation/reopen, forbidden patch paths, incomplete explanation rejection, deleted-step late results, provider-ignoring-abort timeouts, explicit cancellation, call/input/token caps, locked goal/given data, unapproved source IDs, concurrent human edits, and a real provider adapter with a synthetic retryable transport failure that remains bounded to four attempts.

## Remaining rollout work

The root integration owns route authorization and quota reservation; it now supplies conservative token budgets and requires explicit acknowledgment before approving accepted proposals with unresolved unknowns or risks. UI integration must show before/after, missing fields, stale/conflict state, uncertainty and failed reviewers, and retain edits after 409. Private concern protection is a structural scope rule plus literal/phone leakage checks on proposed changes, unknowns and risk flags before the editor receives them. Semantic privacy and the quality of supportive Hebrew still need human review.

Obtain source/safeguarding approval before staging. Evaluate at least 10 outputs with the human rubric, then compare single/team outputs on the same frozen dataset and model/context versions. Keep the feature flag off until those checks pass.

Local browser verification additionally exercised a synthetic HTTP-backed draft: add/remove a step during review, preserve the removed step, private encouragement, explicit acceptance/approval, open exact approved version 3, save an observation/next step and reload them. The practice path is rehearsal with a colleague; it does not connect the approved artifact to the existing AI character engine. No live model quality, production persistence, efficacy, dollar spend ceiling, or rollout decision is established by the local tests.
