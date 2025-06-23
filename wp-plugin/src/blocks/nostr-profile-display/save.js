import { useBlockProps } from '@wordpress/block-editor';

export default function Save({ attributes }) {
  return (
    <div {...useBlockProps.save()}>
      <script 
        type="module" 
        src="https://nostr-components.web.app/dist/nostr-profile.js" 
        data-pubkey={attributes.npub}
      ></script>
      <nostr-profile pubkey={attributes.npub}></nostr-profile>
    </div>
  );
}