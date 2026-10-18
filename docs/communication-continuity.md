# תקשורת מקדמת חוסן חברתי · Communication for Social Resilience

Version 1.1.0, prompt 1.1.1, AI engine 1.1.1, principles 18-1.0.0, additive private JSON schema 2. Earlier schema-1 conversations remain readable and retain their original provenance. Every generation/extraction records the actual response model or configured provider model. The same engine and eighteen principles serve both modes. Built from BE GOOD main 668fc9d on `feat/communication-continuity`, reusing the completed ongoing implementation at 984a958. This release has not been deployed or merged. The revised implementation plan was updated and independently reviewed before implementation. Prompt/engine 1.1.1 records the reviewed image-extraction correction; existing 1.0.0 and 1.1.0 provenance stays unchanged.

## Run

The existing stack is unchanged: static `app/` on Netlify, Node `harness/practice-server.mjs` on Render, existing Supabase `access_settings` behind its service key, existing Anthropic/OpenAI provider integration. No new runtime packages or backend service are required.

Configure the Node server using the existing `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` and the selected provider's `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`. `PROVIDER` defaults to the existing Anthropic setting; `MODEL` retains the existing configured identifier. Optional `COMMUNICATION_CONTEXT_TOKENS` declares that model's actual context window; the module conservatively uses 32,768 when unset. Avoid setting a larger window than the provider actually supports. Optional existing `ANTHROPIC_WORKSPACE_ID` applies as before. Secrets stay server-side.

Run the real API in one terminal:

```sh
node harness/practice-server.mjs --port 8790
```

Run the local frontend proxy in another:

```sh
node harness/communication-dev.mjs --port 8791 --api-port 8790
```

Open `http://127.0.0.1:8791/entry.html`, sign in normally with the existing `writer` entitlement, then open `message-writer.html`. Single mode is the default; `message-writer.html?mode=continuity` opens ongoing mode. The old `communication-continuity.html` redirects into ongoing mode, preserving other query parameters and the hash. The local proxy rewrites gateway URLs only in locally served bytes so normal sign-in uses the local real API. It provides no fake auth, AI or database. System administrators can open the unified tool from their existing screen menu. Saved ongoing content additionally requires a personal staff/administrator code or system account.

## Product workflow

One Hebrew RTL workspace offers **ניסוח חד־פעמי** and **ניהול תקשורת**. Its purpose is to help educators intentionally use everyday communication to support trust, empathy, shared agency, preparedness, shared skills and social resilience. It supports professional judgment without claiming that wording alone guarantees those outcomes.

In single mode, enter a short natural instruction for a message, letter or announcement and choose `ניסוח המסר`. Audience, format, local details, signature and uploaded materials are optional. Edit the result, copy immediately, request one of seven revisions, or export. Sources and versioned drafts exist in this tab only. Opening single mode does not load private conversations, automatically restore a legacy draft, or create a saved row. An explicit legacy-draft import can copy the user's existing scoped writer draft into the source field; its old stored data remains intact. No new single-mode browser persistence is added. Reloading or closing the tab loses the transient document unless exported or converted.

`המשך בניהול תקשורת` explicitly converts a signed single document into a saved process. It includes pending input/material changes and signed manual draft edits, retaining original sources, source IDs, drafts, previous wording, model identifiers and version records. Conversion does not call AI again or mark a draft sent. Atomic request receipts and retained client retry operations prevent duplicate destinations after a lost response. Switching the mode selector alone never saves or converts, and each mode retains its separate tab buffer. Successful conversion selects ongoing mode and records that mode in the URL so reload reopens the saved-conversation workspace.

In ongoing mode, paste received text and select an action immediately. Optional audience, message type and instruction appear in an expandable panel. A saved conversation has an ordered timeline, status, UUID, dates and received-message round count. Seven main actions and seven revision styles use canonical saved history. Editing keeps previous text. A revised AI version is a separate linked draft. `שלחתי את ההודעה` explicitly creates an immutable sent snapshot; nothing is sent externally. Closing proposes a draft; resolving the conversation is an explicit status decision. Conversation history, summaries, agreements, unresolved issues and follow-up belong to this mode.

The educator's instruction is saved as a separate marked note before the browser starts generation, so it survives an AI failure and reload. Reusing the same latest instruction adds no duplicate note. Local title/status/audience drafts survive conflict refresh; clean fields follow the refreshed server record. Unsaved text, draft edits, metadata and instructions receive a leave-page guard.

All eighteen principles are in the shared optional `עקרונות התקשורת של BE GOOD` panel. They apply selectively without quotas. The standalone legacy writer prompt/mount has been retired; its adviser report helpers remain for the other existing tools. Both modes use the new shared server engine, including concise explanations, uncertainty and appropriate collaboration/referral.

