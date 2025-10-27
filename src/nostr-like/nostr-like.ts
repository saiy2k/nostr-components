// SPDX-License-Identifier: MIT

import { NostrBaseComponent } from '../base/base-component/nostr-base-component';
import { NCStatus } from '../base/base-component/nostr-base-component';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import { renderLikeButton, RenderLikeButtonOptions } from './render';
import { getLikeButtonStyles } from './style';
import { showHelpDialog } from './dialog-help';
import { 
  fetchLikesForUrl, 
  createLikeEvent,
  createUnlikeEvent,
  hasUserLiked, 
  getUserPubkey, 
  signEvent, 
  isNip07Available,
  LikeCountResult 
} from './like-utils';

/**
 * <nostr-like>
 * Attributes:
 *   - url          (optional) : URL to like (default: current page URL)
 *   - relays       (optional) : comma-separated relay URLs
 *   - data-theme   (optional) : "light" | "dark" (default light)
 *   - text         (optional) : custom text (default "Like")
 * 
 * Features:
 *   - URL-based likes using NIP-25 kind 17 events
 *   - One-way like action (no unlike)
 *   - Click count to view likers
 *   - NIP-07 signing support
 */
export default class NostrLike extends NostrBaseComponent {
  protected likeActionStatus = this.channel('likeAction');
  protected likeListStatus = this.channel('likeList');
  
  private currentUrl: string = '';
  private isLiked: boolean = false;
  private likeCount: number = 0;
  private cachedLikeDetails: LikeCountResult | null = null;

  constructor() {
    super();
    this.likeListStatus.set(NCStatus.Loading);
  }

