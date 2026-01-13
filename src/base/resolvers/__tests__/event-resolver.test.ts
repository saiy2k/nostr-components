// SPDX-License-Identifier: MIT

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';
import { EventResolver } from '../event-resolver';
import { NostrService } from '../../../common/nostr-service';

describe('EventResolver - validateNaddr', () => {
  let resolver: EventResolver;
  let mockNostrService: any;

  beforeEach(() => {
    mockNostrService = {
      getNDK: vi.fn(() => ({
        fetchEvents: vi.fn(),
      })),
    };
    resolver = new EventResolver(mockNostrService as unknown as NostrService);
  });

  it('should return null for valid naddr', () => {
    const validNaddr = 'naddr1qqjxxwp3xymrwdek95cxxv3h956rvdmz943rvvfh94sngef5x4jkxe3nvf3nxqg4waehxw309aex2mrp0yhxgctdw4eju6t09upzpn6956apxcad0mfp8grcuugdysg44eepex68h50t73zcathmfs49qvzqqqrkvu7k4zz2';

    const result = resolver.validateNaddr({ naddr: validNaddr });
    expect(result).toBeNull();
  });

  it('should return error for missing naddr', () => {
    const result = resolver.validateNaddr({ naddr: null });
    expect(result).toBe("Provide naddr attribute");

    const result2 = resolver.validateNaddr({ naddr: undefined });
    expect(result2).toBe("Provide naddr attribute");

    const result3 = resolver.validateNaddr({ naddr: '' });
    expect(result3).toBe("Provide naddr attribute");

    const result4 = resolver.validateNaddr({ naddr: '   ' });
    expect(result4).toBe("Provide naddr attribute");
  });

  it('should return error for invalid format (does not start with naddr1)', () => {
    const invalidNaddr = 'note1qqsrhuxx8l9ex335q7he0f09aej04zpazpl0ne2crukmm9a9a0w8a4jrqygq';
    
    const result = resolver.validateNaddr({ naddr: invalidNaddr });
    
    expect(result).toBe("Invalid naddr format");
  });

  it('should return error for decode failure', () => {
    // Use an invalid naddr1 string - real decode will throw
    const invalidNaddr = 'naddr1invalidbech32string';

    const result = resolver.validateNaddr({ naddr: invalidNaddr });
    
    expect(result).toBe("Invalid naddr format: decoding failed");
  });
});

describe('EventResolver - resolveAddressableEvent', () => {
  let resolver: EventResolver;
  let mockNostrService: any;
  let mockNDK: any;
  let mockFetchEvents: any;

  beforeEach(() => {
    mockFetchEvents = vi.fn();
    mockNDK = {
      fetchEvents: mockFetchEvents,
    };
    mockNostrService = {
      getNDK: vi.fn(() => mockNDK),
    };
    
    resolver = new EventResolver(mockNostrService as unknown as NostrService);
  });

  it('should resolve addressable event successfully', async () => {
    const validNaddr = 'naddr1qqjrqvfevgurzeps956rvcfs95mn2cmp95urzdpe956rjd338yunsve3vdjrgqgwwaehxw309ahx7uewd3hkctczyrt8hwqfm33fqvryz4v9lywftgax3n3x3w9vdx04syyr3xya8pskvqcyqqq8vecaj5ryr';
    
    const decoded = nip19.decode(validNaddr);
    expect(decoded.type).toBe('naddr');
    const { kind, pubkey, identifier } = decoded.data as { kind: number; pubkey: string; identifier: string };

    const mockEvent = {
      id: 'event-id-123',
      kind: kind,
      pubkey: pubkey,
      created_at: 1699123456,
      tags: [['d', identifier]],
      content: '',
      sig: '',
    } as unknown as NDKEvent;

    const mockEventsSet = new Set([mockEvent]);
    mockFetchEvents.mockResolvedValue(mockEventsSet);

    const result = await resolver.resolveAddressableEvent({ naddr: validNaddr });

    expect(result).toBe(mockEvent);
    expect(mockNostrService.getNDK).toHaveBeenCalled();
    expect(mockFetchEvents).toHaveBeenCalledWith({
      kinds: [kind],
      authors: [pubkey],
      '#d': [identifier],
    });
  });

  it('should throw error for invalid naddr format', async () => {
    const invalidNaddr = 'not-an-naddr';

    await expect(resolver.resolveAddressableEvent({ naddr: invalidNaddr }))
      .rejects.toThrow("Invalid naddr format");
    
    expect(mockFetchEvents).not.toHaveBeenCalled();
  });

  it('should throw error when no events found', async () => {
    // TODO: Replace with a real valid naddr
    const validNaddr = 'naddr1qqjrqvfevgurzeps956rvcfs95mn2cmp95urzdpe956rjd338yunsve3vdjrgqgwwaehxw309ahx7uewd3hkctczyrt8hwqfm33fqvryz4v9lywftgax3n3x3w9vdx04syyr3xya8pskvqcyqqq8vecaj5ryr';

    mockFetchEvents.mockResolvedValue(new Set()); // Empty set

    await expect(resolver.resolveAddressableEvent({ naddr: validNaddr }))
      .rejects.toThrow("Addressable event not found");
  });

  it('should return latest event when multiple events exist', async () => {
    // TODO: Replace with a real valid naddr
    const validNaddr = 'naddr1qqjrqvfevgurzeps956rvcfs95mn2cmp95urzdpe956rjd338yunsve3vdjrgqgwwaehxw309ahx7uewd3hkctczyrt8hwqfm33fqvryz4v9lywftgax3n3x3w9vdx04syyr3xya8pskvqcyqqq8vecaj5ryr';

    const olderEvent = {
      id: 'event-1',
      created_at: 1699123456, // Older
    } as unknown as NDKEvent;

    const newerEvent = {
      id: 'event-2',
      created_at: 1699127056, // Newer - should be returned
    } as unknown as NDKEvent;

    const mockEventsSet = new Set([olderEvent, newerEvent]);
    mockFetchEvents.mockResolvedValue(mockEventsSet);

    const result = await resolver.resolveAddressableEvent({ naddr: validNaddr });

    expect(result).toBe(newerEvent);
    expect(result.id).toBe('event-2');
  });
});

