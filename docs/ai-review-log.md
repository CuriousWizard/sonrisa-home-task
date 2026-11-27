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
- Follow-up: the user tested the reviewer setup in a separate git worktree. reviewer-gpt runs on GPT-6.2 Sol, but no reasoning effort was configured, so it ran on medium. The user then set GPT-6.2 Sol to extra high in the VS Code settings.
- Consequence: the M1 design review by reviewer-gpt (V-008) ran on medium reasoning effort. The design is approved, so the review is not repeated. Reviews from M2 onwards run on extra high.
- Status: closed.

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

| Topic                                                              | Opus | GPT  | Outcome                   | Reason                                                                                                          |
| ------------------------------------------------------------------ | ---- | ---- | ------------------------- | --------------------------------------------------------------------------------------------------------------- |
| A sixth send after the lease expires at max attempts               | F2   | F1   | accepted                  | The claim now requires `attempts < max`. Expired rows at max become `dead`.                                     |
| Lease shorter than the send, stale result overwrites a newer claim | F1   | F1   | accepted                  | Send deadlines of 5 and 10 seconds, concurrent sends, fenced result update, no overlapping polls                |
| Delivery foreign keys on delete, column defaults                   | F3   | F7   | accepted                  | Cascade on delete, with the history loss listed in known limits. `attempts` and `next_attempt_at` get defaults. |
| `category` inside `filters` and `data`                             | F4   | F3   | accepted                  | The outer DTO is now discriminated on `category`. See V-007.                                                    |
| Seed rows break N3                                                 | F5   | F4   | accepted                  | Rows are inserted from the registries at startup.                                                               |
| `source_id = 'dev'` and foreign keys                               | F6   | none | accepted                  | `events.source_id` has no foreign key.                                                                          |
| Auth rate limit gives 429 in tests, out-of-scope wording           | F7   | F9   | accepted                  | `AUTH_RATE_LIMIT_MAX`. The out-of-scope item now says notification rate limiting.                               |
| Placeholder `JWT_SECRET` passes the length check                   | F8   | F5   | accepted                  | `config.ts` rejects it. `npm run setup` writes a random secret.                                                 |
| Allowlist prefixes are not validated                               | F9   | F6   | accepted                  | Trailing slash required, no user or password, `http:` only outside production                                   |
| Skipped rows spend an attempt and cannot be retried                | F10  | F2   | accepted                  | D-024                                                                                                           |
| A `created_at` cursor drops rows with the same timestamp           | F11  | F7   | accepted                  | D-023 removes cursors.                                                                                          |
| Fastify parses `text/plain` by default                             | F12  | none | accepted                  | The app removes the parser.                                                                                     |
| `\b` fails for `C++`                                               | F13  | none | accepted                  | Unicode lookarounds, checked with `node -e`                                                                     |
| No driver or run commands                                          | F14  | F8   | accepted                  | D-022 and a Commands section                                                                                    |
| Requirements wording and unslop rules                              | F15  | none | accepted                  | Reworded R5, the Delivery term and A2                                                                           |
| Test send while the channel is disabled                            | none | F2   | accepted                  | 409                                                                                                             |
| Admin retry is not atomic                                          | none | F2   | accepted                  | One conditional `UPDATE ... RETURNING`                                                                          |
| Earthquake without a magnitude                                     | none | F3   | accepted                  | It does not match when `minMagnitude` is set.                                                                   |
| Cookie path, algorithm pinning, role from the token                | none | F5   | accepted                  | `Path=/`, no `Domain`, HS256 only, role read from the database                                                  |
| `Origin` header check on mutations                                 | none | F5   | deferred                  | Local only, and `SameSite=Strict` covers cross-site requests. Listed in known limits.                           |
| Logout does not revoke the token                                   | none | F5   | accepted as a known limit | Revocation needs a token store. The expiry is 8 hours.                                                          |
| Webhook URL can leak through error messages, non-2xx handling      | none | F6   | accepted                  | Errors carry no URL. Any status outside 200 to 299 is a failure.                                                |
| `app.inject()` opens no socket for the worker to call              | none | F8   | accepted                  | Delivery tests use `listen({ port: 0 })`.                                                                       |
| Random delay per poll, injection defaults, mock body schema        | none | F8   | accepted                  | Written into the design                                                                                         |
| Cut `PATCH /alerts`                                                | F16  | none | rejected                  | One small route. The enable switch in the alert list needs it.                                                  |
| Truncate tables instead of a test database                         | F16  | none | rejected                  | Truncating would wipe the developer's demo data. One init SQL line creates `alerts_test`.                       |
| Remove auth rate limiting                                          | F16  | none | rejected                  | One plugin registration. It covers OWASP A07.                                                                   |
| Auto-refresh, expandable users view                                | F16  | F10  | accepted                  | Refresh button only. Selecting a user shows that user's alerts.                                                 |

