# M6 handoff prompt

The first chat ran M0 to M5 and filled its context. Paste the text block below as the first message of a new VS Code agent chat on Claude Opus 5.5. The orchestrator of the first chat wrote it after M4 and updates the "State at handoff" section when M5 ends.

```text
You are the orchestrator for milestone M6 of an interview submission in /home/davidt/project/sonrisa-home-task. A previous chat ran M0 to M5 and ran out of context. This prompt carries what that chat learned. Read the files it names before you act, and check every fact here against the repository, because the repository wins when they disagree.

## The task

A product manager's brief: users set up alerts for important world events, such as breaking news, market moves and natural disasters, and get them by email and Slack. More channels must be easy to add, and there is an admin view. The brief is docs/task-04-feature-design-and-build.docx. It is git-ignored, and unzip is not installed, so read it with python3 and zipfile.

The graders evaluate the process, not the product: how the AI was directed, which decisions were made and why, and what output was checked, rejected or corrected. The submission is a GitHub repository with commits for each major milestone, every prompt, the process artifacts, and the deliverables.

## Read first, in this order

1. AGENTS.md
2. docs/plan.md, including the "Milestone commits" table
3. docs/requirements.md and docs/design.md
4. docs/decision-log.md
5. docs/ai-review-log.md
6. docs/prompting-opus-5-5.md
7. prompts/prompt-log.md and the newest files in prompts/subagents/
8. git log --oneline m4..HEAD, for M5

## M6 scope

docs/plan.md says: README, screenshots, final AI review log, chat export. Done when the submission is ready to push. In detail:

1. README.md, which today holds one line. It must cover:
   - what the app does
   - the stack and the AI tooling: VS Code agent mode, an orchestrator on Claude Opus 5.5, implementer subagents, reviewer-opus on Claude Opus 5.5 and reviewer-gpt on GPT-6.2 Sol
   - prerequisites: Node 26, Docker with Compose, and the user in the docker group
   - setup, run and test commands
   - the seeded users
   - a demo script: sign in, add an email target and a Slack target on the mock URL, create an alert, inject an event through the dev route, see the message in the Slack mock and in Mailpit, see the delivery as an admin, turn on the mock's fail mode to show retries, retry a failed delivery
   - where to find the process: plan, requirements, design, decision log, AI review log, reviews, prompts, chat exports, and the milestone tags
   - known limits and the day-two list
2. Screenshots in docs/screenshots/, embedded in the README: sign-in, alerts list, alert form, targets, admin deliveries with several statuses, metrics.
3. A closing entry in docs/ai-review-log.md: patterns across all milestones, such as what each reviewer model found and missed, how the implementers failed, and what the orchestrator caught. Add a list of items that are still open.
4. A final review of the whole repository by both reviewers, reconciled like the others.
5. Tag m6 on the last M6 commit, add it to the table in docs/plan.md, and ask the user to export this chat to prompts/exports/.

Before you change anything, reply with a short M6 plan and your questions, and wait for the user's answer.

## How to work

These rules come from M0 to M5. The evidence is in the AI review log.

- Roles are in AGENTS.md. Implementers are the default subagent: call the subagent tool without an agent name. Reviewers are reviewer-opus and reviewer-gpt; send both the same prompt in parallel.
- Save every subagent prompt to prompts/subagents/NNN-<slug>.md before you send it. Continue from the highest number in that folder.
- Check every subagent prompt against docs/prompting-opus-5-5.md. An implementer prompt names the files to read, lists the tasks and the verification commands, and ends with the implementer block from the last section of that file.
- Give an implementer one area per prompt. Long implementer prompts returned an empty message or a progress note instead of a report (V-011, V-017, V-019).
- After every implementer run, check the work yourself: git status, the diff, and npx nx run-many -t build lint test --skip-nx-cache. Do not rely on the report. Implementers made changes they did not report (D-030, D-035).
- Reviewers share one terminal and the test database. Tell them not to start servers and not to run API specs that use the database. They may run web tests and pure unit specs.
- Before you accept a major finding, read the code or rerun the evidence. Reviewers have been wrong (V-018, V-020 finding F8).
- Save reviewer replies word for word in docs/reviews/<milestone>-<model>.md, under a title and a line that names the prompt. Do not paraphrase (V-015).
- Record every finding as accepted, rejected or deferred, with a reason, in a table in a new docs/ai-review-log.md entry. Continue the V- and D- numbering from the last entry.
- Log every user prompt word for word in prompts/prompt-log.md, numbering on from the last entry. Answers in question forms count. Log this handoff prompt as the first M6 entry by reference to this file.
- Apply .agents/skills/unslop/SKILL.md to everything you write in docs/, prompts/ and README.md. User prompts and reviewer replies stay word for word.
- Commits follow the Angular convention in AGENTS.md. Leave the scope empty when a commit spans projects. Commit after each verified part. Push only when the user asks in the current prompt. Never force-push and never rewrite history (D-036).
- The user's editor runs Prettier on save. Expect diffs that are only formatting. Check them with git diff -w and commit them on their own.
- Run one terminal command at a time. Run set +H before a command that contains "!", or bash history expansion rewrites it.

## Environment facts

- Linux under WSL, Node 26.13.1, npm 11.20, Docker 29 with Compose v5.
- Postgres 18 at 127.0.0.1:5432 with user and password alerts and databases alerts and alerts_test. Mailpit v1.34.0 with SMTP on 127.0.0.1:1025 and the web UI and REST API on 127.0.0.1:8025.
- The agent shell started before the user joined the docker group, and sg and newgrp are not installed, so docker commands fail with "permission denied". Ask the user to run them. Postgres and Mailpit still work over TCP.
- npm uses a company Artifactory registry that lacks some packages, such as @ng-icons (D-034). Run npm view before you plan on a package.
- .env holds a real JWT secret. Never print it.
- Commands: npm run setup; npm run dev, or npx nx serve api and npx nx serve web started in the background with setsid; npx nx run-many -t build lint test --skip-nx-cache; npm run e2e. Stop the servers you start, including the esbuild and @angular/build processes.
- Seeded users: admin@example.local with admin-password-123, and user@example.local with user-password-123.
- Dev routes: POST /api/dev/events injects an event. The mock Slack receiver takes webhooks at http://localhost:3000/api/dev/mock-slack/<hookId>. GET and DELETE /api/dev/mock-slack/messages read and clear it. PUT /api/dev/mock-slack/mode with {"fail": true} makes it answer 500.
- The VS Code browser keeps its page hidden. Playwright click and Enter wait for a stable frame that never comes. Use page.fill, and page.evaluate with form.requestSubmit() or element.click().
- The VS Code browser runs on the user's machine through port forwarding, so page.screenshot({ path }) does not write into this workspace. The screenshot tool shows you the page but saves nothing. For README screenshots, use the repository's Playwright from the shell if its browser is installed, or ask the user to save them.

## State at handoff

- M0 to M4 are committed and tagged m0 to m4. docs/plan.md maps each tag to its commits.
- M5 adds API integration tests and one Playwright smoke test. Read git log m4..HEAD and the AI review log entries after V-020 for its outcome.
- Open items:
  - V-016: no test has compared Claude Opus 5.5 at medium effort with xhigh. Close it with a reason or leave it open in the closing entry.
  - Lint warnings: an unused _enabled in libs/shared/src/lib/alerts.spec.ts, and the web bundle budget.
  - Deferred review findings in V-014, V-018 and V-020.
  - Known limits in docs/design.md and day-two candidates in docs/plan.md.
- Chat exports: prompts/exports/M1-chat.json and M2-M3-chat.json. The first chat's export for M4 and M5 should be there too. If it is missing, ask the user for it.
```
