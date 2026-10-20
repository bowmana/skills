---
name: starting-phone-sessions
description: Use when the user wants to start, open or create a Claude Code session from their phone (or claude.ai/code) that runs on this PC in a project folder — "make <project> startable from my phone", "start a new Claude session on <project> from my phone", "which environment do I pick in the app", "phone link for <project>", "stop the phone server for <project>", or when /remote-control server mode, `claude remote-control --spawn`, or the claude-rc systemd service comes up.
---

# Starting phone sessions on this PC

The Claude app can't open a terminal window on the PC. Instead, each project folder runs a
`claude remote-control` **server** (`--spawn same-dir`) as a systemd user service. The server shows
up in the app as an **environment** named `<folder> · <branch>`, and each new session the user
starts on it runs headless on this PC in that folder. Verified 2026-10-20 (Claude Code 2.1.280).

## Do it

Helper script: `${CLAUDE_SKILL_DIR}/scripts/rc.sh` (`~/.claude/skills/starting-phone-sessions/scripts/rc.sh`).

| Ask | Run |
|---|---|
| make `<project>` startable from the phone | `rc.sh up <project>` (a folder name under `~/Projects`) |
| fewer approval prompts on the phone | `rc.sh up <project> same-dir acceptEdits` (3rd arg spawn mode: `same-dir`, `worktree`, `session`; 4th arg `--permission-mode`) |
| the link / which environment to pick | `rc.sh link <project>` |
| what is running | `rc.sh status` |
| stop it | `rc.sh down <project>` |

`up` writes the template unit `~/.config/systemd/user/claude-rc@.service` and the per-project
`~/.config/claude-rc/<project>.env`, then enables and starts `claude-rc@<project>`, turns on
`loginctl enable-linger` (so it starts at boot) and prints the environment name and link.

Then tell the user: in the Claude app open **Code**, start a **new session**, pick the environment
**`<project> · <branch>`** (computer icon, green dot), and type the task. The printed
`https://claude.ai/code?environment=env_…` link opens that environment directly; it is fine to
bookmark.

## Gotchas

- **arsenal** predates the template: it runs as plain `claude-rc.service` (`~/Projects/arsenal`,
  link `env_01AXJLUGcBv9ceKLGQAhdKPF`). `rc.sh` detects it and won't start a second server. To move
  it onto the template, run `systemctl --user disable --now claude-rc && rc.sh up arsenal`, but only
  when no phone session is attached (stopping the server kills them; check
  `systemctl --user status claude-rc` for `claude --print --sdk-url` children).
- **Restarting a server kills every session it spawned.** Check for children before `up`/`down` on a
  running one.
- Starting the server creates one session right away; it shows in the app's list.
- **`same-dir`**: every phone session shares the real checkout with any terminal sessions.
  **`worktree`** isolates each session but leaves branches to merge; avoid it in repos with a
  one-branch rule (arsenal's `docs/coding-rules.md` §6).
- Spawned sessions run headless (no desktop window) and read the repo's `CLAUDE.md` and memory, but
  have no context from other conversations.
- Requirements: Pro/Max plan (Team/Enterprise needs Remote Control enabled), signed in with
  `claude auth login`, not an API key.
- Logs: `journalctl --user -u claude-rc@<project> -f`. Flags: `claude remote-control --help`
  (never run it without `--help` in a tool shell: it starts a server and blocks).
- Folder names must be valid systemd instance names (plain names; escape others with `systemd-escape`).
- Docs: https://code.claude.com/docs/en/remote-control
