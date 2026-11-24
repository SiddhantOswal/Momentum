# Roadmap to the release candidate and the pitch

A plan, not a promise. Re-plan every morning from `bash tools/orchestrator/resume.sh` and `node tools/orchestrator/ticket-status.mjs`. Dates are 2026; the release candidate is due Monday 30 November; the pitch is Friday 4 December SGT. Run the backend, AI, data and frontend lanes in parallel, each ticket in its own worktree. Lane contents are in `external/queue.md`.

| Day | Backend and AI | Frontend | Data, cloud and gates |
|---|---|---|---|
| Tue 24 Nov | M2-04 router merged; M2-05 packet | M6-02 panel shell rebased and checked | handover package; M1 gate conditions queued |
| Wed 25 Nov | M2-05 answer writer and output checks; M2-07 eval harness; M1 gate repairs (SEC-1 to SEC-5, CR-3 to CR-6, retention note, records) | M6-02 merged; M6-08 reproducible `/app` build; start M6-06 page groups | Om's sign-offs due 26 Nov: apply the defaults if silent; cloud: change records for the pitch secret and the budget flags |
| Thu 26 Nov | M2-06 event stream, resume and the durable effect store; M2-07 merged | M6-03 J1 screens, M6-04 answer screens against the contract; M6-06 groups | M4-03 insufficient-data answers; ARC-M4-01 dry-runs; M2 gate prepared |
| Fri 27 Nov | M3-01 J1 task-run plan; M3-02 conditions with provenance; M4-04 model trust and moisture | wire M6-03 and M6-04 to the real routes; M6-06 continues | **M2 gate** (eight reviewers); tagged no-traffic revision: live integration run (ARC-M1-28), Vertex smoke call, token and latency measurement (ARC-M2-08) |
| Sat 28 Nov | M3 closes (J1 in Arc end to end, parity with the dashboard route for PO1 to PO5); M7-01 offline suites complete | P0 pages done; missing states G1 to G17 drafted for approval | **M3 and M4 gates**; M6 pages checked in a batch |
| Sun 29 Nov | M7-02 live eval run on the separate counter, M7-03 PO injection variants, M7-05 security pass, M7-06 measured time saved | M6 gate fixes; phone views if time | **M6 and M7 gates**; load and failure rehearsal on the tagged revision (M7-04) |
| Mon 30 Nov | M8-01 scripted deploy, M8-03 demo runbook | final UI fixes | M8-02 scaling and billing budget; the acceptance run (M8-04, run by the orchestrator and recorded); **M8 release gate**; tag `arc-rc-20261130`; `--no-traffic` revision verified, then traffic moved if the gate is GO |
| Tue 1 to Wed 2 Dec | fixes from rehearsals only; no new features | fixes only | Cloud Run min 1, max 6 until 2 Dec (F3); rehearsals on the live revision; refresh backups |
| Thu 3 Dec | freeze; Cloud Run min 2; final checks of the pitch path (J1 and the demo data answers) | freeze | final backup and a clean-clone check of the package |
| Fri 4 Dec | pitch day: watch the budget counters and the live revision; the 80-attempt reserve is claimed with the pitch code | | |

If the plan slips, `ORCHESTRATOR.md` section 8 lists what to cut, in order, and what never to cut. Record every cut as a decision. Phase B (M9 to M14, from 8 December) is in `tickets/M9-M14-production-readiness.md`.