- Comparison: reviewer-opus ran its own `node` tests against Node 26 and read the Nodemailer docs for default timeouts. reviewer-gpt could not reach the npm registry and used the local cache. It still found four issues that reviewer-opus missed: the `app.inject()` socket problem, secrets in error messages, the test route with a disabled channel, and the non-atomic retry. Neither review contained a false claim that the orchestrator could find.
- Status: corrected. The design diff after commit `28355cf` shows every change.

## V-009 User check of the word-boundary claim

- AI claim: reviewer-opus F13 said `\b` fails for keywords such as `C++` and `$TSLA`.
- Check: the user ran an independent `node -e` test of `\b` plus the escaped keyword against four headlines.
- Result: `S&P` true, `C++` false, `$TSLA` false, `oil` true. The claim holds. The design uses Unicode lookarounds instead (see V-008).
- Status: accepted.

## V-010 Chat export before commit

- Check: before committing `prompts/exports/M1-chat.json`, the orchestrator scanned it for GitHub tokens, OpenAI-style keys, Slack tokens, AWS keys and Slack webhook URLs.
- Result: the only matches were the fake test URL `https://user:pw@hooks.slack.com/services/T/B/C` that the reviewers used in their checks. No real secret was found.
- Status: accepted.

## V-011 Implementer runs that returned no report

- AI output: the M2 implementer for prompt 002 stopped partway and returned an empty message. The first follow-up, prompt 003, also returned an empty message.
- Check: the orchestrator did not assume either run had worked. It read `git status`, the new files and `package.json`, then ran build, lint and test itself.
- Result:
  - After prompt 002: the Nx workspace, the four projects, Tailwind 4 and the spartan theme existed. The spartan button, the health route, the shared schemas, Docker Compose, the env files, the setup script and the root scripts were missing.
  - The orchestrator split the remaining work into prompts 003 and 004.
  - After prompt 003, every file it asked for existed. Build, lint and test passed, `/api/health` returned `{"status":"ok"}`, and the built CSS held the Tailwind classes from the home page.
  - Prompt 004 and prompt 006 returned full reports. Each now ends with "Your last message must be the report".
- Status: corrected.

## V-012 Unknown dependency `cn`

- AI output: the implementer added a runtime dependency named `cn`. The name is short and generic, which is a common pattern for typosquatted packages.
- Check: `npm view cn` and a search of `node_modules/@spartan-ng/cli` for the name.
- Result: `cn` 0.5.2 is published by shadcn from `github.com/shadcn-ui/cn`, and the spartan CLI references it. reviewer-opus also found it pinned as `CN_VERSION` in the CLI. Both reviewers reached the same result on their own.
- Status: accepted.

## V-013 Docker access from the agent shell

