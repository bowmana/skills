---
name: driving-desktop-apps
description: Use when a task is stuck behind a GUI meant for humans with no CLI or API route — cloud console setup (enabling services, consent screens, OAuth/API-key pages, billing or project wizards), installers, settings panels, native file pickers or dialogs — or when asked for "computer use", to click through a console, or to operate a desktop app on this Omarchy/Hyprland machine; also any mention of hypruse or mcp__hypruse__* tools. Drives the live Wayland desktop through the hypruse MCP server and records which input paths are verified to work.
---

# Driving desktop apps (hypruse)

## When to use (owner's rule, 2026-10-22)
This is the **last resort**. Use whatever is best at your disposal first: a CLI (`gcloud`, `aws`, `az`, `gh`, `stripe`…), an API/SDK, an MCP connector, or Claude in Chrome for plain web pages. Reach for hypruse when you are stuck in a flow built for humans to click through and nothing else can drive it. The main case is **cloud console setup** (enabling an API, consent screens, creating credentials, wizards). Also: native dialogs, file pickers, installers, desktop settings.
- Cloud consoles are outward-facing and can cost money. Before any click that creates billable resources, deletes, publishes, or grants access, confirm with the owner unless they already approved that exact step.
- Never type passwords or 2FA codes; hand those steps to the owner (hypruse refuses auth fields unless `allow_auth=true`, which you should only pass when the owner asks).
- Once the GUI step is done, go back to the CLI/API for everything after it.

hypruse 0.13.0 is registered as a user-scope MCP server: `claude mcp add -s user hypruse -- uvx hypruse`. No root needed (grim, wtype, uv were already installed). Tools load at session start; if `mcp__hypruse__*` is missing, restart, or run the same verbs in Bash: `uvx hypruse <verb> --help`. Full test record with exact calls: `references/test-log.md`.

Coordinates are Hyprland **global logical pixels** everywhere. For an image: `global = geometry[:2] + image_pixel / scale`. Monitors (verified 2026-10-22, check `desktop` since layouts change): HDMI-A-1 portrait 1440x2560 at 0,0; DP-2 1920x1080 at 1440,0; DP-3 1920x1080 at 3360,0 (the terminal).

## Loop
1. `desktop` first; act on the window addresses it returns. Note the terminal's address so you can hand focus back.
2. Window or workspace work goes through `hypr` (focus_window, move_window, close_window), not clicks. Open apps with `launch` (pass `workspace` to put it on screen).
3. Named control in a GTK/Qt app → `click_ui(name=…)`; `marks` shows a numbered map, then `click_ui(mark=N)`. Add `then='ui'` to verify state (e.g. `checked`).
4. Otherwise: `screenshot(window=addr)` → `zoom` on the target → `pointer` click at the computed global point. Take the screenshot with `stable=true` right before pressing; animations (smooth scroll) shift content.
5. Verify every effect: `then=`, a screenshot, the file system, or the clipboard (`wl-paste`).
6. Finish with `hypr focus_window <terminal>`; clicking another window takes focus away from the user.

## Verified rules (2026-10-22)
- `pointer` into a window the user isn't in needs `background=false` (it moves the user's real cursor). `click_ui(background=true)` presses via accessibility with no cursor or focus change. Works.
- GTK4 context menus and popovers are **not** in the accessibility tree; `click_ui("Rename")` fails. Use screenshot + pointer.
- Chromium exposes no tree; use vision.
- **Long drag in GTK4 (Nautilus, ~2,000 px):** the drag-and-drop starts but the release isn't delivered as a drop. Fix: `sequence` [`pointer drag` → `pointer click` at the same target]. Short drags (~50 px) work as-is. Chromium text drag-select works at 650 px.
- `pointer drag` releases instantly, so it can't autoscroll or keep a selection held. To hold the button (drag-select across a scroll, slow drop): `uvx --from hypruse python ${CLAUDE_SKILL_DIR}/scripts/hold_drag_scroll.py X1 Y1 X2 Y2 --notches N`.
- Mouse-wheel scroll works in Chromium but is **ignored by Nautilus (GTK4)**, whether sent as whole or fractional notches. Use keys: `pgdn`/`End` (the first pgdn only moves the selection to the last visible row; the second scrolls).
- `keyboard` with `background=true` into Chromium (Hyprland sendshortcut) reports success and does nothing. Use `background=false`.
- Synthetic keys never trigger Hyprland binds (super+…); use `use_bind`.
- `wait_for title_change` only fires on a change. If the title is already the target, it times out, so confirm with a screenshot.
- Omarchy minimize = the yellow title-bar dot (green, red follow). Minimized windows move to `special:omarchy-minimized` and appear on the bar's left; clicking the entry restores the window.
- Ctrl+C overwrites the user's clipboard; tell them.
