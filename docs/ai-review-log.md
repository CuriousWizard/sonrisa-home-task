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

| Topic | Opus | GPT | Outcome | Reason |
| --- | --- | --- | --- | --- |
| API compiles without strict mode | F1 | none | accepted | D-027. Confirmed with `tsc --showConfig`. |
| Event data and filter schemas strip unknown keys | F2 | M2-01 | accepted | `z.strictObject`, with two tests that fail on revert |
| Three Nx plugins on caret ranges | F3 | M2-06 | accepted | Pinned to 24.0.7 |
| Generated autoload bootstrap instead of `buildApp(config)` | F4 | M2-05 | deferred to M3 | D-028 |
| No route params schemas | F5 | M2-02 | accepted | `IdParam`, `SourceIdParam`, `ChannelIdParam`, `HookIdParam` |
| `ChannelField.key` typed as `string` | F6 | none | deferred to M4 | M4 builds the form that reads the keys |
| `enabled` default turns an alert back on through PUT | F7 | none | accepted | `enabled` is required, with a test |
| Leftover deploy targets in `apps/api/project.json` | F8 | none | rejected | Generator defaults with no effect on dev or tests |
| Firefox and WebKit in Playwright | F9 | none | accepted | Chromium only |
| Mailpit image without a tag | F10 | none | accepted | `axllent/mailpit:v1.34.0`, read from the Docker Hub tag list |
| `npm ls` reports invalid nested dev packages | F11 | none | deferred | Dev-only, nested under `@spartan-ng/cli`. The top-level tree is valid. |
| Duplicate `targetIds` rejected without a rule in the design | none | M2-03 | accepted | The design now states the rule, because `alert_targets` has a primary key on the pair. |
| Playwright `serve-static` has no `/api` proxy | none | M2-04 | deferred to M5 | M5 sets up the e2e server |

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