- Check: `npm run setup` failed with "permission denied" on the Docker socket. `id -nG` showed that the agent's shell had no `docker` group. `getent group docker` showed that the user account was a member.
- Result: the VS Code server started before the user joined the group, so the agent's shells do not have it. `sg` and `newgrp` are not installed. The user ran the setup in their own terminal and pasted the output (prompt log 005). The orchestrator then checked from its side over TCP: Mailpit `/api/v1/messages` returned 200, Postgres accepted a connection on 5432, `.env` had mode 600 with no placeholder secret, and git ignored it.
- Status: closed. `AGENTS.md` now describes this case.

## V-014 M2 review by two models

- AI output: two reviews of the M2 working tree. The replies are stored word for word in `docs/reviews/m2-opus.md` and `docs/reviews/m2-gpt.md`. The prompt is `prompts/subagents/005-review-m2.md`.
- Check: the orchestrator reran reviewer-opus F1 with `tsc --showConfig`. The API had `strict: false` and `target: es6`, while `apps/web` and `libs/shared` had `strict: true`. The finding holds.
- Result:

| Topic                                                       | Opus | GPT   | Outcome        | Reason                                                                                 |
| ----------------------------------------------------------- | ---- | ----- | -------------- | -------------------------------------------------------------------------------------- |
| API compiles without strict mode                            | F1   | none  | accepted       | D-027. Confirmed with `tsc --showConfig`.                                              |
| Event data and filter schemas strip unknown keys            | F2   | M2-01 | accepted       | `z.strictObject`, with two tests that fail on revert                                   |
| Three Nx plugins on caret ranges                            | F3   | M2-06 | accepted       | Pinned to 24.0.7                                                                       |
| Generated autoload bootstrap instead of `buildApp(config)`  | F4   | M2-05 | deferred to M3 | D-028                                                                                  |
| No route params schemas                                     | F5   | M2-02 | accepted       | `IdParam`, `SourceIdParam`, `ChannelIdParam`, `HookIdParam`                            |
| `ChannelField.key` typed as `string`                        | F6   | none  | deferred to M4 | M4 builds the form that reads the keys                                                 |
| `enabled` default turns an alert back on through PUT        | F7   | none  | accepted       | `enabled` is required, with a test                                                     |
| Leftover deploy targets in `apps/api/project.json`          | F8   | none  | rejected       | Generator defaults with no effect on dev or tests                                      |
| Firefox and WebKit in Playwright                            | F9   | none  | accepted       | Chromium only                                                                          |
| Mailpit image without a tag                                 | F10  | none  | accepted       | `axllent/mailpit:v1.34.0`, read from the Docker Hub tag list                           |
| `npm ls` reports invalid nested dev packages                | F11  | none  | deferred       | Dev-only, nested under `@spartan-ng/cli`. The top-level tree is valid.                 |
| Duplicate `targetIds` rejected without a rule in the design | none | M2-03 | accepted       | The design now states the rule, because `alert_targets` has a primary key on the pair. |
| Playwright `serve-static` has no `/api` proxy               | none | M2-04 | deferred to M5 | M5 sets up the e2e server                                                              |

- Fixes: prompt `006-m2-review-fixes.md`. The orchestrator reran `nx run-many -t build lint test --skip-nx-cache` after the fixes. All 6 projects passed. `tsc --showConfig` shows `strict: true` and `target: es2024` for the API. The shared tests went from 19 to 26.
- Comparison: reviewer-opus found 11 issues, including the strict-mode gap, which reviewer-gpt missed. reviewer-gpt found the e2e proxy gap and the undocumented uniqueness rule, which reviewer-opus missed. Both checked `cn` and the Postgres 18 volume path on their own and agreed. Neither could reach Docker. reviewer-opus reported that the shared terminal twice returned another process's output, and it reran those commands with markers.
- Status: corrected. No second review round. The fixes are small, and the orchestrator checked each one.

## V-015 Review copies that were not word for word

