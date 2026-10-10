// SPDX-License-Identifier: MIT

// Import for side effects to register the custom element
import '../base/dialog-component/dialog-component';
import type { DialogComponent } from '../base/dialog-component/dialog-component';
import { getZappersDialogStyles } from './dialog-zappers-style';
import {
  extractProfileMetadataContent,
  ZapDetails,
} from './zap-utils';
import { renderZapperEntry } from './render-zap-entry';
import { loadZapperProfiles } from './zapper-profiles';
import {
  setTrustedInnerHTML,
  setTrustedOuterHTML,
} from '../common/trusted-html';

/**
 * Modal dialog for displaying individual zap details (zappers).
 *
 * Shows a list of all zaps received by a user with:
 * - Zap amount
 * - Zap date (relative time)
 * - Zap author's name
 * - Zap author's profile picture
 * - Clickable links to author profiles via njump.me
 */

export interface OpenZappersModalParams {
  zapDetails: ZapDetails[];
  theme?: 'light' | 'dark';
  relays?: string[];
  actionId?: string;
  kind?: 'x' | 'youtube';
}

/**
 * Inject zappers dialog content styles into document head
 * Prevents duplicate injection by checking for existing styles
 */
export const injectZappersDialogStyles = (
  theme: 'light' | 'dark' = 'light',
) => {
  // Remove existing zappers dialog styles
  const existingStyles = document.querySelectorAll(
    'style[data-zappers-dialog-styles]',
  );
  existingStyles.forEach((style) => style.remove());

  const style = document.createElement('style');
  style.setAttribute('data-zappers-dialog-styles', 'true');
  style.textContent = getZappersDialogStyles(theme);
  document.head.appendChild(style);
};

/**
 * Opens the zappers dialog showing individual zap details
 */
export async function openZappersDialog(
  params: OpenZappersModalParams,
): Promise<DialogComponent> {
  const { zapDetails, theme = 'light', relays, actionId } = params;

  // Inject styles
  injectZappersDialogStyles(theme);

  // Ensure custom element is defined
  if (!customElements.get('dialog-component')) {
    await customElements.whenDefined('dialog-component');
  }

  // Create dialog component (not added to DOM)
  const dialogComponent = document.createElement(
    'dialog-component',
  ) as DialogComponent;
  dialogComponent.setAttribute('header', 'Zappers');
  if (params.theme) {
    dialogComponent.setAttribute('data-theme', params.theme);
  }

  // Comments and a short npub are visible before profile names arrive.
  const initialContent = renderInitialContent(zapDetails);
  setTrustedInnerHTML(dialogComponent, initialContent);

  // Show the dialog (this will create and append the actual dialog element)
  dialogComponent.showModal();

  // Get the actual dialog element for progressive enhancement
  // The dialog is created synchronously by showModal() and appended to document.body
  // Try both shadow root and light DOM, then fall back to document.body
  const dialogElement: HTMLDialogElement | null =
    dialogComponent.querySelector('.nostr-base-dialog') ||
    dialogComponent.shadowRoot?.querySelector('.nostr-base-dialog') ||
    document.body.querySelector('.nostr-base-dialog');

  if (!dialogElement) {
    console.error(
      '[showZappersDialog] Failed to find dialog element after showModal()',
    );
    throw new Error(
      'Dialog element not found. The dialog may not have been created properly.',
    );
  }

  // Type assertion: dialog is guaranteed to be non-null after the check above
  const dialog = dialogElement as HTMLDialogElement;

  // Start progressive enhancement
  if (dialog && zapDetails.length > 0) {
    enhanceZapDetailsProgressively(dialog, zapDetails, relays, actionId);
  }

  return dialogComponent;
}

/**
 * Render the zappers list. Names fall back to a short npub until kind 0 arrives.
 * The zap comment is the kind 9734 content and is included on every row.
 */
function renderInitialContent(zapDetails: ZapDetails[]): string {
  if (zapDetails.length === 0) {
    return `
      <div class="zappers-dialog-content">
        <div class="zappers-list">
          <div class="no-zaps">No zaps received yet</div>
        </div>
      </div>
    `;
  }

  const entries = zapDetails
    .map((zap, index) => renderZapperEntry(zap, index))
    .join('');

  return `
    <div class="zappers-dialog-content">
      <div class="zappers-list">
        ${entries}
      </div>
    </div>
  `;
}

/**
 * Progressively enhance zap details with profile information (batched approach)
 */
async function enhanceZapDetailsProgressively(
  dialog: HTMLDialogElement,
  zapDetails: ZapDetails[],
  relays?: string[],
  actionId?: string,
): Promise<void> {
  const zappersList = dialog.querySelector('.zappers-list') as HTMLElement;
  if (!zappersList) return;

  // Get unique author IDs
  const uniqueAuthorIds = [
    ...new Set(
      zapDetails
        .map((zap) => zap.authorPubkey)
        .filter((pubkey): pubkey is string => !!pubkey),
    ),
  ];
  console.log(
    'Nostr-Components: Zappers dialog: Fetching profiles for',
    uniqueAuthorIds.length,
    'unique authors',
  );

  try {
    const profiles = await loadZapperProfiles(uniqueAuthorIds, relays, actionId);

    for (let index = 0; index < zapDetails.length; index++) {
      const zap = zapDetails[index];
      const profile = zap.authorPubkey
        ? profiles.get(zap.authorPubkey.toLowerCase())
        : undefined;
      const entry = zappersList.querySelector(`[data-zap-index="${index}"]`);
      if (!entry) continue;
      setTrustedOuterHTML(
        entry,
        renderZapperEntry(
          zap,
          index,
          profile ? extractProfileMetadataContent(profile) : null,
        ),
      );
    }

    console.log(
      'Nostr-Components: Zappers dialog: Progressive enhancement completed for',
      zapDetails.length,
      'zap entries',
    );
  } catch (error) {
    console.error(
      'Nostr-Components: Zappers dialog: Error loading zapper profiles',
      error,
    );
  }
}
