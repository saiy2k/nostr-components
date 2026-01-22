// SPDX-License-Identifier: MIT

import NDK, { NDKKind, NDKEvent } from '@nostr-dev-kit/ndk';
import { nip19 } from "nostr-tools";


import { Theme } from './types';
import { DEFAULT_RELAYS, MILLISATS_PER_SAT } from './constants';

export const decodeNpub = (npub: string): string => {
  if (typeof npub !== 'string' || !npub.startsWith('npub1')) {
    return '';
  }

  try {
    const decoded = nip19.decode(npub);
    if (decoded && typeof decoded.data === 'string') {
      return decoded.data;
    }
  } catch (error) {
    console.error('Failed to decode npub:', error);
  }
  
  return '';
};

/**
 * Convert hex pubkey to npub
 */
export function hexToNpub(hex: string): string {
  if (!hex || !isValidHex(hex)) return '';
  try {
    return nip19.npubEncode(hex.toLowerCase());
  } catch (error) {
    console.error('Failed to encode hex to npub:', error);
    return '';
  }
}

// Could be npub, note1, naddr, nsec, etc.,
export const decodeNip19Entity = (entity: string): any => {
  if (typeof entity !== 'string' || !/^[a-z0-9]+1[ac-hj-np-z02-9]+/.test(entity)) {
    return null;
  }

  try {
    const decoded = nip19.decode(entity);
    return decoded?.data ?? null;
  } catch (error) {
    console.error('Failed to decode NIP-19 entity:', error);
    return null;
  }
};

export function maskNPub(npubString: string = '', length = 3) {
  const npubLength = npubString.length;

  if (!npubString.startsWith('npub1')) {
    return 'Invalid nPub: expected npub1...';
  }

  if (!validateNpub(npubString)) {
    return 'Invalid nPub';
  }

  let result = 'npub1';

  for (let i = 5; i < length + 5; i++) {
    result += npubString[i];
  }

  result += '...';

  let suffix = '';
  for (let i = npubLength - 1; i >= npubLength - length; i--) {
    suffix = npubString[i] + suffix;
  }

  result += suffix;

  return result;
}

export type Stats = {
  likes: number;
  reposts: number;
  zaps: number;
  replies: number;
};

export async function getPostStats(ndk: NDK, postId: string): Promise<Stats> {
  const reposts = await ndk.fetchEvents({
    kinds: [NDKKind.Repost],
    '#e': [postId || ''],
  });

  const isDirectRepost = (repost: NDKEvent): boolean => {
    const pTagCounts = repost.tags.filter(tag => tag[0] === 'p').length;
    return pTagCounts === 1;
  };

  const isDirectReply = (reply: NDKEvent): boolean => {
    const eTagsCount = reply.tags.filter(tag => tag[0] === 'e').length;
    return eTagsCount === 1;
  };

  // Only take the count of direct reposts
  const repostsCount = Array.from(reposts).filter(isDirectRepost).length;

  const likes = await ndk.fetchEvents({
    kinds: [NDKKind.Reaction],
    '#e': [postId || ''],
  });

  // TODO: Add zap receipt validation - https://github.com/nostr-protocol/nips/blob/master/57.md#appendix-f-validating-zap-receipts
  // const zaps = await ndk.fetchEvents({
  //   kinds: [NDKKind.Zap],
  //   '#e': [postId || '']
  // });

  // const zapAmount = Array.from(zaps).reduce((prev, curr) => {
  //   const bolt11Tag = curr.getMatchingTags('bolt11');

  //   if(
  //     !bolt11Tag ||
  //     !Array.isArray(bolt11Tag) ||
  //     bolt11Tag.length === 0 ||
  //     !bolt11Tag[0] ||
  //     !Array.isArray(bolt11Tag[0]) ||
  //     (bolt11Tag[0] as string[]).length === 0
  //   ) {
  //     return prev;
  //   }

  //   const bolt11 = bolt11Tag[0][1];

  //   const decodedbol11 = decode(bolt11);

  //   const amountSection = decodedbol11.sections.find(section => section.name === 'amount');

  //   if(amountSection) {
  //     const millisats = Number(amountSection.value);

  //     return prev + millisats;
  //   }

  //   return prev;
  // }, 0);

  const zapAmount = 0;

  const replies = await ndk.fetchEvents({
    kinds: [NDKKind.Text],
    '#e': [postId || ''],
  });

  // Only take the direct replies
  // https://github.com/nostr-protocol/nips/blob/master/10.md#positional-e-tags-deprecated
  const replyCount = Array.from(replies).filter(isDirectReply).length;

  return {
    likes: likes.size,
    reposts: repostsCount,
    zaps: zapAmount / MILLISATS_PER_SAT,
    replies: replyCount,
  };
}

