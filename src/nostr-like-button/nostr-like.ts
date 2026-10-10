// SPDX-License-Identifier: MIT

import { NostrBaseComponent } from '../base/base-component/nostr-base-component';
import { NCStatus } from '../base/base-component/nostr-base-component';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import { renderLikeButton, RenderLikeButtonOptions, shouldDisableLikeButton } from './render';
import { getLikeButtonStyles } from './style';
import { showHelpDialog } from './dialog-help';
import { isValidUrl } from '../common/utils';
import { 
  fetchCachedLikeStateForUrl,
  fetchLikesForUrl, 
  createLikeEvent,
  createUnlikeEvent,
  hasUserLiked, 
  publishSignedReaction,
  publishToWriteRelays,
  signEvent,
  isDirectoryWriteError,
  restoredViewerLiked,
  LikeCountResult 
} from './like-utils';
import { ensureSignerForAction, hasConnectedSigner } from '../common/auth-onboarding';
import { getCachedPublicKey, getPublicKey } from '../common/nostr-login-service';
import {
  getRelayTransport,
  hasInstalledRelayTransport,
} from '../common/relay-transport';
import { relaysForComponent } from '../common/relay-routing';
import { likeTagUrl } from '../common/url-tags';
import { setTrustedInnerHTML } from '../common/trusted-html';
import { getTrustedActionContext } from '../common/trusted-action-context';
import { isTrustedUserEvent } from '../common/trusted-user-activation';
import {
  applyOptimisticLike,
  applyOptimisticUnlike,
  clampLikeCount,
  rollbackOptimisticLikeState,
  type LikeUiState,
} from './optimistic-state';

/**
 * <nostr-like-button>
 * Attributes:
 *   - url          (optional) : URL to like (default: current page URL)
 *   - text         (optional) : custom text (default "Like") (Max 32 characters)
 *   - relays       (optional) : comma-separated relay URLs
 *   - data-theme   (optional) : "light" | "dark" (default light)
 *   - compact      (optional) : compact icon + numeric-count action-row mode
 *
 * Features:
 *   - URL-based likes using NIP-25 kind 17 events
 *   - Click count to view likers
 */
export default class NostrLike extends NostrBaseComponent {
  protected likeActionStatus  = this.channel('likeAction');
  protected likeListStatus    = this.channel('likeList');

  protected getRelays() {
    return relaysForComponent(this.getAttribute('relays'));
  }

