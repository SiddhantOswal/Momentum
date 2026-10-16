# Product screenshots and verification summary

Only six useful product views are retained, rather than internal design iterations or before/after comparison galleries:

| View | Screenshot | Scope |
|---|---|---|
| Historical evidence | [Desktop](premium-analytics-20261016/after-history-1440.png) | Verified private Cloud Run response |
| Historical evidence | [Phone](premium-analytics-20261016/after-history-mobile-default-390.png) | Verified private Cloud Run response |
| Production Impact | [Desktop](premium-analytics-20261016/after-impact-1440.png) | BigQuery-backed held-out estimates, not measured factory savings |
| Photo Diagnosis | [Workspace](premium-analytics-20261016/after-photo-initial-1440.png) | Approved selection controls; no image preview or invented confidence |
| Empty Impact workspace | [Desktop](impact-empty-state-20261016/empty-impact-1440.png) | Newer local source, no dummy numbers |
| Empty Impact workspace | [Phone](impact-empty-state-20261016/empty-impact-390.png) | Newer local source, no dummy numbers |

[Reviewed release summary](REVIEWED_RELEASE_SUMMARY.json) records the bounded historical verification scope and immutable deployment identity. It does not claim the newest local source has been deployed or that D4 passed.

Raw provider/API/IAM/billing journals, internal build notes, reference images, redundant captures and temporary logs are not distributed. No WhatsApp image is required or included. The approved PO inputs remain under `public/samples/`; regression fixtures remain under `test/fixtures/`.