- AI output: the orchestrator's own files `docs/reviews/m1-design-*.md`, and its first draft of the M2 files. They were labelled "unedited", but the orchestrator had paraphrased the replies before saving them. The finding IDs and the substance matched. The wording did not: some lines were shortened and used arrows, and some words were changed.
- Check: while saving the M2 reviews, the orchestrator compared the saved text with the replies in its context.
- Result: all four review files were rewritten with the exact replies. The rule in `AGENTS.md` already exempted reviewer replies from the writing rules. The orchestrator had applied those rules anyway.
- Status: corrected.

## V-016 Reviewer files against the Opus 5.5 prompting guide

- User input, in a separate chat on a git worktree: "I found this documentation about prompting opus 5.5: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5 Check if the created reviewer agent is using those best practices. Additionally, include somewhere those points for later. Use worktree for your work."
- AI output: the reviewer body in `.github/agents/reviewer-opus.agent.md` and `.github/agents/reviewer-gpt.agent.md`, written by the orchestrator in M0.
- Check: compared the body with each section of the guide. Read the effort that the VS Code chat session records hold for each reviewer call in the M1 session.
- Result:
  - The body asks for no written reasoning and has no "think carefully" line. Both follow the guide.
  - The body did not say that its last message is the review, and it did not list the files to read first. D-029 adds both.
  - reviewer-opus ran all three M1 calls at `xhigh`. reviewer-gpt ran all four at `medium`. The guide says to start at `medium` and to keep `xhigh` for measured gains. V-005 recorded only the GPT-6.2 Sol setting.
  - The guide's section on an early end of turn may explain the two M2 implementer runs that returned no report (V-011).
- Open: the effort for Claude Opus 5.5 is a VS Code setting that only the user can change. The two defects in V-007 give a small test. Run the M1 design review on reviewer-opus at `medium` and check whether it still finds both.
- Numbering: this entry was V-011 on the `docs/opus-5-5-prompting` branch. It was renumbered when the branch came into main, because main had used V-011 to V-015 for M2 in the meantime.
- Status: corrected for the body. The effort question is open.

## V-017 M3 implementer runs

- AI output: seven implementer runs for M3, prompts 007 to 013.
- Check: after each run, the orchestrator read the changed files, reran `nx run-many -t build lint test --skip-nx-cache` and committed only when it passed.
- Result:
  - Prompt 007 wrote the platform code, migrated and seeded both databases, then returned an empty message. It wrote no tests. It also swapped `@fastify/jwt` for `jose` without saying so (D-030). The orchestrator's build found two errors: `apps/api/package.json` still listed `@fastify/autoload`, which broke lockfile pruning, and a drizzle enum type error. Prompt 008 fixed both and wrote the tests.
  - Prompts 009 to 013 were each scoped to one area and all returned full reports. Each report listed deviations that the orchestrator then checked, such as the Slack text escaping in 009 and the `FOR KEY SHARE` locks in 010 and 011.
  - The implementer for 011 reported that swapped source interval values would give a near-zero poll delay. Prompt 012 added a config check.
  - The implementer for 012 reported that one requested test could not fail without its rule, because an earlier step already covered the case. It added a test that does fail.
- Orchestrator end-to-end check, run twice, after 012 and after the review fixes: health 200, login 200, a Slack target on `https://hooks.slack.com.evil.com/services/x` rejected with 400, an earthquake of magnitude 5.5 created 0 deliveries, magnitude 7.1 created 2. The mock Slack receiver got the message within 6 seconds and the Mailpit message count went up by 1. The API log had no error-level lines.
- Status: accepted.

## V-018 M3 review by two models

- AI output: two reviews of commits `50d61a3..c980484`, stored word for word in `docs/reviews/m3-opus.md` and `docs/reviews/m3-gpt.md`. The prompt is `prompts/subagents/014-review-m3.md`. Both reviewers used the reviewer body from D-029 for the first time.
- Check: the orchestrator reran two claims before accepting them.
  - `DrizzleQueryError` in `node_modules/drizzle-orm/errors.js` builds its message as `Failed query: <sql>\nparams: <params>`, and `app.ts` logged the whole error. M3-01 holds.
  - `session.ts` called `jwtVerify` with `algorithms` only, so a token without `exp` was accepted. M3-06 holds. reviewer-opus had listed "`exp` is checked" as verified, which is true only when the claim is present.
