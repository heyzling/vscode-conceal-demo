#!/usr/bin/env bash
# Record the README's GIFs by driving a real editor and photographing it.
#
# The extension's recorder (src/recorder.ts) plays examples/scenes.jsonc inside the running editor and
# stops at every frame; this script is what takes the picture. The two meet in a rendezvous
# directory: the recorder writes `<frame>.json` when a state is ready, this script captures the
# window and writes `<frame>.taken`, and the recorder moves on. Nothing is on a timer, so no frame
# can catch a half-applied decoration.
#
#   ./scripts/record.sh                      # every scene in examples/scenes.jsonc
#   ./scripts/record.sh 01                   # every scene of case 01 — examples/01-*
#   ./scripts/record.sh 0101 0102            # only those two scenes
#   ./scripts/record.sh 01-tags              # a folder, spelled out
#   ./scripts/record.sh --manual 05          # the scenes filmed by hand instead, here those of case 05
#   CONCEAL_DEMO_SCENES=/tmp/probe.json ./scripts/record.sh 99   # another scene file, for probes
#   CONCEAL_DEMO_NO_COMPARE=1 ./scripts/record.sh 01           # without the extensions compared against
#
# A step marked `manual` in scenes.jsonc is a clip filmed by hand: the recorder sets the scene up,
# this script films the workbench rectangle — pointer included — with the Windows ffmpeg until
# Enter is pressed here or the step's `timeout` (seconds) runs out, and the clip gets its caption
# like any frame. For a mouse scene, since nothing here can move the mouse. Such scenes are left out
# unless --manual is given, which records them and nothing else. CONCEAL_DEMO_CLIP_SECONDS is the
# timeout for every step, for an unattended check of the pipeline.
#
# The window is raised to the foreground for every frame, so a run owns the desktop's focus while
# it lasts — an editor command only reaches an editor whose window has focus.
#
# Requirements — see "Recording the demos" in the README:
#   * the conceal-capable fork, as for scripts/dev.sh (CONCEAL_DEMO_FORK)
#   * ffmpeg, for assembling the frames
#   * a Win32 screenshot helper taking -Hwnd/-Out, because WSLg has no Linux screenshot tool
#     and the editor window is a Win32 window like any other (CONCEAL_DEMO_WINSHOT)
#   * for clips filmed by hand only: ffmpeg.exe on the Windows side, which is what can film the
#     desktop with the pointer in it (CONCEAL_DEMO_FFMPEG_WIN, default ffmpeg.exe from PATH)
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
WIN_FFMPEG="${CONCEAL_DEMO_FFMPEG_WIN:-ffmpeg.exe}"
CLIP_SECONDS="${CONCEAL_DEMO_CLIP_SECONDS:-}"

die() { echo "$*" >&2; exit 1; }

command -v ffmpeg >/dev/null || die "ffmpeg is not installed — dnf install ffmpeg / apt install ffmpeg"
[[ -n "$WINSHOT" && -x "$WINSHOT" ]] || die "set CONCEAL_DEMO_WINSHOT to a screenshot helper that takes -Hwnd/-Out (WSL only; see README)"
[[ -f "$FONT" ]] || die "no font at $FONT — set CONCEAL_DEMO_FONT to a .ttf"

rm -rf "$WORK"
mkdir -p "$RDV" "$RAW" "$CAPTIONED"

MANUAL=0
args=()
for arg in "$@"; do
	case "$arg" in
		--manual) MANUAL=1 ;;
		*) args+=("$arg") ;;
	esac
done

# Pick the scenes asked for, and hand the recorder only those.
#
# An argument is a prefix, not a substring, because the numbering is a hierarchy: the first two
# digits are the case and the last two the scene within it, so `07` has to mean "case 07" and not
# "every id with 07 in it" — which would drag in 0107. A folder name works too, for the cases worth
# spelling.
# CONCEAL_DEMO_SCENES names another scene file, for probes that are not meant for the README.
python3 - "${CONCEAL_DEMO_SCENES:-$REPO/examples/scenes.jsonc}" "$RDV/scenes.jsonc" "$MANUAL" "${args[@]}" <<'PY'
import json, re, sys
source, target, manual, *wanted = sys.argv[1:]
manual = manual == "1"


