  import { ContentItem } from './parse-text';
  import { escapeHtml, isValidUrl } from '../common/utils';

  export async function renderContent(content: ContentItem[]): Promise<string> {
    const html: string[] = [];
    let mediaCount = 0;
    let textBuffer = '';

    for (const item of content) {
      if (item.type === 'text') {
        textBuffer += item.value;
      } else if (item.type === 'embedded-note') {
        // Handle embedded note placeholder
        if (textBuffer) {
          html.push(
            `<span class="text-content">${escapeHtml(textBuffer).replace(/\n/g, '<br />')}</span>`
          );
          textBuffer = '';
        }

        html.push(
          `<div class="embedded-post-placeholder" data-note-id="${item.noteId}"></div>`
        );
      } else {
        if (textBuffer) {
          html.push(
            `<span class="text-content">${escapeHtml(textBuffer).replace(/\n/g, '<br />')}</span>`
          );
          textBuffer = '';
        }

        const url = item.value ?? "";
        if (!isValidUrl(url)) break;
        switch (item.type) {
          case 'image':
            html.push(
              `<div class="post-media-item"><img src="${url}" alt="User uploaded image" loading="lazy"></div>`
            );
            mediaCount++;
            break;
          case 'gif':
            html.push(
              `<div class="post-media-item"><img src="${url}" alt="User uploaded GIF" loading="lazy"></div>`
            );
            mediaCount++;
            break;
          case 'video':
            html.push(
              `<div class="post-media-item"><video src="${url}" controls></video></div>`
            );
            mediaCount++;
            break;
          case 'link':
            html.push(`<a href="${url}">${url}</a>`);
            break;
        }
      }
    }

    if (textBuffer) {
      html.push(
        `<span class="text-content">${escapeHtml(textBuffer).replace(/\n/g, '<br />')}</span>`
      );
    }

    return html.join('');
  };