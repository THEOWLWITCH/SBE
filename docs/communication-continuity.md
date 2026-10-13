# ניהול שיח מתמשך · Communication Continuity

Version 1.0.0, prompt 1.0.0, principles 18-1.0.0, private JSON schema 1. The model identifier is recorded from the provider response or configured provider model with every generation/extraction. Built from BE GOOD main 668fc9d on `feat/communication-continuity`. This release has not been deployed or merged.

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

Open `http://127.0.0.1:8791/entry.html`, sign in normally using a personal staff/administrator code with the existing `writer` entitlement, then open `communication-continuity.html`. The local proxy rewrites gateway URLs only in locally served bytes so the normal sign-in workflow uses the local real API. It provides no fake auth, AI or database. System administrators can open the module from their existing screen menu.

## Product workflow

Paste text and select a response/action immediately. Optional audience, message type and instruction appear in an expandable panel. A saved conversation has an ordered timeline, status, UUID, dates and received-message round count. Seven main actions and seven revision styles use canonical saved history. Editing keeps the previous text. A revised AI version is a separate linked draft. `שלחתי את ההודעה` explicitly creates an immutable sent snapshot; nothing is sent externally. Closing proposes a draft; resolving the conversation is an explicit status decision.

All eighteen principles are in the optional `עקרונות התקשורת של BE GOOD` panel. They apply selectively without quotas. Existing letter-writing behavior is preserved. The current brief's concise-output and collaboration/referral instructions apply narrowly to this new module, while existing tools retain their historical global policies.

JSON export includes canonical history, metadata and separately labelled unsaved draft edits. Text and styled PDF use the current edited wording while retaining the previously saved wording and revisions. Export files may contain sensitive conversation text; their handling follows the user's chosen device and institutional arrangements.

## Storage and privacy

POST `/api/communication-continuity` rechecks signed tokens and live `writer` entitlement for every action and again after AI calls. Only personal staff/instadmin code identities and the system account can store sensitive conversations. Legacy institution, course, student and open-link sessions do not establish individual ownership and are denied. A personal code is an account identity: sharing that code shares its records. Distinct personal codes and system administrators have isolated namespaces; administrators have no implicit access to another user's conversations.

The existing server-only table stores one versioned row per conversation at `cc:<trusted-owner-hash>:<UUID>`. Client-supplied owners/keys are ignored. Responses are `private,no-store`. Atomic conditional updates compare the stored revision inside the PostgreSQL update, preventing lost concurrent edits. Compact request receipts make retries idempotent without duplicating private history. A deletion removes raw history, generated results, research fields and retry payloads; a content-free tombstone prevents delayed responses resurrecting it. Provider processing/retention and database backups follow the existing service arrangements, separate from deletion of the product's active row.

Private content never enters generic pipeline jobs, their public status endpoint, external analytics or public examples. Errors and new route logs contain no conversation/provider response content. No WhatsApp import or automatic external sending is implemented.

Uploads show a notice before processing. TXT/DOCX are read fully in the browser using already-vendored JSZip. Images and PDF are sent transiently to the configured supported vision model. Only actual, nonempty extracted text and source metadata are saved; unreadable results produce an error. Binary files are not persisted in browser storage or server rows. This is model-assisted transcription, so the educator can inspect the recorded text; live OCR accuracy remains to be evaluated with the configured model. The OpenAI adapter follows the official [image-input](https://developers.openai.com/api/docs/guides/images-vision) and [file-input](https://developers.openai.com/api/docs/guides/file-inputs) formats and uses `store:false` for the new module.

Long histories are explicitly summarized in bounded chunks, preserving structured facts, commitments, disagreements, open questions, uncertainty, draft/sent distinction and ordered source IDs. Raw messages remain intact. Context summaries are separate timeline entries and shown as such. Bounds reject visibly rather than slicing content: 120,000 characters per input, 10 MiB binary attachment, 1,000 timeline entries, 2,000 request receipts, 1,000 conversation rows per owner including tombstones and 12 MiB per row/list response. These limits and conservative token accounting can require a smaller attachment or an appropriately configured model window.

Research is dormant by default. No raw communication is collected for research. The backend supports a separate research envelope within the private professional row, only with a server-owned approved study, approved metadata fields and valid independent consent. The deployed route supplies no approved study, so ordinary users cannot enroll or collect research data. Consent is distinct from ordinary terms; questionnaires are absent from the communication flow. Any future dedicated collection/export requires separately authorized study infrastructure.

## Test and verification

```sh
cd harness
node --test
```

The integrated suite passed 189/189, including 37 new focused AI/backend/adapter checks. Tests cover owner isolation, shared-session denial, revoked permission, concurrent save conflicts, safe retries, dropped responses, delete during AI, raw history, draft versions, sent snapshots, context summary coverage, error privacy, extraction contracts and research consent. Deterministic prompt/contract tests cover all ten requested educational scenarios. They do not prove a language model will never invent facts.

For the real UI journey, install/use Playwright in a development environment and run from the repository root:

```sh
node harness/communication-browser-check.mjs work/communication-browser-check
```

`PLAYWRIGHT_PACKAGE` can point to an existing Playwright package; `PLAYWRIGHT_CHANNEL=chrome` selects installed Chrome. The check uses the real handler and UI, isolated in-memory storage and explicitly synthetic model responses; external browser requests are blocked. It passed create/draft/edit/sent/continue/reload/rename/archive/reopen/export/delete, second-user denial, eighteen principles and a 390-pixel mobile overflow check. Screenshots and a JSON result record are produced. Edge failed to launch in this environment; Chrome passed. No lint/typecheck command is configured; changed JavaScript passes Node syntax checks.

The first loopback adapter run's automatic approval review expired. Its PostgREST request/response check therefore uses injected HTTP fixtures. Browser and complete-suite checks later ran with local networking enabled. Live Supabase transaction/RLS and model/OCR accuracy have not been verified here because this chat environment has no service credentials.

Opt-in live model evaluation uses only the ten synthetic scenarios:

```sh
node harness/communication-eval.mjs --live
```

Inspect its generated results for invented facts, agreements, intentions, emotions, institutional policies and outcomes, preserved revision intent, appropriate referrals and essential clarification. Human educational review is required; passing shape checks is not factuality approval. Supply the normal provider environment first. Never use sensitive production conversation data as fixtures.

## Authorized deployment only

Do not merge into `main`, apply production SQL or deploy until instructed. Before an authorized release, use a staging configuration to verify the existing table schema (`key` primary key, `value` JSONB, `updated_at`), service role operations and denied anonymous/authenticated direct access. The pending hardening script `harness/migrations/20261013-communication-storage.sql` targets the existing table, enables RLS and revokes client grants. It aborts if unexpected public/client policies exist so they can be reviewed; it has not been applied.

Then verify real-model scenario and Hebrew image/PDF transcription quality, real two-account isolation, persistence across server restart and concurrent database revisions. Deploy the Node route before opening the new static screen, preserving existing secrets and services. Netlify's existing branch-ignore rule builds only `main`; this feature branch can be reviewed without production deployment. Rollback by reverting this module commit and its navigation changes; do not silently delete stored conversation rows. Keep versioned exports available under the approved data-retention process.
