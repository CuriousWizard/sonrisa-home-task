# M2 review by reviewer-gpt (GPT-6.2 Sol)

Prompt: `prompts/subagents/005-review-m2.md`. The text below the line is the reviewer's reply, word for word.

---

### Findings

| ID | Severity | Location | Finding | Evidence | Suggested fix |
| --- | --- | --- | --- | --- | --- |
| M2-01 | major | [libs/shared/src/lib/events.ts:7](libs/shared/src/lib/events.ts#L7) | Category schemas silently strip fields the contract excludes. A news event with disaster data succeeds as `{}`. Market data and news filters also accept a nested `category`. | Read-only `safeParse` probes reproduced all three cases. | Use strict nested objects for event data and alert filters. Test news with disaster data, nested `category`, and mixed filters. |
| M2-02 | minor | [libs/shared/src/index.ts:1](libs/shared/src/index.ts#L1) | The shared library has no route-parameter schemas. The design requires handlers to validate params with shared Zod schemas, including UUID resource IDs, channel IDs, source IDs, and mock hook IDs. | Checked the public exports against [docs/design.md:260](docs/design.md#L260) and the route tables. | Export reusable params schemas before M3 handlers need them. |
| M2-03 | minor | [libs/shared/src/lib/alerts.ts:37](libs/shared/src/lib/alerts.ts#L37) | Duplicate target IDs are rejected, an undocumented restriction beyond the stated requirement of at least one UUID. | `safeParse` rejected an otherwise valid alert with the same UUID twice. | Document uniqueness as part of the contract or normalize duplicates before persistence. |
| M2-04 | minor | [apps/web-e2e/playwright.config.mts:35](apps/web-e2e/playwright.config.mts#L35) | When Playwright starts its own server in CI, it chooses a static server with no `/api` proxy. The heading test can pass while M4’s same-origin API requests fail. | The proxy is configured on `serve`, not `serve-static`, in [apps/web/project.json:57](apps/web/project.json#L57). | Use the proxied server in CI or require the running stack described in the design. |
| M2-05 | minor | [apps/api/src/app/app.ts:6](apps/api/src/app/app.ts#L6) | The generated bootstrap still has empty `AppOptions`. Main and tests construct Fastify separately, rather than sharing the design’s `buildApp(config)`. | Compared the bootstrap with [apps/api/src/app/app.spec.ts:8](apps/api/src/app/app.spec.ts#L8) and the repository layout contract. | Use one app factory for startup and injection tests before adding M3 configuration. |
| M2-06 | minor | [package.json:25](package.json#L25) | Three Nx plugins use carets while the rest are pinned. Regenerating the lockfile can split the Nx versions when a newer release lands. | `npm view` currently returns only `24.0.7` for those ranges. Nx Angular and Vitest declare exact Nx peer versions. | Pin all Nx packages to the same version and upgrade them together. |

### Verified

- Replayed all 19 shared test cases in memory. Each of 12 targeted rule removals triggered an existing failure, including all three discriminator pairings.
- `TargetInput` narrows correctly in both branches and rejects crossed configs at compile time. The IDs and branches derive from the channel map.
- Fastify injection returned `200` with `{"status":"ok"}` for `/api/health` and `404` for `/`. The Angular dev proxy covers `/api` subpaths, and the Playwright heading assertion matches the page.
- `npm view` found every locked direct dependency. `cn` is shadcn’s Tailwind class merger; `class-variance-authority` is Joe Bell’s CVA. The installed top-level tree reported no problems.
- The environment template matches the design. Compose publishes all three ports on loopback and uses the documented Postgres 18 volume path. Setup creates `.env` exclusively at mode `600`; the existing file is ignored and left unchanged on repeat. Postgres runs the init SQL only on a fresh volume.

### Not verified

- Live Compose health, database creation, and a second setup run: Docker socket access was denied. I did not read `.env` or rerun the full Nx or browser suites.
- M2 commit message: the changes are still uncommitted.
