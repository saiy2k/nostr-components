import NDK, { NDKEvent, NDKKind, NDKUserProfile, ProfilePointer } from '@nostr-dev-kit/ndk';
import { nip21 } from 'nostr-tools';
import Glide from '@glidejs/glide';
import { DEFAULT_RELAYS } from '../common/constants';
import { getPostStats, Stats } from '../common/utils';
import { Theme } from '../common/types';
import { getPostStylesLegacy } from '../common/theme';

export default class NostrPost extends HTMLElement {
  private rendered: boolean = false;
  private ndk: NDK = new NDK();

  private isLoading: boolean = true;
  private isError: boolean = false;

  private theme: Theme = 'light';

  private post: NDKEvent | null = null;
  private stats: Stats | null = null;
  private embeddedPosts: Map<string, NDKEvent> = new Map();

  private receivedData: boolean = false;

  private author: NDKUserProfile | null | undefined = {
    name: '',
    image: '',
    nip05: '',
  };

  private onClick: Function | null = null;
  private onAuthorClick: Function | null = null;
  private onMentionClick: Function | null = null;

  connectToNostr = async () => {
    await this.ndk.connect();
  }

  getRelays = () => {
    const userRelays = this.getAttribute('relays');

    if(userRelays) {
      return userRelays.split(',');
    }

    return DEFAULT_RELAYS;
  }

  getTheme = async () => {
    this.theme = 'light';

    const userTheme = this.getAttribute('theme');

    if(userTheme) {
      const isValidTheme = ['light', 'dark'].includes(userTheme);

      if(!isValidTheme) {
        throw new Error(`Invalid theme '${userTheme}'. Accepted values are 'light', 'dark'`);
      }

      this.theme = userTheme as Theme;
    }
  }

  async connectedCallback() {
    const onClick = this.getAttribute("onClick");
    if(onClick !== null) {
      this.onClick = window[onClick];
    }

    const onAuthorClick = this.getAttribute("onAuthorClick");
    if(onAuthorClick !== null) {
      this.onAuthorClick = window[onAuthorClick];
    }

    const onMentionClick = this.getAttribute("onMentionClick");
    if(onMentionClick !== null) {
      this.onMentionClick = window[onMentionClick];
    }

    this.render();

    if (!this.rendered) {
      this.ndk = new NDK({
        explicitRelayUrls: this.getRelays(),
      });

      await this.connectToNostr();
      this.getPost();

      this.rendered = true;
    }
  }

  static get observedAttributes() {
    return ['relays', 'id', 'theme', 'show-stats', 'onClick', 'onAuthorClick', 'onMentionClick'];
  }

  attributeChangedCallback(name: string, _oldValue: string, newValue: string) {
    if(name === 'relays') {
      this.ndk.explicitRelayUrls = this.getRelays();
      this.connectToNostr();
    }

    if(['relays', 'id'].includes(name)) {
      this.getPost();
    }

    if(name === "onClick") {
      this.onClick = window[newValue];
    }

    if(name === "onAuthorClick") {
      this.onAuthorClick = window[newValue];
    }

    if(name === "onMentionClick") {
      this.onMentionClick = window[newValue];
    }

    if(name === 'theme') {
      this.getTheme();
      this.render();
    }

    if(name === "show-stats") {
      this.render();
    }
  }

  async getPost() {
    try {
      this.isLoading = true;
      this.render();

      const noteId = this.getAttribute('id') || '';
      const post = await this.ndk.fetchEvent(noteId);

      if(!this.receivedData) {
        if(!post) {
          this.isError = true;
        } else {
          this.receivedData = true;
          this.post = post;
  
          const author = await this.post?.author.fetchProfile();
          if(author) {
            this.author = author;
          }
  
          const shouldShowStats = this.getAttribute('show-stats');
  
          if(this.post && shouldShowStats) {
            const stats = await getPostStats(this.ndk, this.post.id);
            if(stats) {
              this.stats = stats;
            }
          }
  
          this.isError = false;
        }
      }
    } catch(err) {
      console.log(err)
      this.isError = true;
      throw err;
    } finally {
      this.isLoading = false;
      this.render();
    }
  }

