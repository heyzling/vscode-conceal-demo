# Changelog

## 0.1.0

First release.

- Regex conceal rules from settings: `conceal-demo.rules` for your own, `conceal-demo.exampleRules`
  for the shipped demo, `conceal-demo.include` as the blast-radius guard, `conceal-demo.disableExamples`
  to switch the demo off.
- Two-step detection of the `concealedText` proposal, and a quiet, warned shutdown when it is absent.
- 16 example rules and an `examples/` tree, one folder per group of the case survey, with a
  recording beside every file it demonstrates and `not-implemented/` for the cases the API cannot
  serve.
- `Conceal Demo: Toggle Concealment`, `Show Statistics`, `Show Log`.
