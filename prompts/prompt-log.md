# Prompt log

Every prompt the user sent to the orchestrator agent, copied word for word. Prompts the orchestrator sent to subagents are in `prompts/subagents/`. Full chat exports are in `prompts/exports/`.

Tool: GitHub Copilot agent mode in VS Code. Orchestrator model: Claude Opus 5.5.

## 001 Kick-off

```text
I have a homework task for my interview. The requirement is in the docs folder.

I want to plan it first, go through step-by-step what should be the outcome and then execute on anything.
First, look at the file and clarify all questions. My idea is to build the frontend part in Angular 22, backend can be in Node.js LTS.
```

## 002 Answers to the first round of clarifying questions

The agent asked 16 questions through the VS Code question form. Each line has the question, then the user's answer.

```text
Event sources: Where should events come from?
  -> Simulated events only
Alert rule model: How expressive should a user's alert rule be?
  -> Category + typed filters
Auth: How should users and admins sign in?
  -> Email + password, JWT, seeded admin
Email delivery: Docker is not installed. How should email be sent?
  -> "I can install docker, that's not a problem. Assume that you can use a docker for email sending."
Slack delivery: How should Slack delivery work?
  -> Incoming webhook URL per user/channel config
Admin scope: What should the admin view include?
  -> All users and their alerts; Ingested event feed; Delivery log with status + retry failed;
     Enable/disable sources and channels; Metrics dashboard (counts, failure rate)
Delivery reliability: Which delivery features are in scope?
  -> Dedup (one notification per alert+event); Retries with backoff
     "Let's start with these two, we can implement additional features later"
Backend framework: Which Node.js backend framework?
  -> Fastify
Database: Which database? (Docker not available)
  -> "I will install Docker, no worries. Tell me what is the best for that."
UI library: Which UI styling approach for Angular 22?
  -> "I'm thinking of trying out shadcn-ui. If that's not possible, stick to Angular Material"
Repo structure: How should the repo be laid out?
  -> Nx monorepo
Testing depth: What testing level?
  -> Unit (rules, channels) + API integration + 1 Playwright e2e smoke
Prompt history: How should prompt history be captured?
  -> Both: verbatim log in repo + chat exports at milestones
Doc writing style: Should I apply the unslop rules from .agents/skills/unslop to all docs I write?
  -> Yes, apply to all docs
Deployment: Does it need to be deployed?
  -> Local only, one command to run (npm run dev + seed)
Time budget: How many hours do you plan to spend, and is there a deadline?
  -> "2.5 more hours"
```

## 003 Plan approval and orchestration setup

```text
Answers:
1. I might can do some work tomorrow as well, but currently I accept this slack cut.
2. No, I don't have that.
3. Yes, and please use commit message convension like Angular has on GitHub (https://github.com/angular/angular/blob/main/contributing-docs/commit-message-guidelines.md)
4. Yes, sounds good.

I have some things to add:
- I think an agents.md file would be nice to create
- You just become the orchestrator agent. Your task is to make sure you coordinate all subagents well in this environment.
- For reviews, I want you to create 2 subagents: one Opus 5.5 agent, one GPT 6.2 Sol
```

Context for the numbered answers. The agent had asked:

1. Do you accept the cut order: metrics page, then Playwright test, then source and channel switches?
2. Do you have a Slack workspace where you can create an incoming webhook?
3. Should I commit at each milestone, with you doing all the pushes?
4. Should generated events appear on a timer in addition to the dev injection endpoint?
