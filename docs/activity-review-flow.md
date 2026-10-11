# Private narrative preparation

This pilot connects `input-screen.html` → `SBE_BUILD.showEdu` / `docsPanel` → `SBE_ACTIVITY_REVIEW` to the authorized `/api/artifacts` API. It covers narrative scenarios generated through the validated pipeline. Activity and conversation planners and the existing Studio remain separate flows.

The adapter uses the original `scenario._generation.pipelineOutput` and `context`; without them it refuses to create an artifact. Purpose starts from `context.given.goals`, individual skills from the original skills, and stable steps from turning points. Resilience components, shared skills, facilitator guidance and the social mechanism start empty and visibly missing. Step minutes are editable estimates, not model evidence.

The planner can edit all six explanation fields, add or remove steps, ask about a specific stable step, request a refinement, or discuss a private concern. The concern is sent as `privateConcerns`, separately from participant content. Textareas, proposal rationale, before/after values, source IDs, unknowns and risk flags use DOM text nodes; model markup does not become executable HTML. The panel has RTL layout, input labels, visible keyboard focus and live status announcements.

Saving creates or updates a private artifact using `expectedVersion`. Local work is saved under `sbeUserKey` and the artifact ID. A save that finishes after another edit updates the server base version while keeping the new visible local draft dirty. A conflict keeps the local draft; explicitly opening the server version retains a recoverable copy for comparison. Save failures show a failure message. A personal JSON backup includes private concerns and is labeled private.

AI requests use authenticated asynchronous transport with distinct request and idempotency IDs. Polling accepts the current top-level `{artifact,review}` result and an output wrapper. Cancellation also calls the authenticated job cancellation endpoint. An explicit retry preserves the logical review idempotency key but starts a new transport request. Partial, failed and fallback reviews are shown; proposals do not change the activity. Accept/reject are human actions. A proposal cannot be accepted over unsaved edits or a newer base version, so a late result cannot restore a removed step.

Approval requires a saved version with all explanations and valid steps, plus the planner's checkbox acknowledgment. Edits, saves, reloads and proposal decisions clear that acknowledgment. The request sends `acknowledgeRisks:true`; the server owns the final risk and permission checks. A practice link appears only when that exact version has an approved snapshot: `practice.html?artifactId=…&version=…`. The parent integration owns practice preparation and its version-bound observation/next-step loop; the existing AI roleplay examples are a separate feature.

Narrative generation now uses dotted exact locks, stable request IDs and authenticated cancellation. Reset, source-field edits and the cancel button invalidate the outstanding run. An invalidated result cannot open a replacement product dialog. Workshop choices are saved only from the server-derived scenario after explicit approval. Original narrative HTML downloads remain labeled private backups; edited steps and explanations are saved in the artifact and opened through its approved practice link.

Local verification (no paid model calls):

```powershell
node --preserve-symlinks --preserve-symlinks-main --check app/lib/activity-review-ui.js
node --preserve-symlinks --preserve-symlinks-main --check app/lib/narrative-build.js
node --preserve-symlinks --preserve-symlinks-main --test harness/tests/activity-flow.test.mjs
```

The first seven controller regression tests failed before implementation and passed afterward. Fourteen tests now cover missing explanations, stable IDs, local reopening, late saves/reviews, recoverable conflicts across repeated refreshes, explicit decisions, risk acknowledgment, private concern separation, async authenticated cancellation, actual editor DOM text/labels/controls, narrative cancellation and input-screen script integration. The DOM fixture rejects any `innerHTML` assignment. Browser integration and broader server checks are owned by the parent task. Human evaluation of educational quality is still pending; these checks establish behavior and boundaries, not efficacy.
