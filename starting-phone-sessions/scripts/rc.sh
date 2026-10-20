#!/usr/bin/env bash
# Phone-startable Claude Code sessions on this PC: one `claude remote-control` server per
# project folder, run as the systemd user template unit claude-rc@<project>.service.
#   rc.sh up <project> [spawn-mode] [permission-mode]   create/enable/start, print the link
#   rc.sh down <project>                                stop + disable
#   rc.sh link <project>                                print the phone link
#   rc.sh status                                        list running servers
# <project> is a folder name under ~/Projects (or an absolute path to a folder there).
set -euo pipefail
unit_dir=$HOME/.config/systemd/user
tpl=$unit_dir/claude-rc@.service
proj=${2:-}
proj=${proj%/}; proj=${proj##*/}

# The first server (arsenal, 2026-10-20) predates the template: plain claude-rc.service.
legacy_dir() { systemctl --user show claude-rc -p WorkingDirectory --value 2>/dev/null; }
unit_of() { if [[ $(legacy_dir) == "$HOME/Projects/$1" ]]; then echo claude-rc; else echo "claude-rc@$1"; fi; }
link() { journalctl --user -u "$(unit_of "$1")" --no-pager -o cat 2>/dev/null |
	{ grep -o 'https://claude.ai/code?environment=[A-Za-z0-9_]*' || true; } | tail -1; }

write_template() {
	local claude; claude=$(command -v claude)
	mkdir -p "$unit_dir"
	cat >"$tpl" <<UNIT
[Unit]
Description=Claude Code Remote Control for ~/Projects/%i (start sessions from phone/web)
After=network-online.target

[Service]
WorkingDirectory=%h/Projects/%i
Environment=PATH=%h/.local/share/mise/shims:%h/.local/bin:/usr/local/bin:/usr/bin:/bin
Environment=RC_SPAWN=same-dir
EnvironmentFile=-%h/.config/claude-rc/%i.env
ExecStart=$claude remote-control --spawn \${RC_SPAWN} \$RC_FLAGS
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
UNIT
}

case ${1:-} in
up)
	[[ -n $proj && -d $HOME/Projects/$proj ]] || { echo "no folder ~/Projects/$proj" >&2; exit 2; }
	if [[ $(unit_of "$proj") == claude-rc ]] && systemctl --user is-active -q claude-rc; then
		echo "already served by claude-rc.service"; echo "link: $(link "$proj")"; exit 0
	fi
	write_template
	mkdir -p "$HOME/.config/claude-rc"
	flags=""; [[ -n ${4:-} ]] && flags="--permission-mode $4"
	printf 'RC_SPAWN=%s\nRC_FLAGS=%s\n' "${3:-same-dir}" "$flags" >"$HOME/.config/claude-rc/$proj.env"
	systemctl --user daemon-reload
	systemctl --user enable "claude-rc@$proj" >/dev/null 2>&1
	systemctl --user restart "claude-rc@$proj"
	loginctl enable-linger "$USER" >/dev/null 2>&1 || echo "warn: could not enable linger (service starts at login only)" >&2
	for _ in $(seq 20); do l=$(link "$proj"); [[ -n $l ]] && break; sleep 1; done
	systemctl --user is-active "claude-rc@$proj"
	echo "environment: $proj · $(git -C "$HOME/Projects/$proj" branch --show-current 2>/dev/null || echo '-')"
	echo "link: ${l:-'(not yet: rc.sh link '"$proj"')'}"
	;;
down) systemctl --user disable --now "$(unit_of "$proj")" ;;
link) link "$proj" ;;
status) systemctl --user list-units 'claude-rc*' --all --no-pager --plain --no-legend ;;
*) sed -n '2,8p' "$0"; exit 2 ;;
esac