- Result:

| Topic                                                                  | Opus       | GPT   | Outcome                 | Reason                                                                                                                                        |
| ---------------------------------------------------------------------- | ---------- | ----- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Database errors in logs carry bound values                             | none       | M3-01 | accepted                | `safeErrorLog` in the error handler, scheduler, worker and seed, with a test that fails on the raw error                                      |
| Admin retry lets an old claim pass the attempts fence                  | none       | M3-02 | accepted                | D-032                                                                                                                                         |
| Batch waits for the slowest send; SMTP has no total deadline           | none       | M3-03 | accepted                | D-033, and results are written per row                                                                                                        |
| Lists ignore `limit`                                                   | none       | M3-04 | accepted for lists      | Targets, alerts and admin alerts. Ignoring unknown query keys on routes without inputs is harmless, so that part is rejected.                 |
| scrypt p=1 below OWASP                                                 | none       | M3-05 | accepted                | p=5. Rehash on login is rejected, because no real users exist.                                                                                |
| `jwtVerify` does not require `exp`                                     | none       | M3-06 | accepted                | `requiredClaims: ['exp', 'sub']`                                                                                                              |
| Stale-result and two-tick tests prove less than their names            | F5         | M3-07 | accepted                | A real reclaim test, a SKIP LOCKED test that fails without `skipLocked`, and a renamed test                                                   |
| PUT and metrics fixtures pass with wrong code                          | none       | M3-08 | accepted                | Fixtures now separate the cases                                                                                                               |
| Test route has no rate limit                                           | F1         | none  | accepted                | Same limit as the auth routes                                                                                                                 |
| No test that the admin role comes from the database                    | F2         | none  | accepted                | A user row with an admin token gets 403                                                                                                       |
| No test for cookie attributes or 429                                   | F3         | none  | accepted                | Both added                                                                                                                                    |
| Dead assertion after logout                                            | F4         | none  | accepted                | Removed                                                                                                                                       |
| Slack escaping, key-share locks, jose and layout missing from the docs | F6, F7, F8 | none  | accepted                | Design updated, D-030                                                                                                                         |
| Commit `50d61a3` has scope `api` but changes root files                | F9         | none  | accepted for the future | The commit is local, but rewriting six commits for a scope label is not worth the risk. Commits that span projects now leave the scope empty. |

- Comparison: reviewer-gpt found all three major issues, which are about logs, claim fencing and send deadlines. reviewer-opus found none of them, and it listed the `exp` check as verified. reviewer-opus found the test gaps around auth: the database role, the cookie attributes and the rate limit. reviewer-gpt missed those. Both found that the SKIP LOCKED test did not test SKIP LOCKED. Both reported that the shared terminal mixed their command output with the other reviewer's.
- Fixes: prompts `015-m3-fix-worker.md` and `016-m3-fix-security-tests.md`. The implementer for 016 was told not to touch `apps/api/src/delivery`, so it left the worker's two raw error logs and the missing `limit` in the shared `AdminAlertsQuery`. The orchestrator made those two edits itself: `safeErrorLog` in two worker log calls, and `ListQuery.extend` in `libs/shared/src/lib/admin.ts`. It then reran the full build and tests and the end-to-end check.
- Status: corrected.

## V-019 M4 implementer runs

