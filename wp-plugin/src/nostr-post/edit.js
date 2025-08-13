import { TextControl, PanelBody } from '@wordpress/components';
import { useBlockProps, InspectorControls } from '@wordpress/block-editor';
import { useEffect, useState } from '@wordpress/element';
import { decodeNevent } from '../../includes/decodeNevent';

export default function Edit({ attributes, setAttributes }) {
  const { id } = attributes;
  const [nodeId, setNodeId] = useState(null);

  useEffect(() => {
    const eventData = decodeNevent(id);
    setNodeId(eventData?.type === 'nevent' ? eventData.note : null);
  }, [id]);

  useEffect(() => {
    if (!nodeId) return;

    const iframe = document.querySelector('iframe[name="editor-canvas"]');
    if (!iframe || !iframe.contentDocument) return;

    const iframeDoc = iframe.contentDocument;
    const scriptId = 'nostr-post-script';

    if (!iframeDoc.getElementById(scriptId)) {
      const script = iframeDoc.createElement('script');
      script.type = 'module';
      script.src = 'https://nostr-components.web.app/dist/nostr-post.js';
      script.id = scriptId;
      iframeDoc.body.appendChild(script);
    }

    return () => {
      const existingScript = iframeDoc.getElementById(scriptId);
      if (existingScript) existingScript.remove();
    };
  }, [nodeId]);

  return (
    <div {...useBlockProps()}>
      <InspectorControls>
        <PanelBody title="Nostr Post Settings">
          <TextControl
            label="Nevent or Note ID"
            value={id}
            onChange={(value) => setAttributes({ id: value })}
            placeholder="nevent1..."
          />
        </PanelBody>
      </InspectorControls>

      <div className="nostr-profile-container" style={{ backgroundColor: 'black', color: 'white' }}>
        {nodeId ? (
          <nostr-post id={nodeId}></nostr-post>
        ) : (
          <p>Enter a valid nevent to display post</p>
        )}
      </div>
    </div>
  );
}
