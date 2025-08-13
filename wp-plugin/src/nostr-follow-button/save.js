import { useBlockProps } from '@wordpress/block-editor';

export default function save( { attributes } ) {
	const npub = attributes.npub;
	return (
  <nostr-follow-button data-pubkey={attributes.npub}></nostr-follow-button>
);

}
