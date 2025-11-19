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
      <p>Like any webpage to show your appreciation! Your likes are stored on Nostr, a decentralized network you control—no accounts needed.</p>
      <ul>
        <li>Like any webpage or article</li>
        <li>See who liked the content</li>
        <li>Works with a browser extension like <a href="https://getalby.com" target="_blank" rel="noopener noreferrer">Alby</a> or nos2x</li>
      </ul>
    </div>
  `;
  
  dialogComponent.showModal();
};

