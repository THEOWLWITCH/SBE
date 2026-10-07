# Live access and atomic persistence

Signed sessions are revalidated against the current institution, subscription,
credential, module ceiling and administrator password version. `resolvePrincipal`
returns `ownerId`, `tenantId`, `permissions` and an optional academic quota scope.
Its source token is non-enumerable and must not be stored in jobs or logs.
`authorizePermission` retains the existing Studio API and returns this same live
principal. Exhausting an academic production quota prevents new reservations;
it does not hide the last successful result from its owner.

Institution sessions share the institutional principal `legacy-inst:<institution>`.
Different institutions cannot compare equal through `c:LEGACY`. Staff identities
use their normalized server code; course identities also include their signed
device ID. Institution-code rotation and administrator-password replacement
invalidate previously issued current-format tokens. Earlier institution tokens
are accepted only while their saved institution has no recorded code rotation.
Earlier academic tokens are accepted only if the current academic-code record
predates their inferred issue time. Neither compatibility path guesses ownership
for records without a proven institution.

Existing journeys/workshops retain their own stored tenant. An old LEGACY or
empty institutional owner is mapped only with that saved tenant; ambiguous rows
stay inaccessible until reviewed by an administrator. New rows have explicit
`ownerId` and `tenantId`. Workshop creation ignores client institution fields.
Facilitators can list their institution's workshops, as the documented product
requires; deletion and reopening still check their own workshop ownership.
Journey writes use a database compare-and-set and optional `baseVersion`; stale
versions return 409. The caller keeps its unsaved input for correction/retry.

## Anonymous actions and workshop entry

Anonymous data actions are `jrCert`, `wfJoin`, `wfGet`, `wfSubmit`, `resilInfo`
and `resilSubmit`. `login` is credential bootstrap. `jrTick` has its separate
cron secret. Public `renewRequest` remains a validated renewal/new-subscription
intake because purchasing and expired subscriptions need it; it grants no code,
module or institution access. `renewInstitutions` and all administrative renewal
actions require authentication. Criteria and community-list reads require their
live module permissions. Protected resilience reads require a live authorized
session and the classroom management key (system administrators are exempt from
the key), including when importing an existing questionnaire.

`wfJoin` returns a signed participant token, role permissions and device ID,
bound to the workshop's live code map, institution, facilitator authority and
24-hour expiry. Trainee/actor roles have practice, conversation, activity and
academic permissions; parent/youth roles have practice and conversation.
These tokens grant no facilitation, journey, research or mapping access. This is
a workshop/device identity, not a verified named account. Owner and tenant caps
also limit requests across self-selected device identities.

## Server quota contract

Call `reserveAIUsage(store,principal,{requestId,requestHash,maxTokens,tokenBudget})`
before the provider and settle only validated success with
`settleAIUsage(...,{requestId,outcome:'commit'})`; errors release. A generation
uses one academic production reservation regardless of its bounded internal
calls. `maxTokens` caps one call at 32,000; `tokenBudget` reserves the worst-case
total across stages/retries, up to 512,000. If precise provider usage is absent,
the conservative token budget remains charged. Reservations expire after one
hour and the database reclaims expired capacity before admitting requests.
`AI_LIMITS` enforces owner and tenant concurrency, daily request and token caps.
Current daily conservative token allowances are 1,000,000 per owner and
10,000,000 per tenant; these are admission budgets, not dollar cost estimates.
The four-stage narrative pipeline uses at most one physical attempt per stage
inside its 256,000 allowance. An explicit retry after a confirmed terminal loss
uses a fresh request ID and a new reservation. Shared completion adapters may
retry once, with live authorization checked again before that attempt.
Every distinct reservation counts toward daily attempts and its conservative
token budget, including released and expired attempts, because a failed provider
call may already have incurred cost. Release frees concurrent capacity and
academic production/seat capacity; it does not reset daily cost admission.
Equal IDs and hashes are idempotent; changed contents return 409. A released or
expired reservation cannot later become a successful committed generation.
The legacy `codeUse` action is now an uncharged availability preflight. Only
server completion can consume a course/student production, and pending course
reservations occupy seats until release or expiry.

