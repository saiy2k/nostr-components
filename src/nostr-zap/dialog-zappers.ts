// SPDX-License-Identifier: MIT

// Import for side effects to register the custom element
import '../base/dialog-component/dialog-component';
import type { DialogComponent } from '../base/dialog-component/dialog-component';
import { getZappersDialogStyles } from './dialog-zappers-style';
import { getBatchedProfileMetadata, extractProfileMetadataContent, ZapDetails } from './zap-utils';
import { escapeHtml, formatRelativeTime, hexToNpub, isValidUrl } from '../common/utils';
import { isValidPublicKey } from '../nostr-comment/utils';

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
}

/**
 * Inject zappers dialog content styles into document head
 * Prevents duplicate injection by checking for existing styles
 */
export const injectZappersDialogStyles = (theme: 'light' | 'dark' = 'light') => {
  // Remove existing zappers dialog styles
  const existingStyles = document.querySelectorAll('style[data-zappers-dialog-styles]');
  existingStyles.forEach(style => style.remove());
  
  const style = document.createElement('style');
  style.setAttribute('data-zappers-dialog-styles', 'true');
  style.textContent = getZappersDialogStyles(theme);
  document.head.appendChild(style);
}

interface EnhancedZapDetails extends ZapDetails {
  authorName?: string;
  authorPicture?: string;
  authorNpub?: string;
}

/**
 * Render individual zap entry HTML (with profile data)
 */
function renderZapEntry(zap: EnhancedZapDetails, index: number): string {
  const authorNameSafe = escapeHtml(zap.authorName || 'Unknown zapper');
  const npubSafe = isValidPublicKey(zap.authorNpub || '') ? zap.authorNpub : '';
  const njumpUrl = `https://njump.me/${npubSafe}`;
  const profilePictureSafe = isValidUrl(zap.authorPicture || '') ? zap.authorPicture || '' : '';
  

  const profilePicture = zap.authorPicture 
    ? `<img src="${profilePictureSafe}" alt="${authorNameSafe}" class="zap-author-picture" />`
    : `<div class="zap-author-picture-default">👤</div>`;
  
  return `
    <div class="zap-entry" data-zap-index="${index}" data-author-pubkey="${zap.authorPubkey}">
      <div class="zap-author-info">
        ${profilePicture}
        <div class="zap-author-details">
          <a href="${njumpUrl}" target="_blank" rel="noopener noreferrer" class="zap-author-link">
            ${authorNameSafe}
          </a>
          <div class="zap-amount-date">
            ${zap.amount.toLocaleString()} ⚡ • ${formatRelativeTime(Math.floor(zap.date.getTime() / 1000))}
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render skeleton zap entry HTML (with npub)
 */
function renderSkeletonZapEntry(zap: ZapDetails, npub: string, index: number): string {
  return `
    <div class="zap-entry skeleton-entry" data-zap-index="${index}" data-author-pubkey="${zap.authorPubkey}">
      <div class="zap-author-info">
        <div class="skeleton-picture"></div>
        <div class="zap-author-details">
          <div class="zap-author-link skeleton-name">
            ${escapeHtml(npub)}
          </div>
          <div class="zap-amount-date">
            ${zap.amount.toLocaleString()} ⚡ • ${formatRelativeTime(Math.floor(zap.date.getTime() / 1000))}
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Opens the zappers dialog showing individual zap details
 */
export async function openZappersDialog(params: OpenZappersModalParams): Promise<DialogComponent> {
  const { zapDetails, theme = 'light' } = params;
  
  // Inject styles
  injectZappersDialogStyles(theme);
  
  // Ensure custom element is defined
  if (!customElements.get('dialog-component')) {
    await customElements.whenDefined('dialog-component');
  }
  
  // Create dialog component (not added to DOM)
  const dialogComponent = document.createElement('dialog-component') as DialogComponent;
  dialogComponent.setAttribute('header', 'Zappers');
  if (params.theme) {
    dialogComponent.setAttribute('data-theme', params.theme);
  }
  
  // Initial content with skeleton loaders showing npubs
  const initialContent = await renderInitialContent(zapDetails);
  dialogComponent.innerHTML = initialContent;
  
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
    console.error('[showZappersDialog] Failed to find dialog element after showModal()');
    throw new Error('Dialog element not found. The dialog may not have been created properly.');
  }
  
  // Type assertion: dialog is guaranteed to be non-null after the check above
  const dialog = dialogElement as HTMLDialogElement;
  
  // Start progressive enhancement
  if (dialog && zapDetails.length > 0) {
    enhanceZapDetailsProgressively(dialog, zapDetails);
  }

  return dialogComponent;
}

/**
 * Render initial dialog content with skeleton loaders showing npubs
 */
async function renderInitialContent(zapDetails: ZapDetails[]): Promise<string> {
  if (zapDetails.length === 0) {
    return `
      <div class="zappers-dialog-content">
        <div class="zappers-list">
          <div class="no-zaps">No zaps received yet</div>
        </div>
      </div>
    `;
  }

  // Convert all pubkeys to npubs for immediate display
  const npubs = zapDetails.map(zap => hexToNpub(zap.authorPubkey));

  const skeletonEntries = zapDetails.map((zap, index) => 
    renderSkeletonZapEntry(zap, npubs[index], index)
  ).join('');

  return `
    <div class="zappers-dialog-content">
      <div class="zappers-list">
        ${skeletonEntries}
      </div>
    </div>
  `;
}

