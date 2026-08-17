---
name: diagramming-mental-models
description: Use when the user wants to visually see a diagram of what's being worked on, or wants Claude to look at an existing diagram — "make a diagram of this", "diagram this flow/architecture", "visualize this", "make a temp/scratch diagram of X", "show me the mental model", "looking at the diagram for X", "review/check the X diagram", "open that diagram again". Creates or reviews Mermaid diagrams in the local mermaid-lite app (temp scratch or named SQLite projects).
---

# Diagramming mental models (mermaid-lite)

Tool: `ml` CLI, globally linked from `~/Projects/mermaid-lite` (local mermaid.live clone). The server auto-starts detached; diagrams open in the browser via xdg-open.

## Reviewing an existing diagram ("looking at the diagram for X")

1. `ml show "X"` — prints the project's metadata + mermaid code AND renders a fitted PNG, ending with `image: /tmp/mermaid-lite/<name>.png`. **Read that image file** to actually see the diagram; reason from both code and image. Unknown name → `ml show` suggests close matches; `ml list` shows all projects.
2. For the user's last scratchpad diagram: `ml show --scratch` (covers what `ml scratch` opened; edits made inside the browser scratch page are not captured — if the user says they edited it, ask them to hit "Save as project" first, then `ml show` that project).
3. `--code-only` skips the PNG when only the source matters.

## Creating a diagram

1. Write Mermaid source for the thing being discussed (usually `flowchart TB`/`LR`; `<br/>` in labels and subgraphs render 1:1). Syntax reference if unsure: `~/Projects/mermaid-lite/docs/mermaid/syntax/`.
2. Decide temp vs project:
   - user said temp / scratch / quick / throwaway → **temp**
   - user said project / save / keep, or gave it a name → **project**
   - **otherwise ASK**: "Temp scratch diagram, or a project saved to your mermaid-lite library?"
3. Open it:
   - **Temp:** write code to `/tmp/<slug>.mmd`, then `ml scratch /tmp/<slug>.mmd` — in-memory only, never touches SQLite; the app's "Save as project" button covers a change of mind.
   - **Project:** `ml create "Descriptive Name" -f /tmp/<slug>.mmd && ml open "Descriptive Name"`. If the name is taken, either update that project (`ml set`) or pick a new name — ask if ambiguous.
4. Iterating on a diagram that's already open in the browser: `ml set "Name" -f file.mmd` — the open page live-updates over SSE, no reopen.

## Notes

- `ml list` shows projects; `ml get "Name"` prints code; `ml render "Name" -o out.png` (or `.svg`) exports headlessly without a visible browser.
- Always pass code via `-f` (or an explicit closing pipe): `ml create`/`ml set` with a silent open stdin hangs waiting for EOF.
- If `ml` is missing or broken: `cd ~/Projects/mermaid-lite && npm install && npm run build && npm link`.
