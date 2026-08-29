#!/usr/bin/env bash
# Record the README's GIFs by driving a real editor and photographing it.
#
# The extension's recorder (src/recorder.ts) plays examples/scenes.json inside the running editor and
# stops at every frame; this script is what takes the picture. The two meet in a rendezvous
# directory: the recorder writes `<frame>.json` when a state is ready, this script captures the
# window and writes `<frame>.taken`, and the recorder moves on. Nothing is on a timer, so no frame
# can catch a half-applied decoration.
#
#   ./scripts/record.sh                      # every scene in examples/scenes.json
#   ./scripts/record.sh 2                    # every scene of group 2 — examples/2-*
#   ./scripts/record.sh 21 25                # only those two subcases
#   ./scripts/record.sh 6-not-implemented    # a folder, spelled out
#
# Requirements — see "Recording the demos" in the README:
#   * the conceal-capable fork, as for scripts/dev.sh (CONCEAL_DEMO_FORK)
#   * ffmpeg, for assembling the frames
#   * a Win32 screenshot helper taking -Hwnd/-Out, because WSLg has no Linux screenshot tool
#     and the editor window is a Win32 window like any other (CONCEAL_DEMO_WINSHOT)
set -euo pipefail
shopt -s nullglob

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# A scene's GIF is written beside the file it demonstrates, under the same name — so a folder's
# README can link the file and show the picture without either one carrying a path in its frames.
EXAMPLES="$REPO/examples"
WORK="$REPO/.vscode-test/record"
RDV="$WORK/rendezvous"
RAW="$WORK/raw"
CAPTIONED="$WORK/captioned"
LOG="$WORK/editor.log"
WINSHOT="${CONCEAL_DEMO_WINSHOT:-}"

# The window is sized from here rather than left as the editor last remembered it, so a re-recorded
# GIF drops into the README at the same size as the one it replaces.
WIDTH="${CONCEAL_DEMO_WIDTH:-1280}"
HEIGHT="${CONCEAL_DEMO_HEIGHT:-800}"
CAPTION_HEIGHT=84
CAPTION_SIZE=27
FONT="${CONCEAL_DEMO_FONT:-/usr/share/fonts/adwaita-mono-fonts/AdwaitaMono-Bold.ttf}"
FPS=10

die() { echo "$*" >&2; exit 1; }

command -v ffmpeg >/dev/null || die "ffmpeg is not installed — dnf install ffmpeg / apt install ffmpeg"
[[ -n "$WINSHOT" && -x "$WINSHOT" ]] || die "set CONCEAL_DEMO_WINSHOT to a screenshot helper that takes -Hwnd/-Out (WSL only; see README)"
[[ -f "$FONT" ]] || die "no font at $FONT — set CONCEAL_DEMO_FONT to a .ttf"

rm -rf "$WORK"
mkdir -p "$RDV" "$RAW" "$CAPTIONED"

# Pick the scenes asked for, and hand the recorder only those.
#
# An argument is a prefix, not a substring, because the numbering is a hierarchy: the first digit
# is the group and the second the subcase, so `2` has to mean "group 2" and not "every id with a 2
# in it" — which would drag in 12 and 62. A folder name works too, for the groups worth spelling.
python3 - "$REPO/examples/scenes.json" "$RDV/scenes.json" "$@" <<'PY'
import json, sys
source, target, *wanted = sys.argv[1:]
script = json.load(open(source))


def asked_for(scene):
    folder = scene["example"].split("/")[0]
    return any(scene["id"].startswith(w) or folder.startswith(w) for w in wanted)


if wanted:
    script["scenes"] = [s for s in script["scenes"] if asked_for(s)]
    if not script["scenes"]:
        sys.exit(f"no scene id or folder starts with any of {wanted}")
json.dump(script, open(target, "w"))
print(" ".join(s["id"] for s in script["scenes"]))
PY

# ---------------------------------------------------------------- profile ----
# A throwaway profile, written from here so the GIFs are reproducible: same theme, same zoom, same
# chrome, and none of the editor's motion — a blinking caret or a smooth scroll turns two frames of
# the same state into two different pictures.
mkdir -p "$WORK/profile/user-data/User"
cat > "$WORK/profile/user-data/User/settings.json" <<'JSON'
{
  "window.zoomLevel": 3.2,
  "window.title": "Conceal Demo",
  "window.commandCenter": false,
  "workbench.colorTheme": "Default Dark Modern",
  "workbench.activityBar.location": "hidden",
  "workbench.statusBar.visible": false,
  "workbench.startupEditor": "none",
  "workbench.tips.enabled": false,
  "workbench.layoutControl.enabled": false,
  "workbench.editor.enablePreview": false,
  "chat.commandCenter.enabled": false,
  "breadcrumbs.enabled": false,
  "editor.minimap.enabled": false,
  "editor.stickyScroll.enabled": false,
  "editor.smoothScrolling": false,
  "editor.cursorBlinking": "solid",
  "editor.cursorSmoothCaretAnimation": "off",
  "editor.cursorWidth": 3,
  "editor.renderLineHighlight": "all",
  "//wrap": "A fixed column, not \"on\" and not \"bounded\": a scene splits the window, and the workbench is drawn wider than the window shows — an editor left to wrap at its own viewport puts the last few characters of the right-hand pane past the edge of the picture. Every example is shorter than this column, so nothing wraps and nothing is cut.",
  "editor.wordWrap": "wordWrapColumn",
  "editor.wordWrapColumn": 28,
  "editor.occurrencesHighlight": "off",
  "editor.hover.enabled": false,
  "editor.suggestOnTriggerCharacters": false,
  "editor.quickSuggestions": { "other": "off", "comments": "off", "strings": "off" },
  "editor.acceptSuggestionOnEnter": "off",
  "editor.parameterHints.enabled": false,
  "editor.lightbulb.enabled": "off",
  "files.autoSave": "off",
  "git.enabled": false,
  "telemetry.telemetryLevel": "off",
  "update.mode": "none",
  "extensions.ignoreRecommendations": true
}
JSON

