// SPDX-License-Identifier: MIT

import { NDKEvent, NDKUser, NDKUserProfile } from '@nostr-dev-kit/ndk';
import { getPostStats, Stats } from '../common/utils';
import { renderPost, renderEmbeddedPost, RenderPostOptions } from './render';
import { parseText } from './parse-text';
import { renderContent } from './render-content';
import { NostrEventComponent } from '../base/event-component/nostr-event-component';
import { UserResolver } from '../base/resolvers/user-resolver';
import { attachCopyDelegation } from '../base/copy-delegation';
import { NCStatus } from '../base/base-component/nostr-base-component';

/**
 * TODO:
 *  - Click handlers to use BaseComponent::delegateEvent
 *  - Review entire code to upgrade it to the same standards as other components.
 */
export default class NostrPost extends NostrEventComponent {

  protected stats: Stats | null = null;
  protected statsLoading: boolean = false;
  protected embeddedPosts: Map<string, NDKEvent> = new Map();

  protected author: NDKUser | null = null;
  protected authorProfile: NDKUserProfile | null = null;

  private userResolver = new UserResolver(this.nostrService);

  async connectedCallback() {


    super.connectedCallback?.();
    this.attachDelegatedListeners();
    attachCopyDelegation({
      addDelegatedListener: this.addDelegatedListener.bind(this),
    });
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

    /*
    super.attributeChangedCallback(name, _oldValue, newValue);
    */



  }

  protected async onEventReady(event: any) {
    try {
      const { user, profile } = await this.userResolver.resolveUser({ pubkey: event.pubkey });
      this.author = user;
      this.authorProfile = profile;
      this.getPostStats();
      this.render();
    } catch (err) {
      console.error('[NostrPostComponent] Failed to resolve author:', err);
    }
  }

  async getPostStats() {
    try {
      const shouldShowStats = this.getAttribute('show-stats') === 'true';

      if (this.event && shouldShowStats) {
        this.statsLoading = true;
        this.render(); // Show skeleton loader
        
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
    if (this.computeOverall() !== NCStatus.Ready) return;

    const event = new CustomEvent('nc:post', {
      detail: this.event,
      bubbles: true,
      composed: true,
      cancelable: true,
    });

    const notPrevented = this.dispatchEvent(event);

    if (notPrevented) {
      // Default behavior: open post in new tab
      const id = this.getAttribute('id') || this.event?.id;
      if (id) {
        window.open(`https://njump.me/${id}`, '_blank', 'noopener,noreferrer');
      }
    }
  }

  private onAuthorClick() {
    if (this.computeOverall() !== NCStatus.Ready) return;

    const event = new CustomEvent('nc:author', {
      detail: {
        author: this.author,
        authorProfile: this.authorProfile,
        npub: this.author?.npub
      },
      bubbles: true,
      composed: true,
      cancelable: true,
    });

    const notPrevented = this.dispatchEvent(event);

    if (notPrevented) {
      // Default behavior: open author profile in new tab
      const npub = this.author?.npub;
      if (npub) {
        window.open(`https://njump.me/${npub}`, '_blank', 'noopener,noreferrer');
      }
    }
  }

  private onMentionClick(username: string) {
    if (this.computeOverall() !== NCStatus.Ready) return;

    const event = new CustomEvent('nc:mention', {
      detail: {
        username: username
      },
      bubbles: true,
      composed: true,
      cancelable: true,
    });

    const notPrevented = this.dispatchEvent(event);

    if (notPrevented) {
      // Default behavior: open mention profile in new tab
      window.open(`https://njump.me/p/${username}`, '_blank', 'noopener,noreferrer');
    }
  }

  async renderEmbeddedPost(noteId: string): Promise<string> {
    const post = this.embeddedPosts.get(noteId);
    if (!post) return '<div class="embedded-post-error">Post not found</div>';

    let authorProfile: NDKUserProfile | null = null;
    try {
      authorProfile = await post.author.fetchProfile();
    } catch (error) {
      console.error(
        `Failed to fetch profile for embedded post ${noteId}:`,
        error
      );
    }

    const date = post.created_at
      ? new Date(post.created_at * 1000).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
      : '';

    // Process the post content
    const content = await parseText(post.content, this.event, this.embeddedPosts, this.nostrService);
    const renderedContent = await renderContent(content);

    // Use the renderEmbeddedPost function from the render module
    return renderEmbeddedPost(
      noteId,
      authorProfile
        ? {
          displayName: authorProfile.displayName || '',
          image: authorProfile.picture || '',
          nip05: authorProfile.nip05 || '',
        }
        : undefined,
      date,
      renderedContent
    );
  }

  async replaceEmbeddedPostPlaceholders() {
    const placeholders = this.shadowRoot?.querySelectorAll('.embedded-post-placeholder');

    if (!placeholders) return;

    for (const placeholder of placeholders) {
      const noteId = placeholder.getAttribute('data-note-id');
      if (noteId) {
        const embedHtml = await this.renderEmbeddedPost(noteId);

        // Create a temporary container
        const temp = document.createElement('div');
        temp.innerHTML = embedHtml;

        // Replace the placeholder with the embedded post
        placeholder.parentNode?.replaceChild(
          temp.firstElementChild!,
          placeholder
        );

      }
    }
  }

  private attachDelegatedListeners() {
    // Click anywhere on the post container (except interactive elements)
    this.delegateEvent('click', '.nostr-post-container', (e: Event) => {
      const target = e.target as HTMLElement;
      if (!target.closest('a, .nostr-mention, video, img, .nc-copy-btn, .post-header-left, .post-header-middle')) {
        this.onPostClick();
      }
    });

    // Click on author avatar
    this.delegateEvent('click', '.post-header-left', (e: Event) => {
      this.onAuthorClick();
    });

    // Click on author info (name/username area)
    this.delegateEvent('click', '.post-header-middle', (e: Event) => {
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

    const isLoading = this.computeOverall() == NCStatus.Loading;
    const isError = this.computeOverall() === NCStatus.Error;

    const content = this.event?.content || '';
    const parsedContent = await parseText(content, this.event, this.embeddedPosts, this.nostrService);
    const htmlToRender = renderContent(parsedContent);
    const errorMessage = super.renderError(this.errorMessage);

    console.log(this.event);
    console.log(parsedContent);
    console.log(htmlToRender);

    let date = '';
    if (this.event?.created_at) {
      date = new Date(this.event.created_at * 1000).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }

    const shouldShowStats = this.getAttribute('show-stats') === 'true';

    // Prepare the options for the render function
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

    // Render the post using the new render function
    this.shadowRoot!.innerHTML = renderPost(renderOptions);

    // Process embedded posts after rendering the main content
    await this.replaceEmbeddedPostPlaceholders();
  }
}

customElements.define('nostr-post', NostrPost);
