# M8 deployment, demo runbook and release gate

ADR-0006; design sections 5.6, 5.7 and 7.

### ARC-M8-01 Scripted deploy (P0)
- Goal: `ops/deploy.sh` (or the repo's existing ops convention) that builds from git, deploys a tagged revision with no traffic, runs `tools/release-preflight.mjs`, and shifts traffic only on a pass. Flags come from a checked-in env file with no secret values.
- AC: the current live revision keeps its traffic until the release gate passes, and the rollback is one recorded command.
- The preflight includes one `generateContent` call per role from the tagged revision, using the shipped `config/arc-models.json`, and confirms `safetySettings` and `toolConfig` are accepted (carried from ARC-M1-14).
- Depends on: M6-08. Owner: release manager.
- Test plan: a dry run to a tagged revision; a rollback drill.

### ARC-M8-02 Demo-day scaling (P0, cloud change)
- Goal: apply the scaling the founders approve in F3. The proposal is min 1 and max 6 to 2 Dec, min 2 on 3 and 4 Dec, back to min 0 and max 4 from 5 Dec, with startup CPU boost on.
- AC: a change record with commands, cost and rollback exists before each change.
- Also: a billing budget of ₹10,000 (founder decision F2) on the project, with alerts at 50%, 90% and 100%. The change record comes first.
- Depends on: F3, F4. Owner: release manager.
- Test plan: `gcloud run services describe` read-back in the change record.

### ARC-M8-03 Demo runbook (P0)
- Goal: `docs/arc/delivery/demo-runbook.md`, covering the pre-stage checks (budget remaining, revision, warm instances, network), the pitch script, the recovery paths (explanation retry, cap reached, network down), the recorded fallback labelled "Recording", and who does what.
- AC: two founders rehearse it end to end at least twice before 3 Dec.
- Depends on: M7-04. Owner: release manager.
- Test plan: the rehearsal log.

### ARC-M8-04 Founder manual acceptance script (P0)
- Goal: the script in `00-plan.md` section 5.5, run by a founder on the release candidate.
- AC: each step is recorded pass, fail or NOT RUN with what was seen.
- Depends on: M8-01. Owner: release manager; a founder runs it.
- Test plan: the script itself.

### ARC-M8-05 Release gate and go/no-go (P0)
- Goal: the final review gate over the release candidate, `reviews/M8-review.md`, and a go/no-go recommendation.
- AC: every gate item has a result. The release candidate runs with `USTAAD_ENFORCE_APPROVE_GUARD` on, and an API test against it shows that a superseded draft cannot be approved (M0 gate BL-SE-2). The founders make the call.
- Depends on: all P0 tickets. Owner: release manager.
- Test plan: `/review-gate`.
