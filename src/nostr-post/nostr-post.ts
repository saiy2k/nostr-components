import NDK, { NDKEvent, NDKKind, NDKUserProfile, ProfilePointer } from '@nostr-dev-kit/ndk';
import { nip21 } from 'nostr-tools';
import Glide from '@glidejs/glide';
import { DEFAULT_RELAYS } from '../common/constants';
import dayjs from 'dayjs';
import { getPostStats, Stats } from '../common/utils';
import { Theme } from '../common/types';
import { getPostStyles } from '../common/theme';

export default class NostrPost extends HTMLElement {
  private rendered: boolean = false;
  private ndk: NDK = new NDK();

  private isLoading: boolean = true;
  private isError: boolean = false;

  private theme: Theme = 'light';

  private post: NDKEvent | null = null;
  private stats: Stats | null = null;

  private receivedData: boolean = false;

  private author: NDKUserProfile | null | undefined = {
    name: '',
    image: '',
    nip05: '',
  };

  private onClick: Function | null = null;
  private onAuthorClick: Function | null = null;

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

  connectedCallback() {
    const onClick = this.getAttribute("onClick");
    if(onClick !== null) {
      this.onClick = window[onClick];
    }

    const onAuthorClick = this.getAttribute("onAuthorClick");
    if(onAuthorClick !== null) {
      this.onAuthorClick = window[onAuthorClick];
    }

      this.render();

      if (!this.rendered) {
        this.ndk = new NDK({
          explicitRelayUrls: this.getRelays(),
        });

        this.connectToNostr();
        this.getPost();

        this.rendered = true;
      }

  }

