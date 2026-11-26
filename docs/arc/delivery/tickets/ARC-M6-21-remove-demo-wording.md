# ARC-M6-21: remove the remaining demo wording

- Owner: frontend engineer, with the job-card PDF and the session error messages on the backend. Tier B for copy; the PDF change removes an earlier acceptance criterion (AC1.24), so its tests were rewritten, not deleted.
- Asked by: Om, 2026-11-26, after ARC-M6-20: "Remove all of it" (the remaining demo wording).
- Depends on: ARC-M6-20.

## What changed
- Approval: the Arc Approve card loses the "Approver: Supervisor session, demo access. This approval is simulated." row; the Arc receipt, New Lot Approve, the operator card and Prep Flow no longer say "Demo session, simulated", "Approved in a demo session" or "Demo session, no named person". New Lot reads "Acting as: Supervisor" (the role, no named person) and "Approving saves the job card and its PDF. No machine setting changes."
- Job-card PDF: the three lines "Demo session, simulated", "This approval came from a demo session. It is simulated." and the hackathon approval note are no longer printed.
- Session messages: "another demo session" and "this demo session" read "another session" and "this session" in the UI, the Arc client and the server's 403 and 404 messages.
- Pictures: the "Illustrative line", "Illustrative animation" and "Illustrative line, not a live view" tags are removed; the screen-reader descriptions still say the pictures are schematics.
- Planning: "Working prototype" becomes "Available now"; the header reads "The next phase of Momentum: what comes after preparation." with a "Roadmap" chip.

## Not changed
- Labels that give a number's source stay: "Modelled on our plant", "Model estimate", "Example value", "Modeled records", "From dataset", and "simulated" on a condition that came from the simulated sensor stream (CLAUDE.md sections 3 and 6). They describe data, not the app.
- Stored records: the approval audit still records `HACKATHON_DEMO` and `authenticatedHuman: false`, and the Arc session keeps its `identityLabel`. Only the display changed.
- The old interface at `/` (`src/operator-ui.js`, `src/ui/`) is not changed.

## Acceptance criteria
- No page under `/app` shows "demo", "simulated" (outside the sensor-source note), "illustrative", "prototype" or "not live".
- The issued PDF has no demo or simulated wording for any approval record.
- Tests assert the absence and fail when the old wording is put back.
