# Team learning lab: verification of retained review findings

Date: 2026-10-10. Scope: the working domain/UI changes that resolve findings 1–8 from review run `20261009-170349-f5dedee5`, whose original reviewed head was `4ad8bc472b47c3598ffa4f4159d32170d6a2ba73`.

All eight retained findings are resolved in the inspected working source. This is a targeted fix verification, not a new full review or a receipt for a committed revision. The verifier wrote the UI regressions separately from the root agent's implementation, then inspected the implementation paths and ran additional scenarios instead of treating the earlier green test receipt as sufficient.

## Original review evidence and method

Read `synthesized-findings.json`, `validator-outcome.json`, and its referenced `validator-verdicts.json` under `C:/Users/yaels/AppData/Local/Temp/compound-engineering-yaels/ce-code-review/20261009-170349-f5dedee5`. The validator confirms all eight original findings. Those verdicts describe the old head; the conclusions below describe the current working files.

Inspected `app/lib/team-learning-lab.js`, `app/lib/team-learning-lab-ui.js`, and both domain/UI test files. Also checked the unchanged demo entry path: `app/demo-lab.html:213` creates the `?demolab=1` iframe and `app/lib/demo-hook.js:128–131` calls the real UI's `demoFill()` and `generate()`.

Executed:

```text
node --preserve-symlinks --preserve-symlinks-main --test harness/tests/team-learning-lab.test.mjs harness/tests/team-learning-lab-ui.test.mjs
```

Result: **35/35 passed** (18 domain, 17 UI), zero failed/cancelled/skipped; Node 20.19.1 on Windows. The UI fixture reads the working source, keeps startup listeners, exposes fixture state through a hook, and executes the actual handlers and actual domain functions. Its only `buildRequest` wrapper records options before delegating unchanged. DOM, storage, locks, timers, and model replies are synthetic; no paid AI, network calls, or real participant data were used.

Five additional scenarios ran through the same actual-handler fixture in a transient in-memory module, without modifying app or test files: failed demo generation; an actual first-save failure with no existing record; failed persistence of a recovery merge followed by a manual retry; and actual first/second question submissions through both stage and step controls. All assertions passed. These extra scenarios are verification experiments, not additional retained tests.

## 1. Demo generation overwrites the administrator's regular draft — P1

**Resolved.** `app/lib/team-learning-lab-ui.js:5–20` detects demo mode before repository creation, requiring the query flag, an embedded window, and the sys administrator session. It selects `sbe.team-lab.demo.v1` and a per-instance `Map` adapter. The regular page continues to use its original key and persistent storage. `demoFill()` at lines 429–431 seeds from `T.newWorkspace().context` before the sample overrides, clearing fields such as `emergencyKind`.

The UI test at `harness/tests/team-learning-lab-ui.test.mjs:325` changes a demo-local emergency field, fills the example, and generates an activity. It verifies the reset, zero persistent writes, and byte-for-byte preservation of the regular saved record. The three gating cases at line 341 verify that removing any prerequisite loads the regular workspace; the nonadmin case rejects sample filling. The extra failed-generation experiment also preserved the regular record byte-for-byte, made zero persistent writes, left the demo activity null, and excluded regular-private markers from the captured request. The live demo hook still reaches these same UI functions.

## 2. Conflict recovery discards locally recorded meeting evidence — P1

**Resolved.** `mergeWorkspaces()` at `app/lib/team-learning-lab.js:187–200` validates both inputs, unions every append-only evidence collection by record ID, rejects conflicting content for an existing ID, preserves local draft/context/concerns, retains additional latest threads, and chooses a revision above both inputs. The final `workspace()` validation checks the merged lineage. The recovery merge button at `app/lib/team-learning-lab-ui.js:424–425` uses this function and keeps the combined workspace on screen while the save is attempted.

