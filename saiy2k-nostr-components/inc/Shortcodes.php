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
                Assets::ensure_component_loaded($slug);

                $defaults = Registry::get_component_defaults($slug);
                $component_attrs = Registry::get_component_attributes($slug);
                $original_atts = $atts;
                $theme_provided = isset($original_atts['theme']) && $original_atts['theme'] !== '';
                $atts = shortcode_atts($defaults, $atts, $tag);
                
                $shared_config = get_option('nostr_wp_shared_config', []);
                if (empty($atts['relays']) && !empty($shared_config['relays'])) {
                    $atts['relays'] = $shared_config['relays'];
                }
                if (!$theme_provided && !empty($shared_config['theme'])) {
                    $atts['theme'] = $shared_config['theme'];
                }
                
                foreach ($original_atts as $key => $value) {
                    if ($value !== '' && $value !== null) {
                        $kebab_key = str_replace('_', '-', $key);
                        if (isset($component_attrs[$kebab_key])) {
                            $atts[$kebab_key] = $value;
                        }
                    }
                }
                
                foreach ($component_attrs as $attr_key => $attr_config) {
                    if (isset($atts[$attr_key]) && isset($attr_config['type']) && $attr_config['type'] === 'number') {
                        $value = $atts[$attr_key];
                        if (is_numeric($value)) {
                            $num_value = floatval($value);
                            if (isset($attr_config['minimum'])) {
                                $num_value = max($attr_config['minimum'], $num_value);
                            }
                            if (isset($attr_config['maximum'])) {
                                $num_value = min($attr_config['maximum'], $num_value);
                            }
                            $atts[$attr_key] = $num_value;
                        }
                    }
                }

                $kebab_attrs = [];
                foreach ($atts as $key => $value) {
                    if ($value === '' || $value === null || $value === false) {
                        continue;
                    }
                    
                    $kebab_key = str_replace('_', '-', $key);
                    if ($kebab_key === 'theme') {
                        $kebab_key = 'data-theme';
                    }
                    
                    $kebab_attrs[] = sprintf('%s="%s"', esc_attr($kebab_key), esc_attr($value));
                }

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
            if (!is_array($info) || !isset($info['component']) || !isset($info['attributes']) || !is_array($info['attributes'])) {
                continue;
            }
            
            $component = $info['component'];
            $required_attrs = array_filter($info['attributes'], function($config) {
                return is_array($config) && isset($config['required']) && $config['required'];
            });
            
            $example_parts = [$shortcode];
            
            foreach ($required_attrs as $attr => $config) {
                $example_value = self::get_example_value($attr, $config);
                $example_parts[] = sprintf('%s="%s"', $attr, $example_value);
            }
            
            $identifier_priority = [
                'nostr-post' => ['noteid', 'hex', 'eventid'],
                'nostr-profile' => ['npub', 'pubkey', 'nip05'],
                'nostr-profile-badge' => ['npub', 'pubkey', 'nip05'],
                'nostr-follow-button' => ['npub', 'pubkey', 'nip05'],
                'nostr-zap' => ['npub', 'pubkey', 'nip05', 'url'],
                'nostr-like' => ['url'],
            ];
            
            $component_identifiers = $identifier_priority[$component] ?? [];
            foreach ($component_identifiers as $identifier) {
                if (isset($info['attributes'][$identifier]) && 
                    is_array($info['attributes'][$identifier]) && 
                    !isset($required_attrs[$identifier])) {
                    $example_value = self::get_example_value($identifier, $info['attributes'][$identifier]);
                    $example_parts[] = sprintf('%s="%s"', $identifier, $example_value);
                    break;
                }
            }
            
            $all_identifier_attrs = ['noteid', 'hex', 'eventid', 'npub', 'pubkey', 'nip05', 'url'];
            $optional_attrs = array_filter($info['attributes'], function($config, $attr_key) use ($all_identifier_attrs) {
                if (in_array($attr_key, $all_identifier_attrs) || !is_array($config)) {
                    return false;
                }
                return !isset($config['required']) || !$config['required'];
            }, ARRAY_FILTER_USE_BOTH);
            
            $added_optional = 0;
            foreach ($optional_attrs as $attr => $config) {
                if ($added_optional >= 2) break;
                
                if (in_array($attr, ['show-stats', 'show-npub', 'show-follow', 'show-avatar', 'relays'])) {
                    continue;
                }
                
                $example_value = self::get_example_value($attr, $config);
                if ($example_value && $example_value !== 'example') {
                    $example_parts[] = sprintf('%s="%s"', $attr, $example_value);
                    $added_optional++;
                }
            }
            
            $examples[$shortcode] = [
                'basic' => sprintf('[%s]', implode(' ', $example_parts)),
                'component' => $component,
                'title' => $info['title'] ?? '',
                'description' => $info['description'] ?? '',
                'required_attributes' => array_keys($required_attrs),
                'optional_attributes' => array_keys($optional_attrs),
            ];
        }
        
        return $examples;
    }

    private static function get_example_value(string $attr, array $config): string {
        switch ($attr) {
            case 'eventid':
                return 'nevent1qqstyhryvag0zukl62zw986zd23td45ya0fl8jtfu29uvpqry6jwj3c76k2cu';
            case 'noteid':
                return 'note1kmf8n3c8fxfm3q26ys6vgrg306w05yrddt3txd4jtln47tunhscqp09muz';
            case 'hex':
                return 'e6828f05e5279c5346652033c588c5081383bdd16c171be8d1daa947c2aeac8b';
            case 'npub':
                return 'npub1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q0uf63m';
            case 'pubkey':
                return '82341f882b6eabcd2ba7f1ef90aad961cf074af15b9ef44a09f9d2a8fbfbe6a2';
            case 'nip05':
                return 'dergigi@primal.net';
            case 'relays':
                return 'wss://relay.damus.io,wss://nostr.wine';
            case 'theme':
                return 'light';
            case 'text':
                return 'Follow me on nostr';
            case 'amount':
                return '1000';
            case 'default-amount':
                return '21';
            case 'url':
                return 'https://nostr.com';
            case 'show-stats':
            case 'show-npub':
            case 'show-follow':
            case 'show-avatar':
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
                    case 'number':
                        if (!is_numeric($value)) {
                            $errors[] = sprintf('Attribute "%s" must be a number', $attr);
                        } else {
                            $num_value = floatval($value);
                            if (isset($config['minimum']) && $num_value < $config['minimum']) {
                                $errors[] = sprintf('Attribute "%s" must be at least %s', $attr, $config['minimum']);
                            }
                            if (isset($config['maximum']) && $num_value > $config['maximum']) {
                                $errors[] = sprintf('Attribute "%s" must be at most %s', $attr, $config['maximum']);
                            }
                        }
                        break;
                }
            }

            if (isset($config['enum']) && !in_array($value, $config['enum'])) {
                $errors[] = sprintf('Attribute "%s" must be one of: %s', $attr, implode(', ', $config['enum']));
            }
        }

        return [
            'valid' => empty($errors),
            'errors' => $errors
        ];
    }

}
