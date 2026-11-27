# 026 Review M5

Sent to: `reviewer-opus` and `reviewer-gpt`, in parallel, with the same text.

```text
Review milestone M5 in /home/davidt/project/sonrisa-home-task. M5 adds tests only. It is two commits: git log --oneline c6ca80e..HEAD and git diff c6ca80e..HEAD -- apps.

Context:
- The contract is the "Tests" table in docs/design.md and requirement N5 in docs/requirements.md. The implementer prompts are prompts/subagents/024-m5a-pipeline-test.md and 025-m5b-playwright.md. Finding M2-04 in docs/reviews/m2-gpt.md is the reason the e2e config changed.
- The orchestrator already verified: the pipeline spec passes on its own; npm run e2e passes and leaves ports 3000 and 4200 free; nx run-many -t build lint test passes. The implementers reported a mutation check for each file.
- Known deviations: the pipeline test sets DELIVERY_BACKOFF_BASE_MS to 0 on the parsed config, because loadConfig requires a positive value; the e2e test uses the seeded users in the dev database and leaves its injected event there, because the API has no route to delete events.

Constraints:
- Do not run npm run e2e, do not start servers, and do not run API specs. Another reviewer runs at the same time on the same ports and test database. You may read every file and run npx nx lint web-e2e and npx nx lint api.
- No Docker access. Never print .env.

Check in particular:
1. Does each test fail if the behaviour it names breaks? Name assertions that would still pass with a broken pipeline, worker, channel switch, retry or UI.
2. Isolation: can a run leave data that breaks the next run or the other spec files? Look at cleanup on failure paths as well as on success.
3. Timing: polls, timeouts and the worker's poll interval. Name any wait that can be flaky.
4. Coverage against the design's Tests table and requirement N5: what is still untested, and does it matter?
5. The e2e config: server start and stop, reuseExistingServer, the removed CI branch, the cache setting.
6. The two commit messages against AGENTS.md.

Do not edit files. Use the output format from your agent instructions. Keep the review under 600 words.
```
