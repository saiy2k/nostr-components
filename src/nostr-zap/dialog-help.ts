// SPDX-License-Identifier: MIT

// Import for side effects to register the custom element
import '../base/dialog-component/dialog-component';
import type { DialogComponent } from '../base/dialog-component/dialog-component';
import { getHelpDialogStyles } from './dialog-help-style';

/**
 * Hardcoded YouTube URL for zap tutorial
 */
const YOUTUBE_URL = "https://youtube.com/watch?v=zap-tutorial";

/**
 * Inject help dialog content styles into document head
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
 * Create and show help dialog using DialogComponent
 * Handles dialog creation and content styling
 */
export const showHelpDialog = async (): Promise<void> => {
  // Inject help dialog content styles
  injectHelpDialogStyles();
  
  // Ensure custom element is defined
  if (!customElements.get('dialog-component')) {
    await customElements.whenDefined('dialog-component');
  }
  
  // Create dialog component (not added to DOM)
  const dialogComponent = document.createElement('dialog-component') as DialogComponent;
  dialogComponent.setAttribute('header', 'What is a Zap? (Under construction)');
  
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
  
  // Show the dialog (this will create and append the actual dialog element)
  dialogComponent.showModal();
};