- AI output: six implementer runs for M4, prompts 017 to 020, 022 and 023.
- Check: after each run, the orchestrator read the tree, reran `nx run-many -t build lint test --skip-nx-cache` and checked the pages in the VS Code browser through the dev proxy.
- Result:
  - Prompt 017 built the shell and the sign-in pages, then ended with "Proxy and auth work. A quick browser check of the rendered pages:" and no report. This is the early end of turn that `docs/prompting-opus-5-5.md` describes. It skipped two of the ten requested spartan components. It also added `apps/web/.env.serve` without saying so (D-035).
  - Prompt 018 wrote the targets and alerts pages and returned an empty message. 5 of its tests failed. Prompt 019 found that the test, not the component, was wrong, and fixed it without changing an assertion.
  - Prompt 019 also reported why the two components were missing: they import `@ng-icons`, which the registry does not serve. The orchestrator confirmed the 404 with `npm view` (D-034). A dry run of the CLI had passed earlier, because a dry run skips `npm install`.
  - Prompts 020, 022 and 023 returned full reports.
- Browser check by the orchestrator, run after 018 and after 023:
  - Sign-in, target create, the Slack allowlist rejection, test sends to email and Slack, alert create, edit and the enable switch all worked.
  - The admin pages showed failed, skipped and sent deliveries with their badges. Retry of a skipped row ended as sent.
  - At a 1024 pixel wide window the Retry buttons were off screen. Prompt 023 moved them. After the fix, Retry ends at x=324 at that width, and the top bar wraps at 640 pixels without a horizontal scroll bar.
  - The VS Code browser keeps its page hidden, so Playwright's click waits for a stable frame that never comes. The orchestrator used `fill` and `requestSubmit` through Playwright code instead. This is a tool limit, not an app bug: `document.visibilityState` was `hidden`.
- Status: accepted.

## V-020 M4 review by two models

- AI output: two reviews of commits `3f61e05..086f260`, stored word for word in `docs/reviews/m4-opus.md` and `docs/reviews/m4-gpt.md`. The prompt is `prompts/subagents/021-review-m4.md`.
- Check: the orchestrator read `alert-form-page.ts` and `auth.store.ts` before accepting reviewer-gpt M4-01 and M4-02. The form only created controls for loaded targets, and `logout()` cleared the user in `finally`. Both hold.
- Result:

| Topic                                            | Opus | GPT   | Outcome               | Reason                                                                                                                                                                                                                             |
| ------------------------------------------------ | ---- | ----- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Edit drops target ids outside the loaded list    | none | M4-01 | accepted              | Unlisted ids are kept in the PUT, with a test that fails without the rule                                                                                                                                                          |
| Failed sign-out clears the client anyway         | none | M4-02 | accepted              | Clears only on success or 401                                                                                                                                                                                                      |
| Rapid toggles race                               | none | M4-03 | accepted              | Switches are disabled while their PATCH runs                                                                                                                                                                                       |
| Keywords with a comma split on round trip        | none | M4-04 | accepted              | One keyword per line                                                                                                                                                                                                               |
| Field errors shown under the form                | F2   | M4-05 | accepted              | Slack allowlist, email in use and foreign target errors sit next to their field                                                                                                                                                    |
| No interceptor spec                              | F3   | none  | accepted              | Spec added                                                                                                                                                                                                                         |
| Switch test passes without the response handling | F4   | none  | accepted              | Tests for revert on 500 and disabled while pending                                                                                                                                                                                 |
| Stale-response rule untested                     | F5   | none  | accepted              | Tests on events, deliveries and users, each failing without the rule                                                                                                                                                               |
| Focus lost on Delete confirm                     | F6   | none  | accepted              | One button changes label and style                                                                                                                                                                                                 |
| Row buttons share one accessible name            | F7   | none  | accepted              | `aria-label` names the row                                                                                                                                                                                                         |
| `ConfigField` duplicates `ChannelField`          | F8   | none  | rejected after trying | The implementer for 022 found that `ChannelField` with its default type does not accept either channel's fields, because `keyof C` makes it contravariant. The local type was replaced by inference from the channels map instead. |
| No test for the channel key rule                 | F9   | none  | accepted              | `channels.spec-d.ts` with `@ts-expect-error`                                                                                                                                                                                       |
| Prompt said 4 commits, the range has 3           | F10  | none  | accepted              | The orchestrator's error. `4add287` is the Prettier ignore commit, which the range excludes.                                                                                                                                       |
| Commit body of `3f61e05`                         | F11  | none  | rejected              | Rewording a local commit for style is not worth a rebase.                                                                                                                                                                          |
| Tests that skip the router and interceptor       | none | M4-06 | accepted in part      | A route config test checks the guards. Varying the shared channels map in a test would need it injected, so that part is rejected.                                                                                                 |
| Top bar overflows on narrow screens              | none | M4-07 | accepted              | It wraps                                                                                                                                                                                                                           |
| Deviations missing from docs                     | F1   | M4-08 | accepted              | D-034, D-035 and the design                                                                                                                                                                                                        |

