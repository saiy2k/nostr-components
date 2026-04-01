// SPDX-License-Identifier: MIT

import { NDKEvent, NDKUserProfile } from '@nostr-dev-kit/ndk';
import Glide from '@glidejs/glide';
import {
  filterDirectReplies,
  getPostStats,
  parseBooleanAttribute,
  Stats,
} from '../common/utils';
import { renderPost, RenderPostOptions } from './render';
import { parseText } from './parse-text';
import { renderContent, replaceEmbeddedPostPlaceholders } from './render-content';
import { NostrEventComponent } from '../base/event-component/nostr-event-component';
import { NCStatus } from '../base/base-component/nostr-base-component';
import { getPostStyles } from './style';
import { buildReplyItem, ReplyItem } from './reply-utils';

const EVT_POST = 'nc:post';
const EVT_AUTHOR = 'nc:author';
const EVT_MENTION = 'nc:mention';

export default class NostrPost extends NostrEventComponent {

  protected stats: Stats | null = null;
  protected statsLoading: boolean = false;
  protected embeddedPosts: Map<string, NDKEvent> = new Map();
  protected replyItems: ReplyItem[] = [];
  protected repliesExpanded: boolean = false;
  protected repliesLoaded: boolean = false;
  protected repliesLoading: boolean = false;
  protected repliesError: string | null = null;
  private glideInitialized: boolean = false;
  private cachedParsedContent: string | null = null;
  private cachedHtmlToRender: string | null = null;
  private statsRequestSeq: number = 0;
  private repliesRequestSeq: number = 0;

  async connectedCallback() {
    super.connectedCallback?.();
    this.attachDelegatedListeners();
    this.repliesExpanded = this.shouldShowReplies();
    this.render();
  }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      'show-stats',
      'show-replies',
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
      if (this.shouldShowStats() && this.event) {
        void this.getPostStats();
      } else {
        this.resetStatsState();
        this.render();
      }
    }

    if (name === 'show-replies') {
      this.repliesExpanded = this.shouldShowReplies();

      if (this.event && this.repliesExpanded && !this.repliesLoaded && !this.repliesLoading) {
        void this.loadReplies();
      }

      this.render();
    }
  }

  /** Base class functions */
  protected onStatusChange(_status: NCStatus) {
    this.render();
  }

  protected async onEventReady(_event: any) {
    this.invalidateCache();
    this.resetStatsState();
    this.resetReplyState();

    if (this.shouldShowStats()) {
      void this.getPostStats();
    }

    if (this.repliesExpanded) {
      void this.loadReplies();
    }

    this.render();
  }

  private invalidateCache() {
    this.cachedParsedContent = null;
    this.cachedHtmlToRender = null;
    this.glideInitialized = false;
  }

  private resetStatsState() {
    this.statsRequestSeq++;
    this.stats = null;
    this.statsLoading = false;
  }

  private resetReplyState() {
    this.repliesRequestSeq++;
    this.replyItems = [];
    this.repliesLoaded = false;
    this.repliesLoading = false;
    this.repliesError = null;
    this.repliesExpanded = this.shouldShowReplies();
  }

  private shouldShowStats(): boolean {
    return parseBooleanAttribute(this.getAttribute('show-stats'));
  }

  private shouldShowReplies(): boolean {
    return parseBooleanAttribute(this.getAttribute('show-replies'));
  }

  async getPostStats() {
    const shouldShowStats = this.shouldShowStats();
    const eventId = this.event?.id;

    if (!shouldShowStats || !eventId) {
      this.resetStatsState();
      this.render();
      return;
    }

    const seq = ++this.statsRequestSeq;

    try {
      this.stats = null;
      this.statsLoading = true;
      this.render();
      
      const stats = await getPostStats(
        this.nostrService.getNDK(),
        eventId
      );

      if (seq !== this.statsRequestSeq || this.event?.id !== eventId) {
        return;
      }

      if (stats) {
        this.stats = stats;
      }
    } catch (err) {
      if (seq !== this.statsRequestSeq || this.event?.id !== eventId) {
        return;
      }

      const msg = err instanceof Error ? err.message : 'Failed to load post stats';
      console.error('[NostrPostComponent] ' + msg, err);
      this.eventStatus.set(NCStatus.Error, msg);
    } finally {
      if (seq !== this.statsRequestSeq || this.event?.id !== eventId) {
        return;
      }

      this.statsLoading = false;
      this.render();
    }
  }

  private async loadReplies() {
    const eventId = this.event?.id;

    if (!eventId || this.repliesLoading || this.repliesLoaded) {
      return;
    }

    const seq = ++this.repliesRequestSeq;

    try {
      this.repliesLoading = true;
      this.repliesError = null;
      this.render();

      const replies = await this.nostrService.getNDK().fetchEvents({
        kinds: [1],
        '#e': [eventId],
      });

      if (seq !== this.repliesRequestSeq || this.event?.id !== eventId) {
        return;
      }

      const directReplies = filterDirectReplies(replies, eventId).sort(
        (a, b) => (a.created_at || 0) - (b.created_at || 0)
      );

      const uniqueAuthors = new Map<string, typeof directReplies[number]['author']>();
      for (const reply of directReplies) {
        uniqueAuthors.set(reply.pubkey, reply.author);
      }

      const authorProfiles = await Promise.all(
        Array.from(uniqueAuthors.entries()).map(async ([pubkey, author]) => {
          try {
            const profile = await author.fetchProfile();
            return [pubkey, profile] as const;
          } catch (error) {
            console.error(
              `[NostrPostComponent] Failed to fetch profile for reply author ${pubkey}:`,
              error
            );
            return [pubkey, null] as const;
          }
        })
      );

      if (seq !== this.repliesRequestSeq || this.event?.id !== eventId) {
        return;
      }

      const authorProfileMap = new Map<string, NDKUserProfile | null>(authorProfiles);

      this.replyItems = directReplies.map(reply =>
        buildReplyItem(reply, authorProfileMap.get(reply.pubkey))
      );
      this.repliesLoaded = true;
    } catch (err) {
      if (seq !== this.repliesRequestSeq || this.event?.id !== eventId) {
        return;
      }

      const msg = err instanceof Error ? err.message : 'Failed to load replies';
      console.error('[NostrPostComponent] ' + msg, err);
      this.replyItems = [];
      this.repliesLoaded = false;
      this.repliesError = msg;
    } finally {
      if (seq !== this.repliesRequestSeq || this.event?.id !== eventId) {
        return;
      }

      this.repliesLoading = false;
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

  private onToggleReplies(e: Event) {
    e.preventDefault();

    if (this.repliesExpanded) {
      this.removeAttribute('show-replies');
      return;
    }

    this.setAttribute('show-replies', 'true');
  }

  private attachDelegatedListeners() {
    // Click anywhere on the post container (except interactive elements)
    this.delegateEvent('click', '.nostr-post-container', (_e: Event) => {
      const target = _e.target as HTMLElement;
      if (!target.closest('a, .nostr-mention, video, img, .nc-copy-btn, .post-header-left, .post-header-middle, .reply-toggle-btn, .post-replies')) {
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

    this.delegateEvent('click', '.reply-toggle-btn', (e: Event) => {
      this.onToggleReplies(e);
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

    const shouldShowStats = this.shouldShowStats();

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
      repliesExpanded: this.repliesExpanded,
      repliesLoaded: this.repliesLoaded,
      repliesLoading: this.repliesLoading,
      repliesError: this.repliesError,
      replyItems: this.replyItems,
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
