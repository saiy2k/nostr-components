// SPDX-License-Identifier: MIT

import {
  sanitizeHttpUrl,
  sanitizeMultilineText,
  sanitizePostInlineFragment,
} from '../common/sanitize';
import { escapeHtml } from '../common/utils';

const PROFILE_MENTION_TOKEN_PREFIX = '__NOSTRC_PROFILE_MENTION__(';
const PROFILE_MENTION_TOKEN_REGEX =
  /__NOSTRC_PROFILE_MENTION__\(([^)]*)\)\(([^)]*)\)__/g;
const USERNAME_MENTION_TOKEN_PREFIX = '__NOSTRC_USERNAME_MENTION__(';
const USERNAME_MENTION_TOKEN_REGEX =
  /__NOSTRC_USERNAME_MENTION__\(([^)]*)\)__/g;

export function createProfileMentionToken(
  href: string,
  displayName: string,
): string {
  return `${PROFILE_MENTION_TOKEN_PREFIX}${encodeURIComponent(href)})(${encodeURIComponent(displayName)})__`;
}

export function createUsernameMentionToken(username: string): string {
  return `${USERNAME_MENTION_TOKEN_PREFIX}${encodeURIComponent(username)})__`;
}

function replaceProfileMentionTokens(fragment: string): string {
  return fragment.replace(
    PROFILE_MENTION_TOKEN_REGEX,
    (_match, encodedHref, encodedDisplayName) => {
      const href = sanitizeHttpUrl(decodeURIComponent(encodedHref));
      const displayName = escapeHtml(decodeURIComponent(encodedDisplayName));

      if (!href) {
        return `@${displayName}`;
      }

      return `<a href="${href}" target="_blank" rel="noopener noreferrer">@${displayName}</a>`;
    },
  );
}

function replaceUsernameMentionTokens(fragment: string): string {
  return fragment.replace(
    USERNAME_MENTION_TOKEN_REGEX,
    (_match, encodedUsername) => {
      const username = escapeHtml(decodeURIComponent(encodedUsername));
      return `<span class="nostr-mention" data-username="${username}">@${username}</span>`;
    },
  );
}

export function renderPostInlineText(text: string): string {
  const escapedText = sanitizeMultilineText(text);
  const withProfileMentions = replaceProfileMentionTokens(escapedText);
  const withMentions = replaceUsernameMentionTokens(withProfileMentions);

  return sanitizePostInlineFragment(withMentions);
}
