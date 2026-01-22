// SPDX-License-Identifier: MIT

// Import for side effects to register the custom element
import '../base/dialog-component/dialog-component';
import type { DialogComponent } from '../base/dialog-component/dialog-component';
import { getLikersDialogStyles } from './dialog-likers-style';
import { getBatchedProfileMetadata, extractProfileMetadataContent } from '../nostr-zap-button/zap-utils';
import { escapeHtml, formatRelativeTime, hexToNpub, isValidUrl } from '../common/utils';
import { LikeDetails } from './like-utils';

/**
 * Modal dialog for displaying individual like details (likers).
 * 
 * Shows a list of all users who liked a URL with:
 * - User's name
 * - User's profile picture
 * - Time of like (relative time)
 * - Clickable links to user profiles via njump.me
 */

export interface OpenLikersModalParams {
  likeDetails: LikeDetails[];
  theme?: 'light' | 'dark';
  relays?: string[];
}

/**
 * Inject likers dialog content styles into document head
 * Prevents duplicate injection by checking for existing styles
 */
export const injectLikersDialogStyles = (theme: 'light' | 'dark' = 'light') => {
  // Remove existing likers dialog styles
  const existingStyles = document.querySelectorAll('style[data-likers-dialog-styles]');
  existingStyles.forEach(style => style.remove());
  
  const style = document.createElement('style');
  style.setAttribute('data-likers-dialog-styles', 'true');
  style.textContent = getLikersDialogStyles(theme);
  document.head.appendChild(style);
}

interface EnhancedLikeDetails extends LikeDetails {
  authorName?: string;
  authorPicture?: string;
  authorNpub?: string;
}

/**
 * Render individual like entry HTML (with profile data)
 */
