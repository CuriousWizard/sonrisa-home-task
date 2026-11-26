# AI review log

This log records each AI output or claim that was checked before it was accepted, and the result of the check. Entries are in time order.

Status values: `accepted`, `corrected`, `rejected`, `open`.

## V-001 Reading the brief

- AI output: the first attempt to read the `.docx` file called `unzip`, which is not installed.
- Check: read the file with Python `zipfile`. Also opened `word/comments.xml`, `footnotes.xml` and `endnotes.xml` to look for hidden reviewer comments.
- Result: the brief has no comments, footnotes or endnotes. The plan is based only on the document body.
- Status: corrected.

## V-002 Angular 22 support in Nx and spartan-ng

- AI claim: Nx and spartan-ng work with Angular 22.
- Check: `npm view @nx/angular peerDependencies` and `npm view @spartan-ng/brain peerDependencies`.
- Result: Nx 24.0.7 accepts Angular versions from 20 up to, but not including, 23. spartan-ng 1.10.1 accepts versions from 21 up to, but not including, 23. Both fit Angular 22.3.0.
- Status: accepted.

## V-003 Local tooling

- AI plan: the first plan assumed Docker for Postgres and Mailpit.
- Check: `docker --version`.
- Result: Docker was not installed. The questions to the user were changed to offer options without Docker. The user then chose to install Docker.
- Status: corrected.

## V-004 Reviewer model names

- User input: "one Opus 5.5 agent, one GPT 6.2 Sol".
- Check: searched the local Copilot Chat storage for registered model names.
- Result: the registered names are `Claude Opus 5.5` and `GPT-6.2 Sol`, with a hyphen. The agent files use the registered names.
- Status: corrected.

## V-005 Reviewer agent smoke test

- Check: invoked both reviewer agents with a task that has a known answer. Each agent had to run `git log` and quote a line from `AGENTS.md`.
- Result: both agents ran the command and quoted the line correctly. Each reported the model from its own config file and said it could not confirm the model it runs on. The session debug log did not record model ids.
- Status: open. The user can confirm the model of each subagent call in the VS Code Chat Debug view.

## V-006 Commit convention

- Risk: the agent could have written commits in the common Conventional Commits format from memory.
- Check: fetched the Angular guidelines page before writing any commit.
- Result: two rules differ from the common format. The type list has no `chore`. Every commit except `docs` needs a body of at least 20 characters. Both rules are now in `AGENTS.md`. See D-011 for the earlier `chore` commit.
- Status: corrected.
