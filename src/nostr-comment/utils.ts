import { NDKEvent } from '@nostr-dev-kit/ndk';

export interface CommentEvent {
    id: string;
    pubkey: string;
    content: string;
    created_at: number;
    tags: string[][];
    sig: string;
}

export interface ParsedComment {
    id: string;
    pubkey: string;
    content: string;
    created_at: number;
    replyTo?: string;
    rootUrl?: string;
}

/**
 * Normalize URL for consistent comment identification
 */
export function normalizeURL(raw: string): string {
    try {
        const url = new URL(raw);
        return (
            url.origin
                .replace('://m.', '://') // remove known 'mobile' subdomains
                .replace('://mobile.', '://')
                .replace('http://', 'https://') // default everything to https
                .replace(
                    /:\d+/,
                    // remove 443 and 80 ports
                    port => (port === ':443' || port === ':80' ? '' : port)
                ) +
            url.pathname
                .replace(/\/+/g, '/') // remove duplicated slashes in the middle of the path
                .replace(/\/*$/, '') // remove slashes from the end of path
        );
    } catch (error) {
        console.error('Invalid URL:', raw);
        return raw;
    }
}

/**
 * Parse Nostr event into comment structure
 */
export function parseCommentEvent(event: NDKEvent): ParsedComment | null {
    if (!event.id || !event.pubkey || !event.content || !event.created_at) {
        return null;
    }

    const comment: ParsedComment = {
        id: event.id,
        pubkey: event.pubkey,
        content: event.content,
        created_at: event.created_at
    };

    // Parse tags to find references
    for (const tag of event.tags || []) {
        if (tag[0] === 'r' && tag[1]) {
            comment.rootUrl = tag[1];
        } else if (tag[0] === 'e' && tag[1]) {
            comment.replyTo = tag[1];
        }
    }

    return comment;
}

/**
 * Create a comment event for publishing
 */
export function createCommentEvent(
    content: string,
    pubkey: string,
    url: string,
    replyTo?: string
): Omit<CommentEvent, 'id' | 'sig'> {
    const tags: string[][] = [
        ['r', url], // URL reference
        ['client', 'nostr-components']
    ];

    if (replyTo) {
        tags.push(['e', replyTo, '', 'reply']);
    }

    return {
        pubkey,
        content: content.trim(),
        created_at: Math.floor(Date.now() / 1000),
        tags
    };
}

/**
 * Validate if a string is a valid Nostr public key
 */
export function isValidPublicKey(pubkey: string): boolean {
    return /^[a-f0-9]{64}$/.test(pubkey);
}

/**
 * Validate if a string is a valid Nostr event ID
 */
export function isValidEventId(eventId: string): boolean {
    return /^[a-f0-9]{64}$/.test(eventId);
}

/**
 * Truncate public key for display
 */
export function truncatePublicKey(pubkey: string, length: number = 8): string {
    if (pubkey.length <= length * 2) return pubkey;
    return `${pubkey.slice(0, length)}...${pubkey.slice(-length)}`;
}

/**
 * Format timestamp to relative time
 */
export function formatRelativeTime(timestamp: number): string {
    const now = Date.now() / 1000;
    const diff = now - timestamp;

    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;

    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString();
}

/**
 * Sanitize HTML content to prevent XSS
 */
export function sanitizeContent(content: string): string {
    return content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Parse URLs in content and make them clickable
 */
export function linkifyContent(content: string): string {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return sanitizeContent(content).replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
}

/**
 * Generate a simple hash for content deduplication
 */
export function hashContent(content: string, pubkey: string): string {
    const combined = content + pubkey;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
        const char = combined.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
}

/**
 * Check if user has a Nostr extension (NIP-07)
 */
export function hasNostrExtension(): boolean {
    return typeof (window as any).nostr !== 'undefined';
}

/**
 * Get stored private key from localStorage
 */
export function getStoredPrivateKey(): string | null {
    try {
        const key = localStorage.getItem('nostr-comment-private-key');
        if (key && isValidPrivateKey(key)) {
            return key;
        }
    } catch (error) {
        console.warn('Failed to access localStorage:', error);
    }
    return null;
}

/**
 * Store private key in localStorage
 */
export function storePrivateKey(privateKey: string): boolean {
    try {
        if (isValidPrivateKey(privateKey)) {
            localStorage.setItem('nostr-comment-private-key', privateKey);
            return true;
        }
    } catch (error) {
        console.warn('Failed to store private key:', error);
    }
    return false;
}

/**
 * Validate if a string is a valid private key
 */
export function isValidPrivateKey(privateKey: string): boolean {
    return /^[a-f0-9]{64}$/.test(privateKey);
}

/**
 * Clear stored private key (for logout functionality)
 */
export function clearStoredPrivateKey(): void {
    try {
        localStorage.removeItem('nostr-comment-private-key');
    } catch (error) {
        console.warn('Failed to clear stored private key:', error);
    }
}

/**
 * Debounce function for rate limiting
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}
