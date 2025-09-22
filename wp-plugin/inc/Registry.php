<?php
namespace NostrComponentsWP;

class Registry {
    /**
     * Component metadata - single source of truth for all components
     * Focused on core components: post, profile, profile-badge, follow-button
     * Attributes based on actual JavaScript class files
     */
    public static function all(): array {
        return [
            'nostr-post' => [
                'title'       => 'Nostr Post',
                'description' => 'Display Nostr posts by note ID',
                'shortcode'   => 'nostr_post',
                'block'       => 'nostr/nostr-post',
                'esm'         => 'build/nostr-post.esm.js',
                'dependencies' => [], // No dependencies
                'attributes'  => [
                    // From NostrEventComponent (base)
                    'eventid' => ['type' => 'string', 'required' => true], // Note ID
                    // From NostrBaseComponent (base)
                    'theme'   => ['type' => 'string', 'enum' => ['light','dark'], 'default' => 'light'],
                    'relays'  => ['type' => 'string'], // CSV of relay URLs
                    // From NostrPost (specific)
                    'show-stats' => ['type' => 'boolean', 'default' => false],
                ],
            ],
            'nostr-profile' => [
                'title'       => 'Nostr Profile',
                'description' => 'Display Nostr user profiles',
                'shortcode'   => 'nostr_profile',
                'block'       => 'nostr/nostr-profile',
                'esm'         => 'build/nostr-profile.esm.js',
                'dependencies' => ['nostr-follow-button'], // Uses follow-button when show-follow is true
                'attributes'  => [
                    // From NostrUserComponent (base)
                    'npub'    => ['type' => 'string'], // bech32 npub
                    'pubkey'  => ['type' => 'string'], // hex public key
                    'nip05'   => ['type' => 'string'], // NIP-05 identifier
                    // From NostrBaseComponent (base)
                    'theme'   => ['type' => 'string', 'enum' => ['light','dark'], 'default' => 'light'],
                    'relays'  => ['type' => 'string'], // CSV of relay URLs
                    // From NostrProfile (specific)
                    'show-npub' => ['type' => 'boolean', 'default' => true],
                    'show-follow' => ['type' => 'boolean', 'default' => true],
                ],
            ],
            'nostr-profile-badge' => [
                'title'       => 'Nostr Profile Badge',
                'description' => 'Compact Nostr profile display',
                'shortcode'   => 'nostr_profile_badge',
                'block'       => 'nostr/nostr-profile-badge',
                'esm'         => 'build/nostr-profile-badge.esm.js',
                'dependencies' => ['nostr-follow-button'], // Uses follow-button when show-follow is true
                'attributes'  => [
                    // From NostrUserComponent (base)
                    'npub'    => ['type' => 'string'], // bech32 npub
                    'pubkey'  => ['type' => 'string'], // hex public key
                    'nip05'   => ['type' => 'string'], // NIP-05 identifier
                    // From NostrBaseComponent (base)
                    'theme'   => ['type' => 'string', 'enum' => ['light','dark'], 'default' => 'light'],
                    'relays'  => ['type' => 'string'], // CSV of relay URLs
                    // From NostrProfileBadge (specific)
                    'show-npub' => ['type' => 'boolean', 'default' => true],
                    'show-follow' => ['type' => 'boolean', 'default' => true],
                ],
            ],
            'nostr-follow-button' => [
                'title'       => 'Nostr Follow Button',
                'description' => 'Follow/unfollow Nostr users',
                'shortcode'   => 'nostr_follow_button',
                'block'       => 'nostr/nostr-follow-button',
                'esm'         => 'build/nostr-follow-button.esm.js',
                'dependencies' => [], // No dependencies - standalone component
                'attributes'  => [
                    // From NostrUserComponent (base)
                    'npub'    => ['type' => 'string'], // bech32 npub
                    'pubkey'  => ['type' => 'string'], // hex public key
                    'nip05'   => ['type' => 'string'], // NIP-05 identifier
                    // From NostrBaseComponent (base)
                    'theme'   => ['type' => 'string', 'enum' => ['light','dark'], 'default' => 'light'],
                    'relays'  => ['type' => 'string'], // CSV of relay URLs
                    // From NostrFollowButton (specific) - no additional attributes
                ],
            ],
        ];
    }

    /**
     * Get enabled component slugs from settings
     */
    public static function enabled_slugs(): array {
        $enabled = get_option('nostr_wp_enabled_components', []);
        if (!is_array($enabled)) {
            $enabled = [];
        }
        return array_values(array_intersect(array_keys(self::all()), $enabled));
    }

    /**
     * Get component metadata by slug
     */
    public static function get(string $slug): ?array {
        $all = self::all();
        return $all[$slug] ?? null;
    }

    /**
     * Check if a component is enabled
     */
    public static function is_enabled(string $slug): bool {
        return in_array($slug, self::enabled_slugs(), true);
    }

    /**
     * Resolve dependencies for a component
     * Returns array of component slugs including the component itself and all dependencies
     */
    public static function resolve_dependencies(string $component, array $visited = []): array {
        // Prevent circular dependencies
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
     * Get all enabled components with their dependencies resolved
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
     * Get component assets (ESM only)
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
