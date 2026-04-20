// SPDX-License-Identifier: MIT

import createDOMPurify from 'dompurify';
import { escapeHtml, sanitizeUrl } from './utils';

const POST_INLINE_ALLOWED_TAGS = ['a', 'span', 'br'];
const POST_INLINE_ALLOWED_ATTRS = [
  'href',
  'target',
  'rel',
  'class',
  'data-username',
];
const POST_INLINE_URI_REGEXP =
  /^(?:(?:https?):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i;

let postInlinePurifier: ReturnType<typeof createDOMPurify> | null = null;

function getPostInlinePurifier() {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!postInlinePurifier) {
    postInlinePurifier = createDOMPurify(window);
  }

  return postInlinePurifier;
}

export function sanitizeHttpUrl(url: string | null | undefined): string {
  return sanitizeUrl(url);
}

export function sanitizeMultilineText(text: string | null | undefined): string {
  return escapeHtml(text || '').replace(/\r\n|\r|\n/g, '<br />');
}

export function sanitizePostInlineFragment(html: string): string {
  const purifier = getPostInlinePurifier();

  if (!purifier) {
    return sanitizeMultilineText(html);
  }

  return purifier.sanitize(html, {
    ALLOWED_TAGS: POST_INLINE_ALLOWED_TAGS,
    ALLOWED_ATTR: POST_INLINE_ALLOWED_ATTRS,
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: POST_INLINE_URI_REGEXP,
  });
}