# ---------------------------------------------------------------- launch -----
# Window handles are the only stable way to tell this editor from the ones the user already has
# open: titles change with the active tab, and every VS Code window shares a process name.
before="$WORK/hwnds-before.txt"
"$WINSHOT" list | awk '{print $1}' | sort > "$before"

CONCEAL_DEMO_PROFILE="$WORK/profile" CONCEAL_DEMO_RECORD="$RDV" "$REPO/scripts/dev.sh" > "$LOG" 2>&1 &
EDITOR_PID=$!
cleanup() {
	# SIGKILL, not SIGTERM: a graceful quit stops to ask whether to save the tab a scene pasted
	# into. The bracket keeps the pattern from matching pkill's own command line, which would
	# otherwise make this script kill itself.
	kill -9 "$EDITOR_PID" 2>/dev/null || true
	pkill -9 -f "extensionDevelopmentPath=${REPO/\//[/]}" 2>/dev/null || true
}
trap cleanup EXIT

# Resizing a WSLg window can destroy and recreate it, which retires its handle mid-recording, so
# the handle is looked up again rather than remembered. What identifies it is the window title the
# recording profile sets, restricted to handles that did not exist before this launch — the user's
# own editors can have this repository's name in their titles.
find_window() {
	"$WINSHOT" list | awk -v seen_file="$before" '
		BEGIN { while ((getline line < seen_file) > 0) { seen[line] = 1 } }
		!seen[$1] && /Conceal Demo/ && !found { print $1; found = 1 }'
}

HWND=""
for _ in $(seq 1 120); do
	if ! kill -0 "$EDITOR_PID" 2>/dev/null; then
		tail -5 "$LOG" >&2
		die "the editor exited before its window appeared"
	fi
	HWND="$(find_window)"
	if [[ -n "$HWND" ]]; then
		break
	fi
	sleep 1
done
[[ -n "$HWND" ]] || die "no new editor window appeared in two minutes"
echo "recording window $HWND"

# WSLg windows are real Win32 windows, so they resize like any other. A scene declares its own
# height because the alternative is a GIF that is two thirds empty editor: a nine-line file and a
# forty-line file have nothing to say to each other about how tall the picture should be.
move_window() {
	powershell.exe -NoProfile -Command "
	  Add-Type -Namespace W -Name U -MemberDefinition '[DllImport(\"user32.dll\")] public static extern bool MoveWindow(IntPtr h,int x,int y,int w,int t,bool r);';
	  [void][W.U]::MoveWindow([IntPtr]$HWND, 80, 60, $1, $2, \$true)" >/dev/null
	sleep 1.2
	local found
	found="$(find_window)"
	if [[ -n "$found" ]]; then
		HWND="$found"
	fi
}

# One picture, retrying against a freshly resolved handle — see find_window.
capture_frame() {
	if "$WINSHOT" capture -Hwnd "$HWND" -Out "$1" -NoFallback >/dev/null 2>&1; then
		return 0
	fi
	HWND="$(find_window)"
	[[ -n "$HWND" ]] || die "the editor window disappeared"
	"$WINSHOT" capture -Hwnd "$HWND" -Out "$1" -NoFallback >/dev/null
}

