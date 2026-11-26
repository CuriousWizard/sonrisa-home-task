# AI review log

This log records each AI output or claim that was checked before it was accepted, and the result of the check. Entries are in time order.

Status values: `accepted`, `corrected`, `rejected`, `open`.

## V-001 Reading the brief

- AI output: the first attempt to read the `.docx` file called `unzip`, which is not installed.
- Check: read the file with Python `zipfile`. Also opened `word/comments.xml`, `footnotes.xml` and `endnotes.xml` to look for hidden reviewer comments.
- Result: the brief has no comments, footnotes or endnotes. The plan is based only on the document body.
- Status: corrected.

## V-002 Angular 22 support in Nx and spartan-ng

- AI claim: Nx and spartan-ng work with Angular 22.
- Check: `npm view @nx/angular peerDependencies` and `npm view @spartan-ng/brain peerDependencies`.
- Result: Nx 24.0.7 accepts Angular versions from 20 up to, but not including, 23. spartan-ng 1.10.1 accepts versions from 21 up to, but not including, 23. Both fit Angular 22.3.0.
- Status: accepted.

## V-003 Local tooling

- AI plan: the first plan assumed Docker for Postgres and Mailpit.
- Check: `docker --version`.
- Result: Docker was not installed. The questions to the user were changed to offer options without Docker. The user then chose to install Docker.
- Status: corrected.

## V-004 Reviewer model names

- User input: "one Opus 5.5 agent, one GPT 6.2 Sol".
- Check: searched the local Copilot Chat storage for registered model names.
- Result: the registered names are `Claude Opus 5.5` and `GPT-6.2 Sol`, with a hyphen. The agent files use the registered names.
- Status: corrected.

## V-005 Reviewer agent smoke test

- Check: invoked both reviewer agents with a task that has a known answer. Each agent had to run `git log` and quote a line from `AGENTS.md`.
- Result: both agents ran the command and quoted the line correctly. Each reported the model from its own config file and said it could not confirm the model it runs on. The session debug log did not record model ids.
- Status: open. The user can confirm the model of each subagent call in the VS Code Chat Debug view.

## V-006 Commit convention

- Risk: the agent could have written commits in the common Conventional Commits format from memory.
- Check: fetched the Angular guidelines page before writing any commit.
- Result: two rules differ from the common format. The type list has no `chore`. Every commit except `docs` needs a body of at least 20 characters. Both rules are now in `AGENTS.md`. See D-011 for the earlier `chore` commit.
- Status: corrected.

## V-007 Design draft, issues the orchestrator saw before the review

- AI output: the M1 design draft, written by the orchestrator. Commit `28355cf` holds it as it was sent to review.
- Check: the orchestrator reread the draft after sending it and noted two defects. It did not fix them, so the review could show whether the reviewers would find them on their own.
  - The shared `AlertFilters` union was described as discriminated on `category`, but its branches had no `category` field.
  - The state diagram had `pending --> skipped`, but the text said the worker claims the row first.
- Result: both reviewers found both defects. reviewer-opus listed them as F4 and F10. reviewer-gpt listed them as F3 and F2.
- Status: corrected in the design.

## V-008 Design review by two models

- AI output: two independent reviews of the design draft, stored unedited in `docs/reviews/m1-design-opus.md` and `docs/reviews/m1-design-gpt.md`. The prompt is `prompts/subagents/001-review-design.md`.
- Check: the orchestrator matched the findings by topic, then reran two claims before accepting them:
  - `npm view fastify-type-provider-zod@7.0.0 peerDependencies` confirmed the non-optional peers `@fastify/swagger` and `openapi-types`. This led to D-021.
  - `node -e` with three regexes. `\bC\+\+\b` does not match "new C++ release". The lookaround version matches it. Keyword `oil` with lookarounds does not match "boil".
- Result:

