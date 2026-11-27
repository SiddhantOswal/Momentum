# ARC-M6-20: remove the app-wide demo labels

- Owner: frontend engineer. Tier B (UI copy and tests).
- Asked by: Om, 2026-11-26: "this will be a real app now, we need to remove the complete demo labelling now", naming four labels.
- Depends on: nothing.

## Goal
Remove the four labels Om named from the app frame and Plant Explorer:
1. "Backend connected" in the top bar. The indicator stays for the failure case: it shows only "Backend not reachable", because a real app must say when it cannot reach its server.
2. "Prototype data, not live" chip in the top bar.
3. "Supervisor session / Demo access only." card at the foot of the sidebar.
4. "Stage by stage. Illustrative, no live readings." subtitle on Plant Explorer.

Per-figure labels stay ("Modelled on our plant", "Model estimate", "Example value", "Illustrative line, not a live view" on the line drawing), so every number on screen still carries its source (CLAUDE.md section 3). The approval wording ("Demo session, simulated") and the "another demo session" messages are not part of this ticket; they wait for Om's answer.

## Acceptance criteria
- None of the four texts appears in the built app.
- With `/health` ok, the top bar shows no backend status; with `/health` failing, it shows "Backend not reachable".
- No dead code is left: the `prototype-data` chip kind and the `.sess` styles are removed.
- Browser tests assert the labels are absent, and the unreachable test still passes.

## Test plan
`npm --prefix web run build`, `npm --prefix web test`, `npm test`, the browser specs `arc-shell` and `explorer-photo`, then the full browser suite; a look at Home and Plant Explorer in the browser pane.
