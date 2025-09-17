<?php
/**
 * Plugin Name:       Nostr Components
 * Description:       Embed Nostr components like profiles, posts, follow buttons, and badges using WordPress blocks or shortcodes.
 * Version:           0.1.0
 * Requires at least: 6.7
 * Requires PHP:      7.4
 * Author:            Akap Azmon
 * Author URI:		  "https://github.com/akapazmon"	
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       Nostr
 *
 * @package CreateBlock
 */

 
require_once plugin_dir_path( __FILE__ ) . 'includes/nostr-components-shortcodes.php';
new Nostr_Components_Embed();

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}
function itsnostr_register_block_category( $categories ) {
    return array_merge(
        $categories,
        [
            [
                'slug'  => 'nostr',
                'title' => __( 'Nostr Components', 'nostr' ),
            ],
        ]
    );
}
add_filter( 'block_categories_all', 'itsnostr_register_block_category' );


function create_block_itsnostr_block_init() {
	
	if ( function_exists( 'wp_register_block_types_from_metadata_collection' ) ) {
		wp_register_block_types_from_metadata_collection( __DIR__ . '/build', __DIR__ . '/build/blocks-manifest.php' );
		return;
	}

	
	if ( function_exists( 'wp_register_block_metadata_collection' ) ) {
		wp_register_block_metadata_collection( __DIR__ . '/build', __DIR__ . '/build/blocks-manifest.php' );
	}
	
	$manifest_data = require __DIR__ . '/build/blocks-manifest.php';
	foreach ( array_keys( $manifest_data ) as $block_type ) {
		register_block_type( __DIR__ . "/build/{$block_type}" );
	}
}
add_action( 'init', 'create_block_itsnostr_block_init' );
