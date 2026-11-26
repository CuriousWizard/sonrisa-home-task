# M2 review by reviewer-opus (Claude Opus 5.5)

Prompt: `prompts/subagents/005-review-m2.md`. The text below the line is the reviewer's reply, word for word.

---

### Findings

| ID  | Severity | Location | Finding | Evidence | Suggested fix |
| --- | -------- | -------- | ------- | -------- | ------------- |
| F1 | major | apps/api/tsconfig.json:13 (inherits tsconfig.base.json:16) | The API compiles with `strict: false`, `target: es6` and `lib: ["es2020","dom"]`. Zod needs strict mode. Under the API's settings, the shared types lose required fields. | `tsc --showConfig -p apps/api/tsconfig.app.json` returns `strict=false`. A compiler API probe of `TargetInput` with `strict=false` gives `config: { address?: string }`. With `strict=true` it gives `{ address: string }`. | Set `strict: true` for the API, or in the base config. Use an ES2024 target and lib, and drop `dom` for the API. |
| F2 | minor | libs/shared/src/lib/events.ts:7 | `NewsEventData = z.object({})` accepts any `data` and strips it, so `category: 'news'` with market data passes. All data and filter schemas strip unknown keys, so the discriminator tests only hold while every field of the wrong branch is required. If `keywords` gets a default, the AlertInput test passes with the pairing broken. | Probe: news with market data returns `OK {"data":{}}`. | Use `z.strictObject` for the data and filter schemas. Add a test for news with non-empty data. |
| F3 | minor | package.json:25, :31, :33 | `@nx/angular`, `@nx/node` and `@nx/vitest` use `^24.0.7`. `nx` and the other `@nx/*` packages are pinned to `24.0.7`. Nx needs identical versions, and `@nx/angular` lists `@nx/playwright: "24.0.7"` as an exact peer. | `package.json`, and the peer list in `node_modules/@nx/angular/package.json`. | Pin all three to `24.0.7`. |
| F4 | minor | apps/api/src/app/app.ts:16 | Generated `@fastify/autoload` over `plugins/` and `routes/`, `@fastify/sensible`, and comments such as "Do not touch the following lines". The design specifies `apps/api/src/app.ts` with `buildApp(config)` and feature folders. Neither plugin is in the design. | Read app.ts, plugins/sensible.ts and the design's "Repository layout". | Replace with `buildApp(config)` that registers routes explicitly. Remove autoload and sensible. |
| F5 | minor | libs/shared/src/lib/common.ts | There are no params schemas for `:id` (uuid), source id, channel id or `:hookId`. The Security section says handlers parse params with the shared schemas. | `grep` finds no params schema in the library. | Add `IdParam` and the other params schemas. |
| F6 | nit | libs/shared/src/lib/channels.ts:16 | `ChannelField.key` is typed `string`. A typo in a key compiles, and the generic form then builds a wrong config. | Read the file. | Type `key` as `keyof` the inferred config. |
| F7 | nit | libs/shared/src/lib/alerts.ts:40 | `enabled` defaults to `true`, and PUT uses `AlertInput`, so a PUT that omits `enabled` turns a disabled alert back on. | Read the file and the design's HTTP API section. | Make `enabled` required, or omit it from PUT. |
| F8 | nit | apps/api/project.json:40 | The `prune-lockfile`, `copy-workspace-modules` and `prune` targets are leftover deploy targets. | Read the file. | Remove them. |
| F9 | nit | apps/web-e2e/playwright.config.mts:46 | The Firefox and WebKit projects mean e2e needs three browser installs. | Read the file. | Keep Chromium only. |
| F10 | nit | docker-compose.yml:23 | `axllent/mailpit` has no tag, so it pulls `latest`. | Read the file. | Pin a version tag. |
| F11 | nit | package-lock.json | `npm ls` exits with `ELSPROBLEMS`. The invalid entries are `chokidar@6.0.0` against `^5.0.0` from the nested `@angular-devkit/core` under `@spartan-ng/cli`, and alpha `@emnapi/*` versions in WASM bindings. All are dev-only. | `npm ls --all`. | Run `npm dedupe` or accept it and record the decision. |

### Verified

- `EventInput` and `AlertInput` are discriminated on the top-level `category`, and `TargetInput` on `channel`. A `category` key inside `data` or `filters` is stripped from the parsed result.
- The `TargetInput` cast is sound. Under `strict`, the inferred type is exactly `{channel:"email";config:{address:string}} | {channel:"slack";config:{webhookUrl:string}}` with no diagnostics. At runtime each branch pairs `z.literal(id)` with `channels[id].configSchema`.
- User input has length and size limits. Probes: `ListQuery` rejects `'500'`, `''` and an array. `SlackConfig` rejects `ftp:` and `javascript:` URLs.
- Each shared test fails if its rule is removed, read rule by rule. `Severity` tests cover min, max and integer. The password test covers the minimum. The email test covers trim and lowercase. `ListQuery` tests cover max and default. The web spec depends on `data-slot` from `hlmBtn`. The API spec asserts both the status and the body. `nx run-many -t test -p shared api --skip-nx-cache` passes.
- Mounting the Postgres 18 volume at `/var/lib/postgresql` matches the docker-library docs. `pg_isready -h 127.0.0.1` is correct because the server that runs the init scripts listens only on the Unix socket.
- All ports are bound to 127.0.0.1. `setup.mjs` writes `.env` with flag `wx` and mode 0600, and never prints the secret. A second run leaves `.env` unchanged, `compose up` changes nothing, and the init SQL runs only on an empty volume.
- `.env.example` matches the design exactly. `.env` is ignored.
- `cn@0.5.2` comes from shadcn (repository `shadcn-ui/cn`) and matches `CN_VERSION` in `@spartan-ng/cli` 1.10.1. `class-variance-authority@0.7.1` comes from joe-bell/cva.
- Version fit:
  - `typescript ~6.0.3` fits Angular's peer range `>=6.0 <6.1`.
  - `@angular/cdk` is 22.3.0 and `@types/node` is 26.6.11.
  - `fastify-plugin` 6, `@fastify/autoload` 6.5 and `@fastify/sensible` 6.0.8 all target Fastify `^5`.
  - Vitest 5 and Vite 8 fit the peer ranges of `@angular/build` and `@nx/vitest`.
- The Vitest configs set `watch: false`. The dev proxy sends `/api` to localhost:3000, and the `serve` target uses it.

### Not verified

- Live Docker state, including the Mailpit image healthcheck and `PGDATA` inside the container. Access to the Docker socket was denied.
- Commit messages, because nothing is committed yet.
- The web build and e2e run. I did not run them.
- Twice, the shared terminal returned another process's output. I re-ran those commands with markers and used only output between the markers.
