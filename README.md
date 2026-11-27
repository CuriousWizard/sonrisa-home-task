# Sonrisa - Homework

An alerting app built from a one-paragraph product brief. Users create alert rules for world events in three categories: news, market and disaster. When an event matches a rule, the app sends a notification by email or Slack. Admins see every user, alert, event and delivery, retry failed deliveries, turn sources and channels on and off, and read 24-hour metrics.

The brief asks for the process more than the product, so the docs listed under "Process" are the main part of the submission. The code is the evidence for them.

## Stack

- Node.js 26, TypeScript, Nx 24 monorepo
- API: Fastify 5, Drizzle ORM, PostgreSQL 18
- Web: Angular 22, spartan-ng with Tailwind 4
- Email goes to Mailpit. Slack uses incoming webhooks, with a mock receiver in development.
- Docker Compose runs Postgres and Mailpit.
- Events come from simulators on a timer and from a dev-only injection route.

## AI tooling

- VS Code agent mode.
- One orchestrator agent on Claude Opus 5.5 plans, writes the subagent prompts, checks every result and commits.
- Implementer subagents on Claude Opus 5.5 write the code, one scoped prompt per run.
- Two reviewers check every milestone on the same prompt: `reviewer-opus` on Claude Opus 5.5 and `reviewer-gpt` on GPT-6.2 Sol. Their agent files are in `.github/agents/`.

## Prerequisites

- Node.js 26 and npm
- Docker with Compose. Your user must be in the `docker` group.

## Setup, run and test

```bash
npm install
npm run setup   # creates .env with a random secret, starts Postgres and Mailpit, migrates, seeds
npm run dev     # API on http://localhost:3000, web app on http://localhost:4200
```

| Command                                              | Does                                                  |
| ---------------------------------------------------- | ----------------------------------------------------- |
| `npx nx run-many -t build lint test --skip-nx-cache` | Builds, lints and runs the unit and integration tests |
| `npm run e2e`                                        | Runs the Playwright smoke test                        |

The Playwright test needs Chromium: `npx playwright install chromium` and `npx playwright install-deps chromium`.

Mailpit's inbox is at http://localhost:8025.

## Seeded users

| Email                 | Password             | Role  |
| --------------------- | -------------------- | ----- |
| `admin@example.local` | `admin-password-123` | admin |
| `user@example.local`  | `user-password-123`  | user  |

## Demo

To see retries end within a minute, start the stack with a short backoff: `DELIVERY_BACKOFF_BASE_MS=2000 npm run dev`.

1. Sign in at http://localhost:4200 as `user@example.local`.
2. On Targets, add an email target and a Slack target with the webhook URL `http://localhost:3000/api/dev/mock-slack/demo`.
3. On Alerts, create a market alert on symbol `NVDA`, direction any, minimum change 5, with both targets.
4. Inject a matching event:

   ```bash
   curl -X POST http://localhost:3000/api/dev/events -H 'Content-Type: application/json' \
     -d '{"category":"market","title":"NVDA falls 7%","severity":3,"data":{"symbol":"NVDA","price":160,"changePct":-7}}'
   ```

5. Check the Slack message with `curl http://localhost:3000/api/dev/mock-slack/messages` and the email in Mailpit.
6. Sign in as `admin@example.local` and open Admin, Deliveries. The rows for your two targets show `Sent`.
7. Make the mock Slack receiver fail and inject the event again:

   ```bash
   curl -X PUT http://localhost:3000/api/dev/mock-slack/mode -H 'Content-Type: application/json' -d '{"fail":true}'
   ```

   The Slack row goes to `Failed` and, after five attempts, to `Dead`.

8. Turn fail mode off with `{"fail":false}` and click Retry on the dead row. It ends as `Sent`.

## Process

| What                                          | Where                                                    |
| --------------------------------------------- | -------------------------------------------------------- |
| Plan, milestones, cut list and the M6 status  | [docs/plan.md](docs/plan.md)                             |
| How the brief was read, assumptions           | [docs/requirements.md](docs/requirements.md)             |
| Architecture, data model, API, known limits   | [docs/design.md](docs/design.md)                         |
| Decisions with options and reasons            | [docs/decision-log.md](docs/decision-log.md)             |
| AI output that was checked, rejected or fixed | [docs/ai-review-log.md](docs/ai-review-log.md)           |
| Reviewer replies, word for word               | [docs/reviews/](docs/reviews/)                           |
| Notes on prompting Claude Opus 5.5            | [docs/prompting-opus-5-5.md](docs/prompting-opus-5-5.md) |
| User prompts, word for word                   | [prompts/prompt-log.md](prompts/prompt-log.md)           |
| Prompts sent to subagents                     | [prompts/subagents/](prompts/subagents/)                 |
| Prompt that moved the work to a new chat      | [prompts/handoff/](prompts/handoff/)                     |
| Chat exports                                  | [prompts/exports/](prompts/exports/)                     |
| Agent rules                                   | [AGENTS.md](AGENTS.md)                                   |

Tags `m0` to `m5` mark the end of each milestone. `git log m4..m5` shows one milestone. The table in `docs/plan.md` maps each tag to its commits.

## Status and limits

- M0 to M5 are done. M6 stopped early, because time ran out. The README screenshots, the final review by both reviewers and the closing entry of the AI review log are not done. Nobody has run the demo steps above since this README was written. The M4 browser check and the M5 Playwright test cover the same flow. `docs/plan.md` lists the remaining steps.
- Known limits are in the "Known limits" section of `docs/design.md`. Day-two candidates are in `docs/plan.md`: rate limiting and digests, quiet hours, a real event source and a third channel.
