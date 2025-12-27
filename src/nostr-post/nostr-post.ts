// SPDX-License-Identifier: MIT

import { NDKEvent } from '@nostr-dev-kit/ndk';
import Glide from '@glidejs/glide';
import { getPostStats, Stats } from '../common/utils';
import { renderPost, RenderPostOptions } from './render';
import { parseText } from './parse-text';
import { renderContent, replaceEmbeddedPostPlaceholders } from './render-content';
import { NostrEventComponent } from '../base/event-component/nostr-event-component';
import { NCStatus } from '../base/base-component/nostr-base-component';
import { getPostStyles } from './style';

const EVT_POST = 'nc:post';
const EVT_AUTHOR = 'nc:author';
const EVT_MENTION = 'nc:mention';

export default class NostrPost extends NostrEventComponent {

  protected stats: Stats | null = null;
  protected statsLoading: boolean = false;
  protected embeddedPosts: Map<string, NDKEvent> = new Map();
  private glideInitialized: boolean = false;
  private cachedParsedContent: string | null = null;
  private cachedHtmlToRender: string | null = null;

  async connectedCallback() {
    super.connectedCallback?.();
    this.attachDelegatedListeners();
    this.render();
  }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      'show-stats',
    ];
  }

  attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null
  ) {
    if (oldValue === newValue) return;
    super.attributeChangedCallback?.(name, oldValue, newValue);
    if (name === 'show-stats') {
      this.render();
    }
  }

  /** Base class functions */
  protected onStatusChange(_status: NCStatus) {
    this.render();
  }

  protected async onEventReady(_event: any) {
    this.invalidateCache();
    this.getPostStats();
    this.render();
  }

  private invalidateCache() {
    this.cachedParsedContent = null;
    this.cachedHtmlToRender = null;
    this.glideInitialized = false;
  }

  async getPostStats() {
    try {
      const shouldShowStats = this.getAttribute('show-stats') === 'true';

      if (this.event && shouldShowStats) {
        this.statsLoading = true;
        this.render();
        
        const stats = await getPostStats(
          this.nostrService.getNDK(),
          this.event.id
        );
        if (stats) {
          this.stats = stats;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load post stats';
      console.error('[NostrPostComponent] ' + msg, err);
      this.eventStatus.set(NCStatus.Error, msg);
    } finally {
      this.statsLoading = false;
      this.render();
    }
  }

  private onPostClick() {
    const id = this.getAttribute('id') || this.event?.id;
    if (id) {
      this.handleNjumpClick(EVT_POST, this.event, id);
    }
  }

  private onAuthorClick() {
    const key =
      this.author?.npub ||
      this.authorProfile?.nip05;

    if (key) {
      this.handleNjumpClick(EVT_AUTHOR, {
        author: this.author,
        authorProfile: this.authorProfile,
        npub: this.author?.npub
      }, key);
    }
  }

  private onMentionClick(username: string) {
    this.handleNjumpClick(EVT_MENTION, { username }, `p/${username}`);
  }

  private attachDelegatedListeners() {
    // Click anywhere on the post container (except interactive elements)
    this.delegateEvent('click', '.nostr-post-container', (_e: Event) => {
      const target = _e.target as HTMLElement;
      if (!target.closest('a, .nostr-mention, video, img, .nc-copy-btn, .post-header-left, .post-header-middle')) {
        this.onPostClick();
      }
    });

    // Click on author avatar
    this.delegateEvent('click', '.post-header-left', (_e: Event) => {
      this.onAuthorClick();
    });

    // Click on author info (name/username area)
    this.delegateEvent('click', '.post-header-middle', (_e: Event) => {
      this.onAuthorClick();
    });

    // Click on mentions
    this.delegateEvent('click', '.nostr-mention', (e: Event) => {
      const target = e.target as HTMLElement;
      const username = target.getAttribute('data-username') || target.textContent?.slice(1);
      if (username) {
        this.onMentionClick(username);
      }
    });
  }

  protected async renderContent() {

    const isLoading     =   this.computeOverall() == NCStatus.Loading;
    const isError       =   this.computeOverall() === NCStatus.Error;
    const date          =   this.formattedDate;
    const content = this.event?.content || '';
    
    // Cache parsed content to avoid re-parsing on every render
    if (!this.cachedParsedContent || !this.cachedHtmlToRender) {
      const parsedContent = await parseText(content, this.event, this.embeddedPosts, this.nostrService);
      this.cachedParsedContent = JSON.stringify(parsedContent);
      this.cachedHtmlToRender = renderContent(parsedContent);
    }
    
    const htmlToRender  = this.cachedHtmlToRender;
    const errorMessage  = this.errorMessage;

    const shouldShowStats = this.getAttribute('show-stats') === 'true';

    const renderOptions: RenderPostOptions = {
      isLoading: isLoading,
      isError: isError,
      errorMessage: errorMessage,
      author: this.authorProfile,
      date,
      shouldShowStats,
      stats: this.stats,
      statsLoading: this.statsLoading,
      htmlToRender,
    };

    this.shadowRoot!.innerHTML = `
      ${getPostStyles()}
      ${renderPost(renderOptions)}
    `;

    if(htmlToRender.includes('glide') && !this.glideInitialized) {
      // Wait for DOM to be ready
      setTimeout(() => {
        const glideElement = this.shadowRoot?.querySelector('.glide');
        if (glideElement) {
          new Glide(glideElement as HTMLElement).mount();
          this.glideInitialized = true;
        }
      }, 0);
    }

    // Process embedded post placeholders asynchronously after render
    // TODO: This is super bad!
    if (htmlToRender.includes('embedded-post-placeholder')) {
      setTimeout(() => {
        replaceEmbeddedPostPlaceholders(
          this.shadowRoot, 
          this.embeddedPosts, 
          this.event, 
          this.nostrService
        );
      }, 0);
    }
  }
}

if (!customElements.get('nostr-post')) {
  customElements.define('nostr-post', NostrPost);
}
