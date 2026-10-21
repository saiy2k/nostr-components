# WordPress plugin

Gutenberg blocks and shortcodes for the Nostr components.

- Change component behavior in `src/` at the repo root. Change block registration, shortcodes, and PHP in this directory.
- `saiy2k-nostr-components/assets/` is generated. `npm run wp-build` builds the library and [scripts/wp-copy.js](../scripts/wp-copy.js) copies the bundles here. Do not hand-edit those JS files.
- `npm run wp-release` builds and prepares a zip plus SVN instructions. It does not publish. The WordPress.org `svn commit` needs the owner's explicit approval. This plugin does not deploy through Firebase.
- Plugin layout: [README.md](README.md). Build steps: [scripts/README.md](../scripts/README.md).
