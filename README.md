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
