# 008 Finish M3 part a: build fixes, tests, verification

Sent to: default implementer subagent. Reason: the subagent for prompt 007 wrote the code for tasks 1 to 7 and ran the migration and seed, then returned an empty message. It wrote no tests. The orchestrator checked the tree and found two build errors. Checked against `docs/prompting-opus-5-5.md`.

```text
You are the implementer finishing part a of milestone M3 in /home/davidt/project/sonrisa-home-task. Do not commit, push or amend. Do not edit docs/, prompts/, AGENTS.md or .github/. Edit only apps/api and, if a fix needs it, package.json.

Read first: prompts/subagents/007-m3a-platform.md (the task you are finishing), AGENTS.md, the "Security" and "Data model" sections of docs/design.md, and every file under apps/api/src.

Environment: Postgres at 127.0.0.1:5432 and Mailpit at 127.0.0.1:1025 and :8025 are running. Your shell cannot reach Docker; do not run docker commands. .env at the repository root holds a real secret; never print it. Both databases are migrated and the main database is seeded.

State: tasks 1 to 7 of prompt 007 are done. The API uses jose for JWTs instead of @fastify/jwt; keep that. npx nx run-many -t build lint test fails with two errors:
- apps/api/package.json still lists @fastify/autoload, so lockfile pruning fails. Remove every dependency from apps/api/package.json that the API no longer imports, and add the ones it does import if the file is meant to list them.
- apps/api/src/db/schema.ts line 158: the status enum passes DeliveryStatus.options where drizzle expects a non-empty tuple. Fix the type without a cast to any.

Tasks:
1. Fix both errors.
2. Write the tests from task 8 of prompt 007, next to the code, with Vitest:
   - password: verify accepts the right password, rejects a wrong one, returns false for a malformed value, and two hashes of the same password differ.
   - config: accepts the values in .env.example with a valid 48-character secret; rejects the placeholder secret, a 31-character secret, a prefix without a trailing slash, a prefix with a username, and an http: prefix when NODE_ENV is production.
   - auth routes with app.inject against TEST_DATABASE_URL: register then me returns 200 with the user; a duplicate register returns 409; login with a wrong password returns 401; logout then me returns 401; a session cookie signed with another secret returns 401; a user whose row was deleted returns 401; a request with Content-Type text/plain returns 415. Each test removes the rows it created.
3. The API test target must load .env from the repository root so TEST_DATABASE_URL is set. Tests must use TEST_DATABASE_URL and never DATABASE_URL.

Verification you must run, and report each in one line:
- npx nx run-many -t build lint test --skip-nx-cache
- for one test per file, break the rule it covers, run it, see it fail, and restore the rule
- start the API with npx nx serve api in the background; with curl and a cookie jar run GET /api/health, POST /api/auth/login as the seeded user from .env.example, GET /api/auth/me, POST /api/auth/logout, GET /api/auth/me; report the status codes; stop the server
- git status --short

Your last message goes back to the orchestrator, which cannot reply to you. Finish every task in this prompt before you return. Do not end with a summary that announces the next step, with an offer to do more, or with a list of choices that do not block the work. Stop early only when a task cannot go on without the user. Then name the blocker and list what you finished.

The report, in under 350 words:
1. Files changed or added.
2. How you fixed each error.
3. Test count per file.
4. Command results, one line each.
5. What you could not verify.
```