Persistent adapters expose `putIfAbsent`, `compareAndSet`,
`atomicOpenWorkshop`, `atomicAppendWorkshop`, `atomicReserveUsage`, `atomicSettleUsage` and
`finalizeAIJob`. Finalization compares the job's prior JSON state and commits or
releases its quota in the same transaction as the job transition. The principal
passed to finalization contains owner and tenant only; the caller must recheck
live access before requesting commit. A stale/cancelled state cannot overwrite
a newer job. `createAtomicMemoryStore` is an explicitly local test adapter; it
is not evidence of multiprocess database correctness.

Workshop feedback includes a stable client `submissionId`; equal content retries
deduplicate and changed content returns 409. Older callers get a random server
submission ID, preserving every send while requiring updated clients for retry
deduplication. RPC row locks enforce the 400-entry limit and preserve concurrent
submissions in the existing `entries` shape.
Workshop creation claims its code map and owner in one transaction, so concurrent
open requests cannot replace another facilitator's workshop. Supabase list reads
use 500-row keyset pages through an empty page, avoiding the service's default
row cap even if it is configured below that page size.

## Structured research export

Research consent is checked on each export. Version 2 includes only an export
pseudonym, closed unit/stage/event/decision fields, a month instead of an exact
timestamp, and numeric codes for the six predefined reasons. Choice labels,
explanations, names, contacts, people, reflections, effects, repeated actions,
unique incident descriptions and unrecognized reason text are excluded.
This is a structured research extract, not a guarantee of full anonymity.
Qualitative text needs a separate reviewed/redacted path; that path is not
implemented. Resilience formulas, selected questions, scoring and history were
not changed; existing Studio aggregation tests continue to pass.

## Deployment, rollback and verification

1. Back up `access_settings` and record its RLS policies/grants in a dedicated
   staging database. Review `migrations/20261007_access_atomic.sql`, especially
   service-role-only RPC execution and revoked direct browser table privileges.
2. Apply that migration in staging. The adapter calls the real PostgREST RPC
   endpoint for each atomic operation. Missing RPCs return 503 before a paid
   provider or feedback write; there is no get/set fallback.
3. Run `migrations/verify_access_atomic.mjs` against staging only, supplying
   `BEGOOD_STAGING_ATOMIC_TEST=1`, `BEGOOD_STAGING_SUPABASE_URL` and
   `BEGOOD_STAGING_SERVICE_KEY` through your secret environment. It uses isolated
   synthetic keys, sends 20 concurrent quota/claim RPC requests and 100 feedback
   requests, checks idempotency/conflicts, races 20 atomic job finalizations,
   rejects foreign/revoked commits, verifies failed-job release, and removes its
   own synthetic records. These staging cases are prepared but unrun.
4. Verify denied browser roles and authorized service-role calls, renew intake,
   institution/course/academic entry, workshop participant entry, cancellation,
   source ownership, 409 recovery and server restart in staging. Release the
   server and matching client after these checks.

No migration, paid API call or network verification was performed in this task.
There is no local PostgreSQL binary. Offline regression tests verify the identity,
privacy, local atomic semantics, Supabase RPC request contract and fail-closed
behavior. They do **not** establish deployed database concurrency correctness.
The staging verifier is supplied but unrun. The initial seven regressions all
failed against the baseline; after correction the access/privacy tests and
existing Studio backend tests pass.

For rollback, retain the new RPCs and private grants while rolling back clients
or disabling AI generation; do not restore the vulnerable lost-update writes or
public private-table grants. Restore a backed-up row only after ownership review.
No destructive data conversion is required: existing feedback arrays remain in
place and old ownership is read compatibly from a proven saved tenant. Keep
usage/job records for their idempotency window, and retain all today's usage
reservations (including releases) until daily caps no longer depend on them;
only expired outputs may be
removed by the server's retention policy. Quota ledger maintenance beyond the
current daily admission/expiry logic is an operational follow-up.
