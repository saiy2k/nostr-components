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
            'Nostr Components', 'Nostr Components', 'manage_options',
            'nostr-components', [__CLASS__, 'render']
        );
    }

    public static function render() {
        $all = Registry::all();
        $enabled = get_option(self::OPT_ENABLED, []);
        $shared  = get_option(self::OPT_SHARED, []);
        ?>
        <div class="wrap">
            <h1>Nostr Components</h1>
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
                                    name="<?php echo self::OPT_ENABLED; ?>[]"
                                    value="<?php echo esc_attr($slug); ?>"
                                    <?php checked(in_array($slug, $enabled, true)); ?>
                                    style="margin-right: 10px;" />
                                <strong><?php echo esc_html($meta['title']); ?></strong>
                            </label>
                            <p style="margin: 5px 0 0 30px; color: #666; font-size: 14px;">
                                <?php echo esc_html($meta['description']); ?>
                            </p>
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
                                    name="<?php echo self::OPT_SHARED; ?>[relays]"
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
                                <select id="shared_theme" name="<?php echo self::OPT_SHARED; ?>[theme]">
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

            <?php if (!empty($enabled)): ?>
                <h2>Usage Examples</h2>
                <div style="background: #f9f9f9; padding: 20px; border: 1px solid #ddd; margin: 20px 0;">
                    <h3>Shortcodes</h3>
                    <?php foreach ($enabled as $slug): ?>
                        <?php $meta = Registry::get($slug); ?>
                        <?php if ($meta): ?>
                            <h4><?php echo esc_html($meta['title']); ?></h4>
                            <p><strong>Shortcode:</strong> <code>[<?php echo esc_html($meta['shortcode']); ?>]</code></p>
                            
                            <?php 
                            $required_attrs = array_filter($meta['attributes'], function($attr) {
                                return isset($attr['required']) && $attr['required'];
                            });
                            ?>
                            
                            <?php if (!empty($required_attrs)): ?>
                                <p><strong>Required attributes:</strong></p>
                                <ul>
                                    <?php foreach ($required_attrs as $attr => $config): ?>
                                        <li><code><?php echo esc_html($attr); ?></code> - <?php echo esc_html($config['type']); ?></li>
                                    <?php endforeach; ?>
                                </ul>
                            <?php endif; ?>
                            
                            <?php 
                            $optional_attrs = array_filter($meta['attributes'], function($attr) {
                                return !isset($attr['required']) || !$attr['required'];
                            });
                            ?>
                            
                            <?php if (!empty($optional_attrs)): ?>
                                <p><strong>Optional attributes:</strong></p>
                                <ul>
                                    <?php foreach ($optional_attrs as $attr => $config): ?>
                                        <li>
                                            <code><?php echo esc_html($attr); ?></code> - <?php echo esc_html($config['type']); ?>
                                            <?php if (isset($config['default'])): ?>
                                                (default: <?php echo esc_html($config['default']); ?>)
                                            <?php endif; ?>
                                        </li>
                                    <?php endforeach; ?>
                                </ul>
                            <?php endif; ?>
                        <?php endif; ?>
                    <?php endforeach; ?>
                    
                    <h3>Gutenberg Blocks</h3>
                    <p>Enabled components are also available as Gutenberg blocks in the block editor.</p>
                </div>
            <?php endif; ?>
        </div>
        <?php
    }
}