  #_onPostClick() {

    if(this.isError) {
      return;
    }

    if(this.onClick !== null && typeof this.onClick === 'function')  {
      this.onClick(this.post);
      return;
    }

    let id = this.getAttribute('id');

    window.open(`https://njump.me/${id}`, '_blank');
  }

  #_onAuthorClick() {

    if(this.isError) {
      return;
    }

    if(this.onAuthorClick !== null && typeof this.onAuthorClick === 'function')  {
      this.onAuthorClick(this.post?.author.npub, this.author);
      return;
    }

    window.open(`https://njump.me/${this.post?.author.npub}`, '_blank');
  }

  #_onMentionClick(username: string, event: Event) {
    event.preventDefault();
    event.stopPropagation();
    
    // Custom mention handler if provided
    const onMentionClick = this.getAttribute('onMentionClick');
    if(onMentionClick !== null && window[onMentionClick] && typeof window[onMentionClick] === 'function') {
      window[onMentionClick](username);
      return;
    }
    
    // Default behavior: try to find user with this username
    window.open(`https://njump.me/search?q=${encodeURIComponent('@' + username)}`, '_blank');
  }

  async parseText(text: string) {

    let textContent = text;
    let embeddedNotes: {id: string, position: number}[] = [];

    // First capture embedded note references before other processing
    // Example note1abcdef... or nostr:note1abcdef...
    const noteRegex = /(nostr:)?(note[a-zA-Z0-9]{59,60})/g;
    const noteMatches = [...textContent.matchAll(noteRegex)];
    
    for (const match of noteMatches) {
      const fullMatch = match[0];
      const noteId = match[2];
      const position = match.index || 0;
      
      // Store the note ID and its position for later processing
      embeddedNotes.push({
        id: noteId,
        position: position
      });
      
      // Fetch the embedded post
      try {
        if (!this.embeddedPosts.has(noteId)) {
          const embeddedPost = await this.ndk.fetchEvent(noteId);
          if (embeddedPost) {
            this.embeddedPosts.set(noteId, embeddedPost);
          }
        }
      } catch (error) {
        console.error(`Failed to fetch embedded post ${noteId}:`, error);
      }
      
      // Remove the note reference from the text to prevent @ symbols being added
      textContent = textContent.replace(fullMatch, '');
    }

    // Handle Nostr URI schema for mentions
    const nostrURISchemaMatches = textContent.matchAll(new RegExp(nip21.NOSTR_URI_REGEX, 'g'));
    for(let match of nostrURISchemaMatches) {
      const parsedNostrURI = nip21.parse(match[0]);
      const decordedData = parsedNostrURI.decoded.data;

      let pubkey = '';
      if(typeof decordedData === "string") {
        pubkey = decordedData;
      } else {
        pubkey = (decordedData as ProfilePointer).pubkey;
      }

      const user = await this.ndk.getUser({pubkey: pubkey}).fetchProfile();
      const name = user?.displayName || '';

      textContent = textContent.replace(match[0], `<a href="https://njump.me/${parsedNostrURI.value}" target="_blank">@${name}</a>`);
    }

    // Handle Twitter-like mentions (@username)
    const mentionRegex = /(\s|^)@(\w+)/g;
    const mentionMatches = [...textContent.matchAll(mentionRegex)];
    
    for (const match of mentionMatches) {
      const fullMatch = match[0];
      const username = match[2];
      
      // Replace with styled mention
      textContent = textContent.replace(
        fullMatch, 
        `${match[1]}<span class="nostr-mention" data-username="${username}">@${username}</span>`
      );
    }
    
    // Handle URLs
    const regex = /(https:\/\/(?!njump\.me)[\w.-]+(?:\.[\w.-]+)+(?:\/[^\s]*)?)/g;
    const matches = textContent.match(regex);
    const result: any[] = [];

    if (matches) {
      let lastIndex = 0;
      for (const match of matches) {
        const startIndex = textContent.indexOf(match, lastIndex);
        const endIndex = startIndex + match.length;
  
        if (startIndex > lastIndex) {
          result.push({ type: 'text', value: textContent.substring(lastIndex, startIndex) });
        }
  
        const url = new URL(match);
        let type;
  
        if (url.pathname.endsWith('.jpg') || url.pathname.endsWith('.jpeg') || url.pathname.endsWith('.png')) {
          type = 'image';
        } else if (url.pathname.endsWith('.gif')) {
          type = 'gif';
        } else if (url.pathname.endsWith('.mp4') || url.pathname.endsWith('.webm')) {
          type = 'video';
        } else {
          type = 'link';
        }
  
        result.push({ type, value: match });
  
        lastIndex = endIndex;
      }
  
      if (lastIndex < textContent.length) {
        result.push({ type: 'text', value: textContent.substring(lastIndex) });
      }
    } else {
      result.push({ type: 'text', value: textContent });
    }

    // Add embedded notes to the result
    if (embeddedNotes.length > 0) {
      // Sort by position in descending order to avoid affecting earlier positions
      embeddedNotes.sort((a, b) => b.position - a.position);
      
      for (const note of embeddedNotes) {
        result.push({ 
          type: 'embedded-note', 
          noteId: note.id
        });
      }
    }
  
    return result;
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
        placeholder.parentNode?.replaceChild(temp.firstElementChild!, placeholder);
        
        // Add click handlers to the author elements in this embedded post
        const embeddedPost = temp.firstElementChild;
        const authorAvatar = embeddedPost?.querySelector('.embedded-author-avatar');
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

  // TODO: Fix types
  renderContent = (content: any[]) => {
    const html: string[] = [];
    let mediaCount = 0;
    let textBuffer = '';

    for (const item of content) {
      if (item.type === 'text') {
        textBuffer += item.value;
      } else if (item.type === 'embedded-note') {
        // Handle embedded note placeholder
        if (textBuffer) {
          html.push(`<span class="text-content">${textBuffer.replace(/\n/g, '<br />')}</span>`);
          textBuffer = '';
        }
        
        html.push(`<div class="embedded-post-placeholder" data-note-id="${item.noteId}"></div>`);
      } else {
        if (textBuffer) {
          html.push(`<span class="text-content">${textBuffer.replace(/\n/g, '<br />')}</span>`);
          textBuffer = '';
        }

        switch (item.type) {
          case 'image':
            html.push(`<img width="100%" src="${item.value}" alt="Image">`);
            mediaCount++;
            break;
          case 'gif':
            html.push(`<img width="100%" src="${item.value}" alt="GIF">`);
            mediaCount++;
            break;
          case 'video':
            // Leave the thumbnail handling to the browser for regular posts
            // This preserves the original behavior that was working
            html.push(`<video width="100%" src="${item.value}" controls></video>`);
            mediaCount++;
            break;
          case 'link':
            html.push(`<a href="${item.value}">${item.value}</a>`);
            break;
        }
      }
    }
  
    if (textBuffer) {
      html.push(`<span class="text-content">${textBuffer.replace(/\n/g, '<br />')}</span>`);
    }
  
    return html.join('');
  }

  async renderEmbeddedPost(noteId: string) {
    if (!this.embeddedPosts.has(noteId)) {
      return `<div class="embedded-post-error">Unable to load embedded post</div>`;
    }

    const post = this.embeddedPosts.get(noteId)!;
    
    // Fetch author profile
    let authorProfile: NDKUserProfile | null = null;
    try {
      authorProfile = await post.author.fetchProfile();
    } catch (error) {
      console.error("Failed to fetch author profile for embedded post:", error);
    }

    // Format date
    const date = new Date(post.created_at * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    // Process content for media and proper line breaks
    let processedContent = '';
    let mediaHtml = '';
    let mediaItems: {type: string, url: string}[] = [];
    
    // Extract media from content if present
    const urlRegex = /(https:\/\/[\w.-]+(?:\.[\w.-]+)+(?:\/[^\s]*)?)/g;
    const urlMatches = post.content.match(urlRegex);
    let contentWithoutMedia = post.content;
    
    if (urlMatches) {
      for (const url of urlMatches) {
        try {
          // Check if this is an image or video
          if (url.match(/\.(jpeg|jpg|gif|png)$/i)) {
            mediaItems.push({type: 'image', url: url});
            // Remove the URL from content to avoid duplication
            contentWithoutMedia = contentWithoutMedia.replace(url, ' ');
          } else if (url.match(/\.(mp4|webm)$/i)) {
            mediaItems.push({type: 'video', url: url});
            // Remove the URL from content to avoid duplication
            contentWithoutMedia = contentWithoutMedia.replace(url, ' ');
          }
        } catch (error) {
          console.error("Error processing URL in embedded post:", error);
        }
      }
    }
    
    // Process remaining content with proper line breaks
    let content = contentWithoutMedia.trim();
    if (content.length > 280) {
      content = content.substring(0, 277) + '...';
    }
    
    // Replace newlines with <br> tags
    processedContent = content.replace(/\n/g, '<br>');

    // Generate HTML for media - render each media item vertically one after another
    if (mediaItems.length > 0) {
      mediaHtml = `<div class="embedded-media-list">`;
      for (const item of mediaItems) {
        if (item.type === 'image') {
          mediaHtml += `<div class="embedded-media-item"><img src="${item.url}" alt="Embedded image" loading="lazy" /></div>`;
        } else if (item.type === 'video') {
          mediaHtml += `<div class="embedded-media-item"><video src="${item.url}" controls preload="none"></video></div>`;
        }
      }
      mediaHtml += `</div>`;
    }

    return `
      <div class="embedded-post" data-note-id="${noteId}">
        <div class="embedded-post-header">
          <div class="embedded-author-avatar" style="cursor: pointer;">
            ${authorProfile?.image ? `<img src="${authorProfile.image}" alt="Profile">` : ''}
          </div>
          <div class="embedded-author-info" style="cursor: pointer;">
            <span class="embedded-author-name">${authorProfile?.displayName || 'Unknown'}</span>
            ${authorProfile?.nip05 ? `<span class="embedded-author-username">${authorProfile.nip05}</span>` : ''}
          </div>
          <div class="embedded-post-date">${date}</div>
        </div>
        <div class="embedded-post-content">
          ${processedContent}
          ${mediaHtml ? `<div class="embedded-post-media">${mediaHtml}</div>` : ''}
        </div>
      </div>
    `;
  }

  setupMentionClickHandlers() {
    // Add direct click handlers to each mention element
    const mentions = this.querySelectorAll('.nostr-mention');
    mentions.forEach(mention => {
      mention.addEventListener('click', (event) => {
        const username = mention.getAttribute('data-username') || mention.textContent?.slice(1);
        if (username) {
          this.#_onMentionClick(username, event);
        }
      });
    });
    
    // Also add direct click handlers to the main post author header for the main post
    const authorAvatar = this.querySelector('.post-header-left');
    const authorInfo = this.querySelector('.post-header-middle');
    
    if (authorAvatar) {
      authorAvatar.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.#_onAuthorClick();
      });
    }
    
    if (authorInfo) {
      authorInfo.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.#_onAuthorClick();
      });
    }
  }

  async render() {
    const content = this.post?.content ||  '';
    const parsedContent = await this.parseText(content);
    const htmlToRender = this.renderContent(parsedContent);

    let date = '';
    if(this.post && this.post.created_at) {
      date = new Date(this.post.created_at * 1000).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }

    const shouldShowStats = this.getAttribute('show-stats') === "true"; // Check attribute directly

    this.innerHTML = `
    ${getPostStylesLegacy(this.theme)}
    <style>
      .nostr-mention {
        color: #1DA1F2;
        font-weight: 500;
        cursor: pointer;
      }
      
      /* Embedded post styles */
      .embedded-post {
        margin: 10px 0;
        padding: 12px;
        border: 1px solid ${this.theme === 'light' ? '#e1e8ed' : '#38444d'};
        border-radius: 12px;
        background: ${this.theme === 'light' ? '#f8f9fa' : '#192734'};
      }
      
      .embedded-post-header {
        display: flex;
        align-items: center;
        margin-bottom: 8px;
      }
      
      .embedded-author-avatar {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        overflow: hidden;
        margin-right: 8px;
      }
      
      .embedded-author-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      
      .embedded-author-info {
        display: flex;
        flex-direction: column;
        flex: 1;
      }
      
      .embedded-author-name {
        font-weight: bold;
        font-size: 14px;
        color: ${this.theme === 'light' ? '#14171a' : '#ffffff'};
      }
      
      .embedded-author-username {
        font-size: 12px;
        color: ${this.theme === 'light' ? '#657786' : '#8899a6'};
      }
      
      .embedded-post-date {
        font-size: 12px;
        color: ${this.theme === 'light' ? '#657786' : '#8899a6'};
      }
      
      .embedded-post-content {
        font-size: 14px;
        color: ${this.theme === 'light' ? '#14171a' : '#ffffff'};
        line-height: 1.4;
        white-space: pre-line;
      }
      
      .embedded-post-media {
        margin-top: 10px;
      }
      
      .embedded-media-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      
      .embedded-media-item {
        width: 100%;
        border-radius: 8px;
        overflow: hidden;
      }
      
      .embedded-media-item img,
      .embedded-media-item video {
        width: 100%;
        max-height: 300px;
        object-fit: contain;
        display: block;
      }
      
      .embedded-post-error {
        padding: 10px;
        color: #721c24;
        background-color: #f8d7da;
        border: 1px solid #f5c6cb;
        border-radius: 4px;
        font-size: 14px;
      }
    </style>
    <div class="post-container">
        <div class="post-header">
          <div class="post-header-left">
            <div class="author-picture">
              ${
                this.isLoading
                ? '<div style="width: 35px; height: 35px; border-radius: 50%;" class="skeleton"></div>'
                : this.isError
                  ? ``
                  : `<img src="${this.author?.image}" />`
              }
              </div>
          </div>
          <div class="post-header-middle">
            ${
              this.isLoading
              ? `
                <div style="width: 70%; height: 10px; border-radius: 10px;" class="skeleton"></div>
                <div style="width: 80%; height: 8px; border-radius: 10px; margin-top: 5px;" class="skeleton"></div>
              `
              : this.isError
                ? ''
                : `
                  ${
                    this.author?.displayName
                    ? `<span class="author-name">${this.author?.displayName}</span>`
                    : ''
                  }
                  ${
                    this.author?.nip05
                    ? `<span class="author-username">${this.author?.nip05}</span>`
                    : ''
                  }
                  
                `
            }
          </div>
          <div class="post-header-right">
            ${
              this.isLoading
              ? '<div style="width: 100px; height: 10px; border-radius: 10px;" class="skeleton"></div>'
              : this.isError
                ? ''
                : `<span class="post-date">${date}</span>`
            }
          </div>
        </div>

        <div class="post-body">
            ${
              this.isLoading
              ? `
                <div style="width: 100%; height: 10px; border-radius: 10px; margin-bottom: 15px;" class="skeleton"></div>
                <div style="width: 100%; height: 10px; border-radius: 10px; margin-bottom: 15px;" class="skeleton"></div>
                <div style="width: 30%; height: 10px; border-radius: 10px;" class="skeleton"></div>
              `
              : this.isError
                ? `
                  <div class='error-container'>
                    <div class="error">&#9888;</div>
                    <span class="error-text">Unable to load post</span>
                  </div>
                  <div style="text-align: center; margin-top: 8px">
                    <small class="error-text" style="font-weight: normal">Please check console for more information</small>
                  </div>
                `
                : htmlToRender
            }
        </div>


        ${
          !shouldShowStats
          ? ''
          : `
            <div class="post-footer">
            ${
              this.isLoading
              ? `
                <div class='stats-container'>
                    <div class="stat">
                      <div style="width: 42px; height: 20px; border-radius: 4px;" class="skeleton"></div>
                    </div>

                    <div class="stat">
                      <div style="width: 42px; height: 20px; border-radius: 4px;" class="skeleton"></div>
                    </div>

                    <div class="stat">
                      <div style="width: 42px; height: 20px; border-radius: 4px;" class="skeleton"></div>
                    </div>
                  </div>
                `
              : this.isError || this.stats == null
                ? ''
                : `
                  <div class='stats-container'>
                    <div class="stat">
                      <svg width="18" height="18" fill="#00b3ff">
                        <path xmlns="http://www.w3.org/2000/svg" d="M1.5 5.5C1.5 4.09987 1.5 3.3998 1.77248 2.86502C2.01217 2.39462 2.39462 2.01217 2.86502 1.77248C3.3998 1.5 4.09987 1.5 5.5 1.5H12.5C13.9001 1.5 14.6002 1.5 15.135 1.77248C15.6054 2.01217 15.9878 2.39462 16.2275 2.86502C16.5 3.3998 16.5 4.09987 16.5 5.5V10C16.5 11.4001 16.5 12.1002 16.2275 12.635C15.9878 13.1054 15.6054 13.4878 15.135 13.7275C14.6002 14 13.9001 14 12.5 14H10.4031C9.88308 14 9.62306 14 9.37435 14.051C9.15369 14.0963 8.94017 14.1712 8.73957 14.2737C8.51347 14.3892 8.31043 14.5517 7.90434 14.8765L5.91646 16.4668C5.56973 16.7442 5.39636 16.8829 5.25045 16.8831C5.12356 16.8832 5.00352 16.8255 4.92436 16.7263C4.83333 16.6123 4.83333 16.3903 4.83333 15.9463V14C4.05836 14 3.67087 14 3.35295 13.9148C2.49022 13.6836 1.81635 13.0098 1.58519 12.147C1.5 11.8291 1.5 11.4416 1.5 10.6667V5.5Z" stroke-width="1.66667" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                      <span>${this.stats!.replies}</span>
                    </div>

                    <div class="stat">
                      <svg width="18" height="18">
                        <g xmlns="http://www.w3.org/2000/svg">
                          <path fill="#ff006d" d="M12.2197 1.65717C7.73973 1.25408 5.14439 0.940234 3.12891 2.6623C0.948817 4.52502 0.63207 7.66213 2.35603 9.88052C3.01043 10.7226 4.28767 11.9877 5.51513 13.1462C6.75696 14.3184 7.99593 15.426 8.60692 15.9671C8.61074 15.9705 8.61463 15.9739 8.61859 15.9774C8.67603 16.0283 8.74753 16.0917 8.81608 16.1433C8.89816 16.2052 9.01599 16.2819 9.17334 16.3288C9.38253 16.3912 9.60738 16.3912 9.81656 16.3288C9.97391 16.2819 10.0917 16.2052 10.1738 16.1433C10.2424 16.0917 10.3139 16.0283 10.3713 15.9774C10.3753 15.9739 10.3792 15.9705 10.383 15.9671C10.994 15.426 12.2329 14.3184 13.4748 13.1462C14.7022 11.9877 15.9795 10.7226 16.6339 9.88052C18.3512 7.67065 18.0834 4.50935 15.8532 2.65572C13.8153 0.961905 11.2476 1.25349 9.49466 2.78774Z"/>
                        </g>
                      </svg>
                      <span>${this.stats!.likes}</span>
                    </div>
                  </div>
                `
              }
            </div>
          `
        }
    </div>
    `;

    // Process embedded posts after rendering the main content
    setTimeout(async () => {
      await this.replaceEmbeddedPostPlaceholders();
      this.setupMentionClickHandlers();
    }, 0);
  }
}

customElements.define("nostr-post", NostrPost);
