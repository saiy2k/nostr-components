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

export function getNostrLogo(
    theme: Theme = 'dark',
    width: number = 24,
    height: number = 21,
) {
    return `
        <svg width="${width}" height="${height}" viewBox="0 0 21 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.7084 10.1607C18.1683 13.3466 14.8705 14.0207 12.9733 13.9618C12.8515 13.958 12.7366 14.0173 12.6647 14.1157C12.4684 14.384 12.1547 14.7309 11.9125 14.7309C11.6405 14.7309 11.3957 15.254 11.284 15.5795C11.2723 15.6137 11.3059 15.6452 11.3403 15.634C14.345 14.6584 15.5241 14.3238 16.032 14.4178C16.4421 14.4937 17.209 15.8665 17.5413 16.5434C16.7155 16.5909 16.4402 15.8507 16.2503 15.7178C16.0985 15.6116 16.0415 16.0974 16.032 16.3536C15.8517 16.2587 15.6239 16.1259 15.6049 15.7178C15.5859 15.3098 15.3771 15.4142 15.2157 15.4332C15.0544 15.4521 12.5769 16.2493 12.2067 16.3536C11.8366 16.458 11.4094 16.6004 11.0582 16.8471C10.4697 17.1318 10.09 16.9325 9.98561 16.4485C9.90208 16.0614 10.4444 14.8701 10.726 14.3229C10.3779 14.4526 9.65529 14.7158 9.54898 14.7309C9.44588 14.7457 8.13815 15.7552 7.43879 16.3038C7.398 16.3358 7.37174 16.3827 7.36236 16.4336C7.25047 17.0416 6.89335 17.2118 6.27423 17.5303C5.77602 17.7867 4.036 20.4606 3.14127 21.9041C3.0794 22.0039 2.9886 22.0806 2.8911 22.1461C2.32279 22.5276 1.74399 23.4985 1.50923 23.9737C1.17511 23.0095 1.61048 22.1802 1.86993 21.886C1.75602 21.7873 1.49341 21.8449 1.37634 21.886C1.69907 20.7757 2.82862 20.7757 2.79066 20.7757C2.99948 20.5954 5.44842 17.0938 5.50538 16.9325C5.56187 16.7725 5.46892 16.0242 6.69975 15.6139C6.7193 15.6073 6.73868 15.5984 6.75601 15.5873C7.71493 14.971 8.43427 13.9774 8.67571 13.5542C7.39547 13.4662 5.92943 12.7525 5.16289 12.294C4.99765 12.1952 4.8224 12.1092 4.63108 12.0875C3.58154 11.9687 2.53067 12.6401 2.10723 13.0228C1.93258 12.7799 2.12938 12.0739 2.24961 11.7513C1.82437 11.6905 1.19916 12.308 0.939711 12.6243C0.658747 12.184 0.904907 11.397 1.06311 11.0585C0.501179 11.0737 0.120232 11.3306 0 11.4571C0.465109 7.99343 4.02275 9.00076 4.06259 9.04675C3.87275 8.84937 3.88857 8.59126 3.92021 8.48688C6.0749 8.54381 7.08105 8.18321 7.71702 7.81313C12.7288 5.01374 14.8882 6.73133 15.6856 7.1631C16.4829 7.59487 17.9304 7.77042 18.9318 7.37187C20.1278 6.83097 19.9478 5.43673 19.7054 4.90461C19.4397 4.32101 17.9399 3.51438 17.4084 2.49428C16.8768 1.47418 17.34 0.233672 17.9558 0.0607684C18.5425 -0.103972 18.9615 0.0876835 19.2831 0.378128C19.4974 0.571763 20.0994 0.710259 20.3509 0.800409C20.6024 0.890558 21.0201 1.00918 20.9964 1.08035C20.9726 1.15152 20.5699 1.14202 20.5075 1.14202C20.3794 1.14202 20.2275 1.161 20.3794 1.23217C20.5575 1.30439 20.8263 1.40936 20.955 1.47846C20.9717 1.48744 20.9683 1.51084 20.95 1.51577C20.0765 1.75085 19.2966 1.26578 18.7183 1.82526C18.1298 2.39463 19.3827 2.83114 20.0282 3.51438C20.6736 4.19762 21.3381 5.01372 20.8065 6.87365C20.395 8.31355 18.6703 9.53781 17.7795 10.0167C17.7282 10.0442 17.7001 10.1031 17.7084 10.1607Z" fill="${theme === 'dark' ? 'white': 'black'}"/>
        </svg>
    `;
}

export function getLoadingNostrich(
    theme: Theme = 'dark',
    width: number = 25,
    height: number = 25,
) {
    return `<img width="${width}" height="${height}" src="./assets/${theme === "dark" ? "light": "dark"}-nostrich-running.gif" />`;
}

export function getSuccessAnimation(
    theme: Theme = 'dark',
    width: number = 25,
    height: number = 25,
) {
    return `
        <style>
            .checkmark__circle {
                stroke-dasharray: 166;
                stroke-dashoffset: 166;
                stroke-width: 4;
                stroke-miterlimit: 10;
                stroke: ${theme === 'dark' ? '#FFF': '#000'};
                animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
            }

            .checkmark {
                width: ${width}px;
                height: ${height}px;
                border-radius: 50%;
                display: block;
                stroke-width: 2;
                stroke: ${theme === 'dark' ? '#FFFFFF': '#000000'};
                stroke-miterlimit: 10;
                box-shadow: inset 0px 0px 0px #7ac142;
                animation: fill .4s ease-in-out .4s forwards, scale .3s ease-in-out .9s both;
            }

            .checkmark__check {
                transform-origin: 50% 50%;
                stroke-dasharray: 48;
                stroke-dashoffset: 48;
                stroke-width: 4;
                animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards;
            }

            @keyframes stroke {
                100% {
                    stroke-dashoffset: 0;
                }
            }
            @keyframes scale {
                0%, 100% {
                    transform: none;
            }
            50% {
                    transform: scale3d(1.1, 1.1, 1);
                }
            }
            @keyframes fill {
                100% {
                    box-shadow: inset 0px 0px 0px 30px #fff;
                    fill: #000;
                }
            }
        </style>

        <svg class="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
            <circle class="checkmark__circle" cx="26" cy="26" r="25" fill="${theme === 'dark' ? '#000': '#FFF'}"/>
            <path class="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
        </svg>
    `;
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
