import NDK, {
  NDKKind,
  NDKUser,
  NDKUserProfile,
  NDKEvent,
} from '@nostr-dev-kit/ndk';
import { DEFAULT_RELAYS } from './constants';

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
    relays: string[] = DEFAULT_RELAYS
  ): Promise<void> {
    // Identify new relays that were not part of the original set
    const newRelays = relays.filter(r => !this.getRelays().includes(r));

    // If already connected, add only the delta – keep signer & subscriptions intact
    if (this.isConnected && newRelays.length) {
      // Prefer the public helper if available in the installed ndk version
      if (typeof (this.ndk as any).addExplicitRelay === 'function') {
        newRelays.forEach(url => (this.ndk as any).addExplicitRelay(url));
      } else {
        // Fallback: update pool directly
        newRelays.forEach(url => (this.ndk.pool as any)?.addRelay?.(url));
      }
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

  public async getProfile(identifier: {
    npub?: string;
    nip05?: string;
    pubkey?: string;
  }): Promise<NDKUserProfile | null> {
    let user: NDKUser | null = null;

    if (identifier.npub) {
      user = this.ndk.getUser({ npub: identifier.npub });
    } else if (identifier.nip05) {
      const nip05User = await this.ndk.getUserFromNip05(identifier.nip05);
      if (nip05User) {
        user = nip05User;
      }
    } else if (identifier.pubkey) {
      user = this.ndk.getUser({ pubkey: identifier.pubkey });
    }

    if (user) {
      await user.fetchProfile();
      return user.profile as NDKUserProfile;
    }

    return null;
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

  public async getProfileStats(
    user: NDKUser,
    statsToFetch?: Array<
      'follows' | 'followers' | 'notes' | 'replies' | 'zaps' | 'relays'
    >
  ): Promise<{
    follows: number;
    followers: number;
    notes: number;
    replies: number;
    zaps: number;
    relays: number;
  }> {
    // Initialize stats object with all values set to 0
    const stats = {
      follows: 0,
      followers: 0,
      notes: 0,
      replies: 0,
      zaps: 0,
      relays: 0,
    };

    // If no specific stats are requested, fetch all
    const fetchAll = !statsToFetch || statsToFetch.length === 0;
    const shouldFetch = (stat: string) =>
      fetchAll || statsToFetch?.includes(stat as any);

    try {
      // Ensure we're connected to relays
      if (!this.isConnected) {
        await this.connectToNostr();
      }

      // 1. Get follows count
      if (shouldFetch('follows')) {
        try {
          console.log('Fetching follows for user:', user.npub);
          const follows = await user.follows();
          // Force a fetch of all follows to ensure we have the latest count
          const followsArray = Array.from(follows.values());
          stats.follows = followsArray.length;
          console.log('Follows count:', stats.follows);
        } catch (error) {
          console.warn('Error fetching follows:', error);
        }
      }

      // 2. Get followers (people following the user)
      if (shouldFetch('followers')) {
        try {
          console.log('Fetching followers for user:', user.npub);
          const events = await this.ndk.fetchEvents({
            kinds: [NDKKind.Contacts],
            '#p': [user.pubkey],
          });

          // Convert Set to array and filter out any undefined values
          const eventsArray = Array.from(events).filter(Boolean);
          stats.followers = eventsArray.length;
          console.log('Followers count:', stats.followers);
        } catch (error) {
          console.warn('Error fetching followers:', error);
        }
      }

      // 3. Get notes and replies
      if (shouldFetch('notes') || shouldFetch('replies')) {
        try {
          console.log('Fetching notes and replies for user:', user.npub);
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

          stats.replies = replies;
          stats.notes = Math.max(0, notesCount - replies);
          console.log('Notes:', stats.notes, 'Replies:', stats.replies);
        } catch (error) {
          console.warn('Error fetching notes and replies:', error);
        }
      }

      // 4. Get zaps count (NIP-57)
      if (shouldFetch('zaps')) {
        try {
          console.log('Fetching zaps for user:', user.npub);
          const events = await this.ndk.fetchEvents({
            kinds: [9735], // Zap receipt
            '#p': [user.pubkey],
            limit: 1000,
          });
          stats.zaps = Array.from(events).filter(Boolean).length;
          console.log('Zaps count:', stats.zaps);
        } catch (error) {
          console.warn('Error fetching zaps:', error);
        }
      }

      // 5. Skip relays count for now as it's not critical
      stats.relays = 0;

      // Log final stats
      console.log('Final stats:', stats);

      // Return only the requested stats
      if (fetchAll) {
        return stats;
      }

      // Filter and return only the requested stats
      const result: any = {};
      if (statsToFetch?.includes('follows')) result.follows = stats.follows;
      if (statsToFetch?.includes('followers'))
        result.followers = stats.followers;
      if (statsToFetch?.includes('notes')) result.notes = stats.notes;
      if (statsToFetch?.includes('replies')) result.replies = stats.replies;
      if (statsToFetch?.includes('zaps')) result.zaps = stats.zaps;
      if (statsToFetch?.includes('relays')) result.relays = stats.relays;

      // Ensure all requested stats are in the result, even if they're 0
      return {
        follows: result.follows ?? 0,
        followers: result.followers ?? 0,
        notes: result.notes ?? 0,
        replies: result.replies ?? 0,
        zaps: result.zaps ?? 0,
        relays: result.relays ?? 0,
      };
    } catch (error) {
      console.error('Error in getProfileStats:', error);
      // Return a properly structured stats object with zeros for all fields
      return {
        follows: 0,
        followers: 0,
        notes: 0,
        replies: 0,
        zaps: 0,
        relays: 0,
      };
    }
  }

  public getNDK(): NDK {
    return this.ndk;
  }

  /** Check if window.nostr (NIP-07) or stored nsec is available */
  public hasSigner(): boolean {
    if ((window as any).nostr) return true;
    return !!localStorage.getItem('nostr_nsec');
  }
}
