<?php
if ( ! defined( 'ABSPATH' ) ) exit;

/**
 * Class Nostr_Components_Embed
 *
 * Provides a settings panel under "Settings → Nostr Components"
 * to enable/disable shortcodes for individual components.
 * Components dynamically enqueue Nostr scripts as needed.
 */
class Nostr_Components_Embed {

    private $option_name = 'nostr_components_settings';

    public function __construct() {
        add_action( 'admin_menu', [ $this, 'add_settings_page' ] );
        add_action( 'admin_init', [ $this, 'register_settings' ] );
        add_action( 'wp_enqueue_scripts', [ $this, 'enqueue_scripts' ] );

        // 💡 Load shortcode config
        $options = get_option( $this->option_name );
        $enabled = $options['enabled'] ?? [];

        // 🔗 Register shortcodes conditionally
        $this->maybe_add_shortcode( 'nostr_profile', 'render_nostr_profile', $enabled );
        $this->maybe_add_shortcode( 'nostr_post', 'render_nostr_post', $enabled );
        $this->maybe_add_shortcode( 'nostr_follow_button', 'render_nostr_follow_button', $enabled );
        $this->maybe_add_shortcode( 'nostr_profile_badge', 'render_nostr_profile_badge', $enabled );
    }

    /**
     * Dynamically register shortcodes, or attach fallback if disabled.
     */
    private function maybe_add_shortcode( $tag, $callback_method, $enabled_list ) {
        if ( in_array( $tag, $enabled_list ) ) {
            add_shortcode( $tag, [ $this, $callback_method ] );
        } else {
            add_shortcode( $tag, [ $this, 'shortcode_disabled_notice' ] );
        }
    }

    /**
     * Enqueue only the Nostr web components selected in the settings.
     */
    public function enqueue_scripts() {
        $options = get_option( $this->option_name );

        if ( empty( $options['enabled'] ) || ! is_array( $options['enabled'] ) ) {
            return;
        }

        foreach ( $options['enabled'] as $component ) {
            wp_enqueue_script(
                $component,
                "https://nostr-components.web.app/dist/{$component}.js",
                [],
                null,
                true
            );
        }
    }

    public function enqueue_editor_assets() {
        // Reserved for future editor-related assets
    }

    /**
     * Add the "Nostr Components" submenu under Settings.
     */
    public function add_settings_page() {
        add_options_page(
            'Nostr Components',
            'Nostr Components',
            'manage_options',
            'nostr-components',
            [ $this, 'render_settings_page' ]
        );
    }

    /**
     * Register setting group for saving component preferences.
     */
    public function register_settings() {
        register_setting( 'nostr_components_group', $this->option_name );
    }

    /**
     * Render the admin settings UI.
     */
    public function render_settings_page() {
        $options = get_option( $this->option_name );
        $components = [
            'nostr-profile'        => 'Profile',
            'nostr-profile-badge'  => 'Profile Badge',
            'nostr-post'           => 'Post',
            'nostr-follow-button'  => 'Follow Button'
        ];
        ?>
        <div class="wrap">
            <h1>Nostr Components Settings</h1>
            <form method="post" action="options.php">
                <?php settings_fields( 'nostr_components_group' ); ?>
                <table class="form-table">
                    <tr valign="top">
                        <th scope="row">Enable Components</th>
                        <td>
                            <?php foreach ( $components as $key => $label ) : ?>
                                <label>
                                    <input type="checkbox" name="<?php echo $this->option_name; ?>[enabled][]" value="<?php echo esc_attr( $key ); ?>"
                                           <?php checked( in_array( $key, $options['enabled'] ?? [] ) ); ?> />
                                    <?php echo esc_html( $label ); ?>
                                </label><br>
                            <?php endforeach; ?>
                        </td>
                    </tr>
                </table>
                <?php submit_button(); ?>
            </form>

            <hr>
            <h2>Documentation</h2>
            <p><strong>Blocks:</strong></p>
            <ul>
                <li><code>Nostr Profile</code></li>
                <li><code>Nost Badge</code></li>
                <li><code>Nostr Follow Button</code></li>
                <li><code>Nostr Post</code></li>
            </ul>
            <p>Use these blocks in the Gutenberg editor to embed Nostr components directly into your posts or pages.</p>
            <p>Each block includes an inspector panel to input the required `npub` or `note` ID.</p>

            <p><strong>Shortcodes:</strong></p>
            <ul>
                <li><code>[nostr_profile pubkey="npub..."]</code></li>
                <li><code>[nostr_post note="note_id"]</code></li>
                <li><code>[nostr_follow_button pubkey="npub..."]</code></li>
                <li><code>[nostr_profile_badge pubkey="npub..."]</code></li>
            </ul>

            <p><strong>Instructions:</strong></p>
            <ol>
                <li>Enable the components you want to use by checking the boxes above.</li>
                <li>Use the corresponding shortcodes in any post or page content.</li>
                <li>If a shortcode is used but the component is not enabled, admins will see a notice; regular users will see nothing.</li>
            </ol>

            <p><strong>Need Help?</strong> Visit the <a href="https://nostr-components.web.app/" target="_blank">Nostr Components site</a> or open an issue on GitHub.</p>
        </div>
        <?php
    }

    // 📦 Shortcode renderers
    public function render_nostr_profile( $atts ) {
        $atts = shortcode_atts([ 'pubkey' => '' ], $atts );
        return '<nostr-profile pubkey="' . esc_attr( $atts['pubkey'] ) . '"></nostr-profile>';
    }

    public function render_nostr_post( $atts ) {
        $atts = shortcode_atts([ 'note' => '' ], $atts );
        return '<nostr-post note="' . esc_attr( $atts['note'] ) . '"></nostr-post>';
    }

    public function render_nostr_follow_button( $atts ) {
        $atts = shortcode_atts([ 'pubkey' => '' ], $atts );
        return '<nostr-follow-button pubkey="' . esc_attr( $atts['pubkey'] ) . '"></nostr-follow-button>';
    }

    public function render_nostr_profile_badge( $atts ) {
        $atts = shortcode_atts([ 'pubkey' => '' ], $atts );
        return '<nostr-profile-badge pubkey="' . esc_attr( $atts['pubkey'] ) . '"></nostr-profile-badge>';
    }

    /**
     * Fallback notice if a shortcode is not enabled in settings.
     */
    public function shortcode_disabled_notice() {
        if ( current_user_can( 'manage_options' ) ) {
            return '<div style="color:red;">Nostr Component is disabled. Please enable it in <a href="' .
                admin_url( 'options-general.php?page=nostr-components' ) . '">Settings → Nostr Components</a>.</div>';
        }
        return ''; // No output for regular visitors
    }
}
