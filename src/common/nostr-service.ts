import NDK, { NDKKind, NDKUser, NDKUserProfile, NDKEvent } from '@nostr-dev-kit/ndk';
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

    public async connectToNostr(relays: string[] = DEFAULT_RELAYS): Promise<void> {
        if (!this.isConnected) {
            this.ndk.explicitRelayUrls = relays;
            await this.ndk.connect();
            this.isConnected = true;
        }
    }

    public getRelays(): string[] {
        return this.ndk.explicitRelayUrls || DEFAULT_RELAYS;
    }

    public async getProfile(identifier: { npub?: string; nip05?: string; pubkey?: string }): Promise<NDKUserProfile | null> {
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
                ids: referencedEventIds
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

    public async getProfileStats(user: NDKUser): Promise<{
        follows: number;
        followers: number;
        notes: number;
        replies: number;
        zaps: number;
        relays: number;
    }> {
        const stats = {
            follows: 0,
            followers: 0,
            notes: 0,
            replies: 0,
            zaps: 0,
            relays: 0,
        };

        try {
            // Get follows
            const follows = await user.follows();
            stats.follows = follows.size;

            // Get followers
            const followers = await this.ndk.fetchEvents({
                kinds: [NDKKind.Contacts],
                '#p': [user.pubkey],
            });
            stats.followers = followers.size;

            // Get notes and replies
            const notes = await this.ndk.fetchEvents({
                kinds: [NDKKind.Text],
                authors: [user.pubkey],
            });

            let replies = 0;
            notes.forEach(note => {
                if (note.hasTag('e')) {
                    replies += 1;
                }
            });
            stats.replies = replies;
            stats.notes = notes.size - replies;

            // TODO: Implement zaps and relays counting
            stats.zaps = 0;
            stats.relays = 0;

            return stats;
        } catch (error) {
            console.error('Error fetching profile stats:', error);
            throw error;
        }
    }

    public getNDK(): NDK {
        return this.ndk;
    }
} 