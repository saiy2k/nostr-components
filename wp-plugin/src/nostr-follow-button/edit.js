import { TextControl, PanelBody } from '@wordpress/components';
import { useBlockProps, InspectorControls } from '@wordpress/block-editor';
import { useEffect } from '@wordpress/element';

export default function Edit({ attributes, setAttributes }) {
  const { npub } = attributes;

  // Load the external script when npub changes
  useEffect(() => {
  if (!npub) return;

  const iframe = document.querySelector('iframe[name="editor-canvas"]');
  if (!iframe || !iframe.contentDocument) return;

  const iframeDoc = iframe.contentDocument;
  const scriptId = 'nostr-follow-button-script';

  if (!iframeDoc.getElementById(scriptId)) {
    const script = iframeDoc.createElement('script');
    script.type = 'module';
    script.src = 'https://nostr-components.web.app/dist/nostr-follow-button.js';
    script.id = scriptId;
    iframeDoc.body.appendChild(script);
  }

  return () => {
    const existingScript = iframeDoc.getElementById(scriptId);
    if (existingScript) {
      existingScript.remove();
    }
  };
}, [npub]);

  return (
    <div {...useBlockProps()}>
      <InspectorControls>
        <PanelBody title="Nostr Follow Button Settings">
          <TextControl
            label="Nostr Public Key (npub)"
            value={npub}
            onChange={(value) => setAttributes({ npub: value })}
            placeholder="npub1..."
          />
        </PanelBody>
      </InspectorControls>

      <div
       className="nostr-profile-container" style={{ color: 'red' }}
      >
        {npub ? (
          <nostr-follow-button pubkey={npub}></nostr-follow-button>
        ) : (
          <p>Enter npub to display Nostr follow button</p>
        )}
      </div>
    </div>
  );
}