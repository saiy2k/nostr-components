// SPDX-License-Identifier: MIT

import { NostrBaseComponent } from '../base/base-component/nostr-base-component';
import { NCStatus } from '../base/base-component/nostr-base-component';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import { renderLikeButton, RenderLikeButtonOptions } from './render';
import { getLikeButtonStyles } from './style';
import { showHelpDialog } from './dialog-help';
import { isValidUrl } from '../common/utils';
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
import { normalizeURL } from 'nostr-tools/utils';

/**
 * <nostr-like>
 * Attributes:
 *   - url          (optional) : URL to like (default: current page URL)
 *   - text         (optional) : custom text (default "Like") (Max 32 characters)
 *   - relays       (optional) : comma-separated relay URLs
 *   - data-theme   (optional) : "light" | "dark" (default light)
 * 
 * Features:
 *   - URL-based likes using NIP-25 kind 17 events
 *   - Click count to view likers
 */
export default class NostrLike extends NostrBaseComponent {
  protected likeActionStatus  = this.channel('likeAction');
  protected likeListStatus    = this.channel('likeList');
  
  private currentUrl: string  = '';
  private isLiked: boolean    = false;
  private likeCount: number   = 0;
  private cachedLikeDetails: LikeCountResult | null = null;
  private loadSeq = 0;

  constructor() {
    super();
    this.likeListStatus.set(NCStatus.Loading);
  }

  connectedCallback() {
    super.connectedCallback?.();
    this.attachDelegatedListeners();
    this.render();
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
      this.likeActionStatus.set(NCStatus.Ready);
      this.likeListStatus.set(NCStatus.Loading);
      this.isLiked = false;
      this.errorMessage = '';
      this.updateLikeCount();
      this.render();
    }
  }

  /** Base class functions */
  protected validateInputs(): boolean {
    if (!super.validateInputs()) {
      this.likeActionStatus.set(NCStatus.Idle);
      this.likeListStatus.set(NCStatus.Idle);
      return false;
    }

    const urlAttr   = this.getAttribute('url');
    const textAttr  = this.getAttribute('text');
    const tagName   = this.tagName.toLowerCase();

    let errorMessage: string | null = null;

    if (urlAttr) {
      if (!isValidUrl(urlAttr)) {
        errorMessage = 'Invalid URL format';
      }
    }

    if (textAttr && textAttr.length > 32) {
      errorMessage = 'Max text length: 32 characters';
    }

    if (errorMessage) {
      this.likeActionStatus.set(NCStatus.Error, errorMessage);
      this.likeListStatus.set(NCStatus.Error, errorMessage);
      console.error(`Nostr-Components: ${tagName}: ${errorMessage}`);
      return false;
    }

    return true;
  }

  protected onStatusChange(_status: NCStatus) {
    this.render();
  }

  protected onNostrRelaysConnected() {
    this.updateLikeCount();
    this.render();
  }

  /** Private functions */
  /**
   * Lazy initializer for currentUrl - ensures it's set before like/unlike operations
   */
  private ensureCurrentUrl(): void {
    if (!this.currentUrl) {
      this.currentUrl = normalizeURL(this.getAttribute('url') || window.location.href);
    }
  }

  private async updateLikeCount() {
    const seq = ++this.loadSeq;
    try {
      await this.ensureNostrConnected();
      this.currentUrl = normalizeURL(this.getAttribute('url') || window.location.href);
      this.likeListStatus.set(NCStatus.Loading);
      this.render();
     
      const result = await fetchLikesForUrl(this.currentUrl, this.getRelays());
      if (seq !== this.loadSeq) return; // stale
      this.likeCount = result.totalCount;
      this.cachedLikeDetails = result;
      this.likeListStatus.set(NCStatus.Ready);
    } catch (error) {
      console.error('[NostrLike] Failed to fetch like count:', error);
      this.likeListStatus.set(NCStatus.Error, 'Failed to load likes');
    } finally {
      this.render();
    }
  }

  // TODO: Do onboarding logic here
  private async handleLikeClick() {
    // Ensure currentUrl is set before proceeding
    this.ensureCurrentUrl();
    
    if (!this.currentUrl) {
      this.likeActionStatus.set(NCStatus.Error, 'Invalid URL');
      this.render();
      return;
    }

    this.likeActionStatus.set(NCStatus.Loading);
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
      }
    } catch (error) {
      console.error('[NostrLike] Failed to check user like status:', error);
      this.likeActionStatus.set(NCStatus.Error, 'Failed to check user like status');
    } finally {
      this.render();
    }

    // If already liked, show confirmation dialog
    if (this.isLiked) {
      const confirmed = window.confirm('You have already liked this. Do you want to unlike it?');
      if (!confirmed) {
        this.likeActionStatus.set(NCStatus.Ready);
        this.render();
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
    // Ensure currentUrl is set before proceeding
    this.ensureCurrentUrl();
    
    if (!this.currentUrl) {
      this.likeActionStatus.set(NCStatus.Error, 'Invalid URL');
      this.render();
      return;
    }

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
    // Ensure currentUrl is set before proceeding
    this.ensureCurrentUrl();
    
    if (!this.currentUrl) {
      this.likeActionStatus.set(NCStatus.Error, 'Invalid URL');
      this.render();
      return;
    }

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
      return;
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
    // console.log(`Like: Render: conn: ${this.conn.get()}, likeActionStatus: ${this.likeActionStatus.get()}, likeListStatus: ${this.likeListStatus.get()}`);
    const isLoading = this.likeActionStatus.get() === NCStatus.Loading || this.conn.get() === NCStatus.Loading;
    const isCountLoading = this.likeListStatus.get() === NCStatus.Loading;
    const isError = this.computeOverall() === NCStatus.Error;
    const errorMessage = this.errorMessage;
    const buttonText = this.getAttribute('text') || 'Like';

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
