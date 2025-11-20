<?php
namespace NostrComponentsWP;

class Blocks {
    /**
     * Initialize block registration
     */
    public static function boot() {
        add_action('init', [__CLASS__, 'register_blocks']);
        add_filter('block_categories_all', [__CLASS__, 'add_block_category']);
    }

    /**
     * Register all enabled Nostr blocks
     */
    public static function register_blocks() {
        $enabled_components = Registry::enabled_slugs();
        
        foreach ($enabled_components as $component) {
            $meta = Registry::get($component);
            if (!$meta || !isset($meta['block'])) {
                continue;
            }

            $block_name = $meta['block'];
            $block_dir = NOSTR_WP_DIR . 'blocks/' . str_replace('nostr/', '', $block_name);
            
            if (!file_exists($block_dir . '/block.json')) {
                continue;
            }

            // Register editor script with proper dependencies
            $script_handle = 'ncwp-' . str_replace('nostr/', '', $block_name) . '-edit';
            wp_register_script(
                $script_handle,
                NOSTR_WP_URL . 'blocks/' . str_replace('nostr/', '', $block_name) . '/index.js',
                ['wp-blocks', 'wp-element', 'wp-i18n', 'wp-block-editor', 'wp-components'],
                NOSTR_WP_VERSION,
                true
            );

            // Register the block
            register_block_type($block_dir, [
                'editor_script' => $script_handle,
                'render_callback' => function($attributes, $content) use ($component) {
                    // Enqueue the component's ESM script for frontend
                    Assets::ensure_component_loaded($component);
                    
                    // Render the block
                    return self::render_block($component, $attributes);
                }
            ]);
        }
    }

    /**
     * Add Nostr category to block editor
     */
    public static function add_block_category($categories) {
        return array_merge(
            $categories,
            [
                [
                    'slug'  => 'nostr',
                    'title' => __('Nostr Components (by saiy2k)', 'nostr-components-by-saiy2k'),
                    'icon'  => 'admin-users',
                ],
            ]
        );
    }

    /**
     * Get block attributes for a component
     */
    public static function get_block_attributes(string $component): array {
        $attributes = Registry::get_component_attributes($component);
        $block_attributes = [];

        foreach ($attributes as $attr => $config) {
            $block_attributes[$attr] = [
                'type' => $config['type'],
            ];

            if (isset($config['enum'])) {
                $block_attributes[$attr]['enum'] = $config['enum'];
            }

            if (isset($config['default'])) {
                $block_attributes[$attr]['default'] = $config['default'];
            }
        }

        return $block_attributes;
    }

    /**
     * Render block with proper attributes
     */
    public static function render_block(string $component, array $attributes): string {
        $meta = Registry::get($component);
        if (!$meta) {
            return '';
        }

        // Get component defaults and merge with attributes
        $defaults = Registry::get_component_defaults($component);
        $merged_attributes = array_merge($defaults, $attributes);

        // Get shared config and merge relays if not already set
        $shared_config = get_option('nostr_wp_shared_config', []);
        if (empty($merged_attributes['relays']) && !empty($shared_config['relays'])) {
            $merged_attributes['relays'] = $shared_config['relays'];
        }

        $tag_name = $component;
        $attrs = [];

        foreach ($merged_attributes as $key => $value) {
            // Skip empty values, null, false, numeric zero, and empty strings
            if ($value === '' || $value === null || $value === false || $value === 0) {
                continue;
            }
            
            // Map 'theme' to 'data-theme' for web components
            $attr_name = ($key === 'theme') ? 'data-theme' : $key;
            
            if (is_bool($value)) {
                $attrs[] = $attr_name . '="' . ($value ? 'true' : 'false') . '"';
            } else {
                $attrs[] = $attr_name . '="' . esc_attr($value) . '"';
            }
        }

        $attr_string = implode(' ', $attrs);
        return '<' . $tag_name . ' ' . $attr_string . '></' . $tag_name . '>';
    }
}
