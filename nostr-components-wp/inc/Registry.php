<?php
namespace NostrComponentsWP;

class Registry {
    /**
     * Component metadata - single source of truth for all components
     */
    public static function all(): array {
        return [
            'nostr-post' => [
                'title'       => 'Nostr Post',
                'description' => 'Display Nostr posts by note ID',
                'shortcode'   => 'nostr_post',
                'block'       => 'nostr/nostr-post',
                'esm'         => 'assets/nostr-post.es.js',
                'dependencies' => [],
                'attributes'  => [
                    'eventid' => ['type' => 'string'],
                    'hex'     => ['type' => 'string'],
                    'noteid'  => ['type' => 'string'],
                    'theme'   => ['type' => 'string', 'enum' => ['light','dark'], 'default' => 'light'],
                    'relays'  => ['type' => 'string'],
                    'show-stats' => ['type' => 'boolean', 'default' => false],
                ],
            ],
            'nostr-profile' => [
                'title'       => 'Nostr Profile',
                'description' => 'Display Nostr user profiles',
                'shortcode'   => 'nostr_profile',
                'block'       => 'nostr/nostr-profile',
                'esm'         => 'assets/nostr-profile.es.js',
                'dependencies' => ['nostr-follow-button'],
                'attributes'  => [
                    'npub'    => ['type' => 'string'],
                    'pubkey'  => ['type' => 'string'],
                    'nip05'   => ['type' => 'string'],
                    'theme'   => ['type' => 'string', 'enum' => ['light','dark'], 'default' => 'light'],
                    'relays'  => ['type' => 'string'],
                    'show-npub' => ['type' => 'boolean', 'default' => true],
                    'show-follow' => ['type' => 'boolean', 'default' => true],
                ],
            ],
            'nostr-profile-badge' => [
                'title'       => 'Nostr Profile Badge',
                'description' => 'Compact Nostr profile display',
                'shortcode'   => 'nostr_profile_badge',
                'block'       => 'nostr/nostr-profile-badge',
                'esm'         => 'assets/nostr-profile-badge.es.js',
                'dependencies' => ['nostr-follow-button'],
                'attributes'  => [
                    // From NostrUserComponent (base)
                    'npub'    => ['type' => 'string'], // bech32 npub
                    'pubkey'  => ['type' => 'string'],
                    'nip05'   => ['type' => 'string'],
                    'theme'   => ['type' => 'string', 'enum' => ['light','dark'], 'default' => 'light'],
                    'relays'  => ['type' => 'string'],
                    'show-npub' => ['type' => 'boolean', 'default' => true],
                    'show-follow' => ['type' => 'boolean', 'default' => true],
                ],
            ],
            'nostr-follow-button' => [
                'title'       => 'Nostr Follow Button',
                'description' => 'Follow/unfollow Nostr users',
                'shortcode'   => 'nostr_follow_button',
                'block'       => 'nostr/nostr-follow-button',
                'esm'         => 'assets/nostr-follow-button.es.js',
                'dependencies' => [],
                'attributes'  => [
                    // From NostrUserComponent (base)
                    'npub'    => ['type' => 'string'], // bech32 npub
                    'pubkey'  => ['type' => 'string'],
                    'nip05'   => ['type' => 'string'],
                    'theme'   => ['type' => 'string', 'enum' => ['light','dark'], 'default' => 'light'],
                    'relays'  => ['type' => 'string'],
                    // Component-specific attributes
                    'show-avatar' => ['type' => 'boolean', 'default' => false],
                    'text'    => ['type' => 'string', 'default' => 'Follow me on nostr'],
                ],
            ],
        ];
    }

    /**
     * Get enabled component slugs
     */
    public static function enabled_slugs(): array {
        $enabled = get_option('nostr_wp_enabled_components', []);
        if (!is_array($enabled)) {
            $enabled = [];
        }
        return array_values(array_intersect(array_keys(self::all()), $enabled));
    }

    /**
     * Get component metadata
     */
    public static function get(string $slug): ?array {
        $all = self::all();
        return $all[$slug] ?? null;
    }

    /**
     * Check if component is enabled
     */
    public static function is_enabled(string $slug): bool {
        return in_array($slug, self::enabled_slugs(), true);
    }

    /**
     * Resolve dependencies for a component
     */
    public static function resolve_dependencies(string $component, array $visited = []): array {
        if (in_array($component, $visited, true)) {
            return [];
        }

        $visited[] = $component;
        $result = [$component];

        $meta = self::get($component);
        if ($meta && isset($meta['dependencies'])) {
            foreach ($meta['dependencies'] as $dep) {
                $result = array_merge($result, self::resolve_dependencies($dep, $visited));
            }
        }

        return array_unique($result);
    }

    /**
     * Get all enabled components with dependencies
     */
    public static function get_enabled_with_dependencies(): array {
        $enabled = self::enabled_slugs();
        $resolved = [];

        foreach ($enabled as $component) {
            $resolved = array_merge($resolved, self::resolve_dependencies($component));
        }

        return array_unique($resolved);
    }

    /**
     * Get component assets
     */
    public static function get_component_assets(string $slug): array {
        $meta = self::get($slug);
        if (!$meta) {
            return [];
        }

        $assets = [];
        if (isset($meta['esm'])) {
            $assets['esm'] = [
                'url' => plugins_url($meta['esm'], NOSTR_WP_FILE),
                'handle' => "nostr-wc-$slug-esm"
            ];
        }

        return $assets;
    }

    /**
     * Get component dependencies
     */
    public static function get_component_dependencies(string $slug): array {
        $meta = self::get($slug);
        return $meta['dependencies'] ?? [];
    }

    /**
     * Get component attributes
     */
    public static function get_component_attributes(string $slug): array {
        $meta = self::get($slug);
        return $meta['attributes'] ?? [];
    }

    /**
     * Get component defaults
     */
    public static function get_component_defaults(string $slug): array {
        $meta = self::get($slug);
        if (!$meta || !isset($meta['attributes'])) {
            return [];
        }

        $defaults = [];
        foreach ($meta['attributes'] as $attr => $config) {
            if (isset($config['default'])) {
                $defaults[$attr] = $config['default'];
            }
        }

        return $defaults;
    }
}