- Comparison: reviewer-gpt found all three major issues again. They are about state that can go wrong: a dropped target, a hidden live session and a toggle race. reviewer-opus found more test gaps and accessibility issues, and it traced the `.env.serve` fix through the Nx and Angular sources. One reviewer-opus finding, F8, was wrong, and only the implementer's compile error showed it.
- Fixes: prompts `022-m4-fix-forms-auth.md` and `023-m4-fix-tables-layout.md`. Web tests went from 36 to 70.
- Status: corrected.

## V-021 M5 setup and implementer runs

- AI output: two implementer runs, prompts 024 and 025, and the review fix run 027.
- Check: before the runs, the orchestrator tested the Playwright download host with `curl` and installed Chromium into `~/.cache/ms-playwright`. A headless launch failed with "libnspr4.so: cannot open shared object file". The user installed the system libraries with `npx playwright install-deps chromium`, and the launch then worked. After each run, the orchestrator ran the new spec, `npm run e2e` and the full gate itself, and checked that ports 3000 and 4200 were free afterwards.
- Result:
  - All three runs returned full reports. Each prompt was scoped to one or two files.
  - The orchestrator's first draft of prompt 024 asked the implementer to prove the test by breaking the Slack allowlist check. That check does not affect the test's own allowed URL, so the mutation could not fail any scenario. The orchestrator replaced it before sending with a mutation in `ingest.ts` that makes every delivery pending. Scenario 4 failed with it, as expected.
  - The 024 implementer found that `loadConfig` rejects `DELIVERY_BACKOFF_BASE_MS=0`, so it set 0 on the parsed config. The design now says so.
  - The 025 implementer removed `getReadyUrl` from the Playwright config, because with two servers Nx could hand Playwright the API's address instead of the web app's. It also turned off the e2e cache, so a second run executes the test instead of reading a cached result.
  - The 027 implementer checked `npm run e2e` while `npm run dev` ran. Nx waited for the running servers and started no second one (D-037).
- Status: accepted.

## V-022 M5 review by two models

- AI output: two reviews of commits `10ab02f..11495f5`, stored word for word in `docs/reviews/m5-opus.md` and `docs/reviews/m5-gpt.md`. The prompt is `prompts/subagents/026-review-m5.md`. The reviewer-gpt reply opens with a progress note before the review, the pattern that `docs/prompting-opus-5-5.md` describes, but the full review follows it.
- Check: the orchestrator read `matchEvent` in `ingest.ts`. It selects every enabled alert in the category, so the e2e test's count of exactly 1 depended on what else was in the dev database. Both reviewers' major finding holds.
- Result:

