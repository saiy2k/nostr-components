// SPDX-License-Identifier: MIT

import { NDKEvent } from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';
import { NostrService } from '../../common/nostr-service';
import { isValidHex, validateNoteId, validateEventId } from '../../common/utils';

export class EventResolver {
  constructor(private nostrService: NostrService) { }

  validateInputs({ hex, noteid, eventid }: { hex?: string | null; noteid?: string | null; eventid?: string | null }): string | null {
    if (!hex && !noteid && !eventid) {
      return "Provide hex, noteid, or eventid attribute";
    }
    
    if (hex && !isValidHex(hex)) return `Invalid hex: ${hex}`;
    if (noteid && !validateNoteId(noteid)) return `Invalid noteid: ${noteid}`;
    if (eventid && !validateEventId(eventid)) return `Invalid eventid: ${eventid}`;
    
    return null;
  }

  /**
   * Normalize bech32 identifiers to hex format
   */
  private normalizeToHex(identifier: string): string | null {
    try {
      const decoded = nip19.decode(identifier);
      
      if (decoded.type === 'note') {
        return decoded.data;
      } else if (decoded.type === 'nevent') {
        return decoded.data.id;
      }
      
      return null;
    } catch {
      // Not bech32; accept only if it is valid hex
      return isValidHex(identifier) ? identifier : null;
    }
  }

  async resolveEvent({ hex, noteid, eventid }: { hex?: string | null; noteid?: string | null; eventid?: string | null }): Promise<NDKEvent> {
    // Normalize all identifiers to hex format
    let normalizedHex: string | null = null;
    
    if (noteid) {
      normalizedHex = this.normalizeToHex(noteid);
    } else if (hex) {
      normalizedHex = hex;
    } else if (eventid) {
      normalizedHex = this.normalizeToHex(eventid);
    }
    
    if (!normalizedHex) {
      throw new Error("Unable to normalize identifier to hex format");
    }
    if (!isValidHex(normalizedHex)) {
      throw new Error(`Invalid hex: ${normalizedHex}`);
    }
    
    const event = await this.nostrService.resolveNDKEvent({ hex: normalizedHex });
    if (!event) throw new Error("Unable to resolve event from provided identifier");

    return event;
  }

  /**
   * Validate naddr (NIP-19 addressable event code)
   * @param naddr NIP-19 addressable event code
   * @returns Error message string if validation fails, null if valid
   */
  validateNaddr({ naddr }: { naddr?: string | null }): string | null {
    if (!naddr || naddr.trim() === '') {
      return "Provide naddr attribute";
    }

    // Validate format: must start with 'naddr1' (bech32-encoded)
    if (!naddr.startsWith('naddr1')) {
      return "Invalid naddr format";
    }

    // Attempt to decode using nip19
    try {
      const decoded = nip19.decode(naddr);
      if (decoded.type !== 'naddr') {
        return "Invalid naddr: expected naddr type";
      }
    } catch (error) {
      return "Invalid naddr format: decoding failed";
    }

    return null;
  }

  /**
   * Resolve an addressable event using naddr (NIP-19 addressable event code)
   * @param naddr NIP-19 addressable event code
   * @returns The resolved NDKEvent (latest if multiple exist)
   */
  async resolveAddressableEvent({ naddr }: { naddr: string }): Promise<NDKEvent> {
    // First validate the format
    const validationError = this.validateNaddr({ naddr });
    if (validationError) {
      throw new Error(validationError);
    }

    // Decode naddr
    const decoded = nip19.decode(naddr);
    if (decoded.type !== 'naddr') {
      throw new Error("Invalid naddr: expected naddr type");
    }

    const { kind, pubkey, identifier: dTag } = decoded.data;

    // Query for the addressable event
    const filter = {
      kinds: [kind],
      authors: [pubkey],
      '#d': [dTag],
    };

    const events = await this.nostrService.getNDK().fetchEvents(filter);

    if (!events || events.size === 0) {
      throw new Error("Addressable event not found");
    }

    // If multiple events exist (shouldn't happen, but handle gracefully),
    // return the latest one (highest created_at)
    let latestEvent: NDKEvent | null = null;
    let latestCreatedAt = 0;

    for (const event of events) {
      if (event.created_at && event.created_at > latestCreatedAt) {
        latestCreatedAt = event.created_at;
        latestEvent = event;
      }
    }

    if (!latestEvent) {
      throw new Error("Addressable event not found");
    }

    return latestEvent;
  }
}
