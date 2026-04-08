---
name: planning-docs
description: Planning and documentation conventions for the Perd project. Use this skill whenever the task touches files in `plan/`, roadmap structure, completed-work notes, architecture documentation, or asks to split work into implementation iterations, even if the user does not explicitly mention planning.
---

# Planning And Documentation Conventions

Use this skill for roadmap maintenance and planning docs. The goal is to keep the plan tree small, current, and implementation-oriented instead of turning it into a vague backlog dump.

## Scope

Apply these rules when working on:

- `plan/**`
- roadmap summaries and task decomposition
- completed-work summaries
- architecture notes that change how future work should be implemented

Do not use this skill for backend endpoint code unless the task also changes roadmap or documentation artifacts.

## Roadmap model

- Treat `plan/` as the global product roadmap, not a sprint board or personal todo list.
- Keep `plan/PLAN.md` short and use it as an index to detailed plan files.
- Large efforts should be split into sequential iteration files when that helps implementation stay concrete.
- Move completed work summaries to `plan/completed.md` instead of leaving stale execution detail inside roadmap specs.

## Iteration design

- Prefer the smallest completed iteration that removes one blocker or delivers one coherent slice.
- Do not add speculative implementation detail, abstractions, or future phases that the current iteration does not need.
- For new API iterations, every join must be justified by a returned field or an applied filter in that iteration.
- Do not add extra detail endpoints or broader detail payloads unless the current iteration already has a concrete consumer.
- Treat response examples in plan files as the upper bound for that iteration's payload. Do not silently extend them.

## Update rules

- When roadmap files are renamed or moved, update links in `plan/PLAN.md` and any overview files immediately.
- If a task changes architecture, route conventions, data-model expectations, or test strategy, update the relevant planning or documentation files in the same change.
- Keep completed notes short and factual. Save detailed implementation guidance for the active roadmap files that still matter.

## Writing style

- Write plans so another engineer can implement them without guessing the intended slice.
- Prefer concrete behavior and current constraints over generic platform-speak.
- Remove stale guidance instead of appending contradictory notes on top of it.