function renderLikeEntry(like: EnhancedLikeDetails, index: number): string {
  const authorNameSafe = escapeHtml(like.authorName || 'Unknown liker');
  const npubSafe = like.authorNpub || hexToNpub(like.authorPubkey);
  const njumpUrl = `https://njump.me/${npubSafe}`;
  const profilePictureSafe = isValidUrl(like.authorPicture || '') ? like.authorPicture || '' : '';
  
  const profilePicture = profilePictureSafe 
    ? `<img src="${profilePictureSafe}" alt="${authorNameSafe}" class="like-author-picture" />`
    : `<div class="like-author-picture-default">👤</div>`;
  
  const isDislike = like.content === '-';
  const statusText = isDislike ? 'Disliked' : 'Liked';
  const statusClass = isDislike ? 'disliked' : 'liked';
  
  return `
    <div class="like-entry" data-like-index="${index}" data-author-pubkey="${like.authorPubkey}">
      <div class="like-author-info">
        ${profilePicture}
        <div class="like-author-details">
          <a href="${njumpUrl}" target="_blank" rel="noopener noreferrer" class="like-author-link">
            ${authorNameSafe}
          </a>
          <div class="like-date">
            ${formatRelativeTime(Math.floor(like.date.getTime() / 1000))}
            <span class="like-status ${statusClass}">${statusText}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render skeleton like entry HTML (with npub)
 */
function renderSkeletonLikeEntry(like: LikeDetails, npub: string, index: number): string {
  const isDislike = like.content === '-';
  const statusText = isDislike ? 'Disliked' : 'Liked';
  const statusClass = isDislike ? 'disliked' : 'liked';
  
  return `
    <div class="like-entry skeleton-entry" data-like-index="${index}" data-author-pubkey="${like.authorPubkey}">
      <div class="like-author-info">
        <div class="skeleton-picture"></div>
        <div class="like-author-details">
          <div class="like-author-link skeleton-name">
            ${escapeHtml(npub)}
          </div>
          <div class="like-date">
            ${formatRelativeTime(Math.floor(like.date.getTime() / 1000))}
            <span class="like-status ${statusClass}">${statusText}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Opens the likers dialog showing individual like details
 */
export async function openLikersDialog(params: OpenLikersModalParams): Promise<DialogComponent> {
  const { likeDetails, theme = 'light', relays } = params;
  
  // Inject styles
  injectLikersDialogStyles(theme);
  
  // Ensure custom element is defined
  if (!customElements.get('dialog-component')) {
    await customElements.whenDefined('dialog-component');
  }
  
  // Create dialog component (not added to DOM)
  const dialogComponent = document.createElement('dialog-component') as DialogComponent;
  dialogComponent.setAttribute('header', 'Likers');
  if (params.theme) {
    dialogComponent.setAttribute('data-theme', params.theme);
  }
  
  // Initial content with skeleton loaders showing npubs
  const initialContent = await renderInitialContent(likeDetails);
  dialogComponent.innerHTML = initialContent;
  
  // Show the dialog (this will create and append the actual dialog element)
  dialogComponent.showModal();
  
  // Get the actual dialog element for progressive enhancement
  const dialogElement: HTMLDialogElement | null = 
    dialogComponent.querySelector('.nostr-base-dialog') ||
    dialogComponent.shadowRoot?.querySelector('.nostr-base-dialog') ||
    document.body.querySelector('.nostr-base-dialog');
  
  if (!dialogElement) {
    console.error('[openLikersDialog] Failed to find dialog element after showModal()');
    throw new Error('Dialog element not found. The dialog may not have been created properly.');
  }
  
  // Type assertion: dialog is guaranteed to be non-null after the check above
  const dialog = dialogElement as HTMLDialogElement;
  
  // Start progressive enhancement
  if (dialog && likeDetails.length > 0) {
    enhanceLikeDetailsProgressively(dialog, likeDetails, relays);
  }

  return dialogComponent;
}

/**
 * Render initial dialog content with skeleton loaders showing npubs
 */
async function renderInitialContent(likeDetails: LikeDetails[]): Promise<string> {
  if (likeDetails.length === 0) {
    return `
      <div class="likers-dialog-content">
        <div class="likers-list">
          <div class="no-likes">No likes yet</div>
        </div>
      </div>
    `;
  }

  // Convert all pubkeys to npubs for immediate display
  const npubs = likeDetails.map(like => hexToNpub(like.authorPubkey));

  const skeletonEntries = likeDetails.map((like, index) => 
    renderSkeletonLikeEntry(like, npubs[index], index)
  ).join('');

  return `
    <div class="likers-dialog-content">
      <div class="likers-list">
        ${skeletonEntries}
      </div>
    </div>
  `;
}

/**
 * Progressively enhance like details with profile information (batched approach)
 */
async function enhanceLikeDetailsProgressively(dialog: HTMLDialogElement, likeDetails: LikeDetails[], relays?: string[]): Promise<void> {
  const likersList = dialog.querySelector('.likers-list') as HTMLElement;
  if (!likersList) return;

  // Get unique author IDs
  const uniqueAuthorIds = [...new Set(likeDetails.map(like => like.authorPubkey))];
  console.log("Nostr-Components: Likers dialog: Fetching profiles for", uniqueAuthorIds.length, "unique authors");

  try {
    // Fetch all profiles in a single batched call
    const profileResults = await getBatchedProfileMetadata(uniqueAuthorIds, relays);
    
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

    // Process each like entry
    for (let index = 0; index < likeDetails.length; index++) {
      const like = likeDetails[index];
      const profile = profileMap.get(like.authorPubkey);
      const npub = npubMap.get(like.authorPubkey) || like.authorPubkey;
      
      let enhanced: EnhancedLikeDetails;
      
      if (profile) {
        const profileContent = extractProfileMetadataContent(profile);
        enhanced = {
          ...like,
          authorName: profileContent.display_name || profileContent.name || npub,
          authorPicture: profileContent.picture,
          authorNpub: npub,
        };
      } else {
        // Fallback if profile not found
        enhanced = {
          ...like,
          authorName: npub,
          authorNpub: npub,
        };
      }

      // Find the corresponding skeleton entry by index and replace it
      const skeletonEntry = likersList.querySelector(`[data-like-index="${index}"]`);
      if (skeletonEntry) {
        const enhancedEntry = renderLikeEntry(enhanced, index);
        skeletonEntry.outerHTML = enhancedEntry;
      }
    }

    console.log("Nostr-Components: Likers dialog: Progressive enhancement completed for", likeDetails.length, "like entries");
  } catch (error) {
    console.error("Nostr-Components: Likers dialog: Error in batched profile enhancement", error);
    
    // Fallback to individual processing if batched approach fails
    console.log("Nostr-Components: Likers dialog: Falling back to individual profile fetching");
    await enhanceLikeDetailsIndividually(dialog, likeDetails, relays);
  }
}

/**
 * Fallback: Enhance like details individually (original approach)
 */
async function enhanceLikeDetailsIndividually(dialog: HTMLDialogElement, likeDetails: LikeDetails[], relays?: string[]): Promise<void> {
  const likersList = dialog.querySelector('.likers-list') as HTMLElement;
  if (!likersList) return;

  // Create a map to track which profiles we've already fetched
  const profileCache = new Map<string, EnhancedLikeDetails>();
  
  // Fetch all profile metadata in parallel
  const profilePromises = likeDetails.map(async (like, index) => {
    // Check if we already have this profile cached
    if (profileCache.has(like.authorPubkey)) {
      const cachedProfile = profileCache.get(like.authorPubkey)!;
      return {
        index,
        enhanced: {
          ...like,
          authorName: cachedProfile.authorName,
          authorPicture: cachedProfile.authorPicture,
          authorNpub: cachedProfile.authorNpub,
        }
      };
    }

    try {
      const { getProfileMetadata } = await import('../nostr-zap-button/zap-utils');
      const profileMetadata = await getProfileMetadata(like.authorPubkey, relays);
      const profileContent = extractProfileMetadataContent(profileMetadata);
      const npub = hexToNpub(like.authorPubkey);
      
      const enhanced = {
        ...like,
        authorName: profileContent.display_name || profileContent.name || npub,
        authorPicture: profileContent.picture,
        authorNpub: npub,
      };

      // Cache the profile for other entries from the same author
      profileCache.set(like.authorPubkey, enhanced);
      
      return {
        index,
        enhanced
      };
    } catch (error) {
      console.error("Nostr-Components: Likers dialog: Error fetching profile for", like.authorPubkey, error);
      // Fallback with just pubkey converted to npub
      const npub = hexToNpub(like.authorPubkey);
      const enhanced = {
        ...like,
        authorName: npub,
        authorNpub: npub,
      };
      
      // Cache the fallback profile
      profileCache.set(like.authorPubkey, enhanced);
      
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
      const skeletonEntry = likersList.querySelector(`[data-like-index="${index}"]`);
      if (skeletonEntry) {
        const enhancedEntry = renderLikeEntry(enhanced, index);
        skeletonEntry.outerHTML = enhancedEntry;
      }
    } catch (error) {
      console.error("Nostr-Components: Likers dialog: Error processing profile enhancement", error);
    }
  }
}
