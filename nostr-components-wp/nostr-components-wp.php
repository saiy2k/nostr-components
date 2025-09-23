<?php
/**
 * Plugin Name: Nostr Components
 * Plugin URI:  https://github.com/saiy2k/nostr-components
 * Description: Gutenberg blocks and shortcodes for Nostr web components. Display Nostr posts, profiles, and follow buttons with selective component loading for optimal performance.
 * Version:     0.2.0
 * Author:      Akap Azmon, saiy2k
 * Author URI:  https://github.com/casyazmon, https://github.com/saiy2k
 * License:     MIT
 * License URI: https://opensource.org/licenses/MIT
 * Text Domain: nostr-components-wp
 * Domain Path: /languages
 * Requires at least: 6.0
 * Tested up to: 6.4
 * Requires PHP: 7.4
 * Network:     false
 * 
 * @package NostrComponentsWP
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit('Direct access not allowed.');
}

// Define plugin constants
define('NOSTR_WP_FILE', __FILE__);
define('NOSTR_WP_VERSION', '0.2.0');
define('NOSTR_WP_DIR', plugin_dir_path(__FILE__));
define('NOSTR_WP_URL', plugin_dir_url(__FILE__));

// Check WordPress version compatibility
if (version_compare(get_bloginfo('version'), '6.0', '<')) {
    add_action('admin_notices', function() {
        echo '<div class="notice notice-error"><p>';
        echo esc_html__('Nostr Components requires WordPress 6.0 or higher.', 'nostr-components-wp');
        echo '</p></div>';
    });
    return;
}

// Load plugin classes
require_once NOSTR_WP_DIR . 'inc/Registry.php';
require_once NOSTR_WP_DIR . 'inc/Settings.php';
require_once NOSTR_WP_DIR . 'inc/Assets.php';
require_once NOSTR_WP_DIR . 'inc/Shortcodes.php';
require_once NOSTR_WP_DIR . 'inc/Blocks.php';
require_once NOSTR_WP_DIR . 'inc/Kses.php';

// Initialize plugin classes
add_action('plugins_loaded', function() {
    NostrComponentsWP\Settings::boot();
    NostrComponentsWP\Assets::boot();
    NostrComponentsWP\Shortcodes::boot();
    NostrComponentsWP\Blocks::boot();
    NostrComponentsWP\Kses::boot();
});

// Plugin activation hook
register_activation_hook(__FILE__, function() {
    // Set default enabled components only if option doesn't exist
    if (get_option('nostr_wp_enabled_components') === false) {
        add_option('nostr_wp_enabled_components', ['nostr-post', 'nostr-profile', 'nostr-profile-badge', 'nostr-follow-button']);
    }
    
    // Set default shared settings only if option doesn't exist
    if (get_option('nostr_wp_shared_config') === false) {
        add_option('nostr_wp_shared_config', [
            'relays' => 'wss://relay.damus.io,wss://nostr.wine,wss://relay.nostr.net,wss://relay.nostr.band,wss://nos.lol,wss://nostr-pub.wellorder.net,wss://njump.me,wss://relay.getalby.com,wss://relay.primal.net,wss://purplepag.es',
            'theme' => 'light'
        ]);
    }
});

// Plugin deactivation hook
register_deactivation_hook(__FILE__, function() {
    // No cleanup needed
});
