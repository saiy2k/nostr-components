=== Nostr Components ===
Contributors: akapazmon, saiy2k
Tags: nostr, social, blocks, gutenberg, shortcodes, web components
Requires at least: 6.0
Tested up to: 6.4
Requires PHP: 7.4
Stable tag: 0.2.0
License: MIT
License URI: https://opensource.org/licenses/MIT

Gutenberg blocks and shortcodes for Nostr web components. Display Nostr posts, profiles, and follow buttons with selective component loading for optimal performance.

== Description ==

Nostr Components brings the power of Nostr (Notes and Other Stuff Transmitted by Relays) to your WordPress site through modern web components. This plugin provides Gutenberg blocks and shortcodes that allow you to seamlessly integrate Nostr content into your posts and pages.

= Key Features =

* **Gutenberg Blocks**: Modern block editor integration for Nostr Post, Profile, Profile Badge, and Follow Button
* **Shortcodes**: Classic editor support with simple shortcode syntax
* **Selective Loading**: Enable only the components you need for optimal performance
* **Customizable**: Configure relays, themes, and component settings
* **Security**: Built-in security with custom element allowlist via KSES
* **Performance**: Conditional asset loading based on enabled components

= Available Components =

* **Nostr Post**: Display Nostr notes/posts with full content and metadata
* **Nostr Profile**: Show complete Nostr user profiles with bio, stats, and social links
* **Nostr Profile Badge**: Compact profile display perfect for sidebars and footers
* **Nostr Follow Button**: Interactive follow/unfollow buttons for Nostr users

= How It Works =

1. Install and activate the plugin
2. Go to Settings → Nostr Components to configure
3. Enable only the components you need
4. Add blocks in the Gutenberg editor or use shortcodes
5. Configure relays and theme settings as needed

= Example Usage =

**Gutenberg Blocks:**
Simply add the Nostr blocks from the block inserter and configure them in the block settings.

**Shortcodes:**
`[nostr_post eventid="note1abc..."]`
`[nostr_profile pubkey="npub1abc..."]`
`[nostr_profile_badge pubkey="npub1abc..."]`
`[nostr_follow_button pubkey="npub1abc..."]`

== Installation ==

1. Upload the plugin files to the `/wp-content/plugins/nostr-components-wp/` directory, or install the plugin through the WordPress plugins screen directly.
2. Activate the plugin through the 'Plugins' screen in WordPress
3. Go to Settings → Nostr Components to configure the plugin
4. Enable the components you want to use
5. Start adding Nostr blocks or shortcodes to your content

== Frequently Asked Questions ==

= What is Nostr? =

Nostr is a simple, open protocol that enables global, decentralized, and censorship-resistant social media. It's based on cryptographic keypairs and relays.

= Do I need a Nostr account to use this plugin? =

No, you don't need a Nostr account to display Nostr content. However, for interactive features like follow buttons, users will need their own Nostr accounts.

= Can I customize the appearance? =

Yes! The plugin supports light and dark themes, and you can customize the relay settings. The components are built with modern CSS and are responsive.

= Is this plugin secure? =

Yes, the plugin includes security measures including custom element allowlist via KSES and proper sanitization of all inputs.

= Can I use this with any WordPress theme? =

Yes, the components are designed to work with any WordPress theme. They use modern CSS and are responsive.

== Screenshots ==

1. Nostr Post block in the Gutenberg editor
2. Nostr Profile block showing user information
3. Nostr Profile Badge in a sidebar
4. Nostr Follow Button with interactive states
5. Plugin settings page for configuration
6. Shortcode examples in the classic editor

== Changelog ==

= 0.2.0 =
* Initial release
* Gutenberg blocks for Nostr Post, Profile, Profile Badge, and Follow Button
* Shortcode support for all components
* Selective component loading
* Admin settings page
* Security features with KSES integration
* Performance optimizations

== Upgrade Notice ==

= 0.2.0 =
Initial release of Nostr Components.

== Development ==

This plugin is developed as part of the Nostr Components project. For development, bug reports, and feature requests, please visit the [GitHub repository](https://github.com/saiy2k/nostr-components).

== Support ==

For support, please visit the [GitHub repository](https://github.com/saiy2k/nostr-components) or create an issue.

== Privacy Policy ==

This plugin does not collect, store, or transmit any personal data. All Nostr data is fetched directly from public relays and displayed locally on your site. If components fetch data client‑side, visitors' browsers may directly connect to configured relays (exposing their IP and user agent to those relays). Configure trusted relays accordingly.