def plain(text):
    # scenes.jsonc is JSONC: comments and trailing commas go, string contents stay.
    outside = lambda m: m[0] if m[0].startswith('"') else ""
    text = re.sub(r'"(?:\\.|[^"\\])*"|//[^\n]*|/\*.*?\*/', outside, text, flags=re.S)
    return re.sub(r'"(?:\\.|[^"\\])*"|,(?=\s*[}\]])', outside, text, flags=re.S)


script = json.loads(plain(open(source).read()))


def asked_for(scene):
    folder = scene["example"].split("/")[0]
    return any(scene["id"].startswith(w) or folder.startswith(w) for w in wanted)


def by_hand(scene):
    return any(step.get("manual") for step in scene["steps"])


chosen = [s for s in script["scenes"] if not wanted or asked_for(s)]
if not chosen:
    sys.exit(f"no scene id or folder starts with any of {wanted}")
script["scenes"] = [s for s in chosen if by_hand(s) == manual]
if not script["scenes"]:
    sys.exit("none of these scenes is filmed by hand" if manual else "these scenes are all filmed by hand — pass --manual")
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
  "workbench.editor.empty.hint": "hidden",
  "chat.commandCenter.enabled": false,
  "breadcrumbs.enabled": false,
  "editor.minimap.enabled": false,
  "editor.folding": false,
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
  "editor.matchBrackets": "never",
  "//autoclose": "Markdown auto-closes < with >, so a typed comment row completes one character early, hides, and the rest of the keystrokes land on the next visible line.",
  "editor.autoClosingBrackets": "never",
  "editor.autoSurround": "never",
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
	# into. Matched by the recording profile, so a dev instance of the same extension survives.
	kill -9 "$EDITOR_PID" 2>/dev/null || true
	pkill -9 -f "user-data-dir=$WORK/profile" 2>/dev/null || true
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
#
# Resized where it is, never moved: the Linux side keeps the origin it opened with, and after a
# move every click lands as far from the pointer as the window went.
move_window() {
	powershell.exe -NoProfile -Command "
	  Add-Type -Namespace W -Name U -MemberDefinition '[DllImport(\"user32.dll\")] public static extern bool SetWindowPos(IntPtr h,IntPtr a,int x,int y,int w,int t,uint f);';
	  [void][W.U]::SetWindowPos([IntPtr]$HWND, [IntPtr]::Zero, 0, 0, $1, $2, 0x16)" >/dev/null
	sleep 1.2
	local found
	found="$(find_window)"
	if [[ -n "$found" ]]; then
		HWND="$found"
	fi
}

