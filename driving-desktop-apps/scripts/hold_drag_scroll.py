"""Press-and-hold drag with optional wheel scrolling while the button is still down.

hypruse's MCP `pointer drag` presses, glides ~180 ms and releases instantly, so it cannot
autoscroll a selection, extend one across a scroll, or give a drop target time to accept.
This drives hypruse's own virtual pointer (same Wayland input path as the MCP) and holds.

Run:  uvx --from hypruse python hold_drag_scroll.py X1 Y1 X2 Y2 [--notches N] [--glide S]
      [--dwell S] [--button left|right|middle]
Coordinates are Hyprland global logical pixels (the same space `desktop`/`screenshot` report).
--notches  wheel notches to scroll while holding at X2,Y2 (positive = content down; 0 = none)
--glide    seconds to travel X1,Y1 -> X2,Y2 (default 0.6)
--dwell    seconds to hover at X2,Y2 before releasing (default 0.4; lets drop targets react)
The button is always released, even on error or Ctrl+C.
"""

import argparse
import time

from hypruse import input as hinput
from hypruse.wire import PRESSED, RELEASED

ap = argparse.ArgumentParser()
for name in ("x1", "y1", "x2", "y2"):
    ap.add_argument(name, type=float)
ap.add_argument("--notches", type=int, default=0)
ap.add_argument("--glide", type=float, default=0.6)
ap.add_argument("--dwell", type=float, default=0.4)
ap.add_argument("--button", default="left", choices=("left", "right", "middle"))
a = ap.parse_args()

STEPS = 30


def run(p) -> None:
    p.button(a.button, PRESSED)
    try:
        for i in range(1, STEPS + 1):
            hinput.move(a.x1 + (a.x2 - a.x1) * i / STEPS, a.y1 + (a.y2 - a.y1) * i / STEPS)
            time.sleep(a.glide / STEPS)
        step = 1 if a.notches > 0 else -1
        for n in range(abs(a.notches)):
            p.scroll(dy=step)
            time.sleep(0.15)
            hinput.move(a.x2 + (n % 2), a.y2)  # nudge so the app re-tracks the selection
            time.sleep(0.1)
        time.sleep(a.dwell)
    finally:
        p.button(a.button, RELEASED)


with hinput._seat_lock:
    hinput.move(a.x1, a.y1)
    time.sleep(0.05)
    hinput._with_pointer(run)
print(f"held {a.button} {a.x1:.0f},{a.y1:.0f} -> {a.x2:.0f},{a.y2:.0f}, scrolled {a.notches}")