The domain regression at `harness/tests/team-learning-lab.test.mjs:234` retains a latest rehearsal alongside a local approval, meeting observation, and move; public export can still resolve the local move's complete lineage. It also rejects an ID collision and checks immutability. The UI regression at `harness/tests/team-learning-lab-ui.test.mjs:241` drives the actual merge button and verifies local/latest evidence in both memory and storage. In the extra failed-merged-save experiment, the saved latest record stayed unchanged, both evidence sets remained in the in-memory combined draft, and a later manual save persisted them.

## 3. Follow-up questions forget the previous answer — P1

**Resolved.** `ask()` at `app/lib/team-learning-lab-ui.js:292–299` passes its explicit `threadKey` and stores the exchange in that same thread. `buildRequest()` at `app/lib/team-learning-lab.js:259–267` validates the key against the selected stage/step/approval and includes only the last 12 turns, each capped at 4,000 characters. Stored roles/content are validated at lines 171–175. The request format identifies history as untrusted data and gives the current supplied context precedence.

The domain regression at `harness/tests/team-learning-lab.test.mjs:202` verifies step history bounds and rejects mismatched/support keys; concerns, unrelated threads, and support content remain absent. The UI regression at `harness/tests/team-learning-lab-ui.test.mjs:385` verifies actual stage input/ask listeners pass the key, include exactly turns 28–39 from a 40-turn thread, and keep privacy boundaries. The extra stage and step experiments each submitted a first question through the actual controls, then submitted a follow-up: the second captured request contained the first user question and actual first assistant answer (two prior turns).

## 4. Clear human checks when adopting changed activity content — P1

**Resolved.** `resetApprovalChecks()` at `app/lib/team-learning-lab-ui.js:61–66` centralizes the three check resets. The actual adoption handler invokes it at line 235, both recovery choices invoke it at lines 425–426, and startup invokes it at line 436. `T.approve()` at `app/lib/team-learning-lab.js:210–213` requires all three booleans to be true for the current version.

The UI regressions at `harness/tests/team-learning-lab-ui.test.mjs:211` and line 226 drive proposal adoption and both recovery buttons after all checks are selected. Every path yields three false checks and domain approval rejects that state. The adoption test also rechecks all three and verifies the newly approved snapshot contains the adopted instructions.

## 5. Prevent duplicate submissions while evidence is saving — P2

**Resolved.** `attemptOnce()` at `app/lib/team-learning-lab-ui.js:37–44` adds the target to a `WeakSet` and disables it synchronously before invoking the action. It ignores queued duplicate handlers and restores the previous state on synchronous completion or either promise outcome. Generic buttons use it at lines 29–31, covering the rehearsal/meeting callbacks at lines 332–337 and move callback at lines 357–360. The static approval callback is guarded at lines 448–451. `updateDanger()` at lines 70–72 respects pending approval actions.

The held-lock UI regressions at `harness/tests/team-learning-lab-ui.test.mjs:281`, line 300, and line 309 dispatch two already queued clicks for rehearsal, meeting observation, approval, and archive move. Each creates exactly one record while the lock is pending, disables its control, and persists exactly one record after release. The save completion regression at line 270 separately verifies a save request made during a pending older save does not finish until the newer revision is persisted; this is supported by `save()` calling `save()` again after awaiting `saving` at UI line 81.

## 6. Allow retry after first-save storage failure — P2

**Resolved.** The domain error helper at `app/lib/team-learning-lab.js:62` supports typed codes. Repository read/write/unsupported-lock failures use `storage-unavailable` at lines 301, 312, and 318; malformed storage uses `storage-invalid` at line 307; revision conflicts use `conflict` at lines 315 and 317. The UI save catch at `app/lib/team-learning-lab-ui.js:88–99` locks recovery only for conflict/invalid-storage errors, retains the original expected revision, and queues another automatic save only after a successful save.

The domain regression at `harness/tests/team-learning-lab.test.mjs:271` fails the initial write with no saved record, restores storage, and succeeds at the same expected revision. The UI regression at `harness/tests/team-learning-lab-ui.test.mjs:257` verifies a transient write failure remains retryable, schedules no automatic retry loop, and succeeds through the actual manual save listener. Because that retained UI test begins with a saved baseline, the extra exact-first-save experiment started with null storage and `persistedRevision === 0`: the write failed, conflict stayed false, no timer remained, and manual retry persisted the intact draft at revision 1.

