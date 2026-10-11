# Local quality evaluation and baseline

The runner executes synthetic contracts with the real narrative pipeline, gates, Studio server boundary, source catalogue and public-view filter. It performs **zero model calls and zero network calls**. A green command means the observed contract outcomes match the fixture expectations. It does not establish useful model output, professional approval, or improved resilience.

From `harness/`, no dependency installation or API key is required:

```powershell
npm test
npm run gates
npm run eval -- --output evaluation-report.json
```

All package commands include `--preserve-symlinks --preserve-symlinks-main`, needed by the bundled Windows environment. `npm run run` is the same provider-free evaluation as `npm run eval`. `--json` emits a machine-readable report; `--help` describes options. Unknown options and live-provider options exit 2. Unexpected contract outcomes exit 1; matched adversarial rejections exit 0.

## Dataset and coverage

`harness/fixtures/baseline-cases.json` contains a full narrative fixture and adversarial variants: empty stage/output, missing turning points, an unauthorized source, a changed lock, and verbatim private leakage. The valid fixture follows the existing stage1/stage2/stage3 prompt structures. The source catalogue is supplied separately by the runner; input text cannot approve a source. The runner calls the production `runGates` and, in the default mode, `runPipeline` with a deterministic fixture provider.

`harness/fixtures/agent-evaluation-cases.json` adapts E01–E20 from `outputs/be-good-agent-evaluation-cases.json` to **Studio 1.0**, the current application contract. It contains 20 actual Studio request envelopes, typed provider responses, three synthetic institutions/roles, original planning input, required safety outcomes and human checks. These are ready for later controlled model comparison; they are not 20 model-generated outputs. Synthetic narrative sources test gate policy; Studio professional sources use the real public bank ID and server-generated source version. A bank entry is provenance, not approval of an activity.

`harness/fixtures/narrative-evaluation-inputs.json` preserves the 11 inputs from `app/eval-set.html`, including role play, Arabic and English. The report labels them input-only. No generated baseline or quality score exists for these 11 inputs yet.

| Cases | Automatically exercised | Still unmeasured |
|---|---|---|
| E01–E02, E07–E08 | Valid Studio generation envelope, schema/server checks, draft provenance | Goal alignment, age fit, participation equivalence, safeguarding and practical usefulness |
| E03 | Missing duration rejected before fixture provider | Whether a model asks the right clarifying question |
| E04 | Valid adaptation envelope | Adversarial purpose/duration lock enforcement and affected-field proposals |
| E05 | Consultation shape and no automatic approval | Quality of encouragement and consent scoped to agent roles |
| E06, E10 | Actual `publicActivity` excludes coaching/private conversation | Consent envelopes, research export and approved team handoff |
| E09 | Mechanism fields accepted by current contract | Realistic roles, backup, resources and continuity |
| E11–E12 | Unapproved professional basis rejected; bank ID/version attached | Claim grounding and source relevance judged by a human |
| E13 | Single-provider timeout is an error | Three-reviewer partial failure, retry checkpoints and private proposal retention |
| E14 | Refusal and incomplete provider output are rejected | Quota release and durable private draft retention |
| E15 | Principal without Studio entitlement is rejected before provider | Owned-job isolation across tenants |
| E16 | Unknown-job polling returns no private result | Expired job cleanup and late-result fencing |
| E17–E19 | Representative valid current Studio envelopes only | Deleted-stage fencing, optimistic conflict, atomic quota and idempotency |
| E20 | Observation context can enter current Studio brief | Approved-version practice chain and save/reopen of observation/decision |

Every unexercised outcome remains visible in the report. The representative request for E17–E20 does not count as a passing concurrency or approval test. Dedicated authorization/job tests and the implementation acceptance matrix remain the evidence for F01–F04; narrative leakage/schema/source fixtures cover only their stated portions of F05/F07/F08. F06 research filtering requires separate implementation and tests.

## Reporting and privacy

Reports carry dataset, prompt, schema and source hashes. Repeated fixture runs preserve response hashes; wall time is measured locally and changes naturally. Model usage and cost are `null`, not estimated or recorded as zero measured cost. `modelCalls:0` records that no real model was contacted.

`redactTrace` uses an explicit allowlist. IDs become opaque hashes; traces retain stage, agent, version, gate outcome, local latency and numeric usage only. Prompts, replies, names, phone numbers, concerns, gate reasons and arbitrary nested metadata are excluded. Reports contain response hashes, not full model output. This runner is a report boundary; it is not wired into production request logging and does not prove all production traces are private.

The comparison uses identical E01–E20 case IDs and records `single:fixture_contracts_only` and `team:not_exercised`. The three-reviewer/editor flow is not implemented here, so there is no quality, latency, usage or cost comparison with a team. Do not infer a release recommendation from a structural pass rate.

The human rubric is versioned `agent-quality/v1`: usefulness, grounding, feasibility, agency, safeguarding and privacy, each scored 0–2. All ratings remain pending. Yael must approve the rubric and thresholds, then at least 10 outputs must be reviewed, including a subset by two facilitators. Required safety failures and missing essential information must block use regardless of a numerical average. Disagreements, refusals and unresolved questions remain visible. This evaluation does not claim to measure an intervention's effect on resilience.

## Proof-first verification

Before `harness/run.mjs` existed:

```powershell
node --preserve-symlinks --preserve-symlinks-main --test tests\baseline.test.mjs
# 0 pass / 2 fail; MODULE_NOT_FOUND for the documented entry point.
node --preserve-symlinks --preserve-symlinks-main --test tests\trace-eval.test.mjs
# 0 pass / 1 fail; ERR_MODULE_NOT_FOUND importing run.mjs.
```

The first runner pass exposed gate incompatibility with nested documents and source records: baseline-valid failed exact gates 2/4. The integrated gate/schema implementation now accepts that valid fixture. Verification at this implementation handoff:

```powershell
node --preserve-symlinks --preserve-symlinks-main --test tests\baseline.test.mjs tests\trace-eval.test.mjs
# 6 pass / 1 fail: pipeline private-leak fixture is still accepted.
npm run gates
# 6 cases, 0 unexpected outcomes; exit 0.
npm run eval
# Pipeline: 6 cases, 1 unexpected outcome; Studio: 20 cases, 0 unexpected outcomes; exit 1.
node --preserve-symlinks --preserve-symlinks-main --check run.mjs
# exit 0.
```

The remaining failing regression adds private actor text to the trainee's second visible section (`traineeStakes`, after the separator). The current gate scans the first section only. The gate owner has been notified; this failure must remain visible until both visible sections are checked. The final integration session must record its post-fix result here. Earlier red results are not passing fixes.

## Release and continuation

The CLI changes no product feature flags and starts no production jobs. The team remains unavailable in this runner. Complete U2/U3/U7 and versioned orchestration before collecting team outputs. Then compare the same inputs/context with frozen model, prompt, schema and source versions, and record actual usage, latency, refusals, truncation and spend against caps set before the experiment.

Run the browser acceptance flows and obtain human source/safeguarding approval before a staging pilot. Define a staging-only flag, job/draft retention, cost cap and rollback behavior before rollout. These release controls and the production trace integration are outstanding work; this provider-free runner does not enable the team by default.
