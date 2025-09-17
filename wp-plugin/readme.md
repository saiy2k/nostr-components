=== Nostr Components ===
Contributors:      Akap Azmon
Tags:              block
Tested up to:      6.7
Stable tag:        0.1.0
License:           GPL-2.0-or-later
License URI:       https://www.gnu.org/licenses/gpl-2.0.html

Embed Nostr components like profiles, posts, follow buttons, and badges using WordPress blocks or shortcodes.

== Description ==

Nostr Components is a flexible plugin that lets you embed [Nostr Components](https://nostr-components.web.app/) directly into your WordPress site using either Gutenberg blocks or shortcodes. Whether you're building with the block editor or classic editor, you can showcase Nostr profiles, posts, follow buttons, and badges with ease.

**Features:**
- Multiple custom Gutenberg blocks
- Shortcodes with toggleable settings
- Dynamic script loading for Nostr web components
- Admin settings page to enable/disable shortcodes
- Clean, modular architecture

== Installation ==

1. Upload the plugin folder to `/wp-content/plugins/`
2. Activate the plugin through the WordPress admin
3. Use the blocks in the editor or insert shortcodes in posts/pages
4. Configure shortcode settings under **Settings → Nostr Components**

== Usage ==

### 🧱 Blocks
- **Nostr Profile Badge**
- **Nostr Follow Button**
- **Nostr Post Embed**

Each block includes an inspector panel to input the required `npub` or `note` ID.

### 🔤 Shortcodes

Enable shortcodes via the settings page, then use:

```plaintext
[nostr_profile pubkey="npub..."]
[nostr_post note="note_id"]
[nostr_follow_button pubkey="npub..."]
[nostr_profile_badge pubkey="npub..."]


== Frequently Asked Questions ==

= Why isn’t my block preview showing in the editor? = Make sure you’ve entered a valid npub or note ID. The plugin dynamically injects external scripts into the block editor iframe.

= Can I use both blocks and shortcodes? = Yes! The plugin supports both simultaneously.

= What happens if a shortcode is used but not enabled? = Admins will see a warning message; regular users will see nothing.

== Screenshots ==

1. This screen shot description corresponds to screenshot-1.(png|jpg|jpeg|gif). Note that the screenshot is taken from
the /assets directory or the directory that contains the stable readme.txt (tags or trunk). Screenshots in the /assets
directory take precedence. For example, `/assets/screenshot-1.png` would win over `/tags/4.3/screenshot-1.png`
(or jpg, jpeg, gif).
2. This is the second screen shot

== Changelog ==

= 0.1.0 =
* Release

