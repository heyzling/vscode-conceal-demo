#!/usr/bin/env bash
# Run the integration suite inside the conceal-capable fork, run from sources.
#
# `@vscode/test-cli` can download a released build or point at an installed one; a checkout being
# run from sources is neither, so the host is launched the way that checkout launches itself and
# handed the same `--extensionTestsPath` the CLI would have used.
#
#   CONCEAL_DEMO_FORK=/path/to/vscode-fork ./scripts/test-fork.sh
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FORK="${CONCEAL_DEMO_FORK:-}"
PROFILE="${CONCEAL_DEMO_PROFILE:-$REPO/.vscode-test/fork-profile}"

if [[ -z "$FORK" || ! -x "$FORK/scripts/code.sh" ]]; then
	echo "${FORK:+No VS Code checkout at $FORK. }Set CONCEAL_DEMO_FORK to a VS Code checkout that carries the concealedText proposal." >&2
	exit 1
fi

npm --prefix "$REPO" run pretest
mkdir -p "$PROFILE"

# When this runs from inside a VS Code extension host (a terminal in the editor, an agent), the
# host's own environment is inherited — and `ELECTRON_RUN_AS_NODE=1` among it, which makes the
# launched Electron start as plain Node and fail on `import { Menu } from "electron"`. Scrub the
# whole inherited set before starting a second editor.
while read -r name; do
	unset "$name"
done < <(env | sed -n 's/^\(\(VSCODE\|ELECTRON\)_[A-Za-z0-9_]*\)=.*/\1/p')

# The checkout's own launcher runs a TypeScript prelaunch step that needs Node 22+. The build is
# already compiled here, so it is skipped rather than upgrading node for a demo.
export VSCODE_SKIP_PRELAUNCH=1

exec "$FORK/scripts/code.sh" \
	--user-data-dir="$PROFILE/user-data" \
	--extensions-dir="$PROFILE/extensions" \
	--disable-workspace-trust \
	--disable-updates \
	--skip-welcome \
	--skip-release-notes \
	--extensionDevelopmentPath="$REPO" \
	--extensionTestsPath="$REPO/out/test/suite/index" \
	--enable-proposed-api=heyzling.conceal-demo \
	"$REPO/examples"