## 7. Persisted move fields escape the public projection — P2

**Resolved.** `evidence()` at `app/lib/team-learning-lab.js:123–163` whitelists and validates approval/practice/move records: globally unique bounded IDs, parseable dates, valid approved revisions and contexts/activities, bounded strings, appropriate practice kinds, and approval/step references. Moves must resolve to a real meeting observation and match its approved step. `workspace()` invokes this validation at lines 165–178. `publicPack()` at lines 233–237 validates the workspace before projecting title/conditions/limits and a validated step. Scalar validation at lines 63–67 rejects object-valued fields and caps ordinary strings at 8,000 characters.

The regression at `harness/tests/team-learning-lab.test.mjs:250` tries valid JSON with nested object-valued move conditions, missing observation lineage, forged step instructions, incorrect observation kind, duplicate approval IDs, and an invalid date. Each repository load fails with `storage-invalid`, preserves the original stored bytes, and direct public export rejects the same malformed workspace. The existing public-pack regression at line 156 still verifies that ordinary exports exclude private concerns, conversations, raw observations/next actions, and internal record IDs.

## 8. Rehearsal questions use the wrong activity version — P2

**Resolved.** `selectedPractice()` and `stageQuestionKey()` at `app/lib/team-learning-lab-ui.js:239–254` resolve the explicitly chosen rehearsal/meeting approval and give its discussion an approval-specific key. Selection changes refresh the question view at lines 323 and 326. `ask()` at lines 292–301 passes that approval and selected step, and refuses to create adoption proposals for the frozen selection. The stage question listeners use the derived key at lines 444–445.

`buildRequest()` at `app/lib/team-learning-lab.js:239–266` obtains context/activity/step from that selected approval and supplies its approved revision; planning/activity questions retain draft grounding. Both current and selected context still pass the immediate-danger gate. The domain regression at `harness/tests/team-learning-lab.test.mjs:215` verifies frozen grounding, approved conversation history, invalid selections, and danger gating. UI regressions at `harness/tests/team-learning-lab-ui.test.mjs:356` choose the older of two approvals for stages 2 and 3 while the current draft differs from both. Captured requests use the chosen frozen subject/step, exclude newer-approval/current-draft/private-concern markers, store answers under the approval-specific thread, and offer no adoption button even when the synthetic reply includes a proposed step.

## Remaining limits

No material issue remains open among retained findings 1–8 in the verified source. The current UI fixture stubs the planner lifecycle, so this receipt does not establish actual `planner-continuity.js` cancellation or rejection of late AI after recovery/session changes; that remains a testing gap for follow-up. Native browser rendering, real cross-tab Web Locks, the full repository suite, live authenticated model behavior, and professional/content validation are outside this receipt; root-agent browser/full-suite verification is separate. The five extra edge scenarios above passed as ad hoc experiments and are not yet retained regressions. No production incidence is inferred from the synthetic reproductions.

## Verified file fingerprints

Line references above correspond to these SHA-256 working-file fingerprints:

| File | SHA-256 |
| --- | --- |
| `app/lib/team-learning-lab.js` | `9DB32BC5BF90D90181780573D67CEF341FB5372962DF50A009B9846F83E53225` |
| `app/lib/team-learning-lab-ui.js` | `849C16899F316FA3D5DBE531F93A0CE76E4F580395247F8EC2D636F6B5D833F2` |
| `harness/tests/team-learning-lab.test.mjs` | `08D7B87BA08E9639E46D38CF72602E36FE5DCC1CB8E995959E17776BFF7D4216` |
| `harness/tests/team-learning-lab-ui.test.mjs` | `7EF27D7FBD1701283FB43154DFFA2813AF3D0F876B7D2680490A68F0F1BB8E97` |
