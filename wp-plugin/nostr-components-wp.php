<?php
/**
 * Plugin Name: Nostr Components for WordPress
 * Description: Gutenberg blocks + shortcodes for Nostr web components (enable only what you need).
 * Version:     0.1.0
 * Author:      Nostr Components Team
 * Requires PHP: 7.4
 * Requires at least: 6.0
 * License:     MIT
 * Text Domain: nostr-components-wp
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit('Direct access not allowed.');
}

// Define plugin constants
define('NOSTR_WP_FILE', __FILE__);
define('NOSTR_WP_VERSION', '0.1.0');
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
    // Set default enabled components (core components)
    update_option('nostr_wp_enabled_components', ['nostr-post', 'nostr-profile']);
    
    // Set default shared settings
    update_option('nostr_wp_shared_config', [
        'relays' => '',
        'theme' => 'light'
    ]);
});

// Plugin deactivation hook
register_deactivation_hook(__FILE__, function() {
    // Clean up if needed (optional)
    // Could clear caches, remove temporary data, etc.
});
