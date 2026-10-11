# Independent verification of current fixes

Checked revision: `7b4f2d8d6028536cc482b1fc85dc3f83d5db7a98` (PR #170), 7 October 2026.

This targeted read-only check follows all 17 structured original candidates and the agent-native role-instruction candidate from snapshot `7524755`. Duplicate raw candidates are mapped in the accompanying JSON. The 13 concrete behavior/test gaps are addressed; the access-module extraction is an advisory. No current concrete defect was found in these boundaries. This result is distinct from the original formal review receipt and does not approve release or merge.

66 targeted tests passed, 0 failed or skipped. A supplemental provider-free checkpoint I/O reproduction also passed: initial 503, saved run failed, explicit retry complete, unchanged version 1 approved, exactly two synthetic calls.

```powershell
node --preserve-symlinks --preserve-symlinks-main --test harness/tests/server-transport.test.mjs harness/tests/agent-orchestrator.test.mjs harness/tests/activity-flow.test.mjs harness/tests/narrative-startup.test.mjs harness/tests/provider-stream.test.mjs harness/tests/public-demos.test.mjs harness/tests/artifact-practice.test.mjs harness/tests/quality-foundation.test.mjs
```

Supplemental reproduction, from the task root (parent of `outputs/` and `work/`): `node --preserve-symlinks --preserve-symlinks-main outputs/quality-evidence/current-resolution-probes.mjs`. Portable package instructions are in `current-resolution-probes-README.md`. No implementation was edited.

## CR01 — Narrative pipeline admission budget

Status: **resolved**. Current evidence: `harness/practice-server.mjs:38`, `harness/practice-server.mjs:121`, `harness/practice-server.mjs:213`.

- Pipeline still admits 256000 units, but boundedProvider explicitly forces one physical attempt per stage, rather than the old two-attempt reservation. The cumulative conservative input/output guard remains active.
- quality-foundation.test.mjs:24 runs the real four-stage prompt builders through /api/pipeline, asserts four completed calls, maxAttempts=1/maxTokens=32000, terminal done and one committed ledger.

Limit: This verifies a repository-valid narrative fixture. Oversized stages remain intentionally rejected; live-provider quality/latency is unmeasured.

## CR02 — Abandoned artifact claims, worker loss and checkpoint I/O

Status: **resolved**. Current evidence: `harness/lib/activity-artifact.mjs:66`, `harness/lib/activity-artifact.mjs:84`, `harness/lib/activity-artifact.mjs:163`, `harness/lib/activity-artifact.mjs:178`, `harness/practice-server.mjs:222`.

- Artifact runs persist a bounded lease, owning job key and fresh attemptId. Reconciliation marks terminal/expired claims lost, keeps saved results and permits explicit retry. Checkpoint/final writes require the same running, unexpired attempt.
- agent-orchestrator.test.mjs:200 tests lease reclamation, same base-version retry, abandoned late callback fenced with 409 and approval without manufacturing a content edit. quality-foundation.test.mjs:62 tests actual durable-job loss and artifact association.
- Supplemental current-resolution-probes.mjs injects one thrown CAS I/O error at the first reviewer checkpoint. The initial review returns 503 with run failed; retry completes; approval returns 200 at version 1; exactly two synthetic provider calls.

Limit: Sustained storage unavailability cannot be repaired while storage is inaccessible; the persisted lease supports recovery after service restoration. PostgreSQL transactions and multi-worker behavior remain staging gates.

## CR03 — Studio terminal polling contract

Status: **resolved**. Current evidence: `harness/practice-server.mjs:148`, `harness/practice-server.mjs:188`, `app/lib/resilience-studio-ui.js:69`.

- Successful and failed Studio terminal responses return status:done plus httpStatus and the complete result, preserving structured clarification fields. Failures release the quota reservation.
- server-transport.test.mjs:78 exercises 200, structured 422 and 403 outcomes through both polling aliases; :104 executes the actual Studio browser client against the local HTTP server for consultation and clarification.

Limit: No live OpenAI Studio call was made. Synthetic-handler tests establish envelope compatibility, not the quality of generated activities.

## CR04 — Fresh IDs after confirmed terminal generation failure

Status: **resolved**. Current evidence: `app/lib/narrative-build.js:390`, `app/lib/narrative-build.js:417`, `app/lib/narrative-build.js:433`.

- Completion recovery, educational-pipeline recovery and resumed saved-job recovery all clone the body with a fresh crypto.randomUUID requestId only after confirmed lost/transient terminal failure. Initial uncertain startup transport does not get this recovery branch.
- activity-flow.test.mjs:258 captures submissions for completion, pipeline and saved-job resume and verifies changed IDs after lost status. quality-foundation.test.mjs:36 confirms a released old ID never launches another paid call.

Limit: Unknown network outcomes remain subject to durable idempotency; this fix does not infer that a timed-out start was never accepted.

## CR05 — Canonical narrative turning-point instructions

Status: **resolved**. Current evidence: `app/lib/activity-review-ui.js:89`.

- The adapter now reads characterDoes.line/action and ifMissed from the enforced pipeline contract, retaining compatibility fallbacks for renderer-style fields.
- activity-flow.test.mjs:32 constructs a synthetic canonical turning point and asserts exact line/action/missed-turn instructions. The private artifact validator retains the pipeline contract and approved snapshots preserve its derived content.

Limit: This is contract fidelity; it does not evaluate educational usefulness of the wording.

## CR06 — Production-sized review envelopes and compact-role authority

Status: **resolved**. Current evidence: `harness/lib/agent-contract.mjs:6`, `harness/lib/agent-contract.mjs:28`, `harness/lib/agent-contract.mjs:55`, `harness/lib/activity-artifact.mjs:157`, `harness/lib/agent-orchestrator.mjs:29`.

- The input limit is 64000 UTF-8 bytes, with an explicit 413 preflight before a run claim. Compact pedagogy/facilitation roles omit full document prose, retain structured context and cannot propose pipelineOutput replacement; safety/single/synthesis retain full prose.
- agent-orchestrator.test.mjs:185 uses shipped educational facilitator guidance for both single and team review, verifies complete status, 1/4 calls and <=100000 budget with measured synthetic usage. :69 validates that only full-prose readers can replace it.

Limit: The artifact storage ceiling remains larger than the review ceiling by design. Some very large team envelopes or missing usage can hit the bounded aggregate allowance; the UI gives an actionable size limit and retained candidates. No guarantee is made that every storable artifact fits one review.

## CR07 — Proposal rejection preserves unsaved text and concerns

Status: **resolved**. Current evidence: `app/lib/activity-review-ui.js:160`, `app/lib/activity-review-ui.js:259`.

- Reject decisions adopt server metadata while preserving draft/concerns/dirty state if human edits existed before or during the request; revision checks protect edits arriving after launch.
- activity-flow.test.mjs:89 covers edit-before-reject and edit-during-reject, private concerns, local backup and reopening.

Limit: A genuine concurrent server content-version conflict remains explicit and requires comparison; it is not silently rebased.

## CR08 — Cancellation before startup acknowledgment

Status: **resolved**. Current evidence: `app/lib/narrative-build.js:49`, `app/lib/narrative-build.js:52`, `app/lib/narrative-build.js:399`, `app/lib/activity-review-ui.js:53`.

- The bounded startup acknowledgment is retained separately from the UI abort signal. Its job ID is captured before stale-run handling, and an obsolete acknowledged job receives an authenticated cancel request. The artifact client also retains and cancels a late acknowledgment.
- narrative-startup.test.mjs:32 tests cancel/reset/source edit before delayed acknowledgment; :53 verifies obsolete acknowledgment cancels only its own job and leaves the newer saved job intact. activity-flow.test.mjs:122 covers the artifact review variant.

Limit: If the acknowledgment connection never yields a job ID, the client cannot cancel by ID; server time limits and lease/TTL recovery remain the bounded fallback. These tests prove delayed accepted acknowledgments, not arbitrary network partition recovery.

## CR09 — Closed/replaced editor ownership and local persistence

Status: **resolved**. Current evidence: `app/lib/activity-review-ui.js:130`, `app/lib/activity-review-ui.js:139`, `app/lib/activity-review-ui.js:160`, `app/input-screen.html:1276`.

- Sessions claim an artifact-local storage key, dispose the previous owner and guard asynchronous adopt/persist against disposal. Dialog close/replacement calls the mounted editor disposal hook.
- activity-flow.test.mjs:108 holds the old save, opens a second session sharing storage, edits the new session, then resolves the old save and verifies the active backup survives.

Limit: This is in-process session ownership, not cross-tab or cross-device editing serialization; server CAS and explicit conflict recovery cover independent clients.

## CR10 — Extract identity/quota policy from access monolith

Status: **not-a-defect**. Current evidence: `harness/lib/access.mjs:293`, `harness/lib/access.mjs:348`.

- The original candidate establishes module size and mixed responsibilities, but supplies no concrete incorrect behavior or violated interface contract. The policy remains colocated with its route/storage consumers.
- Treat extraction as a maintainability recommendation, not a resolved behavior defect or necessary fix in this targeted verification. Existing direct identity/quota tests remain a useful boundary for a future refactor.

Limit: A future extraction could reduce review cost. It should preserve imports, legacy routes and the atomic storage contract, and run the relevant access/job regressions.

## CR11 — Terminal persistence failure and same-boot orphan recovery

Status: **resolved**. Current evidence: `harness/practice-server.mjs:94`, `harness/practice-server.mjs:184`.

- finishJob retries thrown storage errors up to three attempts and keeps atomic job/quota finalization. Polling reconciles an expired running lease when a different boot or no current local executor owns the job.
- server-transport.test.mjs:94 injects the first finalize I/O failure and proves retry saves the same completion with one provider call. :120 injects sustained finalization failure, restores storage and advances the lease; polling returns lost and a released ledger for the same-boot orphan.

Limit: Recovery needs storage service availability and owner polling; no background retention/reconciliation daemon is claimed. Deployed PostgreSQL finalization-vs-cancellation is still unrun.

## CR12 — Live revocation fences reviewer calls and proposal writes

Status: **resolved**. Current evidence: `harness/practice-server.mjs:113`, `harness/practice-server.mjs:124`, `harness/lib/providers.mjs:418`, `harness/lib/activity-artifact.mjs:92`, `harness/lib/activity-artifact.mjs:194`, `harness/lib/agent-orchestrator.mjs:18`.

- The job-owned live-principal assertion checks owner, tenant, current permission, job state, expiry and cancellation. It runs before each provider attempt, after completion, and before review checkpoint/final writes. Terminal failure bookkeeping can clear the run lock.
- quality-foundation.test.mjs:94 blocks all three reviewers, revokes the active staff code, then releases responses. It asserts exactly three initial calls, no synthesis, zero stored proposals, unchanged version, failed run, error job, released ledger and 403 on later reads.

Limit: The local check proves revocation observed before the write. A general transactional coupling of arbitrary permission revocation with all artifact CAS writes is not established; database rollout and race testing remain gates.

## CR13 — Anthropic native SSE transport coverage

Status: **resolved**. Current evidence: `harness/lib/providers.mjs:110`, `harness/lib/providers.mjs:125`, `harness/tests/provider-stream.test.mjs:43`.

- New tests use getProvider(anthropic) with its default transport against a local synthetic HTTP SSE server, not an injected preassembled response. Chunks split delimiters and Hebrew UTF-8 bytes.
- provider-stream.test.mjs:43 verifies text, thinking/signature reconstruction, incremental tool JSON and measured usage; :52 rejects malformed tool JSON and premature close with known input usage; :60 aborts an open stream and retains usage.

Limit: Synthetic native-transport compatibility is established. No Anthropic live service call or future vendor protocol guarantee is implied.

## CR14 — Trusted specialist/synthesis responsibilities

Status: **resolved**. Current evidence: `harness/lib/agent-contract.mjs:72`, `harness/lib/agent-contract.mjs:79`, `harness/lib/agent-orchestrator.mjs:4`, `harness/lib/agent-orchestrator.mjs:37`, `harness/lib/agent-orchestrator.mjs:58`.

- Server-owned role instructions now specify pedagogy, resilience/facilitation, privacy/sources, combined single reviewer and synthesis duties. Synthesis must preserve unresolved disagreements and missing-reviewer warnings.
- agent-orchestrator.test.mjs:59 asserts four distinct trusted system prompts, separation of untrusted instructions and four distinct prompt hashes; it does not assert equality to each exact system digest. Separately, source at agent-orchestrator.mjs:58 computes promptVersion as digest(AGENT_SYSTEMS[agent]), and :4 derives reservation bytes from those actual prompts.

Limit: Prompt presence and bounded contracts do not establish that live models fulfill the rubric. Human evaluation of conflicting proposals and model quality remains an explicit pilot gate.

## IC01 — Latest-main Studio restrictions and source catalogue

Status: **resolved**. Current evidence: `harness/practice-server.mjs:17`, `harness/practice-server.mjs:31`, `harness/lib/agent-contract.mjs:79`.

- Studio remains limited to studio permission until professional approval. Global invitation-language policy is counted in actual system-byte reservation and included in role prompts. The compact-role scope test protects edits to unseen full prose.

Limit: No claim is made that model outputs obey invitation wording merely because the policy is supplied.

## IC02 — Public demo exceptions cannot revive private revoked administrator access

Status: **resolved**. Current evidence: `harness/lib/access.mjs:661`, `harness/lib/access.mjs:667`.

- handleDemos resolves the current principal, permits anonymous access only to explicitly published index entries, and requires a live sys principal for private reads/management. public-demos.test.mjs:57 rotates the admin password and denies private reads/list/publish with the revoked token while public entries remain available.

Limit: Public publication is an explicit administrator action; human review of the content being published remains separate.

## IC03 — Approved print excludes private observations and unsaved inputs

Status: **resolved**. Current evidence: `app/lib/artifact-practice.js:43`, `app/lib/artifact-practice.js:79`, `harness/lib/activity-artifact.mjs:121`.

- Printing creates two tables exclusively from fetched approved content using textContent. It does not clone the practice UI, private observation history or unsaved form values. artifact-practice.test.mjs:33 checks table rows, literal malicious markup and private-data exclusion.

Limit: This is the facilitator approved-activity print path. It does not constitute an audit of every product export or semantic de-identification.

## Unexecuted release gates

### RG01 — Real PostgreSQL/RPC and grants verification

Status: **release-gate**, `docs/migrations/verify_access_atomic.mjs:1`, `docs/access-hardening.md:110`.

The verifier now contains 20 competing atomic success finalizations plus foreign/revoked commit denial and release. It is explicitly opt-in and has not been executed against a database.

- Execute in a dedicated staging database; verify RPC/table/browser-role grants, locks, backup/restore and realistic multi-worker behavior.
- Add/execute success-vs-cancellation finalization race, competing workshop-code claims, pending/released course-seat reservations and expiry reclamation at the real RPC boundary.

### RG02 — Retention, operational rollout and rollback ownership

Status: **release-gate**, `docs/access-hardening.md:144`, `docs/agent-team.md:82`.

Job expiry is a read-access/time limit, not physical deletion. Private artifacts, proposals and observations still hold authorized educational content.

- Approve and implement retention/cleanup ownership before real private data; preserve quota daily-admission and idempotency windows.
- Record deployed client/server revisions, monitoring destinations, restart/rollback acceptance and platform generation-disable controls.

### RG03 — Live-model, human educational/source and semantic-privacy acceptance

Status: **release-gate**, `docs/agent-team.md:74`, `docs/agent-team.md:82`.

The run uses only memory/mock transports and a local synthetic provider SSE server. Literal private-concern/phone matching and approved source IDs are concrete gates, not semantic privacy/source relevance proofs.

- Run approved-cost live provider experiments and human rubric evaluation, including conflicting specialists and participant choice/facilitation content.
- Review semantic privacy, source relevance, educational appropriateness and professional Studio approval before opening the broader permissions or team flag.

This check made no paid call, staging/production request, migration, deployment or Git publication. It establishes current source/test resolution for the listed boundaries; educational efficacy, full semantic privacy, actual database concurrency and full cross-model review remain outside its proof.
