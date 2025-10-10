// SPDX-License-Identifier: MIT

  import { ContentItem } from './parse-text';
  import { escapeHtml, isValidUrl } from '../common/utils';

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
      let bullets = '';

      for (let i = 0; i < html.length; i++) {
        const item = html[i];
        if (item.startsWith('<img') || item.startsWith('<video')) {
          carouselHtml.push(`<li class="glide__slide">${item}</li>`);
          
          bullets += `<button class="glide__bullet" data-glide-dir="=${i}"></button>`;

          html.splice(i, 1);
          i--;
        }
      }
  
      html.push(`
        <div class="glide" style="margin-top: 20px">
            <div class="glide__track" data-glide-el="track">
                <ul class="glide__slides">
                    ${carouselHtml.join('')}
                </ul>
            </div>

              <div class="glide__bullets" data-glide-el="controls[nav]">
                ${bullets}
            </div>
        </div>
      `);
    }

    return html.join('');
  };