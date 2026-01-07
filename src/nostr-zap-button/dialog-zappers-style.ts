// SPDX-License-Identifier: MIT

import { getComponentStyles } from "../common/base-styles";

export function getZappersDialogStyles(theme: 'light' | 'dark' = 'light'): string {
  const isDark = theme === 'dark';
  
  const customStyles = `
    /* === ZAPPERS DIALOG CONTENT STYLES === */
    .zappers-dialog-content {
      overflow: hidden;
    }

    .zappers-list {
      max-height: 60vh;
      overflow-y: auto;
    }

    /* Individual zap entry */
    .zap-entry {
      padding: var(--nostrc-spacing-md, 16px);
      border-bottom: 1px solid ${isDark ? '#333333' : '#f3f4f6'};
      transition: background-color 0.2s ease;
    }

    .zap-entry:last-child {
      border-bottom: none;
    }

    .zap-entry:hover {
      background: ${isDark ? '#2a2a2a' : '#f9fafb'};
    }

    .zap-author-info {
      display: flex;
      align-items: center;
      gap: var(--nostrc-spacing-md, 16px);
    }

    .zap-author-picture {
      width: 40px;
      height: 40px;
      border-radius: var(--nostrc-border-radius-full, 50%);
      object-fit: cover;
      border: 2px solid ${isDark ? '#374151' : '#e5e7eb'};
    }

    .zap-author-picture-default {
      width: 40px;
      height: 40px;
      border-radius: var(--nostrc-border-radius-full, 50%);
      background: ${isDark ? '#374151' : '#f3f4f6'};
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: var(--nostrc-font-size-lg, 18px);
      color: ${isDark ? '#9ca3af' : '#6b7280'};
      border: 2px solid ${isDark ? '#4b5563' : '#d1d5db'};
    }

    .zap-author-details {
      flex: 1;
      min-width: 0;
    }

    .zap-author-link {
      display: block;
      font-weight: 500;
      color: ${isDark ? '#ffffff' : '#1a1a1a'};
      text-decoration: none;
      font-size: var(--nostrc-font-size-base, 16px);
      margin-bottom: var(--nostrc-spacing-xs, 4px);
      transition: color 0.2s ease;
    }

    .zap-author-link:hover {
      color: var(--nostrc-color-primary, #7f00ff);
    }

    .zap-comment {
      font-size: var(--nostrc-font-size-sm, 14px);
      color: ${isDark ? '#d1d5db' : '#4b5563'};
      margin: var(--nostrc-spacing-xs, 4px) 0;
      line-height: 1.4;
      word-wrap: break-word;
      white-space: pre-wrap;
    }

    .zap-amount-date {
      font-size: var(--nostrc-font-size-sm, 14px);
      color: ${isDark ? '#9ca3af' : '#6b7280'};
      display: flex;
      align-items: center;
      gap: var(--nostrc-spacing-xs, 4px);
    }

    /* Loading skeleton with npub */
    .skeleton-entry {
      display: flex;
      align-items: center;
      gap: var(--nostrc-spacing-md, 16px);
      padding: var(--nostrc-spacing-md, 16px);
      border-bottom: 1px solid ${isDark ? '#333333' : '#f3f4f6'};
    }

    .skeleton-entry:last-child {
      border-bottom: none;
    }

    .skeleton-picture {
      width: 40px;
      height: 40px;
      border-radius: var(--nostrc-border-radius-full, 50%);
      background: linear-gradient(90deg, 
        ${isDark ? '#374151' : '#f0f0f0'} 25%, 
        ${isDark ? '#4b5563' : '#e0e0e0'} 50%, 
        ${isDark ? '#374151' : '#f0f0f0'} 75%
      );
      background-size: 200% 100%;
      animation: skeleton-loading 1.5s infinite;
    }

    .skeleton-name {
      font-size: var(--nostrc-font-size-base, 16px);
      font-weight: 500;
      color: ${isDark ? '#9ca3af' : '#6b7280'};
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
      word-break: break-all;
      line-height: 1.2;
    }

    @keyframes skeleton-loading {
      0% {
        background-position: 200% 0;
      }
      100% {
        background-position: -200% 0;
      }
    }

    /* Empty state */
    .no-zaps {
      text-align: center;
      padding: var(--nostrc-spacing-xl, 32px);
      color: ${isDark ? '#9ca3af' : '#6b7280'};
      font-size: var(--nostrc-font-size-base, 16px);
    }

    /* Responsive design */
    @media (max-width: 640px) {
      .zap-author-picture,
      .zap-author-picture-default,
      .skeleton-picture {
        width: 36px;
        height: 36px;
      }
      
      .zap-author-link {
        font-size: var(--nostrc-font-size-sm, 14px);
      }
      
      .zap-amount-date {
        font-size: var(--nostrc-font-size-xs, 12px);
      }
    }

    /* Scrollbar styling */
    .zappers-list::-webkit-scrollbar {
      width: 6px;
    }

    .zappers-list::-webkit-scrollbar-track {
      background: ${isDark ? '#2a2a2a' : '#f1f5f9'};
      border-radius: 3px;
    }

    .zappers-list::-webkit-scrollbar-thumb {
      background: ${isDark ? '#4b5563' : '#cbd5e1'};
      border-radius: 3px;
    }

    .zappers-list::-webkit-scrollbar-thumb:hover {
      background: ${isDark ? '#6b7280' : '#94a3b8'};
    }
  `;
  
  return getComponentStyles(customStyles);
}
