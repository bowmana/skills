# mermaid-lite

Minimal local clone of mermaid.live backing the `diagramming-mental-models` skill: paste standard Mermaid source → identical rendered diagram. Local-only, single user. Projects are stored in SQLite; rendering is 1:1 with mermaid.live because it uses the official `mermaid` npm package with mermaid.live's exact defaults — no reimplemented parsing or layout.

## Requirements

- **Node.js ≥ 22.18** (the CLI and server run TypeScript directly via Node's type stripping)
- **A Chromium/Chrome binary** for headless PNG/SVG export — defaults to `/usr/bin/chromium`, override with `ML_CHROME=/path/to/chrome`
- Linux or macOS (browser opening uses `xdg-open` / `open`)

## Install

```sh
npm install
npm run build   # builds the web app into dist/
npm link        # makes the `ml` CLI available globally
```

That's it — `ml` now works from anywhere. The server auto-starts detached on first use (port 4680, override with `ML_PORT`).

## Usage

```sh
ml scratch diagram.mmd        # open a temp scratch diagram (in-memory, never saved)
ml create "My Diagram" -f diagram.mmd   # save as a named project
ml open "My Diagram"          # open a project in the browser
ml set "My Diagram" -f diagram.mmd      # update it (open pages live-update via SSE)
ml show "My Diagram"          # print metadata + code AND render a fitted PNG
ml list                       # list all projects
ml render "My Diagram" -o out.png       # headless export (png or svg)
ml --help                     # everything else
```

Always pass code via `-f` or an explicit pipe — `ml create`/`ml set` on a silent open stdin will hang waiting for EOF.

## Where data lives

- Projects DB: `$XDG_DATA_HOME/mermaid-lite/projects.db` (default `~/.local/share/mermaid-lite/`)
- Rendered PNGs from `ml show`: `/tmp/mermaid-lite/`

## Development

`npm run dev` runs the API server (watched) plus a Vite dev server. Vanilla TypeScript, no framework.