| Topic                                                                                    | Opus | GPT   | Outcome            | Reason                                                                                                                   |
| ---------------------------------------------------------------------------------------- | ---- | ----- | ------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| The e2e count depends on other alerts, and a failed cleanup breaks later runs            | F1   | M5-02 | accepted           | Unique symbol, count at least 1, cleanup of every `E2E ` record before and after (D-037)                                 |
| A failed step leaves Slack disabled or skips teardown                                    | F2   | M5-01 | accepted           | All channels on in `beforeAll`, the disable step inside `try`, each teardown step on its own                             |
| Two runs on `alerts_test` interfere, because the worker claims rows across the table     | F3   | none  | accepted as a rule | The design now says one test run at a time. Scoping the worker to a test's rows would change the application for a test. |
| The design's test and command text is out of date                                        | F4   | none  | accepted           | Updated                                                                                                                  |
| The config comment says Playwright starts the servers, and `e2e-ci` still caches         | F5   | none  | accepted           | Comment corrected, cache off                                                                                             |
| The Slack poll accepts any message on the hook, and the saved threshold is never checked | none | M5-03 | accepted           | The poll and the Mailpit check look for the event title, and the test reads the saved filters back                       |
| Polls can time out behind a slow worker batch                                            | none | M5-04 | accepted           | 30 second polls, a 90 second test, and a wait for the deliveries response after Refresh                                  |
| The free-port probe races, and the Mailpit wait uses Vitest's default                    | none | M5-05 | accepted in part   | Explicit timeouts. The probe stays, because the channel registry needs the port before the app can listen.               |
| `BASE_URL` and server reuse can point at another stack                                   | none | M5-06 | rejected           | Reusing a running dev stack is the intended local workflow, and Nx needs `reuseExistingServer` to hand over its servers. |

- Comparison: both reviewers found the major e2e isolation problem. reviewer-opus read the Nx Playwright plugin and explained how `npm run e2e` starts the servers. reviewer-gpt found the weaker assertions: the hook-only poll and the unchecked threshold.
- Fixes: prompt `027-m5-fix-tests.md`. The orchestrator then ran the pipeline spec, `npm run e2e` and the full gate again.
- Status: corrected.

## V-023 M4 and M5 chat export before commit

- Check: before committing `prompts/exports/M4-M5-chat.json`, the orchestrator scanned it for GitHub, OpenAI-style, Slack, AWS and npm tokens, private keys, Basic and Bearer credentials, JWTs, `session=` cookies and Slack webhook URLs. It also counted the occurrences of the real `JWT_SECRET` from `.env` without printing it. It ran the secret and JWT counts on the two earlier exports as well.
- Result: every webhook URL match was a fake test URL such as `https://hooks.slack.com/services/T0/B0/x`. The `sk-` match was part of `task-04-feature-design-and-build`. No export contains a JWT or the secret.
- Correction: the exports table in `prompts/prompt-log.md` said the M2 and M3 export covers prompts 004 to 009. Each export holds the whole chat up to the moment of export, so the table now names the prompts that are new in each export.
- Status: accepted.

## V-024 M6 screenshot script

- AI output: the implementer for prompt `028-m6-screenshots.md` wrote `scripts/screenshots.mjs`, added the `screenshots` script to `package.json` and saved six PNGs in `docs/screenshots/`.
- Check: the orchestrator read `git status`, the `package.json` diff and the whole script. It opened each PNG.
- Result:
  - The run returned a full report. Two runs in a row passed, and the switches and fail mode were back in their earlier state afterwards.
  - The implementer reported one deviation. The seeded demo user has an alert with the same filters as the script's earthquake alert, so each run adds four deliveries for that user. The script therefore matches rows by event id, not by title.
  - The deliveries screenshot did not show the Attempts and Last error columns. `main` is limited to `max-w-6xl`, and the table is wider, so both columns sat past the right edge at 1440 px. The implementer listed this under "not verified". An admin who checks a failed delivery needs those two columns, so the orchestrator moved them after Actions in `deliveries-page.html`. Retry stays where the M4 fix put it (V-019).
  - The sign-in, alerts, targets and metrics shots had an empty lower half. The orchestrator changed the script to crop each shot below the last content.
  - When the orchestrator stopped the dev stack, the API still held port 3000, because it runs in its own process group. The orchestrator stopped that group too and confirmed that both ports were free.
- Not verified: the user stopped M6 (prompt 015) before the script ran again. The PNGs still show the old column order. The build, lint and test gate has not run on the template change. None of these files are committed. `docs/plan.md` lists the next steps.
- Status: open.
