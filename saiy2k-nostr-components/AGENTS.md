# WordPress plugin

Gutenberg blocks and shortcodes for the Nostr components.

- Change component behavior in `src/` at the repo root. Change block registration, shortcodes, and PHP in this directory.
- `saiy2k-nostr-components/assets/` is generated. `npm run wp-build` builds the library and [scripts/wp-copy.js](../scripts/wp-copy.js) copies the bundles here. Do not hand-edit those JS files.
- Release with `npm run wp-release` (build, then SVN prep). This plugin does not deploy through Firebase.
- Plugin layout: [README.md](README.md). Build steps: [scripts/README.md](../scripts/README.md).
