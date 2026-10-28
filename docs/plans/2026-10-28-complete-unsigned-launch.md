---
title: Complete unsigned partnership launch readiness
execution: code
date: 2026-10-28
---

# Complete unsigned partnership launch readiness

## Goal

Finish the existing unsigned partnership workflow after release PR222: make the remaining owner actions clear, connect private folders to existing native study forms/results, offer complete proposed intake wording for review, and connect the existing model adapter to the existing guarded impact engine. Reuse all current authentication, study permissions, records, processing policies and writing providers. Signing remains disabled.

The current instruction authorizes continuation and necessary deployment within the unsigned scope. It does not approve legal text, publish conditions, invent a study or research approval, grant data-processing permission, send mail, create credentials, activate paid services, or bypass Google OAuth. No real research content is sent externally during development or tests.

## Existing prerequisites

PR222 is live; schema3/prefix7 and49 private tables passed all14 access guards.746 tests and the deployed read-only checks passed. The working base is production d5020904cad7732d726babebc67bf6c953c65e66. Prior review artifacts under docs/reviews/ce-code-review-20261028-094747-e92abf19 remain local and excluded.

## Units

### U1. Make the existing owner and study workflow actionable

Files: app/lib/research-partnership-ui.js, app/lib/research-management-ui.js, app/lib/research-intake-ui.js; their existing UI tests and owner/setup documentation. Preserve shared JS/SQL contracts and historical terms; no migration.

Add clear owner setup actions using real readiness. Native consent/questionnaire/results screens must be reachable from the partner folder through existing management screens, subject to fresh study/individual authorization and current navigation checks. Native participant distribution must not be described as operationally ready merely because forms exist; encrypted contact and email verification remain required.

Offer an explicit action that loads a versioned expanded suggested intake notice into the editor as an unsaved draft. Do not replace stored/typed/published terms silently. Existing save creates a version; publication stays a separate explicit owner action. Describe only actual fields/use, review, receipt, original preservation, individual grants and private draft preparation. No invented retention period, legal certification or controller details; use owner review for unresolved disclosures. Do not change DEFAULT_TERMS_DRAFT or deployed SQL to overwrite version1.

Verification: existing UI tests plus proof-first checks for draft versus publication, preservation of edits, authorized study/tab navigation and stale/auth-change suppression; desktop/mobile browser verification. Existing native enrollment remains consent/ethics/email gated.

### U2. Wire the existing provider to guarded impact explanations

Files: harness/lib/providers.mjs, provider-input.mjs, research-partnership-impact.mjs, practice-server.mjs; focused existing provider/impact/integration tests. No SQL migration, signing changes or credentials.

Resolve non-secret trusted provider/model/version metadata without construction or network; instantiate the existing provider lazily only after impactAuthorize checkOnly succeeds. Pass a fixed variation and a dedicated research policy in the exact hashed request. The research policy preserves the exact fixed research prompt; OpenAI uses store:false. Preserve existing professional and communication policies. Bump impact engine/prompt version for the new request contract; retain purpose/provider/version/category/actor, consent, ethics, reauthorization and content-free outcome gates. No live model request or automatic processing approval.

Verification: test-first exact request/prompt policy/storage behavior, no construction during bootstrap/blocked access, actual synthetic HTTP wiring after policy approval, policy invalidation and revoked-access suppression; existing professional provider contracts unchanged.

### U3. Verify, deploy and prepare the owner handoff

Review and integrate both units; run full suite with known Node/PGlite/Edge runtime, browser paths and targeted access checks. Run simplification/code review under ce-work before publishing. Deploy matching server/frontend after passed gates and a current verified recovery point. Live verification is read-only; no dummy studies or users.

Prepare readable proposed conditions and exact remaining owner choices. Search of the connected Drive returned no owned Google Form and no matching form under the BE GOOD partnership folder; do not fabricate a Google Forms connection or copy connector credentials to the application. Native forms remain available. Any future external Forms synchronization requires a selected form, legitimate backend OAuth configuration and approved study/processing mapping.

## Definition of done

The unsigned flow and its setup actions are usable in production; new provider wiring is real and policy-gated, with no unapproved data transfer. All selected checks pass, existing tools/data remain preserved, and the owner has concrete proposed wording to review. Report any genuinely external authorization or selection still required; do not present it as completed or stop before completing independent technical work.