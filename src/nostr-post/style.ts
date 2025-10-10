// SPDX-License-Identifier: MIT

import { getComponentStyles } from '../common/base-styles';

export function getPostStyles(): string {
  const customStyles = `
    /* === POST CSS VARIABLES === */
    :host {
      --nostrc-post-bg: var(--nostrc-theme-bg, #ffffff);
      --nostrc-post-text-primary: var(--nostrc-theme-text-primary, #333333);
      --nostrc-post-text-secondary: var(--nostrc-theme-text-secondary, #666666);
      --nostrc-post-border: var(--nostrc-border-width) solid var(--nostrc-color-border);
      --nostrc-post-accent: var(--nostrc-color-accent);
      --nostrc-post-font-family: var(--nostrc-font-family-primary);
      --nostrc-post-font-size: var(--nostrc-font-size-base);
      
      /* Hover state variables */
      --nostrc-post-hover-bg: var(--nostrc-theme-hover-bg, rgba(0, 0, 0, 0.05));
      --nostrc-post-hover-color: var(--nostrc-theme-text-primary, #333333);
      --nostrc-post-hover-border: var(--nostrc-border-width) solid var(--nostrc-theme-border, var(--nostrc-color-border));

      /* Make the host the visual post surface */
      display: block;
      background: var(--nostrc-post-bg);
      color: var(--nostrc-post-text-primary);
      border: var(--nostrc-post-border);
      border-radius: var(--nostrc-border-radius-md);
      font-family: var(--nostrc-post-font-family);
      font-size: var(--nostrc-post-font-size);
      transition: background-color var(--nostrc-transition-duration) var(--nostrc-transition-timing);
    }

    /* === POST CONTAINER PATTERN === */
    .nostr-post-container {
      display: flex;
      flex-direction: column;
      gap: var(--nostrc-spacing-lg);
      padding: var(--nostrc-spacing-md);
    }

    /* Hover state */
    :host(.is-clickable:hover) {
      background: var(--nostrc-post-hover-bg);
      color: var(--nostrc-post-hover-color);
      border: var(--nostrc-post-hover-border);
    }

    /* === POST HEADER PATTERN === */
    .post-header {
      display: flex;
      gap: var(--nostrc-spacing-sm);
    }
    
    .post-body {
      display: block;
      width: 100%;
    }

    .post-header-left {
      width: 35px;
      flex-shrink: 0;
    }

    .post-header-left img {
      width: 35px;
      height: 35px;
      border-radius: var(--nostrc-border-radius-full);
      object-fit: cover;
    }

    .post-header-middle {
      display: flex;
      flex-direction: column;
      width: 100%;
      gap: var(--nostrc-spacing-xs);
    }

    .post-header-right {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: end;
    }

    /* === AUTHOR INFO STYLES === */
    .author-name {
      color: var(--nostrc-post-text-primary);
      font-weight: var(--nostrc-font-weight-bold);
      word-break: break-word;
    }

    .author-username {
      font-weight: var(--nostrc-font-weight-normal);
      color: var(--nostrc-post-text-secondary);
      font-size: var(--nostrc-font-size-sm);
      word-break: break-all;
    }

    .post-date {
      font-weight: var(--nostrc-font-weight-normal);
      color: var(--nostrc-post-text-secondary);
      font-size: var(--nostrc-font-size-sm);
    }

    .text-content {
      word-break: break-word;
    }

    /* === POST FOOTER PATTERN === */
    .post-footer {
      margin-top: var(--nostrc-spacing-lg);
      display: block;
      width: 100%;
    }

    .stats-container {
      display: flex;
      gap: var(--nostrc-spacing-lg);
    }

    .stat {
      display: flex;
      gap: var(--nostrc-spacing-xs);
      color: var(--nostrc-post-text-secondary);
    }

    /* === MEDIA STYLING === */
    .post-media-item {
      width: 100%;
      margin: var(--nostrc-spacing-sm) 0;
      display: flex;
      justify-content: center;
    }

    .post-media-item img,
    .post-media-item video {
      max-width: 100%;
      max-height: 500px;
      width: auto;
      height: auto;
      object-fit: contain;
      border-radius: var(--nostrc-border-radius-md);
      display: block;
    }

    /* === EMBEDDED MEDIA STYLING === */
    .embedded-media-item {
      width: 100%;
      border-radius: var(--nostrc-border-radius-sm);
      overflow: hidden;
      margin: var(--nostrc-spacing-xs) 0;
    }

    .embedded-media-item img,
    .embedded-media-item video {
      width: 100%;
      max-height: 500px;
      object-fit: contain;
      display: block;
    }

    /* === GLIDE CAROUSEL STYLES === */
    .glide__slide {
      width: 100%;
    }

    .glide__slide * {
      border-radius: var(--nostrc-border-radius-md);
    }

    .glide__bullets button {
      border: var(--nostrc-post-border);
    }

    /* === MENTION STYLES === */
    .nostr-mention {
      color: var(--nostrc-post-accent);
      font-weight: var(--nostrc-font-weight-medium);
      cursor: pointer;
    }
    
    /* === EMBEDDED POST STYLES === */
    .embedded-post {
      margin: var(--nostrc-spacing-sm) 0;
      padding: var(--nostrc-spacing-sm);
      border: var(--nostrc-post-border);
      border-radius: var(--nostrc-border-radius-md);
      background: var(--nostrc-color-background-secondary);
    }
    
    .embedded-post-header {
      display: flex;
      align-items: center;
      margin-bottom: var(--nostrc-spacing-xs);
    }
    
    .embedded-author-avatar {
      width: 24px;
      height: 24px;
      border-radius: var(--nostrc-border-radius-full);
      overflow: hidden;
      margin-right: var(--nostrc-spacing-xs);
    }
    
    .embedded-author-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .embedded-author-info {
      display: flex;
      flex-direction: column;
      flex: 1;
    }
    
    .embedded-author-name {
      font-weight: var(--nostrc-font-weight-bold);
      font-size: var(--nostrc-font-size-sm);
      color: var(--nostrc-post-text-primary);
    }
    
    .embedded-author-username {
      font-size: var(--nostrc-font-size-xs);
      color: var(--nostrc-post-text-secondary);
    }
    
    .embedded-post-date {
      font-size: var(--nostrc-font-size-xs);
      color: var(--nostrc-post-text-secondary);
    }
    
    .embedded-post-content {
      font-size: var(--nostrc-font-size-sm);
      color: var(--nostrc-post-text-primary);
      line-height: 1.4;
      white-space: pre-line;
    }
    
    .embedded-post-media {
      margin-top: var(--nostrc-spacing-sm);
    }
    
    .embedded-media-list {
      display: flex;
      flex-direction: column;
      gap: var(--nostrc-spacing-xs);
    }
    
    .embedded-media-item {
      width: 100%;
      border-radius: var(--nostrc-border-radius-sm);
      overflow: hidden;
    }
    
    .embedded-media-item img,
    .embedded-media-item video {
      width: 100%;
      max-height: 300px;
      object-fit: contain;
      display: block;
    }
    
    .embedded-post-error {
      padding: var(--nostrc-spacing-sm);
      color: var(--nostrc-color-error-text);
      background-color: var(--nostrc-color-error-background);
      border: var(--nostrc-post-border);
      border-radius: var(--nostrc-border-radius-sm);
      font-size: var(--nostrc-font-size-sm);
    }
  `;
  
  // Use component styles - includes design tokens + utilities + custom styles
  return getComponentStyles(customStyles);
}