# Give the recorded window the foreground, and make the call stick.
#
# The picture does not need focus; the *next step* does. An editor command is dispatched to the
# focused editor, and a window that does not hold the OS focus has none — the command is accepted
# and does nothing, which photographs as a keypress the editor ignored under a caption saying it
# landed. `src/recorder.ts` refuses to record such a frame, so without this the run stops.
#
# Windows refuses `SetForegroundWindow` to a process that is not already in the foreground, which
# is always the case here. Attaching this thread's input queue to the current foreground window's
# thread is what lets the call through — the documented way to hand focus to a window you own
# while somebody else's has it. The cost is that a recording session owns the desktop's focus
# while it runs.
cat > "$WORK/focus.ps1" <<'PS1'
param([Parameter(Mandatory=$true)][long]$Hwnd)
Add-Type -Namespace Rec -Name Fg -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, IntPtr pid);
[DllImport("user32.dll")] public static extern bool AttachThreadInput(uint from, uint to, bool attach);
[DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
'@
$target = [IntPtr]$Hwnd
$foreground = [Rec.Fg]::GetForegroundWindow()
if ($foreground -eq $target) { exit 0 }
$mine = [Rec.Fg]::GetWindowThreadProcessId($foreground, [IntPtr]::Zero)
$theirs = [Rec.Fg]::GetWindowThreadProcessId($target, [IntPtr]::Zero)
[void][Rec.Fg]::AttachThreadInput($mine, $theirs, $true)
[void][Rec.Fg]::BringWindowToTop($target)
[void][Rec.Fg]::SetForegroundWindow($target)
[void][Rec.Fg]::AttachThreadInput($mine, $theirs, $false)
PS1

focus_window() {
	powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$(wslpath -w "$WORK/focus.ps1")" -Hwnd "$HWND" >/dev/null 2>&1 || true
}

# The window's top-left corner on the desktop, "x y".
window_origin() {
	powershell.exe -NoProfile -Command "
	  Add-Type -Namespace W -Name R -MemberDefinition '[StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; } [DllImport(\"user32.dll\")] public static extern bool GetWindowRect(IntPtr h, out RECT r);';
	  \$r = New-Object W.R+RECT; [void][W.R]::GetWindowRect([IntPtr]$HWND, [ref]\$r); \"\$(\$r.L) \$(\$r.T)\"" | tr -d '\r'
}

# One picture, retrying against a freshly resolved handle — see find_window.
capture_frame() {
	focus_window
	if "$WINSHOT" capture -Hwnd "$HWND" -Out "$1" -NoFallback >/dev/null 2>&1; then
		return 0
	fi
	HWND="$(find_window)"
	[[ -n "$HWND" ]] || die "the editor window disappeared"
	focus_window
	"$WINSHOT" capture -Hwnd "$HWND" -Out "$1" -NoFallback >/dev/null
}

# A clip filmed by hand: the desktop rectangle the workbench is drawn in, pointer included, until
# Enter is pressed here or the seconds given run out. The Windows ffmpeg does the filming because
# only a Windows process sees the desktop; it reads its "q" from a pipe held open from this side.
record_clip() {
	local out="$1" w="$2" h="$3" seconds="${4:-$CLIP_SECONDS}" fifo="$WORK/clip.stdin" ffmpeg_pid x y
	command -v "$WIN_FFMPEG" >/dev/null || die "no $WIN_FFMPEG to film a clip with — set CONCEAL_DEMO_FFMPEG_WIN"
	read -r x y < <(window_origin)
	x=$(( x + BORDER_X ))
	y=$(( y + BORDER_Y ))
	rm -f "$fifo"
	mkfifo "$fifo"
	exec 3<>"$fifo"
	"$WIN_FFMPEG" -hide_banner -loglevel error -y -f gdigrab -framerate "$FPS" -draw_mouse 1 \
		-offset_x "$x" -offset_y "$y" -video_size "${w}x${h}" -i desktop \
		-c:v ffv1 "$(wslpath -w "$out")" <"$fifo" &
	ffmpeg_pid=$!
	focus_window
	if ( : </dev/tty ) 2>/dev/null; then
		echo "filming $(basename "$out" .mkv) at $x,$y,$w,$h: act in the editor window, then press Enter here${seconds:+ or wait ${seconds}s} to stop" >&2
		read -r ${seconds:+-t "$seconds"} </dev/tty || true
	else
		[[ -n "$seconds" ]] || die "no terminal to press Enter in — give the step a timeout"
		sleep "$seconds"
	fi
	echo q >&3
	wait "$ffmpeg_pid" || die "the clip was not written"
	exec 3>&-
	rm -f "$fifo"
	[[ -s "$out" ]] || die "the clip is empty"
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
print(*(window or [sys.argv[3], sys.argv[4]]))' "$RDV/scenes.jsonc" "$scene" "$WIDTH" "$HEIGHT")
			resize_window "$w" "$h"
			current_scene="$scene"
		fi
		if [[ "$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("manual") or "")' "$ready")" == "True" ]]; then
			record_clip "$RAW/$name.mkv" "$w" "$h" "$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("timeout") or "")' "$ready")"
		else
			capture_frame "$RAW/$name.png"
		fi
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
	[[ -f "$RAW/$name.png" ]] || continue
	scene="${name%-[0-9][0-9][0-9]}"
	read -r w h < <(python3 -c '
import json, sys
scenes = json.load(open(sys.argv[1]))["scenes"]
window = next((s.get("window") for s in scenes if s["id"] == sys.argv[2]), None)
print(*(window or [sys.argv[3], sys.argv[4]]))' "$RDV/scenes.jsonc" "$scene" "$WIDTH" "$HEIGHT")
	python3 -c 'import json,sys; sys.stdout.write(json.load(open(sys.argv[1]))["caption"])' "$ready" > "$WORK/$name.txt"
	ffmpeg -y -loglevel error -i "$RAW/$name.png" -vf "\
crop=$w:$h:$BORDER_X:$BORDER_Y,\
pad=iw:ih+$CAPTION_HEIGHT:0:0:color=0x11151b,\
drawtext=fontfile='$FONT':textfile='$WORK/$name.txt':expansion=none:fontsize=$CAPTION_SIZE:fontcolor=white:x=24:y=h-$CAPTION_HEIGHT+($CAPTION_HEIGHT-th)/2" \
		"$CAPTIONED/$name.png"
done

# The concat demuxer is what turns "hold this state for 2.4 seconds" into frames, so a scene's
# pacing lives in scenes.jsonc next to the step it belongs to. The palette is built from every
# frame: built from the differences alone, a glyph that is not in the first frame comes out grey.
PALETTE="split[a][b];[a]palettegen[p];[b][p]paletteuse=dither=bayer:bayer_scale=3"
for scene in $(ls "$RAW" | sed 's/-[0-9]\{3\}\.\(png\|mkv\)$//' | sort -u); do
	# The GIF goes in the folder of the file the scene is about, named after the scene — a case has
	# one source file and several recordings of it, so the picture cannot take the file's own name.
	gif="$EXAMPLES/$(python3 -c '
import json, os, sys
scenes = json.load(open(sys.argv[1]))["scenes"]
example = next(s["example"] for s in scenes if s["id"] == sys.argv[2])
print(os.path.join(os.path.dirname(example), sys.argv[2]))' "$RDV/scenes.jsonc" "$scene").gif"
	mkdir -p "$(dirname "$gif")"

	# A clip filmed by hand is the whole scene: its own pace, one caption throughout.
	clips=("$RAW/$scene"-*.mkv)
	if (( ${#clips[@]} > 0 )); then
		stills=("$RAW/$scene"-*.png)
		(( ${#clips[@]} == 1 && ${#stills[@]} == 0 )) || die "$scene: a scene filmed by hand has that one step only"
		name="$(basename "${clips[0]}" .mkv)"
		python3 -c 'import json,sys; sys.stdout.write(json.load(open(sys.argv[1]))["caption"])' "$RDV/$name.json" > "$WORK/$name.txt"
		ffmpeg -y -loglevel error -i "${clips[0]}" -vf "\
fps=$FPS,\
pad=iw:ih+$CAPTION_HEIGHT:0:0:color=0x11151b,\
drawtext=fontfile='$FONT':textfile='$WORK/$name.txt':expansion=none:fontsize=$CAPTION_SIZE:fontcolor=white:x=24:y=h-$CAPTION_HEIGHT+($CAPTION_HEIGHT-th)/2,\
$PALETTE" -loop 0 "$gif"
		echo "$(du -h "$gif" | cut -f1)	$gif"
		continue
	fi

	list="$WORK/$scene.concat"
	: > "$list"
	last=""
	for frame in "$CAPTIONED/$scene"-*.png; do
		name="$(basename "$frame" .png)"
		hold="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["hold"])' "$RDV/$name.json")"
		printf "file '%s'\nduration %s\n" "$frame" "$hold" >> "$list"
		last="$frame"
	done
	# The concat demuxer shows the last entry for the previous entry's duration, whatever its own
	# says, so the final frame is named twice and the output is cut at the holds' sum.
	printf "file '%s'\n" "$last" >> "$list"
	total="$(awk '/^duration/ { sum += $2 } END { print sum }' "$list")"
	ffmpeg -y -loglevel error -f concat -safe 0 -i "$list" -vf "fps=$FPS,$PALETTE" -t "$total" -loop 0 "$gif"
	echo "$(du -h "$gif" | cut -f1)	$gif"
done