Single copy, text and styled PDF use the current finished message, including pending local wording, and work without a server request. Private source instructions and earlier drafts belong to its full JSON archive. That archive includes source/draft/model/version provenance and explicitly labelled `manual-local` unsaved revisions; those revisions are not attributed to the AI. Changed composer fields and newly uploaded signed materials are preserved separately in `exportPendingInput`, with the export time, current versions and signed base revision. Exporting does not alter the signed document or attribute pending source changes to the AI. Ongoing JSON includes canonical history, metadata and labelled unsaved edits; ongoing text/PDF include the communication record with current wording and previous saved revisions. Handle exported private information according to the user's device and institutional arrangements.

The existing administrator demo lab can generate explicitly fictional examples in either mode through the actual tool/provider. Single examples capture the fresh draft; ongoing examples capture only their newly created timeline. Approved examples from both old identifiers appear under the unified product in the public library. Private saved conversations never enter it.

## HTTP contract

The endpoint uses a flat result envelope `{ok,status,...out}`: successful `out` has `conversation`, `conversations` or `deleted`; errors have `code,error`. `status` is the actual application result (200, 400, 403, 404, 409, 413, 422 or 503). Clients must inspect `ok` and `status`, even when HTTP transport is 200. Auth/input errors and short operations carry the same status in HTTP. Long AI requests commit HTTP 200 and whitespace keepalive before provider work to avoid the existing Render idle timeout; later failures retain their true application status in the envelope. The UI uses that status for conflicts and retries. This explicit result envelope supersedes the original plan's transport-status assumption for kept-alive requests without introducing public job storage.

The existing endpoint also dispatches `singleGenerate`, `singleExtract` and `singleEdit`, returning `{document,proof}` or `{material,proof}`. These actions never persist a conversation. Documents/materials carry identity-bound HMAC proofs signed server-side with the existing token secret; tampering or use by another identity is rejected. Manual edits become signed new versions before an AI revision or conversion. Long single materials may require context summaries; every intermediate summary's model, source IDs and versions are retained on the result's `contextSummaries` audit field, while full source text remains intact. Prior audit summaries are excluded from later single-mode generation. `convert` accepts `{id,requestId,expectedRevision:null,document,proof,input?}` through the existing private-owner/CAS boundary. Its optional current input preserves pending changes without discarding original sources. No binary attachment is included in the signed document.

`list` returns only `id,title,audience,status,createdAt,updatedAt,revision,rounds,versions`, projected at the database. Use `get` or `export` to fetch one complete history. Successful mutations include content-free public `actions` provenance with action/time/revision/tool, prompt, engine, principles and schema versions; request fingerprints and IDs stay private. Deletion retains only a content-free tombstone and its versioned receipt. Older receipts without version evidence are not retroactively attributed to a current release.

## Storage and privacy

POST `/api/communication-continuity` rechecks signed tokens and live `writer` entitlement for every action and again after AI calls. Single mode preserves currently eligible writer access, including supported shared institution/open sessions; existing course/student policy is not broadened. Only personal staff/instadmin code identities and the system account can store or convert sensitive conversations. Legacy institution, course, student and open-link sessions do not establish individual ownership and cannot use private storage. Denied conversion retains the single document for editing/export. A personal code is an account identity: sharing that code shares its records. Distinct personal codes and system administrators have isolated namespaces; administrators have no implicit access to another user's conversations.

The existing server-only table stores one versioned row per conversation at `cc:<trusted-owner-hash>:<UUID>`. Client-supplied owners/keys are ignored. Responses are `private,no-store`. Atomic conditional updates compare the stored revision inside the PostgreSQL update, preventing lost concurrent edits. Compact request receipts make retries idempotent without duplicating private history. A deletion removes raw history, generated results, research fields and retry payloads; a content-free tombstone prevents delayed responses resurrecting it. Provider processing/retention and database backups follow the existing service arrangements, separate from deletion of the product's active row.

Private content never enters generic pipeline jobs, their public status endpoint, external analytics or public examples. Errors and new route logs contain no conversation/provider response content. No WhatsApp import or automatic external sending is implemented.

Uploads show a notice before processing. TXT/DOCX are read fully in the browser using already-vendored JSZip. DOCX uses both advertised-size preflight and a cumulative 16 MiB actual decoded XML-byte bound, with streaming decode and no oversized XML parsing. Images/PDF are sent transiently to the configured supported vision model. Single image materials permit objective visual description plus visible text, preserving the writer's drawing use case. The provider returns visible text and visual description separately; the attribution guard checks only the description, so an emotional quotation in the source remains verbatim. Ongoing image/PDF extraction and single PDF extraction use exact transcription. Only an actual nonempty extraction becomes a signed tab material or an ongoing received entry; unreadable results or failed description repair produce an error without a material/proof. Binary files are not persisted in browser storage or server rows. The educator can inspect extracted text; live accuracy remains to be evaluated with the configured model. Existing OpenAI image/file input formats and `store:false` are retained.

