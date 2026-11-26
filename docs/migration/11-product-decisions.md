# 11 Product decisions

## Resolved (2026-11-26, by the owner)
- **PD-01** The design is the owner's 61-artboard export (`Momentum_Finals_UI_Directions-project.zip`, sha256 76d81b9c...ffef0). It holds the 60 screens already in `docs/arc/design/source` (identical visible text and CSS, checked by script) plus `Main-Photo`, a backup Home variant with a photo hero. `Main` is the primary Home; `Main-Photo` is not built.
- **PD-02** Base is `arc/main`. The migration runs independently on `arc/ui-vnext`; the owner merges later, after approval. No other session is assumed to work on `web/`.
- **PD-10** No assistant attribution anywhere: commits, code, comments, docs. Commits carry the owner's identity.
- **PD-11** Restart the frontend from scratch on the same backend base. Done: old screens, shell and status strip removed on this branch; tokens, API client, session helpers, theme hook and Arc panel kept.
- **PD-13** Primary viewport left flexible. Checks run at 1440x900, 1280x800, 1024x768, 768x1024 and 390x844 and are marked provisional for the owner's MacBook.

## Open

Format: context, options, recommendation, deferral cost. All are blockers for implementation unless marked.

**PD-03 What is Home?** Design Home is sample-order start, reference run and Arc entry; React Floor is a live line view. Recommend build Home to design; keep live feed only where the design shows it. Affects U02.

**PD-04 Undesigned states (G1 to G17, hover/focus/loading, breakpoints).** Recommend approve a short list of drafted states before building; engineers do not invent. Defer: P2 items only.

**PD-05 Models screen.** No design page. Recommend remove the nav entry; show model trust inside Insights as designed.

**PD-06 Welcome / login screen.** Legacy has it, design does not. Recommend keep a minimal demo-entry outside the sidebar layout, labelled "Demo access only." as in the design header; or drop it. Needs your call.

**PD-07 Operator phone card.** Route, who opens it, auth, and whether to build receipts/mismatch endpoints (none exist). Recommend build the view read-only from `GET /jobs/:id` with "not connected" for receipts; defer endpoint. P2.

**PD-08 Contributor work not on the remote.** Siddhant's worktrees, Om's sign-offs, any local-only branches. Recommend both push or list them before cut. Without it the base is stale by an unknown amount.

**PD-09 Backend-only capabilities:** feedback (actual scrap), FX display currency, Google sign-in roles, legacy `/api/agents/*`. Recommend: keep routes, no UI, record as "not exposed in this release".

**PD-12 Figures.** Show PKBX0041 figures from the design (100.4 to 83.0 kg) or the m2 re-run (7.8 kg, Rs 421, provisional) until Om signs off. Recommend m2 figures labelled "Model estimate, awaiting sign-off"; never old ones.

**PD-14 Display font.** The design CSS names Inter Tight for headings and figures; the repo's QA matched the approved PNGs, which render in Inter, and `arc-tokens.css` uses Inter. Foundation follows the tokens (Inter). Confirm, or add Inter Tight files.

**PD-15 Top bar status.** The design shows a fixed "Backend connected" and "Prototype data, not live". The app shows the real state from `/api/status` and shows "Synthetic demonstration" only when the server reports synthetic-only mode. Confirm.

**PD-16 Below 900px.** The design has no small-screen layout apart from two phone cards. The shell turns the sidebar into a scrolling row and stacks grids. Confirm or supply a design.

**PD-17 Reference figures on Plant Explorer.** The design carries October figures (86% humidity, 35 s, Strength +0.078, "Meets its pass level"). Applied the retired-figure list in `docs/arc/delivery/data/stale-claims.md` and the final reference in `PKBX0041-m2-rerun.md`: 42% humidity, 32 to 45 s, no Strength row, Print and Crack show their holdout scores. Dropped "confirmed" after humidity (nobody confirmed it) and "humid days". Added the note "Reference lot PKBX0041, awaiting sign-off." Provisional until Om signs off (DR-019, PD-12). Confirm.

**PD-18 Stages other than Glue.** The design draws only Glue (stage 3). Other stage buttons select the stage and show "No reference values for this stage." Confirm, or supply designs for stages 1, 2, 4 and 5.

**PD-19 Compare HIGH and MEDIUM.** No lot in progress exists to compare (DR-011, ticket ARC-M6-12). The button stays and shows "Comparison is not connected yet. It needs a lot in progress to compare against." Confirm the wording.

**PD-20 New Lot inputs the design does not show.** (a) `POST /jobs` needs paper type and paper supplier; the design has no field for them. Only PO1 has a known context (RECYCLED, SUP-D, from the first React client); for PO2 to PO5 and uploads a "Paper" row appears in "What we read from the order" with a Missing chip until the operator enters both. (b) The approve checkbox is not drawn in NewLot-Approve; it is added because `CLAUDE.md` section 4 requires tick then Approve, with the wording "I checked the job card against the order, conditions and settings." (c) Board, box style and size have no source in the listed routes; they read "Not recorded" with a Missing chip instead of the design's "From catalog". Confirm, or supply designs.

**PD-21 New Lot cards with no backend source.** "Constraints for this comparison" (no constraint route), "How far to trust this" (no pass-level data in the job response), the trade-off sentence ("Strength risk rises 0.078 points", an October figure) and "Keep entered plan" (no route approves the entered plan) show the not-connected state. The trade-off card lists the server's per-defect rates for the entered and recommended plan instead. "Retry explanation" shows a not-connected note because no route re-runs the explanation alone. Confirm.

**PD-22 Figures on New Lot.** The page shows whatever the server returns for the lot; no October figure (100.4 to 83.0 kg, Rs 925) is hard-coded (DR-019, PD-12). The fixtures in the browser spec reuse those numbers only to match the design's layout and carry no claim.
