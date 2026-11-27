# Packet: ARC-M2-01-FIX2 two test gaps from the second QA

Role: backend-engineer. QA tier: B (test-only; the orchestrator verifies by mutation).
Branch: `arc/ARC-M2-01-arc-routes` (head 74e14aa) in `/Users/siddhant/Developer/momentum-wt/ARC-M2-01`. Add commits on top; do not rewrite.

Read `AGENTS.md`, `CLAUDE.md`, `docs/arc/delivery/external-agents.md` (section 2a), `docs/arc/delivery/external/known-findings.md` and your role prompt. Hand back a `commit-plan.json`.

Fix, test-only:
- **QA-5.** All 36 route tests still pass when `Cache-Control: no-store` is removed from the route-level 413 or 503 responses. In `test/arc-routes.test.js` (near line 414) assert the header on both error cases, and show that each assertion fails with the header removed.
- **QA-6.** The new socket test in `test/arc-mount-http.test.js` (near line 104) has no test-level timeout. Add one that bounds the request loop, so a failure is an assertion or a clear timeout message and never a hang (known finding 4).

No source change is expected. If a fix needs one, say why. Do not weaken any assertion. Report which tests you could run in your sandbox.
