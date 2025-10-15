// SPDX-License-Identifier: MIT

import { getHelpDialogStyles } from './dialog-help-style';

/**
 * Hardcoded YouTube URL for zap tutorial
 */
const YOUTUBE_URL = "https://youtube.com/watch?v=zap-tutorial";

/**
 * Inject help dialog styles into document head
 * Prevents duplicate injection by checking for existing styles
 */
export const injectHelpDialogStyles = (): void => {
  // Check if styles are already injected
  if (document.querySelector('style[data-help-dialog-styles]')) return;
  
  const style = document.createElement('style');
  style.setAttribute('data-help-dialog-styles', 'true');
  style.textContent = getHelpDialogStyles();
  document.head.appendChild(style);
};

/**
 * Create and show help dialog
 * Handles dialog creation, styling, and event listeners
 */
export const showHelpDialog = (): void => {
  // Inject help dialog styles
  injectHelpDialogStyles();
  
  // Create help dialog
  const dialog = document.createElement('dialog');
  dialog.className = 'nostr-zap-help-dialog';
  dialog.innerHTML = `
    <div class="help-dialog-content">
      <button class="close-btn">✕</button>
      <h2>What is a Zap? (Under construction)</h2>
      <div class="help-content">
        <p>A zap is a Lightning Network payment sent to a Nostr user.</p>
        <p>Zaps allow you to:</p>
        <ul>
          <li>Send micropayments instantly</li>
          <li>Support content creators</li>
          <li>Show appreciation for posts</li>
        </ul>
        <p>Learn more about zaps:</p>
        <a href="${YOUTUBE_URL}" target="_blank" class="youtube-link">
          Watch YouTube Tutorial
        </a>
      </div>
    </div>
  `;
  
  document.body.appendChild(dialog);
  dialog.showModal();
  
  // Close dialog handlers
  const closeBtn = dialog.querySelector('.close-btn');
  closeBtn?.addEventListener('click', () => {
    dialog.close();
    document.body.removeChild(dialog);
  });
  
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) {
      dialog.close();
      document.body.removeChild(dialog);
    }
  });
};
