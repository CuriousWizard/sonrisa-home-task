# 001 Review the design (M1)

Sent to: `reviewer-opus` and `reviewer-gpt`, in parallel, with the same text.

```text
Review the M1 design for this repository before any code is written. Repository root: /home/davidt/project/sonrisa-home-task

Read these files in full:
- docs/requirements.md
- docs/design.md
- docs/decision-log.md (entries D-004 to D-020)
- AGENTS.md

No code exists yet. Review the design as the contract that implementer subagents will build from.

Check in particular:
1. Every requirement R1 to R18 and N1 to N5 is covered by the design. List any requirement that is missing, contradicted or only partly covered.
2. Internal contradictions between requirements.md, design.md, decision-log.md and AGENTS.md: names, routes, env vars, statuses, field shapes.
3. The delivery state machine: claim query, lease, attempts counting, backoff formula, admin retry, skipped handling. Walk through a crash mid-send and five failed sends step by step.
4. The shared zod schemas: can they be implemented as written? Look at how AlertFilters relates to the alert's category.
5. Security gaps against OWASP Top 10, including the Slack URL allowlist check and cookie-based JWT.
6. Package and API claims. Verify with `npm view` that these exist and support Fastify 5 or Node 26: @fastify/jwt, @fastify/cookie, @fastify/rate-limit, fastify-type-provider-zod (and which zod major it needs), drizzle-orm with the `postgres` or `pg` driver, nodemailer. Check that Node's fetch supports `redirect: 'error'`. Check that Mailpit exposes `/api/v1/messages`.
7. Scope: the user has about 2 hours left today. Name design parts that cost a lot and add little, and say what you would cut or simplify.

Do not edit files. Use the output format from your agent instructions. Keep the review under 900 words.
```
