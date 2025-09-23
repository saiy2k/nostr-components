# Nostr Components WordPress Plugin

This WordPress plugin provides Gutenberg blocks and shortcodes for Nostr web components, with the ability to enable only the components you need.

## Directory Structure

```text
wp-plugin/
├── nostr-components-wp.php    # Main plugin file
├── inc/                       # Core plugin classes
│   ├── Registry.php          # Component registry & metadata
│   ├── Settings.php          # Admin settings page
│   ├── Assets.php            # Script/style management
│   ├── Shortcodes.php        # Shortcode registration
│   ├── Blocks.php            # Block registration
│   └── Kses.php              # Security (custom elements)
├── blocks/                   # Gutenberg block definitions
│   ├── nostr-post/
│   ├── nostr-profile/
│   ├── nostr-profile-badge/
│   └── nostr-follow-button/
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

## Installation

1. Copy the `wp-plugin` directory to your WordPress plugins folder
2. Activate the plugin in WordPress admin
3. Go to Settings → Nostr Components to configure

## Development

Use `npm run wp-build` to build and copy component bundles to the plugin.
