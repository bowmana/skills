# hypruse test log

Run 2026-10-22 on Omarchy with Hyprland 0.56.2 and hypruse 0.13.0 (`uvx hypruse`), from a Claude Code session in `~/Projects/arsenal`. Every result below was checked: by screenshot, `ls` of the test folder, `hyprctl`, or the clipboard via `wl-paste`. Test files lived in the session scratchpad (`clicktest/` with `file_01..40.txt`, `drag_me.txt`, `inbox/`, later 100 `zz_NNN.txt`) and were deleted afterwards.

Layout at test time: HDMI-A-1 portrait 1440x2560 at 0,0 (workspace 1, empty); DP-2 1920x1080 at 1440,0 (Chromium, ws 4); DP-3 1920x1080 at 3360,0 (foot terminal running Claude, ws 3). Two minimized Claude terminals sat in `special:omarchy-minimized`.

## Contents
- A. Install + smoke test (CLI)
- B. Minimize / restore from the bar (CLI)
- C. Minimize / restore from the bar (MCP)
- D. Nautilus click suite (MCP)
- E. Chromium: typing, scroll, background keys
- F. Highlight while scrolling (Chromium)
- G. Root-causing the long-drag failure

## A. Install + smoke test (CLI): PASS
- Deps check: `command -v grim wtype uv uvx wl-copy magick hyprctl` all present.
- `timeout 60 uvx hypruse --help` downloads 30 packages; no args = MCP stdio server.
- `HYPRUSE_READONLY=1 uvx hypruse desktop` listed all 3 monitors, workspaces, windows, layers.
- `HYPRUSE_READONLY=1 uvx hypruse screenshot --scale 0.5 --out ./x.png` captured the focused monitor (JPEG, with JSON coordinate metadata).
- Registered: `claude mcp add -s user hypruse -- uvx hypruse`; `claude mcp get hypruse` showed Connected. The MCP tools only appeared after restarting Claude Code.

## B. Minimize / restore from the bar (CLI, before restart): PASS
1. `uvx hypruse screenshot --region 1440,0,1920x1080 --scale 0.5 --out dp2.png` → Chromium has 3 title-bar dots at the top right.
2. `uvx hypruse zoom 3320 40 --size 120x40 --out zoom.png` → yellow, green, red. Yellow at image (59,20) → global (3299,40).
3. `uvx hypruse pointer click 3299 40 --then desktop` → Chromium moved to ws -98 `special:omarchy-minimized`; DP-2 showed only the wallpaper.
4. `uvx hypruse zoom 1660 13 --size 440x26` → bar shows a new "Googl…" entry with the Chromium icon at about x=375 of the crop → (1815,13).
5. `uvx hypruse pointer click 1815 13 --then desktop` → Chromium back on ws 4 at 1442,52 at its original size; screenshot identical to before.
6. `uvx hypruse hypr focus_window <terminal>` → focus back on the terminal.

## C. Same flow through the MCP tools: PASS
`desktop` → `zoom(x=3320,y=40,size="120x40")` → `pointer(action="click",x=3299,y=40,background=false,then="desktop")` (Chromium on ws -98) → `screenshot(region="1440,0,480x26",stable=true)` → `pointer(click,1815,13,background=false,then="screenshot")` (restored) → `hypr(focus_window, terminal)`.
- `background=false` was passed up front because the tool docs say pointer input into a window the user isn't in is refused otherwise. I did not observe a refusal myself.
- Screenshots are saved to `/run/user/1000/hypruse/shot-*.jpeg`; Read the path to see them.

## D. Nautilus (GTK4) click suite (MCP)
Setup: `launch(command="nautilus --new-window <clicktest>", workspace="1")` → window 0x…d430 on the portrait monitor at 2,52, 1436x2506.