  connectedCallback() {
    super.connectedCallback?.();
    this.initializeComponent();
  }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      'url',
      'text'
    ];
  }

  attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null
  ) {
    if (oldValue === newValue) return;
    super.attributeChangedCallback(name, oldValue, newValue);
    
    if (name === 'url' || name === 'text') {
      this.initializeComponent();
    }
  }

  /** Base class functions */
  protected onStatusChange(_status: NCStatus) {
    this.render();
  }

  /** Private functions */
  private async initializeComponent() {
    try {
      // Get URL
      this.currentUrl = this.getAttribute('url') || window.location.href;
      
      // Validate inputs
      if (!this.validateInputs()) {
        return;
      }

      // Connect to relays
      await this.ensureNostrConnected();
      
      // Attach event listeners
      this.attachDelegatedListeners();
      
      // Fetch like count
      await this.updateLikeCount();
      
      // Don't check user like status during initialization
      // This will be done when user first interacts with the component
      
      // Render
      this.render();
    } catch (error) {
      console.error('[NostrLike] Initialization failed:', error);
      this.likeListStatus.set(NCStatus.Error, 'Failed to initialize');
      this.render();
    }
  }

  protected validateInputs(): boolean {
    const urlAttr = this.getAttribute('url');
    const textAttr = this.getAttribute('text');
    const tagName = this.tagName.toLowerCase();

    let errorMessage: string | null = null;

    if (urlAttr) {
      try {
        new URL(urlAttr);
      } catch {
        errorMessage = 'Invalid URL format';
      }
    }

    if (textAttr && textAttr.length > 128) {
      errorMessage = 'Max text length: 128 characters';
    }

    if (errorMessage) {
      this.likeActionStatus.set(NCStatus.Error, errorMessage);
      this.likeListStatus.set(NCStatus.Error, errorMessage);
      console.error(`Nostr-Components: ${tagName}: ${errorMessage}`);
      return false;
    }

    return true;
  }

  private async updateLikeCount() {
    try {
      this.likeListStatus.set(NCStatus.Loading);
      this.render();
      
      const result = await fetchLikesForUrl(this.currentUrl, this.getRelays());
      this.likeCount = result.totalCount;
      this.cachedLikeDetails = result;
      this.likeListStatus.set(NCStatus.Ready);
    } catch (error) {
      console.error('[NostrLike] Failed to fetch like count:', error);
      this.likeListStatus.set(NCStatus.Error, 'Failed to load likes');
    }
  }

  private async handleLikeClick() {
    if (!isNip07Available()) {
      this.likeActionStatus.set(NCStatus.Error, 
        'Please install a Nostr browser extension (Alby, nos2x, etc.)'
      );
      this.render();
      return;
    }

    // Check user like status
    try {
      const userPubkey = await getUserPubkey();
      if (userPubkey) {
        this.isLiked = await hasUserLiked(this.currentUrl, userPubkey, this.getRelays());
        this.render(); // Update UI to show current state
      }
    } catch (error) {
      console.error('[NostrLike] Failed to check user like status:', error);
    }

    // If already liked, show confirmation dialog
    if (this.isLiked) {
      const confirmed = window.confirm('You have already liked this. Do you want to unlike it?');
      if (!confirmed) {
        return;
      }
      
      // Proceed with unlike
      await this.handleUnlike();
    } else {
      // Proceed with like
      await this.handleLike();
    }
  }

  private async handleLike() {
    this.likeActionStatus.set(NCStatus.Loading);
    this.render();

    try {
      // Create like event
      const event = createLikeEvent(this.currentUrl);
      
      // Sign with NIP-07
      const signedEvent = await signEvent(event);
      
      // Create NDKEvent and publish
      const ndkEvent = new NDKEvent(this.nostrService.getNDK(), signedEvent);
      await ndkEvent.publish();
      
      // Update state optimistically
      this.isLiked = true;
      this.likeCount++;
      this.likeActionStatus.set(NCStatus.Ready);
      
      // Refresh like count to get accurate data
      await this.updateLikeCount();
    } catch (error) {
      console.error('[NostrLike] Failed to like:', error);
      
      // Rollback optimistic update
      this.isLiked = false;
      this.likeCount--;
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to like';
      this.likeActionStatus.set(NCStatus.Error, errorMessage);
    } finally {
      this.render();
    }
  }

  private async handleUnlike() {
    this.likeActionStatus.set(NCStatus.Loading);
    this.render();

    try {
      // Create unlike event
      const event = createUnlikeEvent(this.currentUrl);
      
      // Sign with NIP-07
      const signedEvent = await signEvent(event);
      
      // Create NDKEvent and publish
      const ndkEvent = new NDKEvent(this.nostrService.getNDK(), signedEvent);
      await ndkEvent.publish();
      
      // Update state optimistically
      this.isLiked = false;
      if (this.likeCount > 0) {
        this.likeCount--;
      }
      this.likeActionStatus.set(NCStatus.Ready);
      
      // Refresh like count to get accurate data
      await this.updateLikeCount();
    } catch (error) {
      console.error('[NostrLike] Failed to unlike:', error);
      
      // Rollback optimistic update
      this.isLiked = true;
      this.likeCount++;
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to unlike';
      this.likeActionStatus.set(NCStatus.Error, errorMessage);
    } finally {
      this.render();
    }
  }

  private async handleCountClick() {
    if (this.likeCount === 0 || !this.cachedLikeDetails) {
      return; // No likes to show
    }

    try {
      // Import dialog dynamically to avoid circular dependencies
      const { openLikersDialog } = await import('./dialog-likers');
      await openLikersDialog({
        likeDetails: this.cachedLikeDetails.likeDetails,
        theme: this.theme === 'dark' ? 'dark' : 'light',
      });
    } catch (error) {
      console.error('[NostrLike] Error opening likers dialog:', error);
    }
  }

  private async handleHelpClick() {
    try {
      await showHelpDialog(this.theme === 'dark' ? 'dark' : 'light');
    } catch (error) {
      console.error('[NostrLike] Error showing help dialog:', error);
    }
  }

  private attachDelegatedListeners() {
    this.delegateEvent('click', '.nostr-like-button', (e) => {
      e.preventDefault?.();
      e.stopPropagation?.();
      void this.handleLikeClick();
    });

    this.delegateEvent('click', '.like-count', (e) => {
      e.preventDefault?.();
      e.stopPropagation?.();
      void this.handleCountClick();
    });

    this.delegateEvent('click', '.help-icon', (e) => {
      e.preventDefault?.();
      e.stopPropagation?.();
      this.handleHelpClick();
    });
  }

  protected renderContent() {
    const isLoading = this.computeOverall() === NCStatus.Loading;
    const isError = this.computeOverall() === NCStatus.Error;
    const errorMessage = this.errorMessage;
    const buttonText = this.getAttribute('text') || 'Like';
    const isCountLoading = this.likeListStatus.get() === NCStatus.Loading;

    const renderOptions: RenderLikeButtonOptions = {
      isLoading,
      isError,
      errorMessage,
      buttonText,
      isLiked: this.isLiked,
      likeCount: this.likeCount,
      hasLikes: this.likeCount > 0,
      isCountLoading,
      theme: this.theme as 'light' | 'dark',
    };

    this.shadowRoot!.innerHTML = `
      ${getLikeButtonStyles()}
      ${renderLikeButton(renderOptions)}
    `;
  }
}

customElements.define('nostr-like', NostrLike);
