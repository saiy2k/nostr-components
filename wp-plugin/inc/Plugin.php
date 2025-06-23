<?php

namespace Nostr\GutenbergBlocks;

class Plugin {
	/**
	 * Prefix for naming.
	 *
	 * @var string
	 */
	const PREFIX = 'nostr-gutenberg-blocks'; 

	/**
	 * Gettext localization domain.
	 *
	 * @var string
	 */
	const L10N = self::PREFIX;

	/**
	 * @var string
	 */
	private static string $baseUrl;

	public static function perInit(): void {
		// block initialization
		add_action('init',  __CLASS__ . '::gutenbergBlocksInit');
	}

	public static function init(): void {
		// blocks category
		if (version_compare($GLOBALS['wp_version'], '5.7', '<')) {
			add_filter('block_categories', __CLASS__ . '::gutenbergBlocksRegisterCategory', 10, 2);
		}
		else {
			add_filter('block_categories_all', __CLASS__ . '::gutenbergBlocksRegisterCategory', 10, 2);
		}
	}

	public static function getBlocksName(): array {
		return [
			'nostr-follow-button',
			'nostr-profile-display',
			'nostr-post',
			'nostr-badge',
		];
	}

	public static function gutenbergBlocksInit(): void {
		foreach (self::getBlocksName() as $block_name) {
			register_block_type(self::getBasePath() . '/build/blocks/' . $block_name);
		}
	}

	public static function gutenbergBlocksRegisterCategory($categories, $post): array {
		return [
			[
				'slug'  => 'Nostr Components',
				'title' => __('Nostr Components', Plugin::L10N),
			],
			...$categories,
		];
	}

	public static function gutenbergBlocksExternalLibraries() {
		wp_enqueue_script(
			'gutenberg-blocks-lib',
			GUTENBERG_BLOCKS_INC_URL . 'js/plugin.js',
			[],
			GUTENBERG_BLOCKS_VERSION,
			TRUE
		);
	}

	/**
	 * Loads the plugin text domain.
	 */
	public static function loadTextDomain(): void {
		load_plugin_textdomain(static::L10N, FALSE, static::L10N . '/languages/');
	}

	/**
	 * The base URL path to this plugin's folder.
	 *
	 * Uses plugins_url() instead of plugin_dir_url() to avoid a trailing slash.
	 */
	public static function getBaseUrl(): string {
		if (!isset(static::$baseUrl)) {
			static::$baseUrl = plugins_url('', static::getBasePath() . '/plugin.php');
		}
		return static::$baseUrl;
	}

	/**
	 * The absolute filesystem base path of this plugin.
	 *
	 * @return string
	 */
	public static function getBasePath(): string {
		return dirname(__DIR__);
	}
}