  static get observedAttributes() {
    return ['relays', 'id', 'theme', 'show-stats', 'onClick', 'onAuthorClick'];
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

  attachEventListeners() {
    this.querySelector('.post-container')?.addEventListener('click', (e) => {
      const targetElement = e.target as HTMLElement;

      if(targetElement.closest('.post-header-left') || targetElement.closest('.post-header-middle')) {
        this.#_onAuthorClick();
      } else {
        this.#_onPostClick();
      }
    });
  }

    parseText = async (text: string) => {

      let textContent = text;

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

        const regex = /(https:\/\/(?!njump\.me)[\w.-]+(?:\.[\w.-]+)+(?:\/[^\s]*)?)/g;
        const matches = textContent.match(regex);
        const result: any[] = [];

        if ( matches) {
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
      
        return result;
    }

    // TODO: Fix types
    renderContent = (content: any[]) => {
        const html: string[] = [];
        let mediaCount = 0;
        let textBuffer = '';

        for (const item of content) {
          if (item.type === 'text') {
            textBuffer += item.value;
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
      
        if (mediaCount > 1) {
          const carouselHtml: string[] = [];
          let bullets = '';

          for (let i = 0; i < html.length; i++) {
            const item = html[i];
            if (item.startsWith('<img') || item.startsWith('<video')) {
              carouselHtml.push(`<li class="glide__slide">${item}</li>`);
              
              bullets += `<button class="glide__bullet" data-glide-dir="=${i}"></button>`;

              html.splice(i, 1);
              i--;
            }
          }
      
          html.push(`
            <div class="glide" style="margin-top: 20px">
                <div class="glide__track" data-glide-el="track">
                    <ul class="glide__slides">
                        ${carouselHtml.join('')}
                    </ul>
                </div>

                  <div class="glide__bullets" data-glide-el="controls[nav]">
                    ${bullets}
                </div>
            </div>
          `);
        }
      
        return html.join('');
    }

    async render() {
        const content = this.post?.content ||  '';
        const parsedContent = await this.parseText(content);
        const htmlToRender = this.renderContent(parsedContent);

        let date = '';
        if(this.post && this.post.created_at) {
          date = dayjs(this.post.created_at * 1000).format('MMM D, YYYY');
        }

        const shouldShowStats = this.getAttribute('show-stats') === "true";

        this.innerHTML = ``;

        this.innerHTML += `
        ${getPostStyles(this.theme)}

        <div class="post-container">
            <div class="post-header">
              <div class="post-header-left">
                <div class=""author-picture>
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

                        <!-- TODO: Add zaps after resolving the doubts
                        <div class="stat">
                          <div style="width: 42px; height: 20px; border-radius: 4px;" class="skeleton"></div>
                        </div>
                        -->

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

                        <!-- TODO: Add zaps after resolving the doubts
                        <div class="stat">
                          <svg width="18" height="18">
                            <g xmlns="http://www.w3.org/2000/svg">
                              <path fill="#ffaf00" fill-rule="evenodd" clip-rule="evenodd" d="M9.49466 2.78774C7.73973 1.25408 5.14439 0.940234 3.12891 2.6623C0.948817 4.52502 0.63207 7.66213 2.35603 9.88052C3.01043 10.7226 4.28767 11.9877 5.51513 13.1462C6.75696 14.3184 7.99593 15.426 8.60692 15.9671C8.61074 15.9705 8.61463 15.9739 8.61859 15.9774C8.67603 16.0283 8.74753 16.0917 8.81608 16.1433C8.89816 16.2052 9.01599 16.2819 9.17334 16.3288C9.38253 16.3912 9.60738 16.3912 9.81656 16.3288C9.97391 16.2819 10.0917 16.2052 10.1738 16.1433C10.2424 16.0917 10.3139 16.0283 10.3713 15.9774C10.3753 15.9739 10.3792 15.9705 10.383 15.9671C10.994 15.426 12.2329 14.3184 13.4748 13.1462C14.7022 11.9877 15.9795 10.7226 16.6339 9.88052C18.3512 7.67065 18.0834 4.50935 15.8532 2.65572C13.8153 0.961905 11.2476 1.25349 9.49466 2.78774Z"/>
                            </g>
                          </svg>
                          <span>${this.stats!.zaps}</span>
                        </div>
                        -->

                        <div class="stat">
                          <svg width="18" height="18">
                            <g xmlns="http://www.w3.org/2000/svg">
                              <path fill="#ff006d" d="M12.2197 1.65717C12.5126 1.36428 12.9874 1.36428 13.2803 1.65717L16.2803 4.65717C16.5732 4.95006 16.5732 5.42494 16.2803 5.71783L13.2803 8.71783C12.9874 9.01072 12.5126 9.01072 12.2197 8.71783C11.9268 8.42494 11.9268 7.95006 12.2197 7.65717L13.9393 5.9375H5.85C5.20757 5.9375 4.77085 5.93808 4.43328 5.96566C4.10447 5.99253 3.93632 6.04122 3.81902 6.10099C3.53677 6.2448 3.3073 6.47427 3.16349 6.75652C3.10372 6.87381 3.05503 7.04197 3.02816 7.37078C3.00058 7.70835 3 8.14507 3 8.7875V8.9375C3 9.35171 2.66421 9.6875 2.25 9.6875C1.83579 9.6875 1.5 9.35171 1.5 8.9375V8.75653C1.49999 8.15281 1.49998 7.65452 1.53315 7.24863C1.56759 6.82706 1.64151 6.43953 1.82698 6.07553C2.1146 5.51104 2.57354 5.0521 3.13803 4.76448C3.50203 4.57901 3.88956 4.50509 4.31113 4.47065C4.71703 4.43748 5.2153 4.43749 5.81903 4.4375L13.9393 4.4375L12.2197 2.71783C11.9268 2.42494 11.9268 1.95006 12.2197 1.65717Z"/>
                              <path fill="#1ded00" d="M15.75 9.6875C15.3358 9.6875 15 10.0233 15 10.4375V10.5875C15 11.2299 14.9994 11.6667 14.9718 12.0042C14.945 12.333 14.8963 12.5012 14.8365 12.6185C14.6927 12.9007 14.4632 13.1302 14.181 13.274C14.0637 13.3338 13.8955 13.3825 13.5667 13.4093C13.2292 13.4369 12.7924 13.4375 12.15 13.4375H4.06066L5.78033 11.7178C6.07322 11.4249 6.07322 10.9501 5.78033 10.6572C5.48744 10.3643 5.01256 10.3643 4.71967 10.6572L1.71967 13.6572C1.42678 13.9501 1.42678 14.4249 1.71967 14.7178L4.71967 17.7178C5.01256 18.0107 5.48744 18.0107 5.78033 17.7178C6.07322 17.4249 6.07322 16.9501 5.78033 16.6572L4.06066 14.9375H12.181C12.7847 14.9375 13.283 14.9375 13.6889 14.9044C14.1104 14.8699 14.498 14.796 14.862 14.6105C15.4265 14.3229 15.8854 13.864 16.173 13.2995C16.3585 12.9355 16.4324 12.5479 16.4669 12.1264C16.5 11.7205 16.5 11.2222 16.5 10.6185V10.4375C16.5 10.0233 16.1642 9.6875 15.75 9.6875Z"/>
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

        if(htmlToRender.includes('glide')) {
          new Glide('.glide').mount();
        }

        this.attachEventListeners();
    }
}

customElements.define("nostr-post", NostrPost);