# The window rect a WSLg window reports is bigger than what it draws into: the workbench starts at
# a fixed inset from the top left and runs to the far edge, so a naive capture has a black band
# down one side and nothing to spare on the other. Measure the inset once from a real capture, then
# ask for a window that much larger than the picture and cut the band off again at assembly time.
move_window "$WIDTH" "$HEIGHT"
capture_frame "$WORK/border.png"
read -r BORDER_X BORDER_Y < <(ffmpeg -v error -i "$WORK/border.png" -f rawvideo -pix_fmt gray - | python3 -c '
import sys
width, height = int(sys.argv[1]), int(sys.argv[2])
pixels = sys.stdin.buffer.read()
lit = lambda y, x: pixels[y * width + x] > 6
print(next(x for x in range(width) if any(lit(y, x) for y in range(height))),
      next(y for y in range(height) if any(lit(y, x) for x in range(width))))' "$WIDTH" "$HEIGHT")
echo "window border ${BORDER_X}x${BORDER_Y}"

resize_window() {
	# One inset, not two. The band is on the left and the top only; on the right and the bottom the
	# workbench is drawn right up to the window's edge. Asking for two insets' worth of window makes
	# the workbench wider than the crop, and the crop then cuts a strip of live editor off the right
	# — where, in a scene that splits the window, the pasted text is.
	move_window "$(( $1 + BORDER_X ))" "$(( $2 + BORDER_Y ))"
}

# ---------------------------------------------------------------- capture ----
# One picture per state the recorder declares finished, until it says there will be no more.
frames=0
current_scene=""
deadline=$(( SECONDS + 900 ))
while :; do
	shot=0
	for ready in "$RDV"/*.json; do
		name="$(basename "$ready" .json)"
		case "$name" in scenes | done) continue ;; esac
		if [[ -f "$RDV/$name.taken" ]]; then
			continue
		fi
		scene="${name%-[0-9][0-9][0-9]}"
		if [[ "$scene" != "$current_scene" ]]; then
			read -r w h < <(python3 -c '
import json, sys
scenes = json.load(open(sys.argv[1]))["scenes"]
window = next((s.get("window") for s in scenes if s["id"] == sys.argv[2]), None)
print(*(window or [sys.argv[3], sys.argv[4]]))' "$RDV/scenes.json" "$scene" "$WIDTH" "$HEIGHT")
			resize_window "$w" "$h"
			current_scene="$scene"
		fi
		capture_frame "$RAW/$name.png"
		touch "$RDV/$name.taken"
		frames=$(( frames + 1 ))
		shot=1
	done
	if [[ -f "$RDV/done.json" && $shot -eq 0 ]]; then
		break
	fi
	(( SECONDS < deadline )) || die "the recorder stopped answering after $frames frames"
	sleep 0.1
done

error="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("error") or "")' "$RDV/done.json")"
[[ -z "$error" ]] || die "the recorder failed: $error"
echo "captured $frames frames"

cleanup
trap - EXIT

# ---------------------------------------------------------------- assemble ---
# Each frame gets its caption burnt in, because a GIF has nowhere else to put one, and `textfile`
# keeps the caption out of ffmpeg's filter syntax — these captions are full of colons and quotes.
for ready in "$RDV"/*.json; do
	name="$(basename "$ready" .json)"
	case "$name" in scenes | done) continue ;; esac
	scene="${name%-[0-9][0-9][0-9]}"
	read -r w h < <(python3 -c '
import json, sys
scenes = json.load(open(sys.argv[1]))["scenes"]
window = next((s.get("window") for s in scenes if s["id"] == sys.argv[2]), None)
print(*(window or [sys.argv[3], sys.argv[4]]))' "$RDV/scenes.json" "$scene" "$WIDTH" "$HEIGHT")
	python3 -c 'import json,sys; sys.stdout.write(json.load(open(sys.argv[1]))["caption"])' "$ready" > "$WORK/$name.txt"
	ffmpeg -y -loglevel error -i "$RAW/$name.png" -vf "\
crop=$w:$h:$BORDER_X:$BORDER_Y,\
pad=iw:ih+$CAPTION_HEIGHT:0:0:color=0x11151b,\
drawtext=fontfile='$FONT':textfile='$WORK/$name.txt':expansion=none:fontsize=$CAPTION_SIZE:fontcolor=white:x=24:y=h-$CAPTION_HEIGHT+($CAPTION_HEIGHT-th)/2" \
		"$CAPTIONED/$name.png"
done

# The concat demuxer is what turns "hold this state for 2.4 seconds" into frames, so a scene's
# pacing lives in scenes.json next to the step it belongs to.
for scene in $(ls "$RAW" | sed 's/-[0-9]\{3\}\.png$//' | sort -u); do
	list="$WORK/$scene.concat"
	: > "$list"
	last=""
	for frame in "$CAPTIONED/$scene"-*.png; do
		name="$(basename "$frame" .png)"
		hold="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["hold"])' "$RDV/$name.json")"
		printf "file '%s'\nduration %s\n" "$frame" "$hold" >> "$list"
		last="$frame"
	done
	# The concat demuxer ignores the last entry's duration, so the final frame is named twice.
	printf "file '%s'\n" "$last" >> "$list"

	gif="$EXAMPLES/$(python3 -c '
import json, os, sys
scenes = json.load(open(sys.argv[1]))["scenes"]
example = next(s["example"] for s in scenes if s["id"] == sys.argv[2])
print(os.path.splitext(example)[0])' "$RDV/scenes.json" "$scene").gif"
	mkdir -p "$(dirname "$gif")"
	ffmpeg -y -loglevel error -f concat -safe 0 -i "$list" \
		-vf "fps=$FPS,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3" \
		-loop 0 "$gif"
	echo "$(du -h "$gif" | cut -f1)	$gif"
done
