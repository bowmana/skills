---
name: meld-diffing
description: Use when the user asks to visually diff or compare two files or directories ("diff x and y in meld", "visual diff of a vs b", "open meld on these"), or to see a before/after visual diff of file changes made during this session ("show me what you changed in meld", "visual diff of your changes"). Opens the Meld GUI with the requested comparisons.
---

# Diffing in Meld

Requires `meld` (Arch: `sudo pacman -S meld`). If missing, ask the user to run `! sudo pacman -S meld`.

Always launch detached so the session never blocks on the GUI:

```bash
setsid -f meld ARGS >/dev/null 2>&1
```

## Mode 1 — user names the things to compare

- Two files or two directories: `setsid -f meld "$A" "$B" >/dev/null 2>&1`
- Three-way: `meld "$A" "$B" "$C"`

## Mode 2 — before/after of this session's changes

1. List the files changed this session (you know them from the conversation).
2. If the repo was clean when the session's edits began and all working-tree changes are yours, prefer the one-liner: `setsid -f meld "$REPO_ROOT" >/dev/null 2>&1` — Meld's version-control view lists every modified file; double-click opens its diff. Done.
3. Otherwise materialize "before" copies under `<scratchpad>/meld-before/`, mirroring relative paths:
   - File was committed and untouched before your edits: `git show HEAD:rel/path > <scratchpad>/meld-before/rel/path`
   - No git / file had pre-existing uncommitted changes: reconstruct the before-content from the session's own edits (reverse each Edit by putting `old_string` back) and write it there.
   - File you created this session: use an empty file as the before side.
4. Open ONE window with a tab per file (first pair positional, rest via repeated `--diff`):

   ```bash
   setsid -f meld before1 after1 --diff before2 after2 --diff before3 after3 >/dev/null 2>&1
   ```

   More than ~10 files: use the version-control view (step 2) or ask which files matter.

## Notes

- Left pane = before (throwaway scratchpad copy), right pane = the live file — edits made in Meld's right pane save to the real file, which is fine.
- Scratchpad before-copies are temporary; if the user wants to keep a snapshot, copy it somewhere durable.
- Tell the user the window is open; don't wait on the meld process.
