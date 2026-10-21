# Project skills

Cursor loads these from the repo, so they are available in Cloud Agents, where `~/.agents/skills/` is not.

| Skill | Source |
|-------|--------|
| [`tdd/`](tdd/SKILL.md) | [mattpocock/skills](https://github.com/mattpocock/skills) `skills/engineering/tdd` |
| [`domain-modeling/`](domain-modeling/SKILL.md) | [mattpocock/skills](https://github.com/mattpocock/skills) `skills/engineering/domain-modeling` |

Vendored verbatim from upstream commit `6654f6b60cd9d5be8b54c6fafe44346dabeb3b76` (MIT, [`LICENSE-mattpocock-skills`](LICENSE-mattpocock-skills)). Project-specific overrides live in [`.cursor/rules/`](../../.cursor/rules/); where they and a skill disagree, the rule wins. Behavior specs live at `<component folder>/spec/spec.md` in the changed component's own folder, for example `src/<component>/`, `backend/<job>/`, or `functions/<area>/`. There is no `docs/spec/` directory.

`tdd/SKILL.md` refers to `codebase-design` and `code-review`; neither is vendored, so those names do not resolve here. [`tdd.mdc`](../../.cursor/rules/tdd.mdc) covers the loop and the refactor stage instead.
