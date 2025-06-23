import { TextControl, PanelBody } from '@wordpress/components';
import { useBlockProps, InspectorControls } from '@wordpress/block-editor';
import { useEffect } from '@wordpress/element';

export default function Edit({ attributes, setAttributes }) {
  const { npub } = attributes;

  // Load the external script when npub changes
  useEffect(() => {
    if (npub) {
      const script = document.createElement('script');
      script.type = 'module';
      script.src = 'https://nostr-components.web.app/dist/nostr-profile.js';
      document.body.appendChild(script);
      
      return () => {
        document.body.removeChild(script);
      };
    }
  }, [npub]);

  return (
    <div {...useBlockProps()}>
      <InspectorControls>
        <PanelBody title="Nostr Profile Settings">
          <TextControl
            label="Nostr Public Key (npub)"
            value={npub}
            onChange={(value) => setAttributes({ npub: value })}
            placeholder="npub1..."
          />
        </PanelBody>
      </InspectorControls>

      <div className="nostr-profile-container">
        {npub ? (
          <nostr-profile pubkey={npub}></nostr-profile>
        ) : (
          <p>Enter npub to display profile</p>
        )}
      </div>
    </div>
  );
}