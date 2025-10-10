// SPDX-License-Identifier: MIT

import { NDKEvent, ProfilePointer } from "@nostr-dev-kit/ndk";
import { NostrService } from "../common/nostr-service";
import { nip21 } from 'nostr-tools';

// Handle URLs and Nostr attachments
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

    // Handle Nostr URI schema for mentions
    const nostrURISchemaMatches = textContent.matchAll(
      new RegExp(nip21.NOSTR_URI_REGEX, 'g')
    );
    for (let match of nostrURISchemaMatches) {
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

        textContent = textContent.replace(
          match[0],
          `<a href="https://njump.me/${parsedNostrURI.value}" target="_blank">@${name}</a>`
        );
      }
    }

    // Handle Twitter-like mentions (@username)
    const mentionRegex = /(\s|^)@(\w+)/g;
    const mentionMatches = [...textContent.matchAll(mentionRegex)];

    for (const match of mentionMatches) {
      const fullMatch = match[0];
      const username = match[2];

      // Replace with styled mention
      textContent = textContent.replace(
        fullMatch,
        `${match[1]}<span class="nostr-mention" data-username="${username}">@${username}</span>`
      );
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

    // Then handle URLs in the text
    const regex =
      /(https:\/\/(?!njump\.me)[\w.-]+(?:\.[\w.-]+)+(?:\/[^\s]*)?)/g;
    const matches = textContent.match(regex);

    if (matches) {
      let lastIndex = 0;
      for (const match of matches) {
        const startIndex = textContent.indexOf(match, lastIndex);
        const endIndex = startIndex + match.length;

        if (startIndex > lastIndex) {
          result.push({
            type: 'text',
            value: textContent.substring(lastIndex, startIndex),
          });
        }

        const url = new URL(match);
        let type: 'image' | 'gif' | 'video' | 'link';

        if (
          url.pathname.endsWith('.jpg') ||
          url.pathname.endsWith('.jpeg') ||
          url.pathname.endsWith('.png')
        ) {
          type = 'image';
        } else if (url.pathname.endsWith('.gif')) {
          type = 'gif';
        } else if (
          url.pathname.endsWith('.mp4') ||
          url.pathname.endsWith('.webm') ||
          url.pathname.endsWith('.mov')
        ) {
          type = 'video';
        } else {
          type = 'link';
        }

        result.push({ type, value: match });

        lastIndex = endIndex;
      }

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
