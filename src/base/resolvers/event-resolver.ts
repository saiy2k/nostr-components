// SPDX-License-Identifier: MIT

import { NDKEvent } from '@nostr-dev-kit/ndk';
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

  async resolveEvent({ hex, noteid, eventid }: { hex?: string | null; noteid?: string | null; eventid?: string | null }): Promise<NDKEvent> {
    const event = await this.nostrService.resolveNDKEvent({ hex, noteid, eventid });
    if (!event) throw new Error("Unable to resolve event from provided identifier");

    return event;
  }
}
