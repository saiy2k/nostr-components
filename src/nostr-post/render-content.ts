// SPDX-License-Identifier: MIT

  import { ContentItem } from './parse-text';
  import { escapeHtml, isValidUrl } from '../common/utils';
  import { NDKEvent, NDKUserProfile } from '@nostr-dev-kit/ndk';
  import { parseText } from './parse-text';
  import { renderEmbeddedPost } from './render';
  import { formatEventDate } from '../common/date-utils';

  export function renderContent(content: ContentItem[]): string {
    const html: string[] = [];
    let mediaCount = 0;
    let textBuffer = '';

    for (const item of content) {
      if (item.type === 'text') {
        textBuffer += (item.value ?? '');
      } else if (item.type === 'embedded-note') {
        // Handle embedded note placeholder
        if (textBuffer) {
          html.push(
            `<span class="text-content">${textBuffer.replace(/\n/g, '<br />')}</span>`
          );
          textBuffer = '';
        }

        html.push(
          `<div class="embedded-post-placeholder" data-note-id="${item.noteId}"></div>`
        );
      } else {
        if (textBuffer) {
          html.push(
            `<span class="text-content">${textBuffer.replace(/\n/g, '<br />')}</span>`
          );
          textBuffer = '';
        }

        const url = item.value ?? "";
        if (!isValidUrl(url)) continue;
        switch (item.type) {
          case 'image':
            html.push(
              `<img class="post-media-item" src="${url}" alt="User uploaded image" loading="lazy">`
            );
            mediaCount++;
            break;
          case 'gif':
            html.push(
              `<img class="post-media-item" src="${url}" alt="User uploaded GIF" loading="lazy">`
            );
            mediaCount++;
            break;
          case 'video':
            html.push(
              `<video class="post-media-item" src="${url}" controls></video>`
            );
            mediaCount++;
            break;
          case 'link':
            html.push(`<a href="${url}">${escapeHtml(url)}</a>`);
            break;
        }
      }
    }

    if (textBuffer) {
      html.push(
        `<span class="text-content">${textBuffer.replace(/\n/g, '<br />')}</span>`
      );
    }

    if (mediaCount > 1) {
      const carouselHtml: string[] = [];
      const bullets: string[] = [];
      const nonMediaHtml: string[] = [];

      // Separate media and non-media items efficiently
      for (let i = 0; i < html.length; i++) {
        const item = html[i];
        if (item.startsWith('<img') || item.startsWith('<video')) {
          carouselHtml.push(`<li class="glide__slide">${item}</li>`);
          bullets.push(`<button class="glide__bullet" data-glide-dir="=${i}"></button>`);
        } else {
          nonMediaHtml.push(item);
        }
      }
  
      // Replace html array with non-media items and add carousel
      html.length = 0;
      html.push(...nonMediaHtml);
      html.push(`
        <div class="glide" style="margin-top: 20px">
            <div class="glide__track" data-glide-el="track">
                <ul class="glide__slides">
                    ${carouselHtml.join('')}
                </ul>
            </div>

              <div class="glide__bullets" data-glide-el="controls[nav]">
                ${bullets.join('')}
            </div>
        </div>
      `);
    }

    return html.join('');
  };

  export async function replaceEmbeddedPostPlaceholders(
    shadowRoot: ShadowRoot | null,
    embeddedPosts: Map<string, NDKEvent>,
    event: NDKEvent | null,
    nostrService: any
  ) {
    const placeholders = shadowRoot?.querySelectorAll('.embedded-post-placeholder');

    if (!placeholders) return;

    for (const placeholder of placeholders) {
      const noteId = placeholder.getAttribute('data-note-id');
      if (noteId) {
        const embedHtml = await renderEmbeddedPostContent(noteId, embeddedPosts, event, nostrService);

        const temp = document.createElement('div');
        temp.innerHTML = embedHtml;

        // Replace the placeholder with the embedded post
        placeholder.parentNode?.replaceChild(
          temp.firstElementChild!,
          placeholder
        );
      }
    }
  }

  export async function renderEmbeddedPostContent(
    noteId: string,
    embeddedPosts: Map<string, NDKEvent>,
    event: NDKEvent | null,
    nostrService: any
  ): Promise<string> {
    const post = embeddedPosts.get(noteId);
    if (!post) return '<div class="embedded-post-error">Post not found</div>';

    let authorProfile: NDKUserProfile | null = null;
    try {
      authorProfile = await post.author.fetchProfile();
    } catch (error) {
      console.error(
        `Failed to fetch profile for embedded post ${noteId}:`,
        error
      );
    }

    const date = formatEventDate(post.created_at);

    // Process the post content
    const content = await parseText(post.content, event, embeddedPosts, nostrService);
    const renderedContent = renderContent(content);

    // Use the renderEmbeddedPost function from the render module
    return renderEmbeddedPost(
      noteId,
      authorProfile
        ? {
          displayName: authorProfile.displayName || '',
          image: authorProfile.picture || '',
          nip05: authorProfile.nip05 || '',
        }
        : undefined,
      date,
      renderedContent
    );
  }