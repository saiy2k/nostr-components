  // TODO: Fix types
  export async function renderContent(content: any[]): Promise<string> {
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

        switch (item.type) {
          case 'image':
            html.push(
              `<div class="post-media-item"><img src="${item.value}" alt="Image"></div>`
            );
            mediaCount++;
            break;
          case 'gif':
            html.push(
              `<div class="post-media-item"><img src="${item.value}" alt="GIF"></div>`
            );
            mediaCount++;
            break;
          case 'video':
            html.push(
              `<div class="post-media-item"><video src="${item.value}" controls></video></div>`
            );
            mediaCount++;
            break;
          case 'link':
            html.push(`<a href="${item.value}">${item.value}</a>`);
            break;
        }
      }
    }

    if (textBuffer) {
      html.push(
        `<span class="text-content">${textBuffer.replace(/\n/g, '<br />')}</span>`
      );
    }

    return html.join('');
  };