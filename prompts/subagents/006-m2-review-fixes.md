# 006 Apply accepted M2 review findings

Sent to: default implementer subagent. The findings come from `docs/reviews/m2-opus.md` and `docs/reviews/m2-gpt.md`. The orchestrator accepted the items below. Deferred and rejected items are in `docs/ai-review-log.md`, V-014.

```text
You are the implementer for review fixes in milestone M2 in /home/davidt/project/sonrisa-home-task. Do not commit, push or amend. Do not edit docs/, prompts/, AGENTS.md or .github/. Do not touch apps/api/src; M3 rewrites it.

Make these changes and nothing else:

1. TypeScript strict mode. tsconfig.base.json has "strict": false, target es2015 and lib ["es2020", "dom"]. The API inherits that, and under strict: false zod infers optional fields where the schemas require them. Set "strict": true in tsconfig.base.json. In apps/api/tsconfig.json set target and lib to ES2024 with no dom. Fix any compile errors this causes in libs/ui or the apps without loosening strict.

2. libs/shared, strict nested objects. Use z.strictObject for every per-category event data schema and every alert filter schema, so unknown keys are rejected instead of stripped. Add tests:
   - EventInput rejects category news with { symbol: 'X', price: 1, changePct: 1 } as data
   - AlertInput rejects news filters that contain a nested category key
   Each new test must fail if strictObject is changed back to object.

3. libs/shared, AlertInput.enabled. Remove the default so enabled is a required boolean. A PUT that omits it must fail validation instead of turning a disabled alert back on. Add a test for the missing field.

4. libs/shared, route params schemas, exported from index.ts:
   - IdParam: { id: uuid }
   - SourceIdParam: { id: string, 1 to 50 characters, lowercase letters, digits and hyphens }
   - ChannelIdParam: { id: ChannelId }
   - HookIdParam: { hookId: string, 1 to 64 characters, letters, digits, hyphens and underscores }
   Add one test per schema that rejects a bad value.

5. package.json: pin @nx/angular, @nx/node and @nx/vitest to exactly 24.0.7, the same as nx and the other @nx packages. Run npm install so the lockfile matches.

6. apps/web-e2e/playwright.config.mts: keep only the Chromium project.

7. docker-compose.yml: change the Mailpit image to axllent/mailpit:v1.34.0. The orchestrator read the tag list from Docker Hub.

Verification you must run and report:
- npx nx run-many -t build lint test --skip-nx-cache
- npx tsc --showConfig -p apps/api/tsconfig.app.json, showing strict, target and lib
- the test count for libs/shared before and after
- for each new test in items 2 and 3, revert the rule, run the test, show it fails, and restore the rule
- git status --short

Your last message must be the report, in under 300 words:
1. Files changed.
2. Compile errors that strict mode caused and how you fixed each.
3. Command results, one line each.
```
