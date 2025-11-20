<?php
namespace NostrComponentsWP;

class Settings {
    const OPT_ENABLED = 'nostr_wp_enabled_components';
    const OPT_SHARED  = 'nostr_wp_shared_config';

    public static function boot() {
        add_action('admin_init', [__CLASS__, 'register']);
        add_action('admin_menu', [__CLASS__, 'menu']);
    }

    public static function register() {
        register_setting('nostr_wp', self::OPT_ENABLED, [
            'type' => 'array',
            'sanitize_callback' => function($value) {
                $value = is_array($value) ? array_values($value) : [];
                $known = array_keys(Registry::all());
                return array_values(array_intersect($value, $known));
            },
            'default' => [],
        ]);

        register_setting('nostr_wp', self::OPT_SHARED, [
            'type' => 'array',
            'sanitize_callback' => function($value) {
                $out = [];
                $out['relays'] = isset($value['relays']) ? sanitize_text_field($value['relays']) : '';
                $out['theme']  = isset($value['theme'])  ? sanitize_text_field($value['theme'])  : 'light';
                return $out;
            },
            'default' => [
                'relays' => 'wss://relay.damus.io,wss://nostr.wine,wss://relay.nostr.net,wss://relay.nostr.band,wss://nos.lol,wss://nostr-pub.wellorder.net,wss://relay.getalby.com,wss://relay.primal.net', 
                'theme' => 'light'
            ],
        ]);
    }

    public static function menu() {
        add_options_page(
            'Nostr Components (by saiy2k)', 'Nostr Components (by saiy2k)', 'manage_options',
            'nostr-components-by-saiy2k', [__CLASS__, 'render']
        );
    }

