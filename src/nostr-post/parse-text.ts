// SPDX-License-Identifier: MIT

import { NDKEvent, ProfilePointer } from "@nostr-dev-kit/ndk";
import { NostrService } from "../common/nostr-service";
import { nip21 } from 'nostr-tools';
import { escapeHtml } from "../common/utils";

export type ContentItem = {
  type: 'text' | 'image' | 'gif' | 'video' | 'link' | 'embedded-note';
  value?: string;
  noteId?: string;
};
 
export async function parseText(text: string, post: NDKEvent | null, embeddedPosts: Map<string, NDKEvent>, nostrService: NostrService): Promise<ContentItem[]> {
    let textContent = text;
    let embeddedNotes: { id: string; position: number }[] = [];

    // First capture embedded note references before other processing
    // Example note1abcdef... or nostr:note1abcdef... or nevent1abcdef...
    const noteRegex = /(nostr:)?(note[a-zA-Z0-9]{59,60}|nevent[a-zA-Z0-9]{58,})/g;
    const noteMatches = [...textContent.matchAll(noteRegex)];

    for (const match of noteMatches) {
      const fullMatch = match[0];
      const noteId = match[2];
      const position = match.index || 0;

      // Store the note ID and its position for later processing
      embeddedNotes.push({
        id: noteId,
        position: position,
      });

      // Fetch the embedded post
      try {
        if (!embeddedPosts.has(noteId)) {
          const embeddedPost = await nostrService.getPost(noteId);
          if (embeddedPost) {
            embeddedPosts.set(noteId, embeddedPost);
          }
        }
      } catch (error) {
        console.error(`Failed to fetch embedded post ${noteId}:`, error);
      }

      // Remove the note reference from the text to prevent @ symbols being added
      textContent = textContent.replace(fullMatch, ' ');
    }

    // Handle Nostr URI schema for mentions - batch process to avoid multiple async operations
    const nostrURISchemaMatches = [...textContent.matchAll(new RegExp(nip21.NOSTR_URI_REGEX, 'g'))];
    const uriReplacements: { original: string; replacement: string }[] = [];

    // Process all URIs concurrently
    const uriPromises = nostrURISchemaMatches.map(async (match) => {
      try {
        const parsedNostrURI = nip21.parse(match[0]);
        const decordedData = parsedNostrURI.decoded.data;

        let pubkey = '';
        if (typeof decordedData === 'string') {
          pubkey = decordedData;
        } else {
          pubkey = (decordedData as ProfilePointer).pubkey;
        }

        if (pubkey) {
          const user = nostrService.getNDK().getUser({ pubkey });
          const profile = await user.fetchProfile();
          const name = profile?.displayName || '';

          uriReplacements.push({
            original: match[0],
            replacement: `<a href="https://njump.me/${parsedNostrURI.value}" target="_blank">@${escapeHtml(name)}</a>`
          });
        }
      } catch (error) {
        console.error('Failed to process Nostr URI:', error);
      }
    });

    await Promise.all(uriPromises);

    // Apply all replacements at once
    for (const replacement of uriReplacements) {
      textContent = textContent.replace(replacement.original, replacement.replacement);
    }

    // Handle Twitter-like mentions (@username) - batch process
    const mentionRegex = /(\s|^)@(\w+)/g;
    const mentionMatches = [...textContent.matchAll(mentionRegex)];
    const mentionReplacements: { original: string; replacement: string }[] = [];

    for (const match of mentionMatches) {
      const fullMatch = match[0];
      const username = match[2];

      mentionReplacements.push({
        original: fullMatch,
        replacement: `${match[1]}<span class="nostr-mention" data-username="${username}">@${username}</span>`
      });
    }

    // Apply all mention replacements at once
    for (const replacement of mentionReplacements) {
      textContent = textContent.replace(replacement.original, replacement.replacement);
    }

   const result: ContentItem[] = [];

   // First, check for Nostr attachments in the post
   if (post) {
     const videoTags = post.getMatchingTags('a');
     for (const tag of videoTags) {
       const mimeType = tag[1] as string;
       const url = tag[2] as string;
       if (mimeType?.startsWith('video/') && url) {
         result.push({ type: 'video', value: url });
       }
     }
   }

    // Then handle URLs in the text - optimized with single pass
    const urlRegex = /(https:\/\/(?!njump\.me)[\w.-]+(?:\.[\w.-]+)+(?:\/[^\s]*)?)/g;
    const urlMatches = [...textContent.matchAll(urlRegex)];

    if (urlMatches.length > 0) {
      let lastIndex = 0;
      
      for (const match of urlMatches) {
        const startIndex = match.index!;
        const endIndex = startIndex + match[0].length;

        // Add text before URL
        if (startIndex > lastIndex) {
          result.push({
            type: 'text',
            value: textContent.substring(lastIndex, startIndex),
          });
        }

        // Determine URL type efficiently
        const url = match[0];
        const pathname = new URL(url).pathname.toLowerCase();
        let type: 'image' | 'gif' | 'video' | 'link';

        if (pathname.match(/\.(jpg|jpeg|png)$/)) {
          type = 'image';
        } else if (pathname.endsWith('.gif')) {
          type = 'gif';
        } else if (pathname.match(/\.(mp4|webm|mov)$/)) {
          type = 'video';
        } else {
          type = 'link';
        }

        result.push({ type, value: url });
        lastIndex = endIndex;
      }

      // Add remaining text
      if (lastIndex < textContent.length) {
        result.push({ type: 'text', value: textContent.substring(lastIndex) });
      }
    } else {
      result.push({ type: 'text', value: textContent });
    }

    // Add embedded notes to the result
    // TODO: Embedded notes lose their original position in text and are appended at the end,
    // losing their inline context. Consider inserting embedded notes at their original 
    // positions using the captured position data to maintain content flow and semantic meaning.
    // See: https://github.com/saiy2k/nostr-components/pull/23#discussion_r2238652376
    if (embeddedNotes.length > 0) {
      // Sort by position in descending order to avoid affecting earlier positions
      embeddedNotes.sort((a, b) => b.position - a.position);

      for (const note of embeddedNotes) {
        result.push({
          type: 'embedded-note',
          noteId: note.id,
        });
      }
    }

    return result;
  }
