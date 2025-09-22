<?php
namespace NostrComponentsWP;

class Shortcodes {
    public static function boot() {
        add_action('init', [__CLASS__, 'register']);
    }

    public static function register() {
        $enabled = Registry::enabled_slugs();
        foreach ($enabled as $slug) {
            $meta = Registry::get($slug);
            if (!$meta) continue;

            add_shortcode($meta['shortcode'], function($atts = [], $content = '', $tag = '') use ($slug, $meta) {
                // Ensure component script is loaded
                Assets::ensure_component_loaded($slug);

                // Get component defaults
                $defaults = Registry::get_component_defaults($slug);
                
                // Merge with defaults and sanitize
                $atts = shortcode_atts($defaults, $atts, $tag);

                // Convert attribute names from underscore to kebab-case
                $kebab_attrs = [];
                foreach ($atts as $key => $value) {
                    if ($value !== '' && $value !== null) {
                        $kebab_key = str_replace('_', '-', $key);
                        $kebab_attrs[] = sprintf('%s="%s"', esc_attr($kebab_key), esc_attr($value));
                    }
                }

                // Generate the custom element HTML
                $element_name = $slug;
                $attributes_string = implode(' ', $kebab_attrs);
                
                return sprintf('<%s %s></%s>', 
                    esc_html($element_name), 
                    $attributes_string, 
                    esc_html($element_name)
                );
            });
        }
    }

    /**
     * Get all registered shortcodes for enabled components
     */
    public static function get_registered_shortcodes(): array {
        $enabled = Registry::enabled_slugs();
        $shortcodes = [];
        
        foreach ($enabled as $slug) {
            $meta = Registry::get($slug);
            if ($meta && isset($meta['shortcode'])) {
                $shortcodes[$meta['shortcode']] = [
                    'component' => $slug,
                    'title' => $meta['title'],
                    'description' => $meta['description'],
                    'attributes' => $meta['attributes'],
                    'defaults' => Registry::get_component_defaults($slug),
                ];
            }
        }
        
        return $shortcodes;
    }

    /**
     * Generate shortcode usage examples
     */
    public static function get_usage_examples(): array {
        $shortcodes = self::get_registered_shortcodes();
        $examples = [];
        
        foreach ($shortcodes as $shortcode => $info) {
            $component = $info['component'];
            $required_attrs = array_filter($info['attributes'], function($attr) {
                return isset($attr['required']) && $attr['required'];
            });
            
            $example_parts = [$shortcode];
            
            // Add required attributes
            foreach ($required_attrs as $attr => $config) {
                $example_value = self::get_example_value($attr, $config);
                $example_parts[] = sprintf('%s="%s"', $attr, $example_value);
            }
            
            // Add some optional attributes with defaults
            $optional_attrs = array_filter($info['attributes'], function($attr) {
                return !isset($attr['required']) || !$attr['required'];
            });
            
            $added_optional = 0;
            foreach ($optional_attrs as $attr => $config) {
                if ($added_optional >= 2) break; // Limit to 2 optional attributes
                
                if (isset($config['default']) && $config['default'] !== '') {
                    $example_parts[] = sprintf('%s="%s"', $attr, $config['default']);
                    $added_optional++;
                }
            }
            
            $examples[$shortcode] = [
                'basic' => sprintf('[%s]', implode(' ', $example_parts)),
                'component' => $component,
                'title' => $info['title'],
                'description' => $info['description'],
                'required_attributes' => array_keys($required_attrs),
                'optional_attributes' => array_keys($optional_attrs),
            ];
        }
        
        return $examples;
    }

    /**
     * Get example value for an attribute
     */
    private static function get_example_value(string $attr, array $config): string {
        switch ($attr) {
            case 'eventid':
                return 'abc123def456...';
            case 'npub':
                return 'npub1abc123...';
            case 'pubkey':
                return 'abc123def456...';
            case 'nip05':
                return 'user@example.com';
            case 'relays':
                return 'wss://relay.example.com';
            case 'theme':
                return 'light';
            case 'show-stats':
            case 'show-npub':
            case 'show-follow':
                return 'true';
            default:
                return 'example';
        }
    }

    /**
     * Validate shortcode attributes
     */
    public static function validate_attributes(string $component, array $atts): array {
        $meta = Registry::get($component);
        if (!$meta) {
            return ['valid' => false, 'errors' => ['Component not found']];
        }

        $errors = [];
        $attributes = $meta['attributes'];

        // Check required attributes
        foreach ($attributes as $attr => $config) {
            if (isset($config['required']) && $config['required']) {
                if (!isset($atts[$attr]) || $atts[$attr] === '') {
                    $errors[] = sprintf('Required attribute "%s" is missing', $attr);
                }
            }
        }

        // Validate attribute values
        foreach ($atts as $attr => $value) {
            if (!isset($attributes[$attr])) {
                $errors[] = sprintf('Unknown attribute "%s"', $attr);
                continue;
            }

            $config = $attributes[$attr];
            
            // Type validation
            if (isset($config['type'])) {
                switch ($config['type']) {
                    case 'boolean':
                        if (!in_array($value, ['true', 'false', '1', '0', ''], true)) {
                            $errors[] = sprintf('Attribute "%s" must be true/false', $attr);
                        }
                        break;
                    case 'string':
                        if (!is_string($value)) {
                            $errors[] = sprintf('Attribute "%s" must be a string', $attr);
                        }
                        break;
                }
            }

            // Enum validation
            if (isset($config['enum']) && !in_array($value, $config['enum'])) {
                $errors[] = sprintf('Attribute "%s" must be one of: %s', $attr, implode(', ', $config['enum']));
            }
        }

        return [
            'valid' => empty($errors),
            'errors' => $errors
        ];
    }

    /**
     * Debug method to get shortcode information
     */
    public static function get_debug_info(): array {
        return [
            'enabled_components' => Registry::enabled_slugs(),
            'registered_shortcodes' => self::get_registered_shortcodes(),
            'usage_examples' => self::get_usage_examples(),
        ];
    }
}
