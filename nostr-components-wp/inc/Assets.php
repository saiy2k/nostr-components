<?php
namespace NostrComponentsWP;

class Assets {
    public static function boot() {
        add_action('init', [__CLASS__, 'register_component_scripts']);
        add_filter('script_loader_tag', [__CLASS__, 'as_module'], 10, 3);
    }

    /**
     * Register (don't enqueue yet) each component's ESM script
     */
    public static function register_component_scripts() {
        foreach (Registry::all() as $slug => $meta) {
            $handle = "nostr-wc-$slug-esm";
            $file_path = NOSTR_WP_DIR . $meta['esm'];
            
            // Only register if the file exists
            if (file_exists($file_path)) {
                wp_register_script(
                    $handle,
                    plugins_url($meta['esm'], NOSTR_WP_FILE),
                    [], // No dependencies for now
                    NOSTR_WP_VERSION,
                    true // Load in footer
                );
            }
        }
    }

    /**
     * Mark ESM handles as <script type="module">
     */
    public static function as_module($tag, $handle, $src) {
        if (substr($handle, -4) === '-esm') {
            $tag = sprintf('<script type="module" src="%s"></script>'."\n", esc_url($src));
        }
        return $tag;
    }

    /**
     * Ensure a component's script is loaded when needed
     * Only loads if component is enabled and respects dependencies
     */
    public static function ensure_component_loaded(string $slug) {
        $enabled = Registry::enabled_slugs();
        if (!in_array($slug, $enabled, true)) {
            return; // Component not enabled
        }

        $meta = Registry::get($slug);
        if (!$meta) {
            return; // Component not found
        }

        // Load dependencies first
        if (isset($meta['dependencies'])) {
            foreach ($meta['dependencies'] as $dep) {
                self::ensure_component_loaded($dep);
            }
        }

        // Load the component script
        $handle = "nostr-wc-$slug-esm";
        if (!wp_script_is($handle, 'enqueued')) {
            wp_enqueue_script($handle);
        }
    }

    /**
     * Get all enabled components with their dependencies resolved
     */
    public static function get_enabled_with_dependencies(): array {
        return Registry::get_enabled_with_dependencies();
    }

    /**
     * Enqueue all enabled components (useful for admin or specific pages)
     */
    public static function enqueue_enabled_components() {
        $enabled_with_deps = self::get_enabled_with_dependencies();
        
        foreach ($enabled_with_deps as $slug) {
            $handle = "nostr-wc-$slug-esm";
            if (!wp_script_is($handle, 'enqueued')) {
                wp_enqueue_script($handle);
            }
        }
    }

    /**
     * Check if a component script is registered
     */
    public static function is_component_registered(string $slug): bool {
        $handle = "nostr-wc-$slug-esm";
        return wp_script_is($handle, 'registered');
    }

    /**
     * Check if a component script is enqueued
     */
    public static function is_component_enqueued(string $slug): bool {
        $handle = "nostr-wc-$slug-esm";
        return wp_script_is($handle, 'enqueued');
    }

    /**
     * Get component script handle
     */
    public static function get_component_handle(string $slug): string {
        return "nostr-wc-$slug-esm";
    }

    /**
     * Get component script URL
     */
    public static function get_component_url(string $slug): ?string {
        $meta = Registry::get($slug);
        if (!$meta) {
            return null;
        }

        $file_path = NOSTR_WP_DIR . $meta['esm'];
        if (!file_exists($file_path)) {
            return null;
        }

        return plugins_url($meta['esm'], NOSTR_WP_FILE);
    }

}
