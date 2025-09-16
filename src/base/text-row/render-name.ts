// SPDX-License-Identifier: MIT

import { renderTextRow } from './render-text-row';

export interface RenderNameOptions {
  name: string;
  className?: string;
  title?: string;
  showCopyButton?: boolean;
}

export function renderName(options: RenderNameOptions): string {
  const { name, className = '', title, showCopyButton = false } = options;
  
  return renderTextRow({
    value: name,
    display: name,
    className: `nostr-profile-name ${className}`.trim(),
    title: title ?? name,
    showCopyButton: showCopyButton,
  });
}
