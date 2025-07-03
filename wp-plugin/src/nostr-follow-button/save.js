import { useBlockProps } from '@wordpress/block-editor';

export default function save( { attributes } ) {
	const npub = attributes.npub;
	return (
		<div {...useBlockProps.save()}>
      <script 
        type="module" 
        src="https://nostr-components.web.app/dist/nostr-follow-button.js" 
        data-pubkey={npub}
      ></script>
      <nostr-follow-button pubkey={npub}></nostr-follow-button>
    </div>
	);
}