/**
 * Progressively enhance zap details with profile information (batched approach)
 */
async function enhanceZapDetailsProgressively(dialog: HTMLDialogElement, zapDetails: ZapDetails[]): Promise<void> {
  const zappersList = dialog.querySelector('.zappers-list') as HTMLElement;
  if (!zappersList) return;

  // Get unique author IDs
  const uniqueAuthorIds = [...new Set(zapDetails.map(zap => zap.authorPubkey))];
  console.log("Nostr-Components: Zappers dialog: Fetching profiles for", uniqueAuthorIds.length, "unique authors");

  try {
    // Fetch all profiles in a single batched call
    const profileResults = await getBatchedProfileMetadata(uniqueAuthorIds);
    
    // Create a map for quick lookup
    const profileMap = new Map<string, any>();
    profileResults.forEach(result => {
      profileMap.set(result.id, result.profile);
    });

    // Convert all pubkeys to npubs for display
    const npubMap = new Map<string, string>();
    uniqueAuthorIds.forEach(pubkey => {
      npubMap.set(pubkey, hexToNpub(pubkey));
    });

    // Process each zap entry
    for (let index = 0; index < zapDetails.length; index++) {
      const zap = zapDetails[index];
      const profile = profileMap.get(zap.authorPubkey);
      const npub = npubMap.get(zap.authorPubkey) || zap.authorPubkey;
      
      let enhanced: EnhancedZapDetails;
      
      if (profile) {
        const profileContent = extractProfileMetadataContent(profile);
        enhanced = {
          ...zap,
          authorName: profileContent.display_name || profileContent.name || npub,
          authorPicture: profileContent.picture,
          authorNpub: npub,
        };
      } else {
        // Fallback if profile not found
        enhanced = {
          ...zap,
          authorName: npub,
          authorNpub: npub,
        };
      }

      // Find the corresponding skeleton entry by index and replace it
      const skeletonEntry = zappersList.querySelector(`[data-zap-index="${index}"]`);
      if (skeletonEntry) {
        const enhancedEntry = renderZapEntry(enhanced, index);
        skeletonEntry.outerHTML = enhancedEntry;
      }
    }

    console.log("Nostr-Components: Zappers dialog: Progressive enhancement completed for", zapDetails.length, "zap entries");
  } catch (error) {
    console.error("Nostr-Components: Zappers dialog: Error in batched profile enhancement", error);
    
    // Fallback to individual processing if batched approach fails
    console.log("Nostr-Components: Zappers dialog: Falling back to individual profile fetching");
    await enhanceZapDetailsIndividually(dialog, zapDetails);
  }
}

/**
 * Fallback: Enhance zap details individually (original approach)
 */
async function enhanceZapDetailsIndividually(dialog: HTMLDialogElement, zapDetails: ZapDetails[]): Promise<void> {
  const zappersList = dialog.querySelector('.zappers-list') as HTMLElement;
  if (!zappersList) return;

  // Create a map to track which profiles we've already fetched
  const profileCache = new Map<string, EnhancedZapDetails>();
  
  // Fetch all profile metadata in parallel
  const profilePromises = zapDetails.map(async (zap, index) => {
    // Check if we already have this profile cached
    if (profileCache.has(zap.authorPubkey)) {
      const cachedProfile = profileCache.get(zap.authorPubkey)!;
      return {
        index,
        enhanced: {
          ...zap,
          authorName: cachedProfile.authorName,
          authorPicture: cachedProfile.authorPicture,
          authorNpub: cachedProfile.authorNpub,
        }
      };
    }

    try {
      const { getProfileMetadata } = await import('./zap-utils');
      const profileMetadata = await getProfileMetadata(zap.authorPubkey);
      const profileContent = extractProfileMetadataContent(profileMetadata);
      const npub = hexToNpub(zap.authorPubkey);
      
      const enhanced = {
        ...zap,
        authorName: profileContent.display_name || profileContent.name || npub,
        authorPicture: profileContent.picture,
        authorNpub: npub,
      };

      // Cache the profile for other entries from the same author
      profileCache.set(zap.authorPubkey, enhanced);
      
      return {
        index,
        enhanced
      };
    } catch (error) {
      console.error("Nostr-Components: Zappers dialog: Error fetching profile for", zap.authorPubkey, error);
      // Fallback with just pubkey converted to npub
      const npub = hexToNpub(zap.authorPubkey);
      const enhanced = {
        ...zap,
        authorName: npub,
        authorNpub: npub,
      };
      
      // Cache the fallback profile
      profileCache.set(zap.authorPubkey, enhanced);
      
      return {
        index,
        enhanced
      };
    }
  });

  // Process each profile as it becomes available
  for (const promise of profilePromises) {
    try {
      const { index, enhanced } = await promise;
      
      // Find the corresponding skeleton entry by index and replace it
      const skeletonEntry = zappersList.querySelector(`[data-zap-index="${index}"]`);
      if (skeletonEntry) {
        const enhancedEntry = renderZapEntry(enhanced, index);
        skeletonEntry.outerHTML = enhancedEntry;
      }
    } catch (error) {
      console.error("Nostr-Components: Zappers dialog: Error processing profile enhancement", error);
    }
  }
}

