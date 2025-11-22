# WordPress Plugin Build Process

This directory contains the build scripts and process for creating the WordPress plugin.

## Build Commands

### Development
```bash
npm run wp-dev
```
Builds components and copies to WordPress plugin directory.

### Production
```bash
npm run wp-build
```
Builds components and copies to WordPress plugin directory (production ready).

### Copy Only
```bash
npm run wp-copy
```
Only copies existing build files to WordPress plugin directory.

## Build Process

1. **Build Components**: Runs `npm run build:esm` to create component bundles
2. **Copy Files**: Copies `.es.js` files from `dist/components/` to `saiy2k-nostr-components/assets/`
3. **Generate Manifest**: Creates `manifest.json` with file metadata and integrity hashes

## Output

The build process creates:

```
wp-plugin/build/
├── manifest.json              # Asset manifest with hashes
├── nostr-post.es.js          # Post component bundle
├── nostr-profile.es.js       # Profile component bundle  
├── nostr-profile-badge.es.js # Profile badge component bundle
├── nostr-follow-button.es.js # Follow button component bundle
└── assets/                   # Shared dependencies
    ├── base-styles-BBUNbLUX.js
    ├── copy-delegation-B6WaHIgt.js
    ├── icons-FHzdQYXw.js
    ├── nip05-utils-BNBHUmkr.js
    ├── nostr-service-w4c-zprD.js
    ├── nostr-user-component-iH2jRAjq.js
    ├── preload-helper-D7HrI6pR.js
    ├── pure-Dx-_USO5.js
    ├── render-name-DxPqJZ3i.js
    ├── theme-ijSavGc-.js
    └── utils-Blx44Hni.js
```

## Manifest.json

Contains metadata for each component:
- **file**: Filename
- **size**: File size in bytes
- **hash**: SHA-256 hash for integrity checking
- **url**: Relative URL path

## Installation

After building, the WordPress plugin is ready to install:

1. Copy `saiy2k-nostr-components/` to your WordPress `wp-content/plugins/` directory
2. Activate the plugin in WordPress admin
3. Configure components in Settings → Nostr Components
4. Use shortcodes in posts/pages: `[nostr_post eventid="abc123"]`
