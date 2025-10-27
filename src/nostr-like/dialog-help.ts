// SPDX-License-Identifier: MIT

// Import for side effects to register the custom element
import '../base/dialog-component/dialog-component';
import type { DialogComponent } from '../base/dialog-component/dialog-component';
import { getHelpDialogStyles } from './dialog-help-style';

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
  dialogComponent.setAttribute('header', 'What is a Like?');
  if (theme) {
    dialogComponent.setAttribute('data-theme', theme);
  }
  
  // Set dialog content
  dialogComponent.innerHTML = `
    <div class="help-content">
      <p>A like is a reaction stored on Nostr using NIP-25 kind 7 events. This component uses URL-based likes with kind 17 events.</p>
      <p>Features:</p>
      <ul>
        <li>One-click liking of any URL</li>
        <li>View who liked your content</li>
        <li>See total like counts</li>
        <li>All data stored on Nostr relays</li>
      </ul>
      <p>Requires a Nostr browser extension (Alby, nos2x, etc.) to sign and publish likes.</p>
    </div>
  `;
  
  dialogComponent.showModal();
};

