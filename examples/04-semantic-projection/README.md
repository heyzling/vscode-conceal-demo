# G4 — semantic projection

The replacement is computed per occurrence, not looked up in a table. This is the group no
implementation surveyed can serve, and this folder is where you can watch it fail.

Rules: `g4-scene-round`, `g4-scene-level`, `g4-scene-version` (scenes.md), `g4-i18n-key` (i18n.ts).

What to look for: run **Conceal Demo: Show Statistics** with these files open. `created total`
counts one decoration type per *distinct string drawn* — `⌁10`, `⌁7`, `⌁137` are three types, not
one rule. Add a line with a new version number and the count goes up again. The type count grows
with the manuscript, not with the configuration.

The wall this folder does not get past: a replacement here can only be assembled out of capture
groups. `abstractsingletonproxyfactorybean` → `aspfb` needs a *computed* string, and a regular
expression in a settings file cannot compute one.
