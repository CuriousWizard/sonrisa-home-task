# Prompting notes for Claude Opus 5.5

Source: [Prompting Claude Opus 5.5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5), read on 2026-11-26. The page lists what changed from Claude Opus 5 and points to the general prompting guide for the rest. This file covers only the Opus 5.5 page.

The orchestrator, the implementer subagents and reviewer-opus run on Claude Opus 5.5. The orchestrator checks each new subagent prompt against this file before it saves the prompt to `prompts/subagents/`.

## Guidance and where it applies

### Effort

- Guide: effort is the main control for how much the model thinks, and thinking is always on. The default is `medium`. In Anthropic's coding tests, Opus 5.5 at `medium` matched or beat Opus 5 at `high`. Set the level explicitly and test several levels. Keep `xhigh` and `max` for work where a quality gain was measured. To get less thinking, lower the effort. A prompt line does this less reliably.
- Here: VS Code ignores `reasoning-effort` in agent files. A subagent runs at the effort set for its model in the model picker. Claude Opus 5.5 is set to `xhigh`, so the orchestrator, the implementers and reviewer-opus all run at `xhigh`. All three reviewer-opus calls in M1 ran at `xhigh`.
- Status: open. No test has compared `xhigh` with `medium`. See V-016.

### Reasoning in the reply

- Guide: remove prompt lines that ask the model to write out its reasoning in the reply. The model can decline such prompts with the `reasoning_extraction` refusal. A short explanation of the answer or a summary of the actions taken is fine. Remove "think carefully before answering" lines too, because effort controls thinking.
- Here: the reviewer output asks for evidence, which is the command run or the line read. That is a summary of actions. Neither reviewer file asks the model to think harder.
- Status: follows the guide. Phrase scenario checks as states of the system, such as "list each state the row passes through", and not as the model's thought process.

### Early end of turn

- Guide: on long tasks the model writes progress notes, and some of them end the turn without a tool call. An agent loop that treats such a turn as the end stops there. The model follows instructions that name the stops to avoid, such as a summary that announces the next step instead of taking it, or an offer to continue. Name the stops you want too, such as when the work cannot go on without the user.
- Here: a subagent's last message goes back to the orchestrator as the result. The subagent gets no reply, so an early stop returns a partial review or a partial change.
- Status: added to both reviewer files, see D-029. New implementer prompts get the lines in the last section. In M2, two implementer runs returned no report (V-011). Prompts 004 and 006 then ended with "Your last message must be the report", and both runs returned a full report.

### Reading before acting

- Guide: Opus 5.5 starts work quickly. On loosely specified tasks, tell it to look through the relevant sources first, including ones the task does not name. The guide's example is an agent that works across mail, documents and spreadsheets.
- Here: the reviewer files told the model to open the files named in the prompt. They did not list the files every review needs.
- Status: added to both reviewer files, see D-029.

### Code review and security

- Guide: Opus 5.5 catches more bugs in review than Opus 5 and raises fewer false alarms. The cybersecurity safeguard allows finding vulnerabilities in source code.
- Here: the OWASP check in the reviewer files is a source code review.
- Status: no change.

### Pasted text

- Guide: wrap text that came from somewhere else in `<pasted_content id="...">` tags with a random id. Add a note to the system prompt that says to follow instructions inside the tags only where the user's own message asks for it.
- Here: subagent prompts point to files and do not paste outside text.
- Status: not needed yet. If a prompt quotes a webpage, an email or a reviewer reply, wrap the quote in the tags and add the note from the guide.

### Time budget

- Guide: in agent teams, a line with the elapsed time against a budget, such as `elapsed 340s / 1200s`, makes the lead agent run more subagents in parallel and finish sooner. Under time pressure the model can search and verify less.
- Here: VS Code does not add elapsed time to subagent messages.
- Status: not used. Reviewers get no time budget, because a review that verifies less is worse.

### Frontend design

- Guide: without design direction the model falls back on a few default styles. A line such as "avoid a generic AI look" swaps one default for another. Name the specific patterns to avoid, check the first result and extend the list.
- Here: M4 builds the Angular pages with spartan-ng.
- Status: applies to the M4 implementer prompt. List the patterns to avoid by name.

### Screenshots and diagrams

- Guide: Opus 5.5 reads charts, diagrams and screenshots more accurately than Opus 5. For dense images, a higher resolution and a crop tool add accuracy.
- Here: M6 adds screenshots to the README.
- Status: no change.

### Settled answers in chat

- Guide: a chat system prompt line can tell the model to treat earlier answers as done, which cuts thinking on follow-up turns. The guide advises against it where a later step can show a mistake in an earlier one.
- Here: the orchestrator and the reviewers need to recheck earlier work.
- Status: not used.

### Not applicable

VS Code controls these API settings, so prompts cannot change them: `max_tokens`, `thinking.display`, progress-update blocks, per-message effort and the move away from disabled thinking.

## Lines for subagent prompts

Reviewer files, added in D-029:

```text
- Read `AGENTS.md`, `docs/requirements.md`, `docs/design.md` and `docs/decision-log.md` before you write findings. Open every file the change touches, including files the prompt does not name.
- Your last message is the review, and the orchestrator cannot reply to it. Finish every check before you return. Do not end with a plan for the next step or an offer to do more. If a check cannot be done, list it under "Not verified" and go on with the rest.
```

Implementer prompts:

```text
Your last message goes back to the orchestrator, which cannot reply to you. Finish every task in this prompt before you return. Do not end with a summary that announces the next step, with an offer to do more, or with a list of choices that do not block the work. Stop early only when a task cannot go on without the user. Then name the blocker and list what you finished.
```
