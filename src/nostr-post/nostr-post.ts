// SPDX-License-Identifier: MIT

import { NDKEvent, NDKUser, NDKUserProfile } from '@nostr-dev-kit/ndk';
import { getPostStats, Stats, copyToClipboard } from '../common/utils';
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
  protected embeddedPosts: Map<string, NDKEvent> = new Map();

  protected author: NDKUser | null = null;
  protected authorProfile: NDKUserProfile | null = null;

  private userResolver = new UserResolver(this.nostrService);

  private onClick: ((post: NDKEvent | null) => void) | null = null;
  private onAuthorClick:
    | ((npub: string, author: NDKUserProfile | null | undefined) => void)
    | null = null;

  constructor() {
    super(false);
  }

  async connectedCallback() {

    const onClick = this.getAttribute('onClick');
    if (onClick !== null && (window as any)[onClick]) {
      this.onClick = (window as any)[onClick] as (
        post: NDKEvent | null
      ) => void;
    }

    const onAuthorClick = this.getAttribute('onAuthorClick');
    if (onAuthorClick !== null && (window as any)[onAuthorClick]) {
      this.onAuthorClick = (window as any)[onAuthorClick] as (
        npub: string,
        author: NDKUserProfile | null | undefined
      ) => void;
    }

    super.connectedCallback?.();
    attachCopyDelegation(this);
    this.render();
  }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      'show-stats',
      'onClick',
      'onAuthorClick',
      'onMentionClick',
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

    if (name === 'onClick' && newValue) {
      const handler = (window as any)[newValue];
      if (typeof handler === 'function') {
        this.onClick = handler as (post: NDKEvent | null) => void;
      }
    }

    if (name === 'onAuthorClick' && newValue) {
      const handler = (window as any)[newValue];
      if (typeof handler === 'function') {
        this.onAuthorClick = handler as (
          npub: string,
          author: NDKUserProfile | null | undefined
        ) => void;
      }
    }

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
      const shouldShowStats = this.getAttribute('show-stats');

      if (this.event && shouldShowStats) {
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
      this.render();
    }
  }

  #_onPostClick() {
    /*
    if (this.isError || !this.event) {
      return;
    }
    */

    if (this.onClick) {
      this.onClick(this.event);
      return;
    }

    let id = this.getAttribute('id');

    window.open(`https://njump.me/${id}`, '_blank');
  }

  #_onAuthorClick() {
    /*
    if (this.isError || !this.event?.author.npub) {
      return;
    }
    */

    if (this.onAuthorClick) {
      this.onAuthorClick(this.event!.author.npub, this.authorProfile);
      return;
    }

    window.open(`https://njump.me/${this.event?.author.npub}`, '_blank');
  }

  #_onMentionClick(username: string, event: Event) {
    event.preventDefault();
    event.stopPropagation();

    window.open(`https://njump.me/p/${username}`, '_blank');
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
          image: authorProfile.image || '',
          nip05: authorProfile.nip05 || '',
        }
        : undefined,
      date,
      renderedContent
    );
  }

  async replaceEmbeddedPostPlaceholders() {
    const placeholders = this.querySelectorAll('.embedded-post-placeholder');

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

        // Add click handlers to the author elements in this embedded post
        const embeddedPost = temp.firstElementChild;
        const authorAvatar = embeddedPost?.querySelector(
          '.embedded-author-avatar'
        );
        const authorInfo = embeddedPost?.querySelector('.embedded-author-info');

        if (embeddedPost && authorAvatar && authorInfo) {
          const noteId = embeddedPost.getAttribute('data-note-id');
          if (noteId && this.embeddedPosts.has(noteId)) {
            const post = this.embeddedPosts.get(noteId)!;
            const authorNpub = post.author.npub;

            const handleAuthorClick = (e: Event) => {
              e.preventDefault();
              e.stopPropagation();

              // Open the author's profile
              window.open(`https://njump.me/${authorNpub}`, '_blank');
            };

            authorAvatar.addEventListener('click', handleAuthorClick);
            authorInfo.addEventListener('click', handleAuthorClick);
          }
        }
      }
    }
  }

  setupMentionClickHandlers() {
    // Add direct click handlers to each mention element
    const mentions = this.querySelectorAll('.nostr-mention');
    mentions.forEach(mention => {
      mention.addEventListener('click', event => {
        const username =
          mention.getAttribute('data-username') ||
          mention.textContent?.slice(1);
        if (username) {
          this.#_onMentionClick(username, event);
        }
      });
    });

    // Also add direct click handlers to the main post author header for the main post
    const authorAvatar = this.querySelector('.post-header-left');
    const authorInfo = this.querySelector('.post-header-middle');

    if (authorAvatar) {
      authorAvatar.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        this.#_onAuthorClick();
      });
    }

    if (authorInfo) {
      authorInfo.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        this.#_onAuthorClick();
      });
    }

    // Add click handler for the entire post
    const postContainer = this.querySelector('.post-container');
    if (postContainer) {
      postContainer.addEventListener('click', event => {
        // Only trigger post click if the click wasn't on a child with its own handler
        if (
          event.target === postContainer ||
          ((event.target as HTMLElement).closest('.post-body') &&
            !(event.target as HTMLElement).closest(
              'a, .nostr-mention, video, img'
            ))
        ) {
          this.#_onPostClick();
        }
      });
    }

    // Ensure links, videos, and images don't trigger the post click
    const clickableElements = this.querySelectorAll('a, video, img');
    clickableElements.forEach(element => {
      element.addEventListener('click', event => {
        event.stopPropagation();
      });
    });
  }

  async render() {
    const isLoading = this.computeOverall() == NCStatus.Loading;
    const isError = this.computeOverall() === NCStatus.Error;

    const content = this.event?.content || '';
    const parsedContent = await parseText(content, this.event, this.embeddedPosts, this.nostrService);
    const htmlToRender = await renderContent(parsedContent);
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
      theme: this.theme,
      isLoading: isLoading,
      isError: isError,
      errorMessage: errorMessage,
      author: this.authorProfile,
      date,
      shouldShowStats,
      stats: this.stats,
      htmlToRender,
    };

    // Render the post using the new render function
    this.innerHTML = renderPost(renderOptions);

    // Process embedded posts after rendering the main content
    await this.replaceEmbeddedPostPlaceholders();

    // Add click handlers for mentions and author after rendering everything
    this.setupMentionClickHandlers();

    // Add cursor pointer to post body to indicate it's clickable
    const postBody = this.querySelector('.post-body');
    if (postBody) {
      postBody.setAttribute('style', 'cursor: pointer;');
    }
  }
}

customElements.define('nostr-post', NostrPost);
