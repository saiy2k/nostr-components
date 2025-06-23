import { TextControl, PanelBody } from '@wordpress/components';
import { useBlockProps, InspectorControls } from '@wordpress/block-editor';
import { useEffect } from '@wordpress/element';

export default function Edit({ attributes, setAttributes }) {
  const { id } = attributes;

  // Load the external script when id changes
  useEffect(() => {
    if (id) {
      const script = document.createElement('script');
      script.type = 'module';
      script.src = 'https://nostr-components.web.app/dist/nostr-post.js';
      document.body.appendChild(script);

      return () => {
        document.body.removeChild(script);
      };
    }
  }, [id]);

  return (
    <div {...useBlockProps()}>
      <InspectorControls>
        <PanelBody title="Nostr Post Settings">
          <TextControl
            label="Post ID"
            value={id}
            onChange={(value) => setAttributes({ id: value })}
            placeholder="Enter post ID..."
          />
        </PanelBody>
      </InspectorControls>

      <div className="nostr-profile-container">
        {id ? (
          <nostr-post id={id}></nostr-post>
        ) : (
          <p>Enter post ID to display post</p>
        )}
      </div>
    </div>
  );
}
