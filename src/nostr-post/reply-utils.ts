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

export function formatReplyText(content: string): string {
  if (!content) return '';
  return escapeHtml(content).replace(/\r?\n/g, '<br />');
}

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
