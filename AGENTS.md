# AGENTS.md

Instructions for every AI agent working in this repository.

## Project

An alerting app. Users create alert rules for world events in three categories: news, market and disaster. When an event matches a rule, the app notifies the user by email or Slack. Admins see all users, alerts, events and deliveries.

The repository is an interview submission. Reviewers grade the process, so the process artifacts matter as much as the code.

| File | Purpose |
|---|---|
| `docs/plan.md` | Milestones, order, cut list |
| `docs/requirements.md` | How the brief was interpreted, assumptions, out of scope |
| `docs/design.md` | Architecture, data model, API |
| `docs/decision-log.md` | Decisions with options and reasons |
| `docs/ai-review-log.md` | AI output that was checked, rejected or corrected |
| `prompts/prompt-log.md` | User prompts, word for word |
| `prompts/subagents/` | Prompts the orchestrator sent to subagents |

Read `docs/requirements.md` and `docs/design.md` before changing code.

## Stack

- Node.js 26 LTS, TypeScript, npm
- Nx 24 monorepo: `apps/api`, `apps/web`, `libs/shared`
- Backend: Fastify 5, Drizzle ORM, PostgreSQL 18
- Frontend: Angular 22, spartan-ng with Tailwind 4
- Email: Nodemailer to Mailpit. Slack: incoming webhook, with a mock receiver in development
- Docker Compose runs Postgres and Mailpit

## Agent roles

| Role | Who | Does |
|---|---|---|
| Orchestrator | Main chat agent | Plans, writes subagent prompts, verifies output, reconciles reviews, commits |
| Implementer | Default subagent | Writes code for one scoped task from a saved prompt |
| Explorer | `Explore` subagent | Read-only lookups |
| Reviewer A | `reviewer-opus` on Claude Opus 5.5 | Independent read-only review |
| Reviewer B | `reviewer-gpt` on GPT-6.2 Sol | Independent read-only review |

The two reviewer files in `.github/agents/` share the same body. Only the model differs. Keep the bodies identical so the reviews are comparable.

## Milestone workflow

1. The orchestrator saves the subagent prompt to `prompts/subagents/NNN-<slug>.md` before sending it.
2. An implementer subagent does the task.
3. The orchestrator checks the result itself: reads the diff, runs build and tests, and checks package versions with `npm view`.
4. Both reviewers get the same review prompt and run in parallel.
5. The orchestrator compares the two reviews. It accepts, rejects or defers each finding and records the outcome with a reason in `docs/ai-review-log.md`.
6. The orchestrator commits. The user pushes. Agents never push.

## Commit messages

Follow the [Angular commit message guidelines](https://github.com/angular/angular/blob/main/contributing-docs/commit-message-guidelines.md).

```text
<type>(<scope>): <short summary>

<body>

<footer>
```

- Type is one of `build`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `test`.
- Scope is optional. Use `api`, `web`, `shared`, `e2e` or `infra`. Leave the scope empty for repository-wide docs.
- Write the summary in the imperative present tense, start it with a lowercase letter, and leave out the final period.
- Every commit except `docs` needs a body of at least 20 characters that explains why.

## Writing rules

Apply `.agents/skills/unslop/SKILL.md` to all prose in `docs/`, `prompts/`, `README.md` and this file.

## Code rules

- Keep secrets out of git. Put defaults in `.env.example`.
- The API rejects Slack webhook URLs that do not start with a prefix listed in `SLACK_WEBHOOK_ALLOWED_PREFIXES`.
- Routes under `/dev` are registered only when `NODE_ENV` is not `production`.
- Validate every request body with the zod schemas in `libs/shared`.
