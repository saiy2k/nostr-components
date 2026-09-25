// SPDX-License-Identifier: MIT

import { NDKEvent, NDKUserProfile } from '@nostr-dev-kit/ndk';
import { escapeHtml, isValidUrl } from '../common/utils';

export interface ReplyItem {
  id: string;
  authorKey: string;
  authorName: string;
  authorImage: string;
  contentHtml: string;
}

/**
 * Formats user reply text for HTML rendering by escaping HTML entities
 * and converting line breaks (CRLF, lone CR, lone LF) to <br /> tags.
 *
 * @param content - Raw text content of the reply
 * @returns Escaped and formatted HTML string, or empty string if falsy
 */
export function formatReplyText(content: string): string {
  if (!content) return '';
  return escapeHtml(content).replace(/\r\n|\r|\n/g, '<br />');
}

/**
 * Constructs a normalized ReplyItem view model from an NDKEvent and optional user profile,
 * resolving the author's display name according to fallback precedence and sanitizing the avatar URL.
 *
 * @param reply - The NDK reply event
 * @param profile - Optional NDK user profile metadata for the author
 * @returns Normalized ReplyItem ready for component rendering
 */
export function buildReplyItem(
  reply: NDKEvent,
  profile: NDKUserProfile | null | undefined
): ReplyItem {
  const fallbackName = reply.author?.npub || (reply.pubkey ? reply.pubkey.slice(0, 12) : '');

  return {
    id: reply.id || '',
    authorKey: reply.pubkey || '',
    authorName:
      profile?.displayName ||
      profile?.name ||
      profile?.nip05 ||
      fallbackName,
    authorImage: isValidUrl(profile?.picture || '') ? profile?.picture || '' : '',
    contentHtml: formatReplyText(reply.content || ''),
  };
}
