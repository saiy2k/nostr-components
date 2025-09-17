import { useBlockProps } from '@wordpress/block-editor';

export default function Save({ attributes }) {
  return (
    <div {...useBlockProps.save()}>
      <nostr-post id={attributes.id}></nostr-post>
    </div>
  );
}