    public static function render() {
        $all = Registry::all();
        $enabled = get_option(self::OPT_ENABLED, []);
        $shared  = get_option(self::OPT_SHARED, []);
        
        // Verify nonce for tab switching
        $current_tab = 'settings';
        if (isset($_GET['tab']) && wp_verify_nonce(sanitize_text_field(wp_unslash($_GET['_wpnonce'] ?? '')), 'nostr_tab_nonce')) {
            $current_tab = sanitize_text_field(wp_unslash($_GET['tab']));
        }
        ?>
        <div class="wrap">
            <h1>Nostr Components (by saiy2k)</h1>
            
            <!-- Tab Navigation -->
            <nav class="nav-tab-wrapper">
                <a href="<?php echo esc_url(wp_nonce_url('?page=nostr-components-by-saiy2k&tab=settings', 'nostr_tab_nonce')); ?>" 
                   class="nav-tab <?php echo $current_tab === 'settings' ? 'nav-tab-active' : ''; ?>">
                    Settings
                </a>
                <a href="<?php echo esc_url(wp_nonce_url('?page=nostr-components-by-saiy2k&tab=usage', 'nostr_tab_nonce')); ?>" 
                   class="nav-tab <?php echo $current_tab === 'usage' ? 'nav-tab-active' : ''; ?>">
                    Usage Examples
                </a>
            </nav>
            
            <?php if ($current_tab === 'settings'): ?>
            <!-- Settings Tab -->
            <form method="post" action="options.php">
                <?php settings_fields('nostr_wp'); ?>
                
                <h2>Enable Components</h2>
                <p>Select which Nostr components you want to make available in your WordPress site.</p>
                
                <div style="background: #f9f9f9; padding: 20px; border: 1px solid #ddd; margin: 20px 0;">
                    <?php foreach ($all as $slug => $meta): ?>
                        <div style="margin-bottom: 15px;">
                            <label style="display: flex; align-items: center; font-weight: 500;">
                                <input type="checkbox" 
                                    id="component_<?php echo esc_attr($slug); ?>"
                                    name="<?php echo esc_attr(self::OPT_ENABLED); ?>[]"
                                    value="<?php echo esc_attr($slug); ?>"
                                    <?php checked(in_array($slug, $enabled, true)); ?>
                                    style="margin-right: 10px;" />
                                <strong><?php echo esc_html($meta['title']); ?></strong>
                            </label>
                            <?php if (!empty($meta['dependencies'])): ?>
                                <p style="margin: 5px 0 0 30px; color: #d63638; font-size: 13px;">
                                    <strong>Dependencies:</strong> 
                                    <?php 
                                    $dep_names = array_map(function($dep) use ($all) {
                                        return $all[$dep]['title'] ?? $dep;
                                    }, $meta['dependencies']);
                                    echo esc_html(implode(', ', $dep_names));
                                    ?>
                                </p>
                            <?php endif; ?>
                        </div>
                    <?php endforeach; ?>
                </div>

                <h2>Shared Settings</h2>
                <p>These settings apply to all components unless overridden individually.</p>
                
                <table class="form-table">
                    <tbody>
                        <tr>
                            <th scope="row">
                                <label for="shared_relays">Default Relays</label>
                            </th>
                            <td>
                                <input type="text" 
                                    id="shared_relays"
                                    name="<?php echo esc_attr(self::OPT_SHARED); ?>[relays]"
                                    value="<?php echo esc_attr($shared['relays'] ?? ''); ?>" 
                                    class="regular-text" 
                                    placeholder="wss://relay.damus.io,wss://nostr.wine,wss://relay.nostr.net" />
                                <p class="description">
                                    Comma-separated list of Nostr relay URLs. Leave empty to use default relays:
                                    <br><code>wss://relay.damus.io, wss://nostr.wine, wss://relay.nostr.net, wss://relay.nostr.band, wss://nos.lol, wss://nostr-pub.wellorder.net, wss://relay.getalby.com, wss://relay.primal.net</code>
                                </p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row">
                                <label for="shared_theme">Default Theme</label>
                            </th>
                            <td>
                                <select id="shared_theme" name="<?php echo esc_attr(self::OPT_SHARED); ?>[theme]">
                                    <option value="light" <?php selected(($shared['theme'] ?? 'light')==='light'); ?>>Light</option>
                                    <option value="dark"  <?php selected(($shared['theme'] ?? 'light')==='dark'); ?>>Dark</option>
                                </select>
                                <p class="description">
                                    Default theme for all components. Can be overridden per component.
                                </p>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <?php submit_button(); ?>
            </form>
            <?php endif; ?>
            
            <?php if ($current_tab === 'usage'): ?>
            <!-- Usage Examples Tab -->
            <div style="margin-top: 20px;">
                <?php if (empty($enabled)): ?>
                    <div class="notice notice-warning inline">
                        <p>No components are currently enabled. Please enable components in the <a href="?page=nostr-components-by-saiy2k&tab=settings">Settings</a> tab to see usage examples.</p>
                    </div>
                <?php else: ?>
                    <p>Below are detailed usage examples for all enabled components. You can use these as shortcodes in posts/pages or as Gutenberg blocks in the block editor.</p>
                    
                    <?php 
                    $examples = Shortcodes::get_usage_examples();
                    foreach ($enabled as $slug): 
                        $meta = Registry::get($slug);
                        if (!$meta) continue;
                        $shortcode = $meta['shortcode'];
                        $example = $examples[$shortcode] ?? null;
                    ?>
                        <div style="background: #fff; padding: 20px; border: 1px solid #ccd0d4; margin: 20px 0; box-shadow: 0 1px 1px rgba(0,0,0,.04);">
                            <h2 style="margin-top: 0; padding-bottom: 10px; border-bottom: 1px solid #ddd;">
                                <?php echo esc_html($meta['title']); ?>
                            </h2>
                            <p style="color: #666; margin-top: 10px;">
                                <?php echo esc_html($meta['description']); ?>
                            </p>
                            
                            <?php if (!empty($meta['dependencies'])): ?>
                                <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 10px; margin: 15px 0; border-radius: 4px;">
                                    <strong>⚠️ Dependencies:</strong> This component requires 
                                    <?php 
                                    $dep_names = array_map(function($dep) use ($all) {
                                        return '<strong>' . esc_html($all[$dep]['title'] ?? $dep) . '</strong>';
                                    }, $meta['dependencies']);
                                    echo wp_kses_post(implode(', ', $dep_names));
                                    ?> to be enabled.
                                </div>
                            <?php endif; ?>
                            
                            <h3>Shortcode Usage</h3>
                            <div style="background: #f6f7f7; border-left: 4px solid #2271b1; padding: 15px; margin: 10px 0;">
                                <code style="font-size: 14px; color: #23282d;"><?php echo esc_html($example['basic'] ?? '[' . $shortcode . ']'); ?></code>
                            </div>
                            
                            <h3>Available Attributes</h3>
                            
                            <?php 
                            $required_attrs = array_filter($meta['attributes'], function($attr) {
                                return isset($attr['required']) && $attr['required'];
                            });
                            $optional_attrs = array_filter($meta['attributes'], function($attr) {
                                return !isset($attr['required']) || !$attr['required'];
                            });
                            ?>
                            
                            <?php if (!empty($required_attrs)): ?>
                                <h4 style="color: #d63638;">Required Attributes</h4>
                                <table class="widefat" style="margin-bottom: 20px;">
                                    <thead>
                                        <tr>
                                            <th style="width: 25%;">Attribute</th>
                                            <th style="width: 15%;">Type</th>
                                            <th>Description</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <?php foreach ($required_attrs as $attr => $config): ?>
                                            <tr>
                                                <td><code><?php echo esc_html($attr); ?></code></td>
                                                <td><?php echo esc_html($config['type']); ?></td>
                                                <td><?php echo esc_html(self::get_attribute_description($attr, $config)); ?></td>
                                            </tr>
                                        <?php endforeach; ?>
                                    </tbody>
                                </table>
                            <?php endif; ?>
                            
                            <?php if (!empty($optional_attrs)): ?>
                                <h4>Optional Attributes</h4>
                                <table class="widefat">
                                    <thead>
                                        <tr>
                                            <th style="width: 25%;">Attribute</th>
                                            <th style="width: 15%;">Type</th>
                                            <th style="width: 20%;">Default</th>
                                            <th>Description</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <?php foreach ($optional_attrs as $attr => $config): ?>
                                            <tr>
                                                <td><code><?php echo esc_html($attr); ?></code></td>
                                                <td><?php echo esc_html($config['type']); ?></td>
                                                <td>
                                                    <?php if (isset($config['default'])): ?>
                                                        <code><?php echo esc_html(is_bool($config['default']) ? ($config['default'] ? 'true' : 'false') : $config['default']); ?></code>
                                                    <?php else: ?>
                                                        <em>none</em>
                                                    <?php endif; ?>
                                                </td>
                                                <td><?php echo esc_html(self::get_attribute_description($attr, $config)); ?></td>
                                            </tr>
                                        <?php endforeach; ?>
                                    </tbody>
                                </table>
                            <?php endif; ?>
                            
                            <h3>Gutenberg Block</h3>
                            <p>This component is also available as a Gutenberg block. Search for <strong>"<?php echo esc_html($meta['title']); ?>"</strong> in the block inserter.</p>
                        </div>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>
            <?php endif; ?>
        </div>
        <?php
    }
    
