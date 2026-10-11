## Agent-Native Architecture Review

### Summary

Be Good uses bounded AI assistants to draft and review educational material. The Team Learning Lab sends the selected context, activity, source catalogue, and relevant conversation to its assistant. Human approval, practice records, private evidence, and export are deliberately outside the assistant’s authority. I found no agent-context or capability defect introduced by the reviewed Team Learning Lab integration.

### Capability Map

| User action | Agent capability | Context supplied | Status |
|---|---|---|---|
| Generate a Team Learning Lab activity | `buildRequest(..., "generate")` | Context, selected approaches, permitted sources, output contract | Covered |
| Ask about a draft or step | `buildRequest(..., "question")` | Current activity, selected step, relevant conversation | Covered |
| Ask about an approved practice version | `buildRequest(..., "question")` | Explicitly selected frozen approval and step | Covered |
| Request support about private concerns | `buildRequest(..., "support")` | Concerns only after an explicit request | Covered |
| Review a planning artifact | `runAgentReview` | Artifact, locks, approved source catalogue, role-specific context | Covered |
| Approve, record a real meeting, choose shared material, or export | No agent command | Human decisions and private evidence boundary | Intentional |

### Findings

No findings in the reviewed agent-facing delta.

### Upstream-only observation

**P1 — The Continuity Kit demo shares the ordinary private store.** This is unchanged in upstream commit `c187604`, so it is **pre-existing relative to the local integration** and does not count toward its verdict. The demo opens `continuity-kit.html?demolab=1`, while `app/lib/continuity-kit-ui.js:11` still selects `sbeUserKey('sbe.continuity.v2')`; lines 25 and 30 read and write that ordinary key. The excluded isolation repro confirms that an authorized embedded demo reads the regular private kit. A demo save can overwrite it. Give the authorized embedded demo an in-memory store, as the Team Learning Lab already does. Provenance: `git blame c187604` attributes the Continuity Kit store and load lines to `b0845a2b` (2026-10-09); the Continuity Kit demo entry also exists at `c187604`.

### What’s Working Well

The assistant receives task-specific runtime context, its proposals require explicit human adoption, and the server reviewer has no tools for publication or approval. The Team Learning Lab keeps demo storage separate from ordinary private drafts.

### Score

**5/5 designated AI capabilities have the context needed for their bounded tasks. Verdict: PASS for the reviewed agent-facing delta.** The upstream Continuity Kit demo isolation defect remains open.
