// SPDX-License-Identifier: MIT

import NDK, {
  NDKKind,
  NDKUser,
  NDKUserProfile,
  NDKEvent,
  NDKRelayStatus,
  profileFromEvent,
} from '@nostr-dev-kit/ndk';
import { DEFAULT_RELAYS } from './constants';
import { DEFAULT_PROFILE_IMAGE } from './constants';
import { normalizeURL } from 'nostr-tools/utils';
import {
  getProfileMetadata,
  getZapProviderInfo,
} from '../nostr-zap-button/zap-utils';
import { validateZapReceipt } from '../nostr-zap-button/zap-receipt';
import { getRelayTransport } from './relay-transport';

/** How long to keep polling the relay pool for a first connection. */
const CONNECT_GRACE_MS = 5000;
const CONNECT_POLL_INTERVAL_MS = 250;

// TODO: Is this class doing too much work? Time to split into smaller services?
export class NostrService {

  private static instance: NostrService;
  private ndk: NDK;
  private isConnected: boolean = false;
  private connectPromise: Promise<void> | null = null;

  private constructor() {
    this.ndk = new NDK();
  }

  public static getInstance(): NostrService {
    if (!NostrService.instance) {
      NostrService.instance = new NostrService();
    }
    return NostrService.instance;
  }

  public async connectToNostr(
    relays: string[] = [...DEFAULT_RELAYS]
  ): Promise<void> {
    if (this.isConnected) {
      // addNewRelays appends to the pool without touching existing
      // connections. Never reassign ndk.explicitRelayUrls here: its setter
      // clears the whole pool and drops every open socket.
      this.addNewRelays(relays);
      return;
    }

    if (this.connectPromise) {
      // A connection attempt is already in flight (multiple components mount
      // concurrently on page load). Piggyback on it instead of restarting the
      // pool, then register any relays the first caller didn't know about.
      await this.connectPromise;
      this.addNewRelays(relays);
      return;
    }

    this.connectPromise = this.establishConnection(relays);
    try {
      await this.connectPromise;
      this.isConnected = true;
    } finally {
      // On failure, clear so a later attempt (e.g. component retry) can run.
      this.connectPromise = null;
    }
  }

  /**
   * Adds relays that aren't already in the pool. NDK normalizes relay URLs
   * (trailing slash), so compare normalized forms to avoid re-adding the
   * same relay under a different spelling.
   */
  private addNewRelays(relays: string[]): void {
    const knownRelays = new Set(this.getRelays().map(r => normalizeURL(r)));
    for (const url of relays) {
      const normalized = normalizeURL(url);
      if (!knownRelays.has(normalized)) {
        this.ndk.addExplicitRelay(url);
        knownRelays.add(normalized);
      }
    }
  }

