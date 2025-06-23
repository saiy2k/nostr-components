import { useBlockProps } from '@wordpress/block-editor';

export default function Save({ attributes }) {
  return (
    <div {...useBlockProps.save()}>
      <script 
        type="module" 
        src="https://nostr-components.web.app/dist/nostr-post.js" 
        data-id={attributes.id}
        async
      ></script>
      <nostr-post id={attributes.npub}></nostr-post>
    </div>
  );
}