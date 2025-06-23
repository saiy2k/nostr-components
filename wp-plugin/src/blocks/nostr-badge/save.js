import { useBlockProps } from '@wordpress/block-editor';

export default function Save({ attributes }) {
  return (
    <div {...useBlockProps.save()}>
      <script 
        type="module" 
        src="https://nostr-components.web.app/dist/nostr-profile-badge.js" 
        data-pubkey={attributes.npub}
      ></script>
      <nostr-profile-badge pubkey={attributes.npub}></nostr-profile-badge>
    </div>
  );
}