export function parseRelays(relaysAttr: string | null): string[] {
  if (relaysAttr) {
    const list = relaysAttr
      .split(',')
      .map(r => r.trim())
      .filter(Boolean)
      .filter(isValidRelayUrl);
    // fall back to defaults if user provided no valid entries
    return list.length ? Array.from(new Set(list)) : [...DEFAULT_RELAYS];
  }
  return [...DEFAULT_RELAYS];
}

export function parseTheme(themeAttr: string | null): Theme {

  const theme = themeAttr?.trim().toLowerCase();

  if (theme === 'light' || theme === 'dark') {
    return theme;
  }

  return 'light';
}

export function parseBooleanAttribute(attr: string | null): boolean {
  // Handles: "true", "", null, "false"
  if (attr === null) return false;
  if (attr === '' || attr.toLowerCase() === 'true') return true;
  return false;
}

export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function isValidRelayUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'wss:' || u.protocol === 'ws:';
  } catch {
    return false;
  }
}

export function isValidHex(hex: string): boolean {
  return /^[0-9a-fA-F]+$/.test(hex) && hex.length === 64;
}

export function validateNpub(npub: string): boolean {
  try {
    const { type } = nip19.decode(npub);
    return type === 'npub';
  } catch (e) {
    return false;
  }
}

export function validateNip05(nip05: string): boolean {
  const nip05Regex = /^[a-zA-Z0-9_\-\.]+@[a-zA-Z0-9_\-\.]+\.[a-zA-Z]{2,}$/;
  return nip05Regex.test(nip05);
}

function validateBech32OfType(input: string, expected: 'note' | 'nevent'): boolean {
  try {
    const { type } = nip19.decode(input);
    return type === expected;
  } catch {
    return false;
  }
}

export function validateNoteId(noteId: string): boolean {
  return validateBech32OfType(noteId, 'note');
}

export function validateEventId(eventId: string): boolean {
  return validateBech32OfType(eventId, 'nevent');
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text)
}

/**
 * Get the first value of a tag by tag name
 * @param tags Array of tag arrays from NDKEvent
 * @param tagName The tag name to search for (e.g., 'd', 'title')
 * @param index Index of the tag occurrence (0 for first)
 * @returns The tag value or undefined if not found
 */
export function getTagValue(tags: string[][], tagName: string, index: number = 0): string | undefined {
  const matchingTags = tags.filter(tag => tag[0] === tagName);
  if (matchingTags.length > index && matchingTags[index].length > 1) {
    return matchingTags[index][1];
  }
  return undefined;
}

/**
 * Get all values for a tag by tag name
 * @param tags Array of tag arrays from NDKEvent
 * @param tagName The tag name to search for (e.g., 't', 'relays')
 * @returns Array of all values for the tag (excluding the tag name itself)
 */
export function getTagValues(tags: string[][], tagName: string): string[] {
  return tags
    .filter(tag => tag[0] === tagName)
    .map(tag => tag.slice(1)) // Get all values after tag name
    .flat();
}

/**
 * Parse a timestamp string to a number
 * @param value String value to parse
 * @returns Unix timestamp as number, or undefined if invalid
 */
export function parseTimestamp(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Parse a number string to a number
 * @param value String value to parse
 * @returns Number or undefined if invalid
 */
export function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Format timestamp as relative time (e.g., "2 mins ago", "1 month ago")
 * @param ts Timestamp in seconds
 * @returns Formatted relative time string
 */
export function formatRelativeTime(ts: number): string {
  try {
    const now = Date.now();
    const messageTime = ts * 1000;
    const diffMs = now - messageTime;

    // Convert to seconds
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 60) {
      return 'just now';
    }

    // Minutes
    if (diffSec < 3600) {
      const mins = Math.floor(diffSec / 60);
      return `${mins} ${mins === 1 ? 'min' : 'mins'} ago`;
    }

    // Hours
    if (diffSec < 86400) {
      const hours = Math.floor(diffSec / 3600);
      return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    }

    // Days
    if (diffSec < 2592000) { // ~30 days
      const days = Math.floor(diffSec / 86400);
      return `${days} ${days === 1 ? 'day' : 'days'} ago`;
    }

    // Months
    if (diffSec < 31536000) { // ~365 days
      const months = Math.floor(diffSec / 2592000);
      return `${months} ${months === 1 ? 'month' : 'months'} ago`;
    }

    // Years
    const years = Math.floor(diffSec / 31536000);
    return `${years} ${years === 1 ? 'year' : 'years'} ago`;
  } catch (error) {
    console.error('Error formatting relative time:', error);
    return 'unknown';
  }
}
