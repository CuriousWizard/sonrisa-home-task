# 015 Apply M3 review findings, part 1: delivery worker

Sent to: default implementer subagent. Findings: reviewer-gpt M3-02, M3-03 and M3-07, reviewer-opus F5. Checked against `docs/prompting-opus-5-5.md`.

```text
You are the implementer for review fixes to the delivery worker in /home/davidt/project/sonrisa-home-task. Do not commit, push or amend. Do not edit docs/, prompts/, AGENTS.md or .github/. Edit only apps/api and .env.example.

Read first: docs/reviews/m3-gpt.md findings M3-02, M3-03 and M3-07; docs/reviews/m3-opus.md finding F5; the "Delivery states" section of docs/design.md; apps/api/src/delivery/worker.ts and worker.spec.ts, admin/routes.ts (the retry route), channels/email.ts, channels/slack.ts, channels/registry.ts, config.ts and db/schema.ts.

Environment: Postgres at 127.0.0.1:5432. No Docker access; do not run docker commands. Never print .env. Tests use TEST_DATABASE_URL and run one file at a time.

Changes:

1. Claim token (M3-02). Admin retry resets attempts to 0, so the attempt count alone cannot tell an old claim from a new one. Add a nullable uuid column claim_token to deliveries with a new drizzle-kit migration. Every claim sets claim_token = gen_random_uuid(). Every result write is fenced on id, status 'sending' and claim_token. Admin retry sets claim_token to null. Keep attempts for backoff and the max-attempts rule. Run npm run db:migrate so both databases get the column.

2. Write each result as soon as its send settles (M3-03), instead of waiting for the whole batch. The tick still waits for every send and write to finish before it returns, so ticks never overlap.

3. Total send deadline (M3-03). Nodemailer's socketTimeout is an idle timeout, not a total limit. Wrap every channel send in a total deadline of DELIVERY_SEND_TIMEOUT_MS, default 20000. When the deadline passes, the send counts as failed with the message "send timed out". Add DELIVERY_SEND_TIMEOUT_MS to config.ts and to .env.example. Config must reject DELIVERY_LEASE_MS that is not at least twice DELIVERY_SEND_TIMEOUT_MS.

4. Tests (M3-07, F5):
   - Replace the stale-result test with a real reclaim: worker A claims a row and its send blocks; the lease expires; worker B claims the row and records its result; admin-style retry resets the row; worker C claims it again; then A's send finishes. A's result must not change the row.
   - Rename the two-ticks test so it says what it proves, which is no double send under row locking.
   - Add a SKIP LOCKED test: lock one pending row FOR UPDATE in a separate open transaction, run a tick with a second pending row, and assert that the tick returns within one second and sends the second row only. Then release the lock.
   - Add a test where one send in a batch blocks: the other row's result is written while the blocked send is still running.
   - Add a test where a send exceeds a short DELIVERY_SEND_TIMEOUT_MS: the row becomes failed with "send timed out".
   - Config: a lease shorter than twice the send timeout is rejected.

Verification you must run, and report each in one line:
- npm run db:migrate
- npx nx run-many -t build lint test --skip-nx-cache
- remove the claim_token condition from the result write; report which test fails; restore
- remove skipLocked from the claim; report which test fails; restore
- git status --short

Your last message goes back to the orchestrator, which cannot reply to you. Finish every task in this prompt before you return. Do not end with a summary that announces the next step, with an offer to do more, or with a list of choices that do not block the work. Stop early only when a task cannot go on without the user. Then name the blocker and list what you finished.

The report, in under 300 words:
1. Files added or changed.
2. The migration SQL.
3. Command results, one line each.
4. Deviations from this prompt, and why.
5. What you could not verify.
```
