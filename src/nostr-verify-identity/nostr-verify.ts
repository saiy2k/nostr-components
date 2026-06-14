// SPDX-License-Identifier: MIT

import { nip19 } from 'nostr-tools';
import { NostrBaseComponent, NCStatus } from '../base/base-component/nostr-base-component';
import { renderVerifyIdentity, RenderVerifyOptions, VerifyStep } from './render';
import { getVerifyIdentityStyles } from './style';
import {
  Platform,
  buildProofText,
  buildTweetIntentUrl,
  buildIdentityTag,
  extractTweetId,
  verifyTwitterProof,
  getUserPubkey,
  publishIdentity,
} from './verify-utils';

/**
 * <nostr-verify-identity>
 *
 * A NIP-39 identity verification widget. It walks a Nostr user through proving
 * control of an X/Twitter account and publishes the resulting `i` tag to
 * kind:10011 (and mirrors it into kind:0) — i.e. it *creates* the verified
 * handle→pubkey mappings that a directory/extension can later consume.
 *
 * Verification is client-side and free: Twitter's oEmbed endpoint is loaded via
 * JSONP (no CORS, no backend, no paid X API). See verify-utils.ts.
 *
 * Attributes:
 *   - platform     (optional) : "twitter" (default). Reserved for future platforms.
 *   - handle       (optional) : pre-declare the expected handle; when set, the
 *                               proof tweet MUST be authored by it.
 *   - relays       (optional) : comma-separated relay URLs (publish targets)
 *   - data-theme   (optional) : "light" | "dark"
 *
 * Events:
 *   - nc:verified  : { platform, handle, npub, proofTweetId, publishedKinds }
 */
export default class NostrVerifyIdentity extends NostrBaseComponent {
  protected verifyStatus = this.channel('verify');

  private step: VerifyStep = 'connect';
  private platform: Platform = 'twitter';
  private pubkey = '';
  private npub = '';
  private verifiedHandle = '';
  private proofTweetId = '';
  private publishedKinds: number[] = [];

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback?.();
    this.verifyStatus.set(NCStatus.Ready);
    this.readPlatform();
    this.attachDelegatedListeners();
    this.render();
  }

  static get observedAttributes() {
    return [...super.observedAttributes, 'platform', 'handle'];
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    if (oldValue === newValue) return;
    super.attributeChangedCallback(name, oldValue, newValue);
    if (name === 'platform') {
      this.readPlatform();
      this.render();
    }
    if (name === 'handle') {
      this.render();
    }
  }

  protected onStatusChange(_status: NCStatus) {
    this.render();
  }

  /** Private functions */
  private readPlatform() {
    const p = (this.getAttribute('platform') || 'twitter').toLowerCase();
    this.platform = (['twitter', 'github', 'mastodon', 'telegram'].includes(p) ? p : 'twitter') as Platform;
  }

  private get declaredHandle(): string {
    return (this.getAttribute('handle') || '').trim().replace(/^@/, '');
  }

  private async handleConnect() {
    this.verifyStatus.set(NCStatus.Loading);
    this.render();
    try {
      const pubkey = await getUserPubkey();
      if (!pubkey) {
        this.verifyStatus.set(NCStatus.Error, 'Could not get your Nostr public key. Approve the connection and try again.');
        this.render();
        return;
      }
      this.pubkey = pubkey;
      this.npub = nip19.npubEncode(pubkey);
      this.step = 'proof';
      this.errorMessage = '';
      this.verifyStatus.set(NCStatus.Ready);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to connect';
      this.verifyStatus.set(NCStatus.Error, msg);
    } finally {
      this.render();
    }
  }

  private async handleVerify() {
    // Capture the input value BEFORE re-rendering (innerHTML rewrite clears it).
    const input = this.shadowRoot?.querySelector<HTMLInputElement>('input[name="proof-url"]');
    const raw = input?.value || '';
    const tweetId = extractTweetId(raw);

    if (!tweetId) {
      this.verifyStatus.set(NCStatus.Error, 'Enter a valid tweet URL or numeric status id.');
      this.render();
      return;
    }

    this.step = 'verify';
    this.errorMessage = '';
    this.verifyStatus.set(NCStatus.Loading);
    this.render();

    try {
      const result = await verifyTwitterProof(this.declaredHandle, this.npub, tweetId);
      if (!result.ok || !result.oembed) {
        this.step = 'proof';
        this.verifyStatus.set(NCStatus.Error, result.reason || 'Verification failed.');
        this.render();
        return;
      }

      this.verifiedHandle = result.oembed.handle;
      this.proofTweetId = tweetId;

      await this.ensureNostrConnected();
      const tag = buildIdentityTag(this.platform, this.verifiedHandle, tweetId);
      const { published } = await publishIdentity(this.nostrService.getNDK(), this.pubkey, tag);
      this.publishedKinds = published;

      this.step = 'done';
      this.verifyStatus.set(NCStatus.Ready);
      this.dispatchEvent(new CustomEvent('nc:verified', {
        detail: {
          platform: this.platform,
          handle: this.verifiedHandle,
          npub: this.npub,
          proofTweetId: tweetId,
          publishedKinds: published,
        },
        bubbles: true,
        composed: true,
      }));
    } catch (error) {
      this.step = 'proof';
      const msg = error instanceof Error ? error.message : 'Failed to publish identity';
      this.verifyStatus.set(NCStatus.Error, msg);
    } finally {
      this.render();
    }
  }

  private async handleCopyProof() {
    try {
      await navigator.clipboard?.writeText(buildProofText(this.npub));
    } catch (error) {
      console.error('[NostrVerifyIdentity] clipboard write failed:', error);
    }
  }

  private handleReset() {
    this.step = 'proof';
    this.verifiedHandle = '';
    this.proofTweetId = '';
    this.publishedKinds = [];
    this.errorMessage = '';
    this.verifyStatus.set(NCStatus.Ready);
    this.render();
  }

  private attachDelegatedListeners() {
    this.delegateEvent('click', '[data-action="connect"]', (e) => {
      e.preventDefault?.();
      void this.handleConnect();
    });
    this.delegateEvent('click', '[data-action="verify"]', (e) => {
      e.preventDefault?.();
      void this.handleVerify();
    });
    this.delegateEvent('click', '[data-action="copy-proof"]', (e) => {
      e.preventDefault?.();
      void this.handleCopyProof();
    });
    this.delegateEvent('click', '[data-action="reset"]', (e) => {
      e.preventDefault?.();
      this.handleReset();
    });
  }

  protected renderContent() {
    const isLoading = this.verifyStatus.get() === NCStatus.Loading;
    const isError = this.computeOverall() === NCStatus.Error;

    const options: RenderVerifyOptions = {
      isLoading,
      isError,
      errorMessage: this.errorMessage,
      step: this.step,
      platform: this.platform,
      handle: this.declaredHandle,
      npub: this.npub,
      proofText: buildProofText(this.npub),
      intentUrl: buildTweetIntentUrl(this.npub),
      verifiedHandle: this.verifiedHandle,
      proofTweetId: this.proofTweetId,
      publishedKinds: this.publishedKinds,
      theme: this.theme as 'light' | 'dark',
    };

    this.shadowRoot!.innerHTML = `
      ${getVerifyIdentityStyles()}
      ${renderVerifyIdentity(options)}
    `;
  }
}

if (!customElements.get('nostr-verify-identity')) {
  customElements.define('nostr-verify-identity', NostrVerifyIdentity);
}
