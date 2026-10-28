---
title: BE GOOD research partnerships, applications and researcher folders
date: 2026-10-18
type: feat
execution: code
origin: user continuation of research management and supplied partnership specifications
---

# המשך ניהול המחקר והשותפויות

## הרחבת המסלול לפי הבעלים, 20.10.2026

הגרסה הבסיסית נפרסה באישור ב־19.10.2026. לפי ההנחיה החדשה, אדם פרטי או נציגת מוסד יוכלו לפתוח פנייה עצמאית: לעיין בתנאים שפורסמו, למלא פרטים ולשלוח לבדיקה. אישור בעלת המערכת יקשר את הפנייה למחקר, לזהות אישית ולהרשאות שנבחרו במפורש. תיק שותפה ירכז את המחקרים שלה ואת ההרשאות הנוכחיות בכל מחקר. [תוכנית ההרחבה](2026-10-20-partnership-self-service.md) מגדירה את ההמשך; אין בכך אישור לפריסה נוספת או להפעלת חתימות.

## Goal and authority

Continue the existing Hebrew RTL research administration rather than create another product. The owner can find each researcher and her studies, requests, contributions, agreements and approved findings in one place. Researchers work only within individually authorized study workspaces. Preserve professional communication and its shared eighteen-principle engine.

The earlier study-management plan remains the foundation: [study research management](2026-10-13-1445-feat-study-research-management-plan.md). This continuation adds the applications, researcher folders, authored findings and partnership workflows requested after that plan. It incorporates the user's contribution registry, mutual IP, structured agreement, in-app signing and owner dashboard requirements.

The owner explicitly authorized continuing development after backup work. Production deployment, live migrations, live credential rotation, real research email, purchases, provider activation and real-data restoration remain outside this local implementation's authority.

## Existing implementation and preservation

- Read-only original: `work/communication-continuity`, HEAD `ea656e2`, including nine existing modified files and untracked research usage/integration code.
- Security and recovery foundation: `work/security-backup-recovery`, HEAD `7c8f60d`; encrypted source/data/provider backups and the owner-created portable key kit have verified private Drive copies.
- Canonical continuation: separate clone `work/research-partnerships`, branch `feat/research-partnerships`. Reconcile both histories and original research review fixes here; do not reset or overwrite either source checkout.
- Current production is not the development environment. All tests and browser demonstrations use invented studies and researchers. No private backup contents or production secrets are development fixtures.
- Research database authentication must enforce current owner password version as well as the hardened application server. Membership revocation must be checked transactionally for every operation.

## Product requirements

- R1. Reuse the existing research shell, authenticated client, study permissions, SQL authorization, audit conventions and UI components.
- R2. Add owner-only **ניהול שותפויות והסכמים**, with searchable researchers, study/status filters, pending submissions, deadlines and links to each authorized folder. Researchers receive a scoped workspace rather than the global dashboard.
- R3. Provide structured partnership and study applications, profile/institution fields, requested tools, method, population, timeline, approvals, requested permissions and supporting materials. Draft, submit, review, changes requested, approve and reject must be actual stored transitions with immutable submitted versions.
- R4. A private **תיק חוקרת** groups the researcher's authorized studies, applications, agreements/annexes, contributions, budgets, tools/questionnaires, documents, analysis requests, findings and decisions. Another researcher cannot discover the folder or its document metadata, even within the same study, unless explicit record authorization permits it.
- R5. Findings have independent immutable versions: Draft → Owner Review → Approved → Published, plus withdrawal. Publication requires the owner, exact version approval, source/snapshot and analysis provenance, a privacy/consent review, explicit authorized viewers and separate download rights. Source changes never republish findings automatically.
- R6. New researcher defaults expose approved findings only. Collaborative analysis is a separate preset with granular overrides; it permits proposals and approved results, not arbitrary SQL or raw database access. Preserve existing explicitly granted permissions without silently expanding them.
- R7. Analysis requests identify questions, variables, comparisons, time points and requested outputs. The owner accepts, rejects or requests changes; released analysis results use the same study, consent and publication boundaries. Owner analysis uses fixed allowlisted operations, not client-supplied SQL.
- R8. Implement the contribution registry's eight categories and seven statuses. Preserve the original proposal, requested recognition/payment/IP/owner commitments, agreed terms, amendments and evidence. Approval inside the application alone never creates a binding financial or contractual obligation.
- R9. Structured agreement editing covers all twelve requested sections and annexes. Reuse profile/study/tool/permission/budget/contribution data, allow authorized overrides, autosave drafts, show missing fields, generate a live Hebrew agreement and provide optional PDF/Word exports. Approved legal text and IP explanation are versioned inputs; do not invent owner-approved clauses or claim an unseen Word template has been fully mapped.
- R10. Agreement negotiations show exact field/text changes, financial/deadline/IP/privacy/access/obligation implications and who proposed them. Every submitted revision is immutable. Both parties approve the same final version/hash; any new revision invalidates prior approvals.
- R11. IP reading acknowledgement is distinct from signature. Preserve pre-existing rights and proposed amendments. Executed agreements and their evidence cannot be edited or silently replaced; later rights transfers/exclusive licences require a new mutually approved and signed amendment.
- R12. Invitations are expiring, single-use, revocable and bound to a study and individual researcher. They enroll a collaborator; they do not become permanent login credentials and are separate from participant consent invitations. Reuse verified individual authentication and configured email infrastructure.
- R13. Signing is an integrated provider workflow with embedded signing where supported, signer identity/authority checks, explicit consent, two-party signatures, immutable final documents/hash/audit certificate, delivery and verified completion. Never implement a checkbox/manual upload as a substitute for the mandatory signing workflow. With no approved operational provider/credentials, show the actual dependency and prevent execution/partnership activation.
- R14. Binding obligations originate only from verified executed agreements, retain clause/version references, and require owner review of extracted obligations. Track party, amount, deadline, status and completion evidence without changing signed terms. Proposed budgets/contributions/unsigned amendments remain nonbinding.
- R15. Store documents privately with study/individual access checks for reads, exports and downloads; audit metadata only. No confidential document/response content or privileged credentials in browser persistence, public URLs, fixtures or logs.
- R16. Keep existing research participation, questionnaires, consent, email preferences and withdrawal separate from partner contracting. Owner administrative authority does not override participant consent or ethics restrictions. Google Forms OAuth/sync and mail delivery must report real configuration state; do not present an unconfigured connector as operational.
- R17. Local deliverables include migrations (unapplied), functional backend/UI, meaningful security tests, desktop/mobile browser verification, version history, dependency/setup notes and a Hebrew readiness summary. No production changes.