1. **marks**: `marks(window=addr)` → 20 numbered controls: Back/Forward, every breadcrumb, Current Folder Menu, Search Current Folder, View Options, Close, Eject, Search Everywhere, Main Menu. **No file rows or sidebar places** (not exposed as buttons). PASS
2. **click_ui by name**: `click_ui(name="Search Current Folder",window=addr,background=false,then="ui")` → `checked: true` and a search box appeared. Then `keyboard(action="type",text="file_3",window=addr)` → list filtered to file_30…file_39. PASS
3. **Right-click → menu → rename**: `keyboard(key,"esc")`; zoom showed file_01.txt at (342,217); `pointer(click,342,217,button="right",background=false)` → context menu (visible only in a screenshot; `then="ui"` didn't list it). `click_ui(name="Rename")` → "no matching 'Rename' elements": **GTK4 menus are not in the tree**. Zoom located "Rename…" → `pointer(click,395,458)` → Rename popover with "file_01" preselected → `sequence([type "renamed_by_hypruse", key "enter"])` → `ls` showed `renamed_by_hypruse.txt`. PASS (by position)
4. **Drag**:
   - Long: `pointer(drag,350,165 → 330,2246)` (drag_me.txt onto inbox, ~2,080 px) → file only got selected; nothing moved. FAIL
   - Short: added `a_inbox/` so it sorts directly above drag_me.txt; `pointer(drag,350,217 → 330,165)` → `drag_me.txt` inside `a_inbox/`. PASS
   - Root cause and fix in G.
5. **Double-click**: `pointer(click,336,165,double=true,then="ui")` → breadcrumb gained `a_inbox`, Back became clickable. PASS
6. **click_ui Back**: `click_ui(name="Back")` → back in clicktest, Forward enabled. PASS
7. **Wheel scroll**: added 100 `zz_*.txt` so the list overflows. `pointer(scroll,scroll_dy=30,x=700,y=1200)`, then 3, then 2.5 (fractional = continuous axis instead of axis_discrete), and later 10 → list never moved. FAIL in Nautilus.
   - Workaround: `keyboard(key,"pgdn",window=addr,background=false)` twice. The first press moved the selection to the last visible row; the second scrolled the view to zz_005…. PASS
8. **Background click_ui**: `hypr(focus_window, terminal)`, then `click_ui(name="Search Current Folder",background=true,then="desktop")` → "pressed … through its accessibility action (no pointer, the human's focus untouched); now: checked=true". Active window was still the terminal; cursor didn't move. PASS
9. Cleanup `hypr(close_window, addr)` → closed. PASS

## E. Chromium: typing, scroll, background keys
- `sequence([key ctrl+l, type "https://en.wikipedia.org/wiki/Hyprland", key enter, wait_for title_change match "Wikipedia"])` with `background=false` → page loaded. PASS
- `pointer(scroll,scroll_dy=10,x=2200,y=600)` → page scrolled down to Controversies/References. PASS (so the wheel works; Nautilus is the problem)
- `keyboard(key,"alt+Left",window=chromium,background=true)` → reported "sent … with sendshortcut" but the page stayed (`wait_for title_change "Google"` timed out). FAIL. Clicking the back button by position, `pointer(click,1465,114)`, worked.
- `wait_for(title_change,"Wikipedia")` after the Forward click timed out because the title was already "Hyprland - Wikipedia" (no change event); a screenshot confirmed the page.

## F. Highlight while scrolling (Chromium)
1. `pointer(scroll,-40)` to the top; the first paragraph's first word "Hyprland" is at (1715,428).
2. `pointer(drag,1715,428 → 2140,1066)` (bottom edge of the page area) → three paragraphs highlighted, but **no autoscroll** because the release is instant. PARTIAL
3. Hold script: press at (1715,428), glide in 30 steps to (2140,1000), then 8× [`scroll(dy=1)`, sleep 0.15, nudge pointer ±1 px, sleep 0.1], release. It uses hypruse's own `hypruse.input.move`, `_with_pointer`, `_seat_lock` and `wire.PRESSED/RELEASED`. Ran with `uvx --from hypruse python <script>`. The page scrolled to References with the highlight growing. `keyboard(key,"ctrl+c")` + `wl-paste` → 2,946 chars from "Hyprland is a dynamic tiling window manager…" through reference #8. PASS
4. Generalized into `scripts/hold_drag_scroll.py`: `… 1715 428 2140 1000 --notches 6` → 2,484 chars across the scroll. PASS. The highlight started two lines lower than aimed: the smooth scroll-to-top was still animating when the press landed. Lesson: take a `stable=true` screenshot right before pressing.

## G. Root-causing the long-drag failure (Nautilus)
- Slower drag with a hover pause: `hold_drag_scroll.py 349 164 327 2297 --glide 0.6 --dwell 0.4` → still no move. A missing hover pause is not the cause.
- Pointer accuracy: `uvx hypruse pointer move X Y` then `hyprctl cursorpos` at y = 400, 1000, 1200, 2000, 2297 → exact every time. The rotated monitor is not the cause.
- Clicks at any height: CLI clicks on rows at y = 580, 892, 1204, 1516 each selected that row (Nautilus status pill "file_NN.txt selected"). But one MCP click at y=1724, made right after a failed long drag, did not select: it was consumed by the stuck drag.
- Confirmed: long drag, then `uvx hypruse pointer click 327 2297` at the target → `drag_me.txt` landed in `inbox/`. Then the MCP-only version, `sequence([pointer drag 349,164 → 327,2297, pointer click 327,2297])` → moved. PASS
- Conclusion: for long drags in GTK4 the drag-and-drop starts, but the virtual pointer's release isn't delivered as a drop. The next click completes it. Always follow a long GTK drag with a click on the drop target, and check the result.
