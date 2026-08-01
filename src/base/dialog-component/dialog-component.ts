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
 * dialog.showModal();
 * ```
 *
 * Features:
 * - Native modal dialog (`HTMLDialogElement.showModal`)
 * - Header with customizable text (`aria-labelledby`)
 * - Close button (44×44 hit target)
 * - Click outside / ESC to close
 * - Focus trap + restore
 *
 * Important: Only one instance of this component should be added to the DOM at any time.
 */
export class DialogComponent extends HTMLElement {
  private dialog: HTMLDialogElement | null = null;
  private _titleId = `nostr-dialog-title-${Math.random().toString(36).slice(2, 9)}`;
  private _focusTrapHandler: ((e: KeyboardEvent) => void) | null = null;
  private _outsidePointerHandler: ((e: PointerEvent) => void) | null = null;
  private _previouslyFocused: HTMLElement | null = null;

  constructor() {
    super();
  }

  static get observedAttributes() {
    return ['header', 'data-theme'];
  }

  private injectStyles(): void {
    if (document.querySelector('style[data-dialog-component-styles]')) return;

    const style = document.createElement('style');
    style.setAttribute('data-dialog-component-styles', 'true');
    style.textContent = getDialogComponentStyles();
    document.head.appendChild(style);
  }

  private isFocusable(el: HTMLElement): boolean {
    if (el.hasAttribute('disabled') || el.getAttribute('aria-hidden') === 'true') {
      return false;
    }
    if (typeof el.checkVisibility === 'function') {
      return el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
    }
    return el.getClientRects().length > 0;
  }

  private getFocusableElements(): HTMLElement[] {
    if (!this.dialog) return [];
    return Array.from(
      this.dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => this.isFocusable(el));
  }

  private render(): void {
    this.injectStyles();

    const headerText = this.getAttribute('header') || 'Dialog';
    const theme = this.getAttribute('data-theme');

    this.dialog = document.createElement('dialog');
    this.dialog.className = 'nostr-base-dialog';
    this.dialog.setAttribute('aria-labelledby', this._titleId);
    if (theme) {
      this.dialog.setAttribute('data-theme', theme);
    }

    const headerDiv = document.createElement('div');
    headerDiv.className = 'dialog-header';

    const headerH2 = document.createElement('h2');
    headerH2.id = this._titleId;
    headerH2.textContent = headerText;

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'dialog-close-btn';
    closeBtn.setAttribute('aria-label', 'Close dialog');
    closeBtn.textContent = '✕';

    headerDiv.appendChild(headerH2);
    headerDiv.appendChild(closeBtn);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'dialog-content';

    while (this.firstChild) {
      contentDiv.appendChild(this.firstChild);
    }

    this.dialog.appendChild(headerDiv);
    this.dialog.appendChild(contentDiv);

    document.body.appendChild(this.dialog);

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    if (!this.dialog) return;

    const closeBtn = this.dialog.querySelector('.dialog-close-btn');
    closeBtn?.addEventListener('click', () => {
      this.close();
    });

    this._focusTrapHandler = (e: KeyboardEvent) => {
      if (!this.dialog || e.key !== 'Tab') return;
      const focusable = this.getFocusableElements();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', this._focusTrapHandler);

    this.dialog.addEventListener('close', () => {
      this.cleanup();
    });
  }

  public show(): void {
    this.showModal();
  }

  public getDialogElement(): HTMLDialogElement | null {
    return this.dialog;
  }

  public showModal(): void {
    if (this.dialog) {
      return;
    }
    this._previouslyFocused = document.activeElement as HTMLElement;
    this.render();
    this.dialog!.showModal();

    // Prefer dialog content over the header close button for initial focus.
    const focusable = this.getFocusableElements();
    const contentFocusable = focusable.find((el) => el.closest('.dialog-content'));
    (contentFocusable ?? focusable[0] ?? this.dialog!).focus();

    // Light-dismiss: pointer outside the dialog box (top-layer backdrop clicks).
    // Defer so the opening gesture does not immediately close the dialog.
    // Backdrop clicks target the <dialog> itself, so hit-test coordinates against
    // the border box — clicks on the dialog's own padding must not close it.
    this._outsidePointerHandler = (e: PointerEvent) => {
      if (!this.dialog?.open) return;
      const rect = this.dialog.getBoundingClientRect();
      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (!inside) {
        this.close();
      }
    };
    requestAnimationFrame(() => {
      document.addEventListener('pointerdown', this._outsidePointerHandler!, true);
    });
  }

  public close(): void {
    this.dialog?.close();
  }

  private cleanup(): void {
    if (this._focusTrapHandler) {
      document.removeEventListener('keydown', this._focusTrapHandler);
      this._focusTrapHandler = null;
    }
    if (this._outsidePointerHandler) {
      document.removeEventListener('pointerdown', this._outsidePointerHandler, true);
      this._outsidePointerHandler = null;
    }
    this._previouslyFocused?.focus();
    this._previouslyFocused = null;
    if (this.dialog && this.dialog.isConnected) {
      this.dialog.remove();
    }
    if (this.isConnected) {
      this.remove();
    }
    this.dialog = null;
  }

  disconnectedCallback(): void {
    this.cleanup();
  }

  attributeChangedCallback(name: string, _oldValue: string, newValue: string): void {
    if (name === 'header' && this.dialog) {
      const heading = this.dialog.querySelector(`#${CSS.escape(this._titleId)}`);
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

if (!customElements.get('dialog-component')) {
  customElements.define('dialog-component', DialogComponent);
}
