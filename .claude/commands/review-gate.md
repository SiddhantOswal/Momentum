---
description: Run the milestone review gate with all reviewer agents
argument-hint: milestone number, for example 1
---

Run the review gate for milestone M$ARGUMENTS as defined in CLAUDE.md section 5.

1. List every file changed since the previous gate (git diff against the last gate tag or the branch base).
2. Run these eight agents in parallel, each independently: code-reviewer, qa-lead (verify that the tests are real, can fail, and ran), security-reviewer, ai-evals-reviewer (run the eval suites), responsible-ai-reviewer (check against docs/arc/delivery/responsible-ai.md), compliance-reviewer, copy-editor, and verification-auditor (check every claim since the last gate against its evidence).
3. Collect their findings into docs/arc/delivery/reviews/M$ARGUMENTS-review.md with a table of blocking issues, should-fix items and nits, plus each reviewer's verdict.
4. Give the overall verdict: GO, CONDITIONAL GO or NO-GO. A NO-GO stops the next milestone until the blocking issues are fixed by their owners and re-reviewed.
5. Update docs/arc/delivery/STATUS.md.
