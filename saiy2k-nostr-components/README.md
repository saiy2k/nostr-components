<<<<<<<< HEAD:saiy2k-nostr-components/README.md
# Saiy2k Nostr Components WordPress Plugin
========
# Nostr Components (by saiy2k) WordPress Plugin
>>>>>>>> 799bc64 ( - Rename WP plugin name for submission):nostr-components-by-saiy2k/README.md

This WordPress plugin provides Gutenberg blocks and shortcodes for Nostr web components, with the ability to enable only the components you need.

## Directory Structure

```text
wp-plugin/
<<<<<<<< HEAD:saiy2k-nostr-components/README.md
├── saiy2k-nostr-components.php   # Main plugin file
========
├── nostr-components-by-saiy2k.php   # Main plugin file
>>>>>>>> 799bc64 ( - Rename WP plugin name for submission):nostr-components-by-saiy2k/README.md
├── inc/                      # Core plugin classes
│   ├── Registry.php          # Component registry & metadata
│   ├── Settings.php          # Admin settings page
│   ├── Assets.php            # Script/style management
│   ├── Shortcodes.php        # Shortcode registration
│   ├── Blocks.php            # Block registration
│   └── Kses.php              # Security (custom elements)
├── blocks/                   # Gutenberg block definitions
│   ├── nostr-zap
│   ├── nostr-follow-button/
│   ├── nostr-post/
│   ├── nostr-profile/
│   └── nostr-profile-badge/
├── assets/                   # All component bundles and dependencies
│   ├── manifest.json         # Asset manifest
│   ├── nostr-post.es.js
│   ├── nostr-profile.es.js
│   ├── nostr-profile-badge.es.js
│   ├── nostr-follow-button.es.js
│   ├── nostr-service-w4c-zprD.js
│   ├── base-styles-B5J6mwtp.js
│   ├── utils-Blx44Hni.js
│   └── [other dependencies...]
```

## Features

- **Selective Loading**: Only enabled components are loaded
- **Dependency Resolution**: Automatic dependency loading
- **Gutenberg Blocks**: Modern block editor integration
- **Shortcodes**: Classic editor support
- **Security**: Custom element allowlist via KSES
- **Performance**: Conditional asset loading

## Development

Use `npm run wp-build` to build and copy component bundles to the plugin.
