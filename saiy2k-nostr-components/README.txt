=== Saiy2k Nostr Components ===
Contributors: saiy2k
Tags: nostr, social, blocks, gutenberg, shortcodes, zap, like
Requires at least: 6.0
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 0.6.1
License: MIT
License URI: https://opensource.org/licenses/MIT

Gutenberg blocks and shortcodes for Nostr web components. Display Nostr zap buttons, follow buttons, posts, profiles.

== Description ==

https://www.youtube.com/watch?v=jCaPlEWjeaI

Nostr Components brings the power of Nostr (Notes and Other Stuff Transmitted by Relays) to your WordPress site through modern web components. This plugin provides Gutenberg blocks and shortcodes that allow you to seamlessly integrate Nostr content into your posts and pages.

= Key Features =

* **Gutenberg Blocks**: Modern block editor integration for Nostr Zap button, Post, Profile, Profile Badge, Follow Button, Like Button, and Livestream
* **Shortcodes**: Classic editor support with simple shortcode syntax
* **Selective Loading**: Enable only the components you need for optimal performance
* **Customizable**: Configure relays, themes, and component settings
* **Security**: Built-in security with custom element allowlist via KSES
* **Performance**: Conditional asset loading based on enabled components

= Available Components =

* **Nostr Zap button**: Allows your readers to zap to your posts and pages
* **Nostr Follow Button**: Interactive follow/unfollow buttons for Nostr users
* **Nostr Post**: Display Nostr notes/posts with full content and metadata
* **Nostr Profile**: Show complete Nostr user profiles with bio, stats, and social links
* **Nostr Profile Badge**: Compact profile display perfect for sidebars and footers
* **Nostr Like Button**: Like URLs using Nostr reactions (NIP-25)
* **Nostr Livestream**: Display Nostr livestreams (NIP-53) with video playback and participant information

= How It Works =

1. Install and activate the plugin
2. Go to Settings → Saiy2k Nostr Components to configure
3. Enable only the components you need
4. Add blocks in the Gutenberg editor or use shortcodes
5. Configure relays and theme settings as needed

= Example Usage =

**Gutenberg Blocks:**
Simply add the Nostr blocks from the block inserter and configure them in the block settings.

**Shortcodes:**
`[nostr_zap_button pubkey="npub1abc..." url=""]`
`[nostr_post eventid="note1abc..."]`
`[nostr_profile pubkey="npub1abc..."]`
`[nostr_profile_badge pubkey="npub1abc..."]`
`[nostr_follow_button pubkey="npub1abc..."]`
`[nostr_like_button]`
`[nostr_livestream naddr="naddr1abc..."]`

= Adding Like and Zap Buttons to All Posts/Pages =

To automatically add Like and Zap buttons to the end of every post and page:

1. Go to **Appearance → Theme Editor** (or use a child theme for safer customization)
2. Select your active theme (or child theme)
3. Open `functions.php`
4. Add the following code at the end of the file:

        // Add shortcode to the end of every post and page
        function add_shortcode_to_content($content) {
            // Only add in single posts and pages (not homepage or archives)
            if (is_singular(['post', 'page']) && in_the_loop() && is_main_query()) {
                $shortcode_1 = do_shortcode('[nostr_like_button]');
                $current_url = esc_url(get_permalink());
                $shortcode_2 = do_shortcode('[nostr_zap_button npub="[YOUR-NPUB-GOES-HERE]" url="' . $current_url . '"]');

                $content .= '<div class="nostr-shortcode-wrapper">' . $shortcode_1 . '<br/><br/>' . $shortcode_2 . '</div>';
            }
            return $content;
        }
        add_filter('the_content', 'add_shortcode_to_content');

**Important Notes:**
* Replace `[YOUR-NPUB-GOES-HERE]` with your actual Nostr public key (npub format)
* Always use a child theme when modifying theme files to preserve changes during theme updates
* The buttons will only appear on single post and page views, not on archive pages or the homepage

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

1. Follow and Profile components
2. Nostr post component
3. Like and Zap buttons
4. Zappers list
5. Gutenberg blocks
6. Settings page

== Development ==

This plugin is developed as part of the Nostr Components project. For development, bug reports, and feature requests, please visit the [GitHub repository](https://github.com/saiy2k/nostr-components).

== Support ==

For support, please visit the [GitHub repository](https://github.com/saiy2k/nostr-components) or create an issue.

== Privacy Policy ==

This plugin does not collect, store, or transmit any personal data. All Nostr data is fetched directly from public relays and displayed locally on your site. If components fetch data client‑side, visitors' browsers may directly connect to configured relays (exposing their IP and user agent to those relays). Configure trusted relays accordingly.
