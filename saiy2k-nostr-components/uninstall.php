<?php
/**
 * Fired when the plugin is uninstalled.
 *
 * @package Saiy2kNostrComponents
 */

// If uninstall not called from WordPress, then exit.
if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

// Remove plugin options
delete_option('nostr_wp_enabled_components');
delete_option('nostr_wp_shared_config');

// Remove any transients
delete_transient('nostr_wp_asset_manifest');
delete_transient('nostr_wp_component_registry');

// Clear any cached data
wp_cache_flush();
