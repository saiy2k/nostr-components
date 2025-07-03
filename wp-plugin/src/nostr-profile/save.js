export default function save({ attributes }) {
  return <nostr-profile pubkey={attributes.npub}></nostr-profile>;
}
