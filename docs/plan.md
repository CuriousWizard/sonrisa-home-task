# Plan

## Goal

Turn a one-paragraph product brief into a working alerting app and record how the work was done. The graders read the process artifacts first and use the code as evidence for them.

## Constraints

- About 2.5 hours on day one. The user may continue on day two.
- One developer directs AI agents. The orchestrator agent delegates implementation to subagents and sends every milestone to two reviewer agents on different models.
- Local run only.

## Deliverables

| Deliverable    | Path                                   | Why it exists                                                                 |
| -------------- | -------------------------------------- | ----------------------------------------------------------------------------- |
| Plan           | `docs/plan.md`                         | Shows scope, order and the cut list                                           |
| Requirements   | `docs/requirements.md`                 | Turns the vague brief into testable statements and lists assumptions          |
| Design         | `docs/design.md`                       | Fixes the data model and API before any code, so subagents share one contract |
| Decision log   | `docs/decision-log.md`                 | Records each choice with the options and the reason                           |
| AI review log  | `docs/ai-review-log.md`                | Records what AI output was checked, rejected or corrected                     |
| Prompt history | `prompts/`                             | User prompts word for word, subagent prompts, chat exports                    |
| Agent setup    | `AGENTS.md`, `.github/agents/`         | Shows how the agents were directed                                            |
| Code           | `apps/`, `libs/`, `docker-compose.yml` | Evidence that the design works                                                |
| README         | `README.md`                            | Run instructions, demo script, screenshots                                    |

## Milestones

Each milestone ends with a commit that follows the Angular convention in `AGENTS.md`.

| ID  | Milestone                                                                                 | Budget | Done when                                                                               |
| --- | ----------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------- |
| M0  | Process docs, agent setup, prompt log                                                     | 10 min | Files committed                                                                         |
| M1  | Design doc, reviewed by both reviewer agents                                              | 15 min | The user approves the data model and API list                                           |
| M2  | Nx workspace, Docker Compose, shared library                                              | 15 min | `nx run-many -t build` passes and the containers start                                  |
| M3  | Backend: schema, seed, auth, CRUD, generators, matcher, worker, both channels, unit tests | 40 min | An injected event produces an email in Mailpit and a message in the mock Slack receiver |
| M4  | Frontend: user pages and admin pages                                                      | 35 min | The demo script in the README works by hand                                             |
| M5  | API integration tests and one Playwright smoke test                                       | 15 min | All tests pass                                                                          |
| M6  | README, screenshots, final review log, chat export                                        | 15 min | Submission is ready to push                                                             |

## Milestone commits

An annotated tag marks the last commit of each milestone, so `git log m2..m3` shows one milestone. A milestone has several commits, because the history keeps the state before and after each review (D-036).

| Tag  | Commits                        | Contents                                                                                                              |
| ---- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `m0` | `a96986b..02e11c4`, 2 commits  | AGENTS.md, reviewer agents, plan, requirements, decision log, AI review log, prompt log                               |
| `m1` | `28355cf..557e9e1`, 4 commits  | Design draft as sent to review, design revised after both reviews, M1 chat export                                     |
| `m2` | `470af59..d637df1`, 4 commits  | Nx workspace, Docker Compose, shared schemas, M2 reviews, reviewer files checked against the Opus 5.5 prompting guide |
| `m3` | `50d61a3..00fbbf3`, 11 commits | Backend in six parts, M3 review fixes, M3 docs, M2 and M3 chat export                                                 |
| `m4` | `4add287..0edb6b8`, 6 commits  | Web app in three parts, M4 review fixes, M4 docs                                                                      |
| `m5` | `c6ca80e..m5`, 5 commits       | Milestone tags and the M6 handoff prompt, pipeline integration test, Playwright smoke test, M5 review fixes, M5 docs  |

The tag for M6 is added when that milestone ends.

## M6 status

The user stopped M6 on 2026-11-27 because time ran out (prompt 015). M6 has no tag yet.

Done and committed:

- Prompts 014 to 016 in `prompts/prompt-log.md`, with the user's answers to the M6 questions.
- `prompts/exports/M4-M5-chat.json`, scanned for secrets before the commit (V-023).
- The implementer prompt `prompts/subagents/028-m6-screenshots.md`.

In commit `7cb5c56`, not yet verified (V-024). The user staged these files and asked for the commit (prompt 018):

- `scripts/screenshots.mjs` and the `screenshots` script in `package.json`. The script creates demo data through the API and saves six PNGs in `docs/screenshots/`.
- The six PNGs. They come from the implementer's run, before the two edits below.
- `apps/web/src/app/admin/deliveries-page.html`. The orchestrator moved the Attempts and Last error columns next to Actions.
- The orchestrator's edit to `scripts/screenshots.mjs` that crops each shot below the page content.

Left, in this order:

1. Start the stack with `DELIVERY_BACKOFF_BASE_MS=2000 npm run dev` and run `npm run screenshots`. Look at each PNG. Run `npx nx run-many -t build lint test --skip-nx-cache`, because the table change has not been through it. Commit the new PNGs.
2. Finish `README.md`. A quick version without screenshots was written after the stop (prompt 017). It still needs the screenshots and a run of its demo steps by hand.
3. Send one review prompt for the whole repository to both reviewers. Save the replies in `docs/reviews/m6-opus.md` and `docs/reviews/m6-gpt.md`, and record each finding in the AI review log.
4. Write the closing entry of the AI review log: what each reviewer model found and missed, how the implementers failed, and what the orchestrator caught. It lists the open items:
   - V-016, the effort test for Claude Opus 5.5. The user chose to leave it open.
   - The unused `_enabled` in `libs/shared/src/lib/alerts.spec.ts` and the web bundle at 880 kB against a 500 kB budget. The user chose to leave both open.
   - The deferred findings in V-014, V-018, V-020 and V-022.
   - The events that the e2e test leaves in the dev database (D-037).
5. Add the m6 row to the "Milestone commits" table. The user exports the chat to `prompts/exports/`. The orchestrator commits the export, tags m6 on that commit and pushes.

## Order and reasons

1. Process docs come first. The graders read them first, and every later subagent prompt points at them.
2. The design comes before code. Implementer subagents run in isolated contexts, so the design doc is the only contract they share.
3. The backend comes before the frontend. Matching, dedup and retries carry the most risk, and the UI only displays their results.
4. Tests run alongside the backend work. The matcher and the retry timing get unit tests in M3, and M5 adds the integration tests and the end-to-end test.

## Cut list

If a milestone runs over budget, features are cut in this order:

1. Metrics page
2. Playwright smoke test
3. Admin switches for sources and channels

The process docs are never cut.

## Day two candidates

These items are out of scope for day one. They come back if time allows:

- Rate limiting and digest batching
- Quiet hours
- A real event source, such as the USGS earthquake feed
- A third channel to prove the extension point
