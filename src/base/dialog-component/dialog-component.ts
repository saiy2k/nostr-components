// SPDX-License-Identifier: MIT

import { getDialogComponentStyles } from './style';

/**
 * Base dialog component that extends HTMLElement
 * Provides common dialog functionality with header, close button, and content area
 * 
 * Usage:
 * ```typescript
 * const dialog = document.createElement('dialog-component');
 * dialog.setAttribute('header', 'Dialog Title');
 * dialog.innerHTML = '<p>Your content goes here</p>';
 * dialog.showModal(); // Don't append to body, just call showModal()
 * ```
 * 
 * Features:
 * - Header with customizable text
 * - Close button
 * - Click outside to close
 * - ESC key to close
 * - Automatic cleanup on close
 * 
 * Important: Only one instance of this component should be added to the DOM at any time.
 * Multiple instances may cause conflicts with event listeners and cleanup behavior.
 */
export class DialogComponent extends HTMLElement {
  private dialog: HTMLDialogElement | null = null;

  constructor() {
    super();
  }

  /**
   * Observed attributes for the component
   */
  static get observedAttributes() {
    return ['header', 'data-theme'];
  }

  /**
   * Inject dialog styles into document head
   * Prevents duplicate injection by checking for existing styles
   */
  private injectStyles(): void {
    if (document.querySelector('style[data-dialog-component-styles]')) return;
    
    const style = document.createElement('style');
    style.setAttribute('data-dialog-component-styles', 'true');
    style.textContent = getDialogComponentStyles();
    document.head.appendChild(style);
  }

  /**
   * Render the dialog
   */
  private render(): void {
    this.injectStyles();

    const headerText = this.getAttribute('header') || 'Dialog';
    const theme = this.getAttribute('data-theme');

    this.dialog = document.createElement('dialog');
    this.dialog.className = 'nostr-base-dialog';
    if (theme) {
      this.dialog.setAttribute('data-theme', theme);
    }

    const headerDiv = document.createElement('div');
    headerDiv.className = 'dialog-header';
    
    const headerH2 = document.createElement('h2');
    headerH2.textContent = headerText;
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'dialog-close-btn';
    closeBtn.setAttribute('aria-label', 'Close dialog');
    closeBtn.textContent = '✕';
    
    headerDiv.appendChild(headerH2);
    headerDiv.appendChild(closeBtn);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'dialog-content';
    
    // Safely move child nodes from component to dialog content
    // This preserves any existing DOM nodes without using innerHTML
    while (this.firstChild) {
      contentDiv.appendChild(this.firstChild);
    }

    this.dialog.appendChild(headerDiv);
    this.dialog.appendChild(contentDiv);

    document.body.appendChild(this.dialog);

    this.setupEventListeners();
  }

  /**
   * Setup event listeners for closing the dialog
   */
  private setupEventListeners(): void {
    if (!this.dialog) return;

    // Close button click
    const closeBtn = this.dialog.querySelector('.dialog-close-btn');
    closeBtn?.addEventListener('click', () => {
      this.close();
    });

    // Click outside dialog (on backdrop)
    this.dialog.addEventListener('click', (e) => {
      if (e.target === this.dialog) {
        this.close();
      }
    });

    // ESC key handler
    this.dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      this.close();
    });

    // Cleanup on close
    this.dialog.addEventListener('close', () => {
      this.cleanup();
    });
  }

  /**
   * Show the dialog (alias for showModal)
   */
  public show(): void {
    this.showModal();
  }

  /**
   * Show the dialog as modal
   */
  public showModal(): void {
    if (!this.dialog) {
      this.render();
    }
    this.dialog?.showModal();
  }

  /**
   * Close the dialog
   */
  public close(): void {
    this.dialog?.close();
  }

  /**
   * Cleanup when dialog is closed
   */
  private cleanup(): void {
    if (this.dialog && this.dialog.isConnected) {
      this.dialog.remove();
    }
    if (this.isConnected) {
      this.remove();
    }
    this.dialog = null;
  }

  /**
   * Called when component is removed from DOM
   */
  disconnectedCallback(): void {
    this.cleanup();
  }

  /**
   * Called when observed attributes change
   */
  attributeChangedCallback(name: string, _oldValue: string, newValue: string): void {
    if (name === 'header' && this.dialog) {
      const heading = this.dialog.querySelector('.dialog-header h2');
      if (heading) {
        heading.textContent = newValue || 'Dialog';
      }
    } else if (name === 'data-theme' && this.dialog) {
      if (newValue) {
        this.dialog.setAttribute('data-theme', newValue);
      } else {
        this.dialog.removeAttribute('data-theme');
      }
    }
  }
}

// Define custom element
if (!customElements.get('dialog-component')) {
  customElements.define('dialog-component', DialogComponent);
}