    /**
     * Get human-readable description for an attribute
     */
    private static function get_attribute_description(string $attr, array $config): string {
        // Check for constraints
        $constraints = [];
        if (isset($config['minimum'])) {
            $constraints[] = 'min: ' . $config['minimum'];
        }
        if (isset($config['maximum'])) {
            $constraints[] = 'max: ' . $config['maximum'];
        }
        if (isset($config['enum'])) {
            $constraints[] = 'options: ' . implode(', ', $config['enum']);
        }
        
        $descriptions = [
            'eventid' => 'Event ID in nevent1... format (bech32 encoded with relay hints)',
            'hex' => 'Event ID in hex format (64 character string)',
            'noteid' => 'Note ID in note1... format (bech32 encoded)',
            'npub' => 'Public key in npub1... format (bech32 encoded)',
            'pubkey' => 'Public key in hex format (64 character string)',
            'nip05' => 'NIP-05 identifier (e.g., user@domain.com)',
            'relays' => 'Comma-separated list of Nostr relay URLs',
            'theme' => 'Visual theme for the component',
            'text' => 'Custom button text',
            'amount' => 'Fixed zap amount in satoshis',
            'default-amount' => 'Default zap amount shown in dialog (in satoshis)',
            'url' => 'URL to associate with this action',
            'show-stats' => 'Display engagement statistics (likes, replies, etc.)',
            'show-npub' => 'Display the npub identifier',
            'show-follow' => 'Display the follow button',
            'show-avatar' => 'Display user avatar image',
        ];
        
        $desc = $descriptions[$attr] ?? '';
        
        if (!empty($constraints)) {
            $desc .= ($desc ? ' | ' : '') . implode(', ', $constraints);
        }
        
        return $desc;
    }
}
