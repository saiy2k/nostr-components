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
      // If it's not bech32, assume it's already hex
      return identifier;
    }
  }

  async resolveEvent({ hex, noteid, eventid }: { hex?: string | null; noteid?: string | null; eventid?: string | null }): Promise<NDKEvent> {
    // Normalize all identifiers to hex format
    let normalizedHex: string | null = null;
    
    if (hex) {
      normalizedHex = hex;
    } else if (noteid) {
      normalizedHex = this.normalizeToHex(noteid);
    } else if (eventid) {
      normalizedHex = this.normalizeToHex(eventid);
    }
    
    if (!normalizedHex) {
      throw new Error("Unable to normalize identifier to hex format");
    }
    
    const event = await this.nostrService.resolveNDKEvent({ hex: normalizedHex });
    if (!event) throw new Error("Unable to resolve event from provided identifier");

    return event;
  }
}
