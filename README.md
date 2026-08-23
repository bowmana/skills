# skills

A list of all my favorite skills to use day to day.

Each skill lives in its own directory with a `SKILL.md` (Claude Code / agent skill format).

## Skills

| Skill | What it does |
|---|---|
| [diagramming-mental-models](diagramming-mental-models/SKILL.md) | Create and review Mermaid diagrams of whatever you're working on via a local mermaid-lite app (a mermaid.live clone) — scratch diagrams or named, saved projects. Self-contained: the app + `ml` CLI source is bundled in [`diagramming-mental-models/src/`](diagramming-mental-models/src/README.md) with install instructions. |
| [writing-plans](writing-plans/SKILL.md) | Write comprehensive, bite-sized implementation plans from a spec before touching code. From [obra/superpowers](https://github.com/obra/superpowers) — all credit to the original author; install the maintained version with `npx skills add obra/superpowers -s writing-plans`. |
| [unslop](unslop/SKILL.md) | Remove AI writing patterns from prose (docs, READMEs, blog posts) and add human voice — 25 concrete tells to detect and fix. From [poteto/noodle](https://github.com/poteto/noodle) (`.agents/skills/unslop/`, MIT) — all credit to the original author. |
| [grilling](grilling/SKILL.md) | The core "grill" skill: relentlessly interview the user about a plan/decision/idea as a design tree, asking the frontier of unblocked questions in numbered rounds (with recommended answers) until nothing is silently assumed. From [mattpocock/skills](https://github.com/mattpocock/skills) (MIT) — all credit to Matt Pocock. |
| [grill-me](grill-me/SKILL.md) | User-invoked entry point (`/grill-me`, `disable-model-invocation`) that delegates to [grilling](grilling/SKILL.md). From [mattpocock/skills](https://github.com/mattpocock/skills) (MIT). |
| [grill-with-docs](grill-with-docs/SKILL.md) | Like `/grill-me` but also writes docs (ADRs + glossary) as you go — delegates to [grilling](grilling/SKILL.md) + [domain-modeling](domain-modeling/SKILL.md). From [mattpocock/skills](https://github.com/mattpocock/skills) (MIT). |
| [domain-modeling](domain-modeling/SKILL.md) | Build and sharpen a project's domain model: challenge terms, invent edge-case scenarios, and write `CONTEXT.md` glossary entries + ADRs the moment decisions crystallise. Dependency of grill-with-docs. From [mattpocock/skills](https://github.com/mattpocock/skills) (MIT). |
| [diagnosing-bugs](diagnosing-bugs/SKILL.md) | Disciplined diagnosis loop for hard bugs and performance regressions — phased, with a human-in-the-loop repro script template. From [mattpocock/skills](https://github.com/mattpocock/skills) (MIT). |
| [prototype](prototype/SKILL.md) | Build a throwaway prototype to answer a design question — separate playbooks for logic/state-model questions (`LOGIC.md`) and UI questions (`UI.md`). From [mattpocock/skills](https://github.com/mattpocock/skills) (MIT). |
| [wizard](wizard/SKILL.md) | Generate an interactive bash wizard that walks a human through steps only they can do: credentials, CI secrets, third-party dashboards, one-off migrations. From [mattpocock/skills](https://github.com/mattpocock/skills) (MIT). |
| [codebase-design](codebase-design/SKILL.md) | Shared vocabulary for designing deep modules — lots of behaviour behind small interfaces at clean seams, with `DEEPENING.md` and `DESIGN-IT-TWICE.md` references. From [mattpocock/skills](https://github.com/mattpocock/skills) (MIT). |
| [tdd](tdd/SKILL.md) | Red-green-refactor reference that makes the loop produce tests worth keeping — what a good test is, where tests go, anti-patterns, mocking rules. From [mattpocock/skills](https://github.com/mattpocock/skills) (MIT). |
| [handoff](handoff/SKILL.md) | Compact the current conversation into a handoff document a fresh agent session can pick up (`/handoff`, user-invoked). From [mattpocock/skills](https://github.com/mattpocock/skills) (MIT). |
| [impeccable](impeccable/SKILL.md) | Frontend design director skill: 23 named commands (`polish`, `audit`, `critique`, `distill`, `animate`, …), `PRODUCT.md`/`DESIGN.md` context, and a 59-rule AI-slop detector. From [pbakaus/impeccable](https://github.com/pbakaus/impeccable) (Apache-2.0, v4.1.1) — all credit to Paul Bakaus. Official install: `npx impeccable install`. |
| [taste-skill](taste-skill/SKILL.md) | Anti-slop frontend skill for landing pages, portfolios, and redesigns. Reads the brief, sets VARIANCE/MOTION/DENSITY dials, bans AI tells. From [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) (MIT, v2 experimental, install name `design-taste-frontend`) — all credit to the original author. |
