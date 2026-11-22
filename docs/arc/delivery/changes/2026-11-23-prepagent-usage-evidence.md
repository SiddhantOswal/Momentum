# Evidence: what uses `prepagent` (for founder decision F1)

- Date: 2026-11-23
- Asked by: founders, before deciding F1 (turn Gemini off on `prepagent`, or give it a separate counter)
- Method: read-only. These were `gcloud run services list/describe/get-iam-policy`, list calls for domain mappings, Pub/Sub subscriptions, Scheduler, Eventarc and network endpoint groups, and Cloud Run request logs summarised by day, path and user-agent family. Client addresses were not printed. A `git grep` covered `origin/main`, `origin/dev` and `origin/v2`, plus a read-only grep of `/Users/siddhant/Singapore 2026` and the reference docs. Nothing was changed.

## Why it matters

Both services write the same Firestore day document, `gemini_daily_usage/<IST date>`. `decodeCount` in `src/google-cloud/firestore-gemini-attempt-store.js` rejects a document written under a different cap (`momentum` 300, `prepagent` 100). The first service to call Gemini on a given day therefore locks the other out until midnight IST (`04-technical-design.md` E7). This has not been seen live yet.

## Findings

| Check | Result |
|---|---|
| Service | `prepagent`, `https://prepagent-26mwt2n7ba-el.a.run.app`, created 2026-10-13. 100% of traffic on `prepagent-demo-v1`; the latest ready revision is `prepagent-polish-v1` (2026-10-21). Ingress all; invoker `allUsers` |
| Custom domain | Only `momentum-ai.cloud.run`, which maps to `momentum`. `prepagent` has none |
| Machine callers | None found. Cloud Scheduler and Eventarc APIs are not enabled on the project, so no jobs or triggers can exist. No Pub/Sub subscriptions exist, and no network endpoint groups or load balancers |
| Requests, last 30 days | 76 in total: 41 on 30 Oct, 26 on 10 Nov, then 3 a day on 18, 19 and 20 Nov. The 9 requests on 18 to 20 Nov are `/robots.txt`, which is crawler traffic |
| Who | Browsers only (iPhone 41, Mac 35). Every referer is `prepagent`'s own URL. No server-to-server user agents |
| Gemini use, last 30 days | No requests to `/orders/extract`, `/jobs`, `/risk/explanation` or `/evidence/*` |
| Last request | 2026-11-20 15:26 UTC (robots.txt). The last human use was on 10 Nov |
| `momentum` code calling `prepagent` | None: there are no references to its URL on `origin/v2` or `origin/main` |
| Docs linking to it | Only historical release records on `origin/dev`, dated 16 Oct (`docs/FINAL_PO_TO_CARD_ACCEPTANCE.md`, `docs/RELEASE_PROVENANCE.md`, `docs/evidence/REVIEWED_RELEASE_SUMMARY.json`, `docs/LOCAL_DEVELOPMENT.md`), and one review-package note saying the URL was not reachable. The `v2` README and every planning file in `Singapore 2026` (9 files) point to `https://momentum-ai.cloud.run/` |

## What could not be checked

- The competition submission portal is outside the project. If the registered demo link is the `prepagent` URL, judges may open it. A founder needs to check the submitted link.
- Whether anyone has `prepagent` bookmarked. The logs show human use on 30 Oct and 10 Nov only.

## Recommendation

Turn Gemini off on `prepagent` until after 5 Dec and leave the service running, so its pages still load. This means one env change on a new revision, with the rollback recorded in a change record before it runs. If the submission portal lists the `prepagent` URL, give it a separate counter document instead (a small code change in ARC-M1-08), so that judges can still use it.