  private currentUrl: string  = '';
  private isLiked: boolean | null = false;
  private likeCount: number   = 0;
  private cachedLikeDetails: LikeCountResult | null = null;
  private loadSeq = 0;
  private actionSeq = 0;
  private isResyncingLikeCount = false;
  private needsResyncLikeCount = false;
  /** created_at of the reaction just published. A directory count older than this is ignored. */
  private pendingReactionAt: number | null = null;

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback?.();
    if (this.likeListStatus.get() === NCStatus.Idle) {
      this.initChannelStatus('likeList', NCStatus.Loading, { reflectOverall: false });
    }
    this.attachDelegatedListeners();
    this.render();
  }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      'url',
      'text',
      'compact'
    ];
  }

  attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null
  ) {
    if (oldValue === newValue) return;
    super.attributeChangedCallback(name, oldValue, newValue);

    if (name === 'compact') {
      this.render();
      return;
    }

    if (name === 'url' || name === 'text') {
      if (name === 'url') {
        // Invalidate any in-flight like/unlike action for the previous URL.
        this.actionSeq++;
        this.pendingReactionAt = null;
      }
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

    if (
      hasInstalledRelayTransport() &&
      !getTrustedActionContext(this)
    ) {
      this.likeActionStatus.set(
        NCStatus.Error,
        'Untrusted extension action',
      );
      this.likeListStatus.set(NCStatus.Error, 'Untrusted extension action');
      return false;
    }

    const urlAttr   = this.getActionUrl();
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

  /** A host relay transport replaces only networking, not the component UI/signer. */
  protected async connectToNostr() {
    if (
      hasInstalledRelayTransport() &&
      !getTrustedActionContext(this)
    ) {
      throw new Error('Untrusted extension action');
    }
    if (!getRelayTransport()) {
      await super.connectToNostr();
      return;
    }

    this.conn.set(NCStatus.Ready);
    this.nostrReadyResolve?.();
    try {
      this.onNostrRelaysConnected();
    } catch (hookError) {
      console.error('Error in onNostrRelaysConnected hook:', hookError);
    }
  }

  /** Private functions */
  /**
   * Lazy initializer for currentUrl - ensures it's set before like/unlike operations
   */
  private getActionUrl(): string {
    return (
      getTrustedActionContext(this)?.url ||
      this.getAttribute('url') ||
      window.location.href
    );
  }

  private ensureCurrentUrl(): void {
    if (!this.currentUrl) {
      this.currentUrl = likeTagUrl(this.getActionUrl()) || '';
    }
  }

  private async updateLikeCount(options?: { quiet?: boolean }) {
    const seq = ++this.loadSeq;
    const pageUrl = this.getActionUrl();
    if (restoredViewerLiked(pageUrl, [], getCachedPublicKey()) === true) {
      this.isLiked = true;
    }
    try {
      await this.ensureNostrConnected();
      if (seq !== this.loadSeq) return;
      this.currentUrl = likeTagUrl(pageUrl) || '';
      if (!options?.quiet) {
        this.likeListStatus.set(NCStatus.Loading);
        this.render();
      }

      // Extension storage is local and fast: restore the user's recent state
      // before the bounded relay query revalidates the count in the background.
      try {
        const cachedIsLiked = await fetchCachedLikeStateForUrl(
          this.currentUrl,
          this.getRelays(),
        );
        if (seq !== this.loadSeq) return;
        if (cachedIsLiked !== null) {
          this.isLiked = cachedIsLiked;
          this.render();
        }
      } catch (cacheError) {
        console.warn('[NostrLike] Failed to restore cached like state:', cacheError);
      }
     
      const result = await fetchLikesForUrl(pageUrl, this.getRelays());
      if (seq !== this.loadSeq) return; // stale
      this.applyRefreshedCount(result);
      await this.applyViewerLike(pageUrl, result, seq);
      if (seq !== this.loadSeq) return;
      this.cachedLikeDetails = result;
      this.likeListStatus.set(NCStatus.Ready);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      console.error('[NostrLike] Failed to fetch like count:', error);
      this.likeListStatus.set(NCStatus.Error, 'Failed to load likes');
    } finally {
      if (seq === this.loadSeq) {
        this.render();
      }
    }
  }

  private applyRefreshedCount(result: LikeCountResult): void {
    const pending = this.pendingReactionAt;
    const activityAt = result.activityAt;
    const directoryCount = activityAt !== undefined;
    const confirmed = typeof activityAt === 'number' && pending != null && activityAt >= pending;
    if (pending != null && directoryCount && !confirmed) return;
    this.likeCount = clampLikeCount(result.totalCount);
    this.pendingReactionAt = null;
  }

  private async applyViewerLike(
    pageUrl: string,
    result: LikeCountResult,
    seq: number,
  ): Promise<void> {
    if (result.isLiked === null) {
      this.isLiked = null;
      return;
    }
    if (typeof result.isLiked === 'boolean') {
      this.isLiked = result.isLiked;
      return;
    }
    let decided = restoredViewerLiked(pageUrl, result.likeDetails, getCachedPublicKey());
    if (decided === null && hasConnectedSigner()) {
      const pubkey = await getPublicKey();
      if (seq !== this.loadSeq) return;
      decided = restoredViewerLiked(pageUrl, result.likeDetails, pubkey);
    }
    if (decided !== null) this.isLiked = decided;
  }

  private queueAuthoritativeCountResync(): void {
    this.needsResyncLikeCount = true;
    if (this.isResyncingLikeCount) return;

    this.isResyncingLikeCount = true;
    void (async () => {
      try {
        while (this.needsResyncLikeCount) {
          this.needsResyncLikeCount = false;
          await this.updateLikeCount();
        }
      } finally {
        this.isResyncingLikeCount = false;
      }
    })();
  }

  private handleLikeMutationFailure(
    error: unknown,
    snapshot: LikeUiState,
    didApplyOptimisticUpdate: boolean,
    fallbackMessage: string
  ): void {
    const restoredState = rollbackOptimisticLikeState({
      current: {
        isLiked: this.isLiked,
        likeCount: this.likeCount,
      },
      snapshot,
      didApplyOptimisticUpdate,
    });

    this.isLiked = restoredState.isLiked;
    this.likeCount = restoredState.likeCount;

    const errorMessage = error instanceof Error ? error.message : fallbackMessage;
    this.likeActionStatus.set(NCStatus.Error, errorMessage);

    this.queueAuthoritativeCountResync();
  }

  private failLikeMutation(
    error: unknown,
    snapshot: LikeUiState,
    didApplyOptimisticUpdate: boolean,
    fallbackMessage: string,
  ): void {
    if (didApplyOptimisticUpdate && isDirectoryWriteError(error)) {
      const errorMessage = error instanceof Error ? error.message : fallbackMessage;
      console.warn('[NostrLike]', errorMessage);
      this.likeActionStatus.set(NCStatus.Ready);
      return;
    }
    this.handleLikeMutationFailure(
      error,
      snapshot,
      didApplyOptimisticUpdate,
      fallbackMessage,
    );
  }

  async #handleLikeClick() {
    if (this.likeActionStatus.get() === NCStatus.Loading) return;

    // Ensure currentUrl is set before proceeding
    this.ensureCurrentUrl();

    // Capture the click target and a sequence token up front: the url attribute
    // can change mid-flight (attributeChangedCallback bumps actionSeq), and a stale
    // action must not sign or publish against the mutated currentUrl. actionSeq is
    // separate from loadSeq so routine count refreshes don't strand this action.
    const targetUrl = this.currentUrl;
    const actionSeq = this.actionSeq;
    const isStale = () => actionSeq !== this.actionSeq || targetUrl !== this.currentUrl;

    if (!targetUrl) {
      this.likeActionStatus.set(NCStatus.Error, 'Invalid URL');
      this.render();
      return;
    }

    this.likeActionStatus.set(NCStatus.Loading);
    this.render();

    try {
      const signerResult = await ensureSignerForAction({
        action: 'like',
        theme: this.theme,
      });

      if (isStale()) return;

      if (signerResult.status === 'dismissed') {
        this.likeActionStatus.set(NCStatus.Ready);
        this.render();
        return;
      }

      if (!signerResult.publicKey) {
        this.likeActionStatus.set(
          NCStatus.Error,
          signerResult.message || 'Connect a Nostr signer to like this page.'
        );
        this.render();
        return;
      }

      // Regular embeds retry a transient relay startup failure here. Extension
      // embeds query through their isolated-world transport instead.
      if (!getRelayTransport()) {
        await this.nostrService.connectToNostr(this.getRelays());
      }

      if (isStale()) return;

      // Check user like status
      this.isLiked = await hasUserLiked(
        this.getActionUrl(),
        signerResult.publicKey,
        this.getRelays()
      );

      if (isStale()) return;

      // If already liked, show confirmation dialog
      if (this.isLiked) {
        const confirmed = window.confirm('You have already liked this. Do you want to unlike it?');
        if (!confirmed) {
          this.likeActionStatus.set(NCStatus.Ready);
          this.render();
          return;
        }

        // Proceed with unlike
        await this.#handleUnlike(targetUrl);
      } else {
        // Proceed with like
        await this.#handleLike(targetUrl);
      }
    } catch (error) {
      console.error('[NostrLike] Failed to check user like status:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to check user like status';
      this.likeActionStatus.set(NCStatus.Error, errorMessage);
      this.render();
    }
  }

  async #handleLike(targetUrl?: string) {
    // Ensure currentUrl is set before proceeding
    this.ensureCurrentUrl();
    const likeUrl = targetUrl ?? this.currentUrl;

    if (!likeUrl) {
      this.likeActionStatus.set(NCStatus.Error, 'Invalid URL');
      this.render();
      return;
    }

    this.likeActionStatus.set(NCStatus.Loading);
    this.render();

    let rollbackSnapshot: LikeUiState = {
      isLiked: this.isLiked,
      likeCount: this.likeCount,
    };
    let didApplyOptimisticUpdate = false;

    try {
      // Create like event
      const event = createLikeEvent(likeUrl);

      // Sign with NIP-07
      const signedEvent = await signEvent(event);

      rollbackSnapshot = {
        isLiked: this.isLiked,
        likeCount: this.likeCount,
      };
      const optimisticState = applyOptimisticLike(rollbackSnapshot);
      this.isLiked = optimisticState.isLiked;
      this.likeCount = optimisticState.likeCount;
      didApplyOptimisticUpdate = true;
      
      // Create NDKEvent and publish
      await publishSignedReaction(signedEvent, this.getRelays(), async () => {
        const ndkEvent = new NDKEvent(this.nostrService.getNDK(), signedEvent);
        await ndkEvent.publish();
      }, getTrustedActionContext(this)?.actionId);
      void publishToWriteRelays(signedEvent, this.getRelays()).catch((error) => {
        console.warn('[NostrLike] Failed to publish to write relays:', error);
      });

      this.pendingReactionAt = Number(signedEvent.created_at);
      await this.updateLikeCount({ quiet: true });
      this.likeActionStatus.set(NCStatus.Ready);
    } catch (error) {
      console.error('[NostrLike] Failed to like:', error);
      this.failLikeMutation(error, rollbackSnapshot, didApplyOptimisticUpdate, 'Failed to like');
    } finally {
      this.render();
    }
  }

  async #handleUnlike(targetUrl?: string) {
    // Ensure currentUrl is set before proceeding
    this.ensureCurrentUrl();
    const unlikeUrl = targetUrl ?? this.currentUrl;

    if (!unlikeUrl) {
      this.likeActionStatus.set(NCStatus.Error, 'Invalid URL');
      this.render();
      return;
    }

    this.likeActionStatus.set(NCStatus.Loading);
    this.render();

    let rollbackSnapshot: LikeUiState = {
      isLiked: this.isLiked,
      likeCount: this.likeCount,
    };
    let didApplyOptimisticUpdate = false;

    try {
      // Create unlike event
      const event = createUnlikeEvent(unlikeUrl);

      // Sign with NIP-07
      const signedEvent = await signEvent(event);

      rollbackSnapshot = {
        isLiked: this.isLiked,
        likeCount: this.likeCount,
      };
      const optimisticState = applyOptimisticUnlike(rollbackSnapshot);
      this.isLiked = optimisticState.isLiked;
      this.likeCount = optimisticState.likeCount;
      didApplyOptimisticUpdate = true;
      
      // Create NDKEvent and publish
      await publishSignedReaction(signedEvent, this.getRelays(), async () => {
        const ndkEvent = new NDKEvent(this.nostrService.getNDK(), signedEvent);
        await ndkEvent.publish();
      }, getTrustedActionContext(this)?.actionId);
      void publishToWriteRelays(signedEvent, this.getRelays()).catch((error) => {
        console.warn('[NostrLike] Failed to publish to write relays:', error);
      });

      this.pendingReactionAt = Number(signedEvent.created_at);
      await this.updateLikeCount({ quiet: true });
      this.likeActionStatus.set(NCStatus.Ready);
    } catch (error) {
      console.error('[NostrLike] Failed to unlike:', error);
      this.failLikeMutation(error, rollbackSnapshot, didApplyOptimisticUpdate, 'Failed to unlike');
    } finally {
      this.render();
    }
  }

  async #handleCountClick() {
    if (this.likeCount === 0 || !this.cachedLikeDetails) {
      return;
    }

    try {
      // Import dialog dynamically to avoid circular dependencies
      const { openLikersDialog } = await import('./dialog-likers');
      await openLikersDialog({
        likeDetails: this.cachedLikeDetails.likeDetails,
        theme: this.theme === 'dark' ? 'dark' : 'light',
        relays: this.getRelays(),
      });
    } catch (error) {
      console.error('[NostrLike] Error opening likers dialog:', error);
    }
  }

  async #handleHelpClick() {
    try {
      await showHelpDialog(this.theme === 'dark' ? 'dark' : 'light');
    } catch (error) {
      console.error('[NostrLike] Error showing help dialog:', error);
    }
  }

  private attachDelegatedListeners() {
    this.delegateEvent('click', '.nostr-like-button', (e) => {
      if (!isTrustedUserEvent(e)) return;
      e.preventDefault?.();
      e.stopPropagation?.();
      void this.#handleLikeClick();
    });

    this.delegateEvent('click', '.like-count.clickable', (e) => {
      if (!isTrustedUserEvent(e)) return;
      e.preventDefault?.();
      e.stopPropagation?.();
      void this.#handleCountClick();
    });

    this.delegateEvent('keydown', '.like-count.clickable', (e: KeyboardEvent) => {
      if (!isTrustedUserEvent(e)) return;
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      e.stopPropagation();
      void this.#handleCountClick();
    });

    this.delegateEvent('click', '.help-icon', (e) => {
      if (!isTrustedUserEvent(e)) return;
      e.preventDefault?.();
      e.stopPropagation?.();
      void this.#handleHelpClick();
    });
  }

  protected renderContent() {
    // console.log(`Like: Render: conn: ${this.conn.get()}, likeActionStatus: ${this.likeActionStatus.get()}, likeListStatus: ${this.likeListStatus.get()}`);
    const compact = this.hasAttribute('compact');
    const isLoading = shouldDisableLikeButton({
      compact,
      actionLoading: this.likeActionStatus.get() === NCStatus.Loading,
      connectionLoading: this.conn.get() === NCStatus.Loading,
    });
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
      compact,
    };

    setTrustedInnerHTML(this.shadowRoot!, `
      ${getLikeButtonStyles()}
      ${renderLikeButton(renderOptions)}
    `);
  }
}

if (!customElements.get('nostr-like-button')) {
  customElements.define('nostr-like-button', NostrLike);
}