Long histories are explicitly summarized in bounded chunks, preserving structured facts, commitments, disagreements, open questions, uncertainty, draft/sent distinction and ordered source IDs. Every fragment carries source role, date and relevant links. Independent summaries run with at most two concurrent calls; assembled results retain source order, and already-started calls settle before a failure returns. The exact selected current draft and its intent remain outside compacted history, or the action rejects explicitly before provider work if that anchor cannot fit. Each summary records its own actual model identifier. Raw messages remain intact. Context summaries are separate timeline entries and shown as such. Bounds reject visibly rather than slicing content: 120,000 characters per input, 10 MiB binary attachment, 1,000 timeline entries, 2,000 request receipts, 1,000 conversation rows per owner including tombstones and 12 MiB per row. Metadata-only navigation remains available when the combined histories exceed 12 MiB. These limits and conservative token accounting can require a smaller attachment or an appropriately configured model window.

Research is dormant by default. No raw communication is collected for research. The backend supports a separate research envelope within the private professional row, only with a server-owned approved study, approved metadata fields and valid independent consent. The deployed route supplies no approved study, so ordinary users cannot enroll or collect research data. Consent is distinct from ordinary terms; questionnaires are absent from the communication flow. Any future dedicated collection/export requires separately authorized study infrastructure.

## Test and verification

```sh
cd harness
node --test
```

The ongoing 1.0.0 implementation passed 211/211 before this architecture update. Unified 1.1.0 passes 263/263 integrated tests, with no skips or failures, and 26 real-browser journeys. Added tests cover transient writes, current writer access, identity-bound source proofs, shared engine use, exact revisions, pending conversion inputs, old provenance, atomic conversion retries, equal-revision edit recovery, corrected validation rejection, complete pending-input archives, mode isolation, optional legacy import, offline copy/export and clean single-message printing/demos. Existing coverage retains owner isolation, revoked access, CAS conflicts, deletion races, raw history, sent snapshots, bounded context summaries, draft anchoring, attachment bounds, private errors and independent research consent. Extraction tests distinguish verbatim quoted text from guarded visual description and verify repair/rejection without a signed result. Deterministic prompt/contract tests cover all ten educational scenarios; they do not prove a language model will never invent facts.

For the real UI journey, install/use Playwright in a development environment and run from the repository root:

```sh
node harness/communication-browser-check.mjs work/communication-browser-check
```

`PLAYWRIGHT_PACKAGE` can point to an existing Playwright package; `PLAYWRIGHT_CHANNEL=chrome` selects installed Chrome. The check uses the real handler and UI, isolated in-memory storage and explicitly synthetic model responses; external browser requests are blocked. It covers both modes, conversion and the original ongoing journeys, including a 390-pixel mobile overflow check and administrator examples excluding private history. Screenshots and a JSON result record are produced. Print preview content/layout is inspected; actual PDF pagination is not tested. No lint/typecheck command is configured; changed JavaScript receives Node syntax checks.

PostgREST projection/CAS checks use injected HTTP fixtures. The actual practice-server route test uses an isolated HTTP database fixture and intentionally unavailable provider. Browser and complete-suite checks use local networking outside the sandbox. Live Supabase transaction/RLS and model/OCR accuracy remain unverified because this chat environment has no service credentials. The completed original code review and its eleven addressed findings remain recorded in `docs/communication-continuity-review-resolution.md`. The fresh unified review against 984a958 completed with six confirmed findings; all six were fixed and independently validated. See `docs/communication-social-resilience-review-resolution.md` and the release QA record for the frozen review scope, receipts and final checks.

Opt-in live model evaluation uses only the ten synthetic scenarios:

```sh
node harness/communication-eval.mjs --live --mode both --output work/communication-eval.json
```

This evaluates the same ten synthetic scenarios in each mode; `--mode single` or `--mode continuity` narrows it. In single mode the full supplied exchange is explicit one-time source material, not saved memory. Inspect outputs for invented facts, agreements, intentions, emotions, institutional policies and outcomes, preserved revision intent, appropriate referrals and essential clarification. Human educational review is required; passing shape checks is not factuality approval. Supply the normal provider environment first. Never use sensitive production conversation data as fixtures.

## Authorized deployment only

Do not merge into `main`, apply production SQL or deploy until instructed. Before an authorized release, use a staging configuration to verify the existing table schema (`key` primary key, `value` JSONB, `updated_at`), service role operations and denied anonymous/authenticated direct access. The pending hardening script `harness/migrations/20261013-communication-storage.sql` targets the existing table, enables RLS and revokes client grants. It aborts if unexpected public/client policies exist so they can be reviewed; it has not been applied.

Then verify real-model scenario and Hebrew image/PDF transcription quality, real two-account isolation, persistence across server restart and concurrent database revisions. Deploy the Node route before opening the new static screen, preserving existing secrets and services. Netlify's existing branch-ignore rule builds only `main`; this feature branch can be reviewed without production deployment. Rollback by reverting this module commit and its navigation changes; do not silently delete stored conversation rows. Keep versioned exports available under the approved data-retention process.
