// SPDX-License-Identifier: MIT

import NDK, {
  NDKKind,
  NDKUser,
  NDKUserProfile,
  NDKEvent,
} from '@nostr-dev-kit/ndk';
import { DEFAULT_RELAYS } from './constants';
import { DEFAULT_PROFILE_IMAGE } from './constants';

export class NostrService {

  private static instance: NostrService;
  private ndk: NDK;
  private isConnected: boolean = false;

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
    // Identify new relays that were not part of the original set
    const newRelays = relays.filter(r => !this.getRelays().includes(r));

    // If already connected, add only the delta – keep signer & subscriptions intact
    if (this.isConnected && newRelays.length) {
      newRelays.forEach(url => this.ndk.addExplicitRelay(url));
      return;
    }

    // First-time connection or reconnect after explicit close
    this.ndk.explicitRelayUrls = relays;
    await this.ndk.connect();
    this.isConnected = true;
  }

  public getRelays(): string[] {
    return this.ndk.explicitRelayUrls || DEFAULT_RELAYS;
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

  public async getProfile(user: NDKUser | null): Promise<NDKUserProfile | null> {
    if (!user) return null;
  
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
      // console.log('Fetching zaps for user:', user.npub);
      const events = await this.ndk.fetchEvents({
        kinds: [9735], // Zap receipt
        '#p': [user.pubkey],
        limit: 1000,
      });
      const count = events.size;
      // console.log('Zaps count:', count);
      return count;
    } catch (error) {
      // console.warn('Error fetching zaps:', error);
      return 0;
    }
  }


  public getNDK(): NDK {
    return this.ndk;
  }

  /**
   * Check if a Nostr signer is available
   * @returns boolean indicating if a signer is available
   */
  public hasSigner(): boolean {
    // Check for NIP-07 browser extension
    if (typeof window !== 'undefined' && (window as any).nostr) {
      return true;
    }
    
    // Check for stored private key
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined' && localStorage.getItem("nostr_nsec")) {
      return true;
    }
    
    // Check if NDK already has a signer
    return !!this.ndk.signer;
  }
}
