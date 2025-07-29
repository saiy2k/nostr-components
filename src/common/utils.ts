import NDK, { NDKKind, NDKEvent } from '@nostr-dev-kit/ndk';

import { Theme } from './types';
import { DEFAULT_RELAYS, MILLISATS_PER_SAT, NPUB_LENGTH } from './constants';

export function maskNPub(npubString: string = '', length = 3) {
  const npubLength = npubString.length;

  if (npubLength !== NPUB_LENGTH) {
    return `Invalid nPub: expected ${NPUB_LENGTH} characters, got ${npubLength}`;
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
    return relaysAttr.split(',').map(r => r.trim());
  }
  return [...DEFAULT_RELAYS];
}

export function parseTheme(themeAttr: string | null): Theme {

  const theme = themeAttr?.trim().toLowerCase();

  if (theme === 'light' || theme === 'dark') {
    return theme;
  }
  if (!theme) {
    return 'light';
  }

  throw new Error(
    `Invalid theme '${theme}'. Accepted values are 'light', 'dark'`
  );
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