## Implementation units

### U0. Reconcile existing research and security

Import the existing research/unified-communication implementation and dirty review fixes through a controlled merge into the security-based clone. Preserve hardened auth, limits, institution boundaries, job ownership, current admin/navigation and backup monitoring. Add actual owner password-version checks to SQL and align invented fixtures. Verify existing research and security regressions before new domain behavior.

### U1. Freeze shared workspace contracts

Define a shared browser/server vocabulary for record kinds, fields, statuses, capabilities, revision transitions, agreement sections and exports. Extend existing permissions and transport without a second authentication/product model. Tests characterize field validation, version comparisons, required-field completion, proposal/nonbinding separation and RTL document generation.

### U2. Implement private records and transactions

Add a migration extending the existing private research schema and fixed service RPC. Reuse current credential verification, row-locked study membership and RLS. Store current record heads plus immutable versions, per-researcher scope, explicit publication viewers, contribution terms, approvals, invitations, document metadata/evidence and content-free audits. Enforce CAS/idempotency and reject cross-study nested references. Existing direct-table access stays denied.

### U3. Extend the existing gateway

Validate typed inputs before the fixed RPC; keep SQL authoritative. Reuse server encryption and mail/provider infrastructure. Add safe scoped document/export handling, actual configuration/readiness reporting, agreement generation/change analysis, signing adapter boundaries and owner-approved analysis. Client bodies never assert an owner identity, verified signature or contractual execution.

### U4. Extend the existing RTL research interface

Add owner overview/search/filters, per-researcher folders and the requested forms/workflows in `research-management.html`. Use existing lifecycle/cancellation/data-clearing behavior. Show only authorized actions. Provide draft resume, readable version comparisons, contextual explanations, missing-field review and operational dependency states. Preserve single-message simplicity and all current tools.

### U5. Verify and deliver locally

Integrate the new migration with isolated PostgreSQL tests, HTTP workflows and desktop/mobile browser checks. Verify the full regression suite, simplify/review the actual changes, resolve actionable findings, record evidence and create local commits. Do not push/deploy or activate external services.

## Acceptance and verification

1. Shoshi and Einat have different studies and individual folders. Search/list/counts, guessed URLs, API IDs, nested record references, documents, exports and browser restoration never reveal the other researcher's private materials.
2. Repeat those checks for two researchers in the same study, with record-specific explicit access and approved publication viewers.
3. Revocation and password rotation invalidate subsequent access; client-supplied owner/status/signature evidence is rejected by server and database.
4. A researcher saves/submits an application, responds to changes requested and resumes a draft. Owner sees the correct researcher/study and immutable versions.
5. A submitted finding is invisible to approved-findings-only peers until the exact version is owner-approved and published for those viewers. Download is an independent permission. Withdrawal removes subsequent access.
6. A researcher cannot approve her own proposal as owner, publish findings, expand grants, see other folders or run arbitrary analyses.
7. Contribution status/term revisions preserve the initial proposal; unsigned proposals/approvals never create binding obligations or financial commitments.
8. Agreement values update preview and exports; fields reuse existing records, preserve mixed Hebrew/English/dates/numbers and show required-field gaps. Changes invalidate prior approvals and preserve exact before/after terms.
9. With no signing provider, execution and partnership activation fail closed with an honest dependency state. Provider adapter tests use invented credentials/evidence; they are not proof of operational or legal verification.
10. Signed versions and evidence are immutable; amendments are new versions requiring mutual approval and signatures. Obligations remain tied to the executed source version.
11. Existing questionnaires/consent, research isolation, professional communication and security/backup tests continue passing. Database tests use the unchanged real SQL in a local isolated engine; hosted concurrency and real provider delivery are separate authorized checks.

## External prerequisites and limits

No approved full Word agreement/template, owner-approved IP explanatory text, operational signing-provider credentials/authority policy, or Google OAuth client configuration has been supplied to this development clone. Preserve owner-entered approved text/version references and clearly identify these missing operational dependencies. Do not purchase or activate a provider. A local synthetic workflow is never displayed as a live signed agreement or real research finding.

Backups have independent encrypted copies, but real PostgreSQL/provider disaster restoration, an actual different-computer recovery exercise, refresh of the 15 October data snapshot, browser-only draft coverage, active-secret incident remediation and backup scheduling remain documented operational work. Continuing isolated development does not imply those gates were completed or authorize a production release.