describe('EventResolver - validateInputs', () => {
  let resolver: EventResolver;
  let mockNostrService: any;

  beforeEach(() => {
    mockNostrService = {
      getNDK: vi.fn(),
      resolveNDKEvent: vi.fn(),
    };
    resolver = new EventResolver(mockNostrService as unknown as NostrService);
  });

  it('should return error when no identifiers provided', () => {
    const result = resolver.validateInputs({ hex: null, noteid: null, eventid: null });
    expect(result).toBe("Provide hex, noteid, or eventid attribute");
  });

  it('should return null for valid hex', () => {
    const validHex = 'a'.repeat(64); // 64 character hex string
    
    const result = resolver.validateInputs({ hex: validHex, noteid: null, eventid: null });
    
    expect(result).toBeNull();
  });

  it('should return error for invalid hex', () => {
    const invalidHex = 'invalid-hex'; // Not 64 chars or not hex
    
    const result = resolver.validateInputs({ hex: invalidHex, noteid: null, eventid: null });
    
    expect(result).toBe(`Invalid hex: ${invalidHex}`);
  });

  it('should return error for hex with wrong length', () => {
    const shortHex = 'abc'; // Too short
    
    const result = resolver.validateInputs({ hex: shortHex, noteid: null, eventid: null });
    
    expect(result).toBe(`Invalid hex: ${shortHex}`);
  });

  it('should return null for valid noteid', () => {
    const validNoteId = 'note13qzmyaseurn0n7tlfvax62ymdssac55ls99qu6053l0e2mtsy9nqp8c4nc';
    
    const result = resolver.validateInputs({ hex: null, noteid: validNoteId, eventid: null });
    
    expect(result).toBeNull();
  });

  it('should return error for invalid noteid', () => {
    const invalidNoteId = 'invalid-noteid';
    
    const result = resolver.validateInputs({ hex: null, noteid: invalidNoteId, eventid: null });
    
    expect(result).toBe(`Invalid noteid: ${invalidNoteId}`);
  });

  it('should return error for noteid with wrong type', () => {
    const wrongTypeId = 'npub1excellx58e497gan6fcsdnseujkjm7ym5yp3m4rp0ud4j8ss39js2pn72a';
    
    const result = resolver.validateInputs({ hex: null, noteid: wrongTypeId, eventid: null });
    
    expect(result).toBe(`Invalid noteid: ${wrongTypeId}`);
  });

  it('should return null for valid eventid', () => {
    const validEventId = 'nevent1qqstyhryvag0zukl62zw986zd23td45ya0fl8jtfu29uvpqry6jwj3c76k2cu';
    
    const result = resolver.validateInputs({ hex: null, noteid: null, eventid: validEventId });
    
    expect(result).toBeNull();
  });

  it('should return error for invalid eventid', () => {
    const invalidEventId = 'invalid-eventid';
    
    const result = resolver.validateInputs({ hex: null, noteid: null, eventid: invalidEventId });
    
    expect(result).toBe(`Invalid eventid: ${invalidEventId}`);
  });

  it('should return error for eventid with wrong type', () => {
    const wrongTypeId = 'note13qzmyaseurn0n7tlfvax62ymdssac55ls99qu6053l0e2mtsy9nqp8c4nc';
    
    const result = resolver.validateInputs({ hex: null, noteid: null, eventid: wrongTypeId });
    
    expect(result).toBe(`Invalid eventid: ${wrongTypeId}`);
  });

  it('should validate all provided identifiers', () => {
    const validHex = 'a'.repeat(64);
    const validNoteId = 'note13qzmyaseurn0n7tlfvax62ymdssac55ls99qu6053l0e2mtsy9nqp8c4nc';
    
    const result = resolver.validateInputs({
      hex: validHex,
      noteid: validNoteId,
      eventid: null,
    });
    
    expect(result).toBeNull();
  });

  it('should return first validation error found', () => {
    const validHex = 'a'.repeat(64);
    const invalidNoteId = 'invalid-noteid';
    
    const result = resolver.validateInputs({
      hex: validHex,
      noteid: invalidNoteId,
      eventid: null,
    });
    
    expect(result).toBe('Invalid noteid: invalid-noteid');
  });
});