| Topic | Opus | GPT | Outcome | Reason |
|---|---|---|---|---|
| A sixth send after the lease expires at max attempts | F2 | F1 | accepted | The claim now requires `attempts < max`. Expired rows at max become `dead`. |
| Lease shorter than the send, stale result overwrites a newer claim | F1 | F1 | accepted | Send deadlines of 5 and 10 seconds, concurrent sends, fenced result update, no overlapping polls |
| Delivery foreign keys on delete, column defaults | F3 | F7 | accepted | Cascade on delete, with the history loss listed in known limits. `attempts` and `next_attempt_at` get defaults. |
| `category` inside `filters` and `data` | F4 | F3 | accepted | The outer DTO is now discriminated on `category`. See V-007. |
| Seed rows break N3 | F5 | F4 | accepted | Rows are inserted from the registries at startup. |
| `source_id = 'dev'` and foreign keys | F6 | none | accepted | `events.source_id` has no foreign key. |
| Auth rate limit gives 429 in tests, out-of-scope wording | F7 | F9 | accepted | `AUTH_RATE_LIMIT_MAX`. The out-of-scope item now says notification rate limiting. |
| Placeholder `JWT_SECRET` passes the length check | F8 | F5 | accepted | `config.ts` rejects it. `npm run setup` writes a random secret. |
| Allowlist prefixes are not validated | F9 | F6 | accepted | Trailing slash required, no user or password, `http:` only outside production |
| Skipped rows spend an attempt and cannot be retried | F10 | F2 | accepted | D-024 |
| A `created_at` cursor drops rows with the same timestamp | F11 | F7 | accepted | D-023 removes cursors. |
| Fastify parses `text/plain` by default | F12 | none | accepted | The app removes the parser. |
| `\b` fails for `C++` | F13 | none | accepted | Unicode lookarounds, checked with `node -e` |
| No driver or run commands | F14 | F8 | accepted | D-022 and a Commands section |
| Requirements wording and unslop rules | F15 | none | accepted | Reworded R5, the Delivery term and A2 |
| Test send while the channel is disabled | none | F2 | accepted | 409 |
| Admin retry is not atomic | none | F2 | accepted | One conditional `UPDATE ... RETURNING` |
| Earthquake without a magnitude | none | F3 | accepted | It does not match when `minMagnitude` is set. |
| Cookie path, algorithm pinning, role from the token | none | F5 | accepted | `Path=/`, no `Domain`, HS256 only, role read from the database |
| `Origin` header check on mutations | none | F5 | deferred | Local only, and `SameSite=Strict` covers cross-site requests. Listed in known limits. |
| Logout does not revoke the token | none | F5 | accepted as a known limit | Revocation needs a token store. The expiry is 8 hours. |
| Webhook URL can leak through error messages, non-2xx handling | none | F6 | accepted | Errors carry no URL. Any status outside 200 to 299 is a failure. |
| `app.inject()` opens no socket for the worker to call | none | F8 | accepted | Delivery tests use `listen({ port: 0 })`. |
| Random delay per poll, injection defaults, mock body schema | none | F8 | accepted | Written into the design |
| Cut `PATCH /alerts` | F16 | none | rejected | One small route. The enable switch in the alert list needs it. |
| Truncate tables instead of a test database | F16 | none | rejected | Truncating would wipe the developer's demo data. One init SQL line creates `alerts_test`. |
| Remove auth rate limiting | F16 | none | rejected | One plugin registration. It covers OWASP A07. |
| Auto-refresh, expandable users view | F16 | F10 | accepted | Refresh button only. Selecting a user shows that user's alerts. |

- Comparison: reviewer-opus ran its own `node` tests against Node 26 and read the Nodemailer docs for default timeouts. reviewer-gpt could not reach the npm registry and used the local cache. It still found four issues that reviewer-opus missed: the `app.inject()` socket problem, secrets in error messages, the test route with a disabled channel, and the non-atomic retry. Neither review contained a false claim that the orchestrator could find.
- Status: corrected. The design diff after commit `28355cf` shows every change.
