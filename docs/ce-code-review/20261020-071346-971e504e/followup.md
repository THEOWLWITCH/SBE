# Review followup — self-service partnerships

The actual `ce-code-review mode:agent` receipt is [review.json](review.json): `status: complete`, run `20261020-071346-971e504e`, reviewed head `44eca17ae55ba59eaa16b94c71b5f651e1822a4b`, verdict `Ready with fixes`. All 11 lenses returned; independent validation confirmed all eight actionable findings. A different-provider pass was unavailable; the local adversarial lens ran. The review is read-only; this followup records caller-owned changes after its completion.

Captured review inputs are retained verbatim. The stored patch has single-space blank context lines and the generated prompt templates have final blank lines; whitespace-check reports on those evidence files do not describe application source defects. Source and delivery-document whitespace checks passed separately.

All eight confirmed findings were applied inline by the orchestrator after checking the cited source and reproducing the behavioral failures. No further review was dispatched.

| # | Applied fix | Evidence |
|---|---|---|
| 1 | Owner approval loads the complete authenticated study bootstrap, including studies without a partnership. | UI proof selects a previously unpartnered study. |
| 2 | Every approval fetches the current study revision immediately before the request. | Two consecutive approvals send revisions 7 and 8. |
| 3 | Public requests abort after 30 seconds; a failed network attempt retains its request UUID. | A stalled fetch aborts with the native signal reason and the successful retry uses the same UUID. |
| 4 | A completed terms refresh reads the live controls; a late refresh cannot replace a submitting form or a receipt. | Actual UMD focus/pageshow listeners preserve typing and acknowledgement, and a changed terms version clears acknowledgement. |
| 5 | An additional under-review note appends a new immutable review event under the current revision. | SQL proof keeps both notes, rejects stale revisions and creates no rights. |
| 6 | Owner view navigation invalidates pending reads and feedback from earlier views. | Delayed intake detail cannot replace the newer terms draft. |
| 8 | The public route bounds access-settings requests to 8 seconds using the existing Supabase store timeout. | HTTP proof returns safe unavailable status after a stalled secret read. |
| 11 | The public partnership page is registered in the owner's central screen inventory with its public audience. | `screens-menu.js` entry; the private access guard is unchanged. |

Public rate and unavailable errors now use context-specific, allowlisted messages without implying that an email was sent. The static workspace replacement explicitly preserves the previous visibility, consent, released-record and document predicates, adding only study details and the selected partner's current grants.

Reported coverage gaps closed locally: SQL/core intake-contract parity; real focus and persisted-pageshow listener wiring; complete hardened migration order under a non-superuser operator, including submission, approval, current permissions and denial of browser RPC access. The tests added before the fixes failed for the reported behaviors and passed afterward.

The automatic union-of-grants proposal remains rejected: the agreed contract requires exactly the owner's selected permissions. No actionable review finding remains unapplied.

Cross-connection locking under hosted PostgreSQL remains a release verification gap. The local PGlite fixture serializes calls and does not prove that property; no production concurrency test, migration or deployment was authorized or performed. Final suite and browser evidence are recorded in [the verification report](../../verification/2026-10-20-partnership-intake.md).