describe('EventResolver - resolveEvent', () => {
  let resolver: EventResolver;
  let mockNostrService: any;
  let mockResolveNDKEvent: any;

  beforeEach(() => {
    mockResolveNDKEvent = vi.fn();
    mockNostrService = {
      getNDK: vi.fn(),
      resolveNDKEvent: mockResolveNDKEvent,
    };
    
    resolver = new EventResolver(mockNostrService as unknown as NostrService);
  });

  it('should resolve event from hex', async () => {
    const validHex = 'a'.repeat(64);
    const mockEvent = {
      id: 'event-id',
      kind: 1,
      pubkey: 'pubkey',
      created_at: 1234567890,
      content: 'test',
      tags: [],
      sig: '',
    } as unknown as NDKEvent;

    mockResolveNDKEvent.mockResolvedValue(mockEvent);

    const result = await resolver.resolveEvent({ hex: validHex, noteid: null, eventid: null });

    expect(result).toBe(mockEvent);
    expect(mockResolveNDKEvent).toHaveBeenCalledWith({ hex: validHex });
  });

  it('should resolve event from noteid', async () => {
    const noteid = 'note13qzmyaseurn0n7tlfvax62ymdssac55ls99qu6053l0e2mtsy9nqp8c4nc';
    
    const decoded = nip19.decode(noteid);
    expect(decoded.type).toBe('note');
    const decodedHex = decoded.data as string;
    
    const mockEvent = {
      id: 'event-id',
      kind: 1,
      pubkey: 'pubkey',
      created_at: 1234567890,
      content: 'test',
      tags: [],
      sig: '',
    } as unknown as NDKEvent;

    mockResolveNDKEvent.mockResolvedValue(mockEvent);

    const result = await resolver.resolveEvent({ hex: null, noteid, eventid: null });

    expect(result).toBe(mockEvent);
    expect(mockResolveNDKEvent).toHaveBeenCalledWith({ hex: decodedHex });
  });

  it('should resolve event from eventid', async () => {
    const eventid = 'nevent1qqstyhryvag0zukl62zw986zd23td45ya0fl8jtfu29uvpqry6jwj3c76k2cu';
    
    // Decode the real nevent to get the event id
    const decoded = nip19.decode(eventid);
    expect(decoded.type).toBe('nevent');
    const decodedEventId = (decoded.data as { id: string }).id;
    
    const mockEvent = {
      id: 'event-id',
      kind: 1,
      pubkey: 'pubkey',
      created_at: 1234567890,
      content: 'test',
      tags: [],
      sig: '',
    } as unknown as NDKEvent;

    mockResolveNDKEvent.mockResolvedValue(mockEvent);

    const result = await resolver.resolveEvent({ hex: null, noteid: null, eventid });

    expect(result).toBe(mockEvent);
    expect(mockResolveNDKEvent).toHaveBeenCalledWith({ hex: decodedEventId });
  });

  it('should throw error when unable to normalize identifier', async () => {
    const noteid = 'npub1excellx58e497gan6fcsdnseujkjm7ym5yp3m4rp0ud4j8ss39js2pn72a';

    await expect(resolver.resolveEvent({ hex: null, noteid, eventid: null }))
      .rejects.toThrow("Unable to normalize identifier to hex format");
  });

  it('should throw error when event is not found', async () => {
    const validHex = 'a'.repeat(64);

    mockResolveNDKEvent.mockResolvedValue(null);

    await expect(resolver.resolveEvent({ hex: validHex, noteid: null, eventid: null }))
      .rejects.toThrow("Unable to resolve event from provided identifier");
  });

  it('should handle hex input directly (no decode needed)', async () => {
    const validHex = 'a'.repeat(64);
    const mockEvent = {
      id: 'event-id',
      kind: 1,
      pubkey: 'pubkey',
      created_at: 1234567890,
      content: 'test',
      tags: [],
      sig: '',
    } as unknown as NDKEvent;

    mockResolveNDKEvent.mockResolvedValue(mockEvent);

    // When hex is provided directly, no decode happens
    const result = await resolver.resolveEvent({ hex: validHex, noteid: null, eventid: null });

    expect(result).toBe(mockEvent);
    expect(mockResolveNDKEvent).toHaveBeenCalledWith({ hex: validHex });
  });
});
