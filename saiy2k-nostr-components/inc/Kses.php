<?php
namespace NostrComponentsWP;

class Kses {
    /**
     * Initialize KSES security for custom elements
     */
    public static function boot() {
        add_filter('wp_kses_allowed_html', [__CLASS__, 'add_custom_elements'], 10, 2);
    }

    /**
     * Add Nostr custom elements to allowed HTML
     */
    public static function add_custom_elements($allowed, $context) {
        if ($context === 'post') {
            $nostr_elements = self::get_nostr_elements();
            $allowed = array_merge($allowed, $nostr_elements);
        }
        return $allowed;
    }

    /**
     * Get allowed Nostr custom elements and their attributes
     */
    public static function get_nostr_elements(): array {
        $enabled_components = Registry::enabled_slugs();
        $elements = [];

        foreach ($enabled_components as $component) {
            $meta = Registry::get($component);
            if (!$meta) {
                continue;
            }

            $tag_name = $component;
            $attributes = Registry::get_component_attributes($component);
            
            $allowed_attrs = [];
            foreach ($attributes as $attr => $config) {
                $allowed_attrs[$attr] = [];
            }

            $elements[$tag_name] = $allowed_attrs;
        }

        return $elements;
    }

    /**
     * Sanitize Nostr component attributes
     */
    public static function sanitize_attributes(string $component, array $attributes): array {
        $meta = Registry::get($component);
        if (!$meta) {
            return [];
        }

        $component_attributes = Registry::get_component_attributes($component);
        $sanitized = [];

        foreach ($attributes as $key => $value) {
            if (!isset($component_attributes[$key])) {
                continue; // Skip unknown attributes
            }

            $config = $component_attributes[$key];
            $sanitized[$key] = self::sanitize_attribute_value($value, $config);
        }

        return $sanitized;
    }

    /**
     * Sanitize individual attribute value based on its type
     */
    public static function sanitize_attribute_value($value, array $config) {
        $type = $config['type'] ?? 'string';

        switch ($type) {
            case 'boolean':
                return filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? false;
            
            case 'number':
                return is_numeric($value) ? (float) $value : 0;
            
            case 'string':
            default:
                if (isset($config['enum'])) {
                    return in_array($value, $config['enum'], true) ? $value : ($config['default'] ?? '');
                }
                return sanitize_text_field($value);
        }
    }

    /**
     * Check if a component is allowed in current context
     */
    public static function is_component_allowed(string $component): bool {
        return Registry::is_enabled($component);
    }

}
