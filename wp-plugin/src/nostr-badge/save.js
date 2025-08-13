import { useBlockProps } from '@wordpress/block-editor';

export default function save( { attributes } ) {
	const npub = attributes.npub;
	// Validate npub format (should start with 'npub1' and be 63 characters long)
	if (!npub || !npub.startsWith('npub1') || npub.length !== 63) {
		return <div {...useBlockProps.save()}>Invalid public key format</div>;
	}
	return <nostr-profile-badge pubkey={attributes.npub}></nostr-profile-badge>;
}
