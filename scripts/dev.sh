#!/usr/bin/env bash
# Launch the conceal-capable VS Code fork with this extension loaded from source.
#
# The conceal API is a proposal, so it is granted either by product.json (an installed build) or by
# running the host from sources / passing --enable-proposed-api. Running the fork's scripts/code.sh
# does both: a source build enables every proposal an extension declares.
#
# The extensions the demo is recorded against are installed into the same throwaway profile, from
# scripts/compare-extensions.txt. Set CONCEAL_DEMO_NO_COMPARE=1 to skip that.
#
#   CONCEAL_DEMO_FORK=/path/to/vscode-fork ./scripts/dev.sh [extra code args...]
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FORK="${CONCEAL_DEMO_FORK:-}"

if [[ -z "$FORK" || ! -x "$FORK/scripts/code.sh" ]]; then
	echo "${FORK:+No VS Code checkout at $FORK. }Set CONCEAL_DEMO_FORK to a VS Code checkout that carries the concealedText proposal." >&2
	exit 1
fi

npm --prefix "$REPO" run compile

# The extensions each case is compared against. Pinned by version and cached, so a re-run is offline
# and two recordings months apart are made against the same build.
install_compare_extensions() {
	local manifest="$REPO/scripts/compare-extensions.txt" cache="$REPO/.vscode-test/vsix"
	local entry id version publisher name vsix
	[[ -f "$manifest" ]] || return 0
	mkdir -p "$cache"
	while read -r entry; do
		[[ "$entry" =~ ^[[:space:]]*(#|$) ]] && continue
		id="${entry%@*}"
		version="${entry##*@}"
		publisher="${id%%.*}"
		name="${id#*.}"
		vsix="$cache/$id-$version.vsix"
		# The extension directory is named publisher.name-version, lowercased, so an installed one
		# is skippable — the manifest keeps the Marketplace's own capitalisation, which the URL needs.
		[[ -d "$PROFILE/extensions/$(echo "$id-$version" | tr "[:upper:]" "[:lower:]")" ]] && continue
		if [[ ! -s "$vsix" ]]; then
			echo "fetching $id@$version"
			# --compressed matters: without it the response is a gzip blob, not a .vsix.
			curl -fsSL --compressed -o "$vsix" \
				"https://marketplace.visualstudio.com/_apis/public/gallery/publishers/$publisher/vsextensions/$name/$version/vspackage" \
				|| { echo "could not fetch $id@$version — recording comparisons will not work" >&2; rm -f "$vsix"; continue; }
		fi
		echo "installing $id@$version"
		# code-cli.sh, not code.sh: the GUI launcher takes --install-extension and opens a window
		# instead, leaving nothing installed.
		"$FORK/scripts/code-cli.sh" --user-data-dir="$PROFILE/user-data" --extensions-dir="$PROFILE/extensions" \
			--install-extension "$vsix" >/dev/null || echo "could not install $id@$version" >&2
	done < "$manifest"
}

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

PROFILE="${CONCEAL_DEMO_PROFILE:-$REPO/.vscode-test/dev-profile}"
mkdir -p "$PROFILE"

if [[ -z "${CONCEAL_DEMO_NO_COMPARE:-}" ]]; then
	install_compare_extensions
fi

# A profile of its own, so a demo never disturbs the editor you actually work in. Trust is waived
# because the manifest refuses to run in an untrusted workspace and the workspace is this repo's
# own examples folder.
exec "$FORK/scripts/code.sh" \
	--user-data-dir="$PROFILE/user-data" \
	--extensions-dir="$PROFILE/extensions" \
	--disable-workspace-trust \
	--skip-welcome \
	--skip-release-notes \
	--extensionDevelopmentPath="$REPO" \
	--enable-proposed-api=heyzling.conceal-demo \
	"$@" \
	"$REPO/examples"