  private async establishConnection(relays: string[]): Promise<void> {
    this.ndk.explicitRelayUrls = relays;

    try {
      await this.ndk.connect(3000);
    } catch (error) {
      console.warn('[NostrService] ndk.connect() threw an error (unexpected):', error);
    }

    // ndk.connect() can resolve before any socket is actually open, so poll
    // the pool until at least one relay is connected or the grace period ends.
    const deadline = Date.now() + CONNECT_GRACE_MS;
    let connectedRelays = this.getConnectedRelays();
    while (connectedRelays.length === 0 && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, CONNECT_POLL_INTERVAL_MS));
      connectedRelays = this.getConnectedRelays();
    }

    const normalizedInputRelays = relays.map(r => normalizeURL(r));
    const failedRelays = normalizedInputRelays.filter(r => !connectedRelays.includes(r));

    if (connectedRelays.length === 0) {
      const error = new Error(`Failed to connect to any of ${relays.length} relay(s): ${relays.join(', ')}`);
      console.error('[NostrService]', error.message);
      throw error;
    } else if (failedRelays.length > 0) {
      console.warn(
        `[NostrService] Connected to ${connectedRelays.length}/${relays.length} relay(s). ` +
        `Working: ${connectedRelays.join(', ')}. ` +
        `Failed: ${failedRelays.join(', ')}`
      );
    }
  }

  /**
   * Get list of relay URLs that are currently connected
   * @returns Array of normalized connected relay URLs (without trailing slashes)
   */
  private getConnectedRelays(): string[] {
    const connected: string[] = [];
    
    try {
      if (this.ndk.pool && this.ndk.pool.relays) {
        for (const [url, relay] of this.ndk.pool.relays.entries()) {
          if (relay && relay.status >= NDKRelayStatus.CONNECTED) {
            connected.push(normalizeURL(url));
          }
        }
      } else {
        console.warn('[NostrService] NDK pool or relays map not available');
      }
    } catch (error) {
      console.warn('[NostrService] Could not check relay connection status:', error);
    }
    
    return connected;
  }

  public getRelays(): string[] {
    const explicitRelays = this.ndk.explicitRelayUrls;
    return explicitRelays && explicitRelays.length > 0
      ? explicitRelays
      : [...DEFAULT_RELAYS];
  }

  public async resolveNDKUser(identifier: {
    npub?: string | null;
    nip05?: string | null;
    pubkey?: string | null;
  }): Promise<NDKUser | null> {
    if (identifier.npub) {
      return this.ndk.getUser({ npub: identifier.npub });
    } else if (identifier.nip05) {
      const user = await this.ndk.getUserFromNip05(identifier.nip05);
      return user ?? null;
    } else if (identifier.pubkey) {
      return this.ndk.getUser({ pubkey: identifier.pubkey });
    }
  
    return null;
  }

  public async resolveNDKEvent(identifier: {
    hex?: string | null;
  }): Promise<NDKEvent | null> {
    if (identifier.hex) {
      return this.ndk.fetchEvent(identifier.hex);
    }
  
    return null;
  }

  /**
   * Convenience helper to fetch zap count for a profile.
   * It determines the user based on the provided identifier and
   * returns the number of zap receipts found (count, **not** total sats).
   */
  public async getZapCount(identifier: {
    npub?: string;
    nip05?: string;
    pubkey?: string;
  }): Promise<number> {
    const user = await this.resolveNDKUser(identifier);
    return user ? this.fetchZaps(user) : 0;
  }

  public async getProfile(
    user: NDKUser | null,
    relays: string[] = this.getRelays(),
  ): Promise<NDKUserProfile | null> {
    if (!user) return null;

    const transport = getRelayTransport();
    if (transport) {
      const event = await getProfileMetadata(user.pubkey, relays);
      if (!event) return null;
      try {
        const profile = profileFromEvent(new NDKEvent(this.ndk, event));
        if (profile.picture === undefined || profile.picture === null) {
          profile.picture = DEFAULT_PROFILE_IMAGE;
        }
        return profile;
      } catch {
        return null;
      }
    }

    await user.fetchProfile();

    const profile = user.profile;

    if (profile && (profile.picture === undefined || profile.picture === null)) {
      profile.picture = DEFAULT_PROFILE_IMAGE;
    }

    return profile as NDKUserProfile;
  }

  public async getPost(eventId: string): Promise<NDKEvent | null> {
    const event = await this.ndk.fetchEvent(eventId);
    if (!event) return null;

    // Fetch referenced events (like videos)
    const referencedEvents = event.getMatchingTags('e');
    if (referencedEvents.length > 0) {
      const referencedEventIds = referencedEvents.map(tag => tag[1]);
      await this.ndk.fetchEvents({
        ids: referencedEventIds,
      });
    }

    // Fetch video attachments
    const videoTags = event.getMatchingTags('a');
    for (const tag of videoTags) {
      const mimeType = tag[1] as string;
      const url = tag[2] as string;
      if (mimeType?.startsWith('video/') && url) {
        // Add the video URL to the event's content
        event.content = event.content + `\n${url}`;
      }
    }

    return event;
  }

  public async fetchFollows(user: NDKUser): Promise<number> {
    try {
      // console.log('Fetching follows for user:', user.npub);
      const follows = await user.followSet();
      const count = follows.size;
      // console.log('Follows count:', count);
      return count;
    } catch (error) {
      // console.warn('Error fetching follows:', error);
      return 0;
    }
  }

  public async fetchFollowers(user: NDKUser): Promise<number> {
    try {
      // console.log('Fetching followers for user:', user.npub);
      const events = await this.ndk.fetchEvents({
        kinds: [NDKKind.Contacts],
        '#p': [user.pubkey],
      });

      const authors = new Set<string>();
      events.forEach((e) => authors.add(e.pubkey));
      const count = authors.size;
      // console.log('Followers count:', count);
      return count;
    } catch (error) {
      // console.warn('Error fetching followers:', error);
      return 0;
    }
  }

  public async fetchNotesAndReplies(user: NDKUser): Promise<[number, number]> {
    try {
      // console.log('Fetching notes and replies for user:', user.npub);
      const events = await this.ndk.fetchEvents({
        kinds: [NDKKind.Text],
        authors: [user.pubkey],
        limit: 1000,
      });

      let replies = 0;
      let notesCount = 0;

      events.forEach(event => {
        if (event) {
          // Check if this is a reply (has 'e' tag that's not a mention)
          const isReply = event.tags.some(
            (tag: string[]) => tag[0] === 'e' && tag[3] !== 'mention'
          );
          if (isReply) {
            replies++;
          }
          notesCount++;
        }
      });

      const repliesFinal = replies;
      const notesFinal = Math.max(0, notesCount - replies);
      // console.log('Notes:', notesFinal, 'Replies:', repliesFinal);

      return [notesFinal, repliesFinal];
    } catch (error) {
      // console.warn('Error fetching notes and replies:', error);
      return [0, 0];
    }

  }

  public async fetchZaps(user: NDKUser): Promise<number> {
    try {
      const profileEvent = await this.ndk.fetchEvent({
        kinds: [0],
        authors: [user.pubkey],
      });
      if (!profileEvent) return 0;

      const provider = await getZapProviderInfo(profileEvent.rawEvent());
      if (!provider) return 0;

      const events = await this.ndk.fetchEvents({
        kinds: [9735], // Zap receipt
        '#p': [user.pubkey],
        limit: 1000,
      });

      let count = 0;
      for (const event of events) {
        const validated = validateZapReceipt(event.rawEvent(), {
          recipientPubkey: user.pubkey,
          provider,
        });
        if (validated.ok) count++;
      }
      return count;
    } catch (error) {
      return 0;
    }
  }


  public getNDK(): NDK {
    return this.ndk;
  }

  /**
   * Check if a Nostr signer is available (NIP-07 / NDK signer only — never localStorage keys).
   * @returns boolean indicating if a signer is available
   */
  public hasSigner(): boolean {
    if (typeof window !== 'undefined' && (window as any).nostr) {
      return true;
    }

    return !!this.ndk.signer;
  }
}
