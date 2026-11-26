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
