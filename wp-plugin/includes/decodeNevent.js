import { nip19 } from 'nostr-tools';

/**
 * Decode a NIP-19 nevent string and convert the event ID to note1 format.
 * @param {string} input - A nevent string like 'nevent1...'
 * @returns {{
 *   type: string,
 *   id?: string,
 *   note?: string,
 *   pubkey?: string,
 *   relays?: string[],
 *   error?: string
 * }}
 */
export function decodeNevent(input) {
  try {
    const decoded = nip19.decode(input);

    if (decoded.type === 'nevent') {
      const eventId = decoded.data.id;

      // Convert event ID to `note1...` format
      const note = nip19.noteEncode(eventId);

      return {
        type: 'nevent',
        id: eventId,
        note,
        pubkey: decoded.data.pubkey,
        relays: decoded.data.relays || [],
      };
    }

    return {
      type: decoded.type,
      error: 'Provided input is not a nevent.',
    };
  } catch (err) {
    return {
      type: 'invalid',
      error: err.message || 'Invalid NIP-19 string.',
    };
  }
}
