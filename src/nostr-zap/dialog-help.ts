// SPDX-License-Identifier: MIT

// Import for side effects to register the custom element
import '../base/dialog-component/dialog-component';
import type { DialogComponent } from '../base/dialog-component/dialog-component';
import { getHelpDialogStyles } from './dialog-help-style';

const YOUTUBE_URL = "https://www.youtube.com/shorts/PDnrh8pkF3g";

export const injectHelpDialogStyles = (): void => {
  // Check if styles are already injected
  if (document.querySelector('style[data-help-dialog-styles]')) return;
  
  const style = document.createElement('style');
  style.setAttribute('data-help-dialog-styles', 'true');
  style.textContent = getHelpDialogStyles();
  document.head.appendChild(style);
};

export const showHelpDialog = async (theme?: 'light' | 'dark'): Promise<void> => {
  injectHelpDialogStyles();
  
  if (!customElements.get('dialog-component')) {
    await customElements.whenDefined('dialog-component');
  }
  
  const dialogComponent = document.createElement('dialog-component') as DialogComponent;
  dialogComponent.setAttribute('header', 'What is a Zap? (Under construction)');
  if (theme) {
    dialogComponent.setAttribute('data-theme', theme);
  }
  
  // Set dialog content
  dialogComponent.innerHTML = `
    <div class="help-content">
      <p>A zap is a Lightning Network payment sent to a Nostr user.</p>
      <p>Zaps allow you to:</p>
      <ul>
        <li>Send micropayments instantly</li>
        <li>Support content creators</li>
        <li>Show appreciation for posts</li>
      </ul>
      <p>Learn more about zaps:</p>
      <a href="${YOUTUBE_URL}" target="_blank" rel="noopener noreferrer" class="youtube-link">
        Watch YouTube Tutorial
      </a>
    </div>
  `;
  
  dialogComponent.showModal();
};
