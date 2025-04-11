import NDK, { NDKKind, NDKTag } from '@nostr-dev-kit/ndk';
import { decode } from 'light-bolt11-decoder';

import { Theme } from './types';
import { MILLISATS_PER_SAT } from './constants';

export function maskNPub(npubString: string = '', length=3) {
    const npubLength = npubString.length;

    if(npubLength !== 63) {
        return 'Invalid nPub';
    }

    let result = 'npub1';

    for(let i=5; i<length+5; i++) {
        result += npubString[i];
    }

    result += '...';

    let suffix = '';
    for(let i=npubLength-1; i>=npubLength-length; i--) {
        suffix = npubString[i] + suffix;
    }

    result += suffix;

    return result;
}

export type Stats = {
    likes: number,
    reposts: number,
    zaps: number,
    replies: number,
};

export async function getPostStats(ndk: NDK, postId: string): Promise<Stats> {
    const reposts = await ndk.fetchEvents({
      kinds: [NDKKind.Repost],
      '#e': [postId || '']
    });
  
    // Only take the count of direct reposts
    const repostsCount = Array.from(reposts).filter(repost => {
      const pTagCounts = repost.tags.filter((tag: NDKTag) => tag[0] === 'p').length;
  
      return pTagCounts === 1;
    }).length;
  
    const likes = await ndk.fetchEvents({
      kinds: [NDKKind.Reaction],
      '#e': [postId || '']
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
      '#e': [postId || '']
    });
  
    // Only take the direct replies
    // https://github.com/nostr-protocol/nips/blob/master/10.md#positional-e-tags-deprecated
    const replyCount = Array.from(replies).filter(reply => {
      const eTagsCount = reply.tags.filter((tag: NDKTag) => tag[0] === 'e').length;
  
      return eTagsCount === 1;
    }).length;
  
    return {
      likes: likes.size,
      reposts: repostsCount,
      zaps: zapAmount / MILLISATS_PER_SAT,
      replies: replyCount,
    };
  }
