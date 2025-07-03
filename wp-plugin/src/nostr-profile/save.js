import { useBlockProps } from '@wordpress/block-editor';

export default function save( { attributes } ) {
	const npub = attributes.npub;
	return (
		<div {...useBlockProps.save()}>
      <script 
        type="module" 
        src="https://nostr-components.web.app/dist/nostr-profile.js" 
        data-pubkey={npub}
      ></script>
      <nostr-profile pubkey={npub}></nostr-profile>
    </div>
	);
}
