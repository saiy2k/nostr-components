import { useBlockProps } from '@wordpress/block-editor';

export default function Save({ attributes }) {
  return (
    <div {...useBlockProps.save()}>
      <script 
        type="module" 
        src="https://nostr-components.web.app/dist/nostr-follow-button.js" 
        data-pubkey={attributes.npub}
      ></script>
      <nostr-follow-button pubkey={attributes.npub}></nostr-follow-button>
    </div>
  );
}