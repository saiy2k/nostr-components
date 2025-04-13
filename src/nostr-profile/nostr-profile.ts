import NDK, { NDKKind, NDKUser, NDKUserProfile } from '@nostr-dev-kit/ndk';
import { DEFAULT_RELAYS } from '../common/constants';
import { maskNPub } from '../common/utils';
import { Theme } from '../common/types';
import { getProfileStyles } from '../common/theme';

export default class NostrProfile extends HTMLElement {
  private rendered: boolean = false;

  private ndk: NDK = new NDK();

  private userProfile: NDKUserProfile = {
    name: '',
    image: '',
    nip05: '',
  };

  private theme: Theme = 'light';

  private isLoading: boolean = true;
  private isStatsLoading: boolean = true;

  private isStatsFollowsLoading: boolean = true;
  private isStatsFollowersLoading: boolean = true;
  private isStatsNotesLoading: boolean = true;
  private isStatsRepliesLoading: boolean = true;
  private isStatsZapsLoading: boolean = true;
  private isStatsRelaysLoading: boolean = true;

  private isError: boolean = false; 
  private isStatsError: boolean = false; 

  private stats = {
    follows: 0,
    followers: 0,
    notes: 0,
    replies: 0,
    zaps: 0,
    relays: 0,
  };

  private onClick: Function | null = null;

  private ndkUser: NDKUser;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

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

  getNDKUser = async () => {
    const npub = this.getAttribute('npub');
    const nip05 = this.getAttribute('nip05');
    const pubkey = this.getAttribute('pubkey');

    if(npub) {
      return this.ndk.getUser({
        npub: npub as string,
      });
    } else if(nip05) {
      return this.ndk.getUserFromNip05(nip05 as string);
    } else if(pubkey) {
      return this.ndk.getUser({
        pubkey: pubkey,
      });
    }

    return null;
  }

  getUserProfile = async () => {
    try {
      this.isLoading = true;

      this.render();

      const user = await this.getNDKUser();

      if(user?.npub) {
        this.ndkUser = user;

        await user.fetchProfile();

        // Check if profile was fetched successfully
        if (user.profile) {
            this.userProfile = user.profile as NDKUserProfile;

            // Fetch stats only if profile exists
            this.getProfileStats()
              .then((stats) => {
                this.isStatsError = false;
                this.stats = stats;
              })
              .catch((err) => {
                console.log(err);
                this.isStatsError = true;
              })
              .finally(() => {
                this.isStatsLoading = false;
                this.render();
              });

            // Set default image only if profile exists but image is missing
            if(!this.userProfile.image) {
                this.userProfile.image = './assets/default_dp.png'
            }
            this.isError = false;
        } else {
            // Profile not found or fetch failed, use default image and clear stats
            console.warn(`Could not fetch profile for user ${user.npub}`);
            this.userProfile.image = './assets/default_dp.png'; 
            this.userProfile.name = '';
            this.userProfile.nip05 = '';
            // Reset stats or show error state for stats?
            this.stats = { follows: 0, followers: 0, notes: 0, replies: 0, zaps: 0, relays: 0 };
            this.isStatsLoading = false; // No longer loading stats
            this.isError = false; // Or true? Let's keep false, but log warning
            this.isStatsError = true; // Indicate stats couldn't be loaded
        }

      } else {
        throw new Error('Either npub or nip05 should be provided');
      }

    } catch(err) {
      this.isError = true;
      throw err;
    } finally {
      this.isLoading = false;
      this.render();
    }
  }

  getProfileStats = async (): Promise<any> => {
    try {
      this.isStatsFollowsLoading = true;
      this.isStatsFollowersLoading = true;
      this.isStatsNotesLoading = true;
      const userHex = this.ndkUser.pubkey as string;
 
      // Get follows
      this.ndkUser.follows()
        .then((follows) => {
          this.stats.follows = follows.size;
          this.isStatsFollowsLoading = false;
          this.render();
        })
        .catch((err) => {
          console.log('Error fetching follows:', err);
        });
  
      // Get followers
      this.ndk.fetchEvents({
        kinds: [NDKKind.Contacts],
        '#p': [userHex || ''],
      })
        .then((followers) => {
          this.stats.followers = followers.size;
          this.isStatsFollowersLoading = false;
          this.render();
        })
        .catch((err) => {
          console.log('Error fetching followers:', err);
        });

      // Get notes and replies
      this.ndk.fetchEvents({
        kinds: [NDKKind.Text],
        authors: [userHex],
      })
        .then((notes) => {
          let replies = 0;
          notes.forEach(note => {
            if(note.hasTag('e')) {
              replies += 1;
            }
          });
          this.stats.replies = replies;
          this.stats.notes = notes.size - replies;
          this.isStatsNotesLoading = false;
          this.render();
        })
        .catch((err) => {
          console.log('Error fetching notes:', err);
        });

      // Zaps (placeholder for now)
      this.stats.zaps = 0;
      this.render();

      // Relays (placeholder for now)
      this.stats.relays = 0;
      this.render();

      return this.stats;

    } catch(err) {
      console.log('getProfileStats', err);
      throw new Error('Error fetching stats');
    }
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
    if (!this.rendered) {
      this.getTheme();
      this.ndk.explicitRelayUrls = this.getRelays();
      await this.connectToNostr(); // Wait for connection attempt
      this.getUserProfile(); // Now fetch profile

      this.rendered = true;
    }
  }

  static get observedAttributes() {
    return ['relays', 'pubkey', 'nip05', 'theme', 'show-npub', 'show-follow', 'onClick'];
  }

  attributeChangedCallback(name: string, _oldValue: string, newValue: string) {
    if(name === 'relays') {
      this.ndk.explicitRelayUrls = this.getRelays();
      this.connectToNostr();
    }

    if(['relays', 'npub', 'nip05'].includes(name)) {
      // Possible property changes - relays, npub, nip05
      // For all these changes, we have to fetch profile anyways
      // TODO: Validate npub
      this.getUserProfile();
    }

    if(name === "onClick") {
      this.onClick = window[newValue];
    }

    if(name === 'theme') {
      this.getTheme();
      this.render();
    }

    if(['show-npub', 'show-follow'].includes(name)) {
      this.render();
    }
  }

  disconnectedCallback() {
    // TODO: Check for cleanup method
  }

  getStyles() {
    return ``;
  }

  renderNpub() {
    const npubAttribute = this.getAttribute('npub');
    const showNpub = this.getAttribute('show-npub');

    if(showNpub === 'false') {
      return '';
    }

    if(showNpub === null && this.userProfile.nip05) {
      return '';
    }

    if (this.ndkUser == null) {
      return '';
    }

    if(!npubAttribute && !this.ndkUser.npub) {
      console.warn('Cannot use showNpub without providing a nPub');
      return '';
    }

    let npub = npubAttribute;

    if(!npub && this.ndkUser && this.ndkUser.npub) {
      npub = this.ndkUser.npub;
    }

    if(!npub) {
        console.warn('Cannot use showNPub without providing a nPub');
        return '';
    }

    return `
      <div class="npub-container">
        ${
            this.isLoading
            ? '<div style="width: 100px; height: 8px; border-radius: 5px" class="skeleton"></div>'
            : `
                <span class="npub full">${npub}</span>
                <span class="npub masked">${maskNPub(npub)}</span>
                <span id="npub-copy" class="copy-button">&#x2398;</span>
            `
        }
      </div>
    `;
  }

  copy(string: string) {
    navigator.clipboard.writeText(string);
  }

  onProfileClick() {

    if(this.isError) {
        return;
    }

    if(this.onClick !== null && typeof this.onClick === 'function')  {
      this.onClick(this.userProfile);
      return;
    }

    let key = '';

    const nip05 = this.getAttribute('nip05');
    const npub = this.getAttribute('npub');

    if(nip05) {
      key = nip05
    } else if(npub) {
      key = npub;
    } else {
      return;
    }

    window.open(`https://njump.me/${key}`, '_blank');
  }

  attachEventListeners() {
    this.shadowRoot!.querySelector('.nostr-profile')?.addEventListener('click', (e) => {
      // Don't trigger profile click if user clicks on website links or follow button
      if(!(e.target as HTMLElement).closest('.nostr-follow-button-container') && 
         !(e.target as HTMLElement).closest('.website a')) {
        this.onProfileClick()
      }
    });

    this.shadowRoot!.querySelector('#npub-copy')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.copy(this.getAttribute('npub') || this.ndkUser.npub || '')
    });

    this.shadowRoot!.querySelector('#nip05-copy')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.copy(this.getAttribute('nip05') || this.userProfile.nip05 || '')
    });
  }

  render() {
    const showNpub = this.getAttribute('show-npub') === 'true';
    const showFollow = this.getAttribute('show-follow') !== 'false';

    if(this.isLoading) {
      this.shadowRoot!.innerHTML = `
        ${getProfileStyles(this.theme)}
        <div class="nostr-profile">
          <div id="profile">
            <div id="profile_banner">
              <div style="width: 100%; height: 100%;" class="skeleton"></div>
            </div>
            <div class="dp_container">
              <div class="avatar_container">
                <div class="avatar_wrapper">
                  <div class="xxl_avatar">
                    <div class="backfill">
                      <div style="width: 100%; height: 100%; border-radius: 50%" class="skeleton"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="profile_actions">
              ${
                this.ndkUser && this.ndkUser.npub && showFollow
                ? `
                  <nostr-follow-button
                    npub="${this.ndkUser.npub}"
                    theme="${this.theme}"
                  ></nostr-follow-button>
                `: ''
              }
            </div>
            <div class="profile_data">
              <div class="basic_info">
                <div class="name">
                  <div style="width: 100px; height: 16px; border-radius: 20px" class="skeleton"></div>
                </div>
              </div>
              <div class="nip05-wrapper">
                <div class="nip05-container">
                  <div style="width: 75px; height: 8px; border-radius: 20px" class="skeleton"></div>
                  ${this.renderNpub()}
                </div>
              </div>
            </div>
            <div class="about">
              <div style="width: 100%; height: 12px; border-radius: 20px; margin-bottom: 12px" class="skeleton"></div>
              <div style="width: 40%; height: 12px; border-radius: 20px" class="skeleton"></div>
            </div>
            <div class="links">
              <div style="width: 150px; height: 12px; border-radius: 20px" class="skeleton"></div>
            </div>
          </div>
          <div class="stats" data-orientation="horizontal">
            ${
              this.isStatsError
              ? `<p class="error-text">Error loading stats</p>`
              : `
                <button class="stat" data-orientation="horizontal">
                  <div class="stat-inner">
                    <div class="stat-value">
                      ${
                        this.isStatsNotesLoading
                        ? '<div style="width: 50px; height: 28px; border-radius: 5px" class="skeleton"></div>'
                        : this.stats.notes
                      }
                    </div>
                    <div class="stat-name">Notes</div>
                  </div>
                </button>
                
                <button class="stat" data-orientation="horizontal">
                  <div class="stat-inner">
                    <div class="stat-value">
                      ${
                        this.isStatsNotesLoading
                        ? '<div style="width: 50px; height: 28px; border-radius: 5px" class="skeleton"></div>'
                        : this.stats.replies
                      }
                    </div>
                    <div class="stat-name">Replies</div>
                  </div></button>
                
                <!-- TODO: Add zaps after resolving the doubts
                <button class="stat" data-orientation="horizontal">
                  <div class="stat-inner">
                    <div class="stat-value">
                      ${
                        this.isStatsLoading
                        ? '<div style="width: 50px; height: 28px; border-radius: 5px" class="skeleton"></div>'
                        : this.stats.zaps
                      }
                    </div>
                    <div class="stat-name">Zaps</div>
                  </div>
                </button>
                -->
                
                <button class="stat" data-orientation="horizontal">
                  <div class="stat-inner">
                    <div class="stat-value">
                      ${
                        this.isStatsFollowsLoading
                        ? '<div style="width: 50px; height: 28px; border-radius: 5px" class="skeleton"></div>'
                        : this.stats.follows
                      }
                    </div>
                    <div class="stat-name">Following</div>
                  </div>
                </button>

                <button class="stat" data-orientation="horizontal">
                  <div class="stat-inner">
                    <div class="stat-value">
                      ${
                        this.isStatsFollowersLoading
                        ? '<div style="width: 50px; height: 28px; border-radius: 5px" class="skeleton"></div>'
                        : this.stats.followers
                      }
                    </div>
                    <div class="stat-name">Followers</div>
                  </div>
                </button>
                
                <!--
                <button class="stat" data-orientation="horizontal">
                  <div class="stat-inner">
                    <div class="stat-value">
                      ${
                        this.isStatsRelaysLoading
                        ? '<div style="width: 20px; height: 28px; border-radius: 5px" class="skeleton"></div>'
                        : this.stats.relays
                      }
                    </div>
                    <div class="stat-name">Relays</div>
                  </div>
                </button>
                -->
              `
            }
          </div>
        </div>
      `;
      return;
    }

    if(this.isError) {
      this.shadowRoot!.innerHTML = `
        ${getProfileStyles(this.theme)}
        <div class="nostr-profile error-container">
          <div class="error">!</div>
          <span class="error-text">Error fetching profile. Is the npub/nip05 correct?</span>
        </div>
      `;
      return;
    }

    this.shadowRoot!.innerHTML = `
      ${getProfileStyles(this.theme)}
      <div class="nostr-profile">
        <div id="profile">
          <div id="profile_banner">
            ${
              this.isLoading
              ? '<div style="width: 100%; height: 100%;" class="skeleton"></div>'
              : this.userProfile.banner
              ? `
                  <a
                    target="_blank"
                    data-cropped="true"
                    class="profile_image"
                    href="#"
                    data-pswp-width="991"
                    data-pswp-height="330.3333333333333"
                    >
                      <img
                      id="4075d846142df0a70fde5fd340e774697c4a7b4f2fce3635b02e061afcd16139"
                      src="${this.userProfile.banner}"
                      width="524px"/>
                    </a>
                `
              : '<div class="banner-placeholder"></div>'
            }
          </div>
          <div class="dp_container">
            <div class="avatar_container">
              <div class="avatar_wrapper">
                <div class="xxl_avatar">
                  <div class="backfill">
                    ${
                      this.isLoading
                      ? '<div style="width: 100%; height: 100%; border-radius: 50%" class="skeleton"></div>'
                      : `
                          <a
                            target="_blank"
                            data-cropped="true"
                            class="profile_image roundedImage"
                            href="#"
                            data-pswp-width="991"
                            data-pswp-height="989.6777851901267"
                            ><img
                            id="70f547f7e6e31ae6952f41d75d50a4ac13b9290d5d8e9e9eb89801501de242fd"
                            src="${this.userProfile.image}"
                            width="524px"
                          /></a>
                      `
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="profile_actions">
            ${
              this.ndkUser && this.ndkUser.npub && showFollow
              ? `
                <nostr-follow-button
                  npub="${this.ndkUser.npub}"
                  theme="${this.theme}"
                ></nostr-follow-button>
              `: ''
            }
          </div>
          <div class="profile_data">
            <div class="basic_info">
              <div class="name">
                ${
                  this.isLoading
                  ? '<div style="width: 100px; height: 16px; border-radius: 20px" class="skeleton"></div>'
                  : `
                      <div class="name-text">${this.userProfile.displayName || this.userProfile.name}</div>
                  `
                }
              </div>
            </div>
            <div class="nip05-wrapper">
              <div class="nip05-container">
                ${
                  this.isLoading
                  ? '<div style="width: 75px; height: 8px; border-radius: 20px" class="skeleton"></div>'
                  :
                    this.userProfile.nip05
                    ? `<div class="nip05">
                        <span>${this.userProfile.nip05}</span>
                        <span id="nip05-copy" class="copy-button">&#x2398;</span>
                      </div>`
                    : ''
                }
                ${this.renderNpub()}
              </div>
            </div>
          </div>
          
          <div class="about">
            ${
              this.isLoading
              ? `
                  <div style="width: 100%; height: 12px; border-radius: 20px; margin-bottom: 12px" class="skeleton"></div>
                  <div style="width: 40%; height: 12px; border-radius: 20px" class="skeleton"></div>
              `
              : this.userProfile.about || ''
            }
          </div>
          <div class="links">
            ${
              this.isLoading
              ? '<div style="width: 150px; height: 12px; border-radius: 20px" class="skeleton"></div>'
              : this.userProfile.website
                ? `
                    <div class="website">
                      <a target="_blank" href="${this.userProfile.website}"
                      >${this.userProfile.website}</a
                      >
                    </div>
                `
                : ''
            }
          </div>
        </div>
        <div class="stats" data-orientation="horizontal">
          ${
            this.isStatsError
            ? `<p class="error-text">Error loading stats</p>`
            : `
              <button class="stat" data-orientation="horizontal">
                <div class="stat-inner">
                  <div class="stat-value">
                    ${
                      this.isStatsNotesLoading
                      ? '<div style="width: 50px; height: 28px; border-radius: 5px" class="skeleton"></div>'
                      : this.stats.notes
                    }
                  </div>
                  <div class="stat-name">Notes</div>
                </div>
              </button>
              
              <button class="stat" data-orientation="horizontal">
                <div class="stat-inner">
                  <div class="stat-value">
                    ${
                      this.isStatsNotesLoading
                      ? '<div style="width: 50px; height: 28px; border-radius: 5px" class="skeleton"></div>'
                      : this.stats.replies
                    }
                  </div>
                  <div class="stat-name">Replies</div>
                </div></button>
              
              <!-- TODO: Add zaps after resolving the doubts
              <button class="stat" data-orientation="horizontal">
                <div class="stat-inner">
                  <div class="stat-value">
                    ${
                      this.isStatsLoading
                      ? '<div style="width: 50px; height: 28px; border-radius: 5px" class="skeleton"></div>'
                      : this.stats.zaps
                    }
                  </div>
                  <div class="stat-name">Zaps</div>
                </div>
              </button>
              -->
              
              <button class="stat" data-orientation="horizontal">
                <div class="stat-inner">
                  <div class="stat-value">
                    ${
                      this.isStatsFollowsLoading
                      ? '<div style="width: 50px; height: 28px; border-radius: 5px" class="skeleton"></div>'
                      : this.stats.follows
                    }
                  </div>
                  <div class="stat-name">Following</div>
                </div>
              </button>

              <button class="stat" data-orientation="horizontal">
                <div class="stat-inner">
                  <div class="stat-value">
                    ${
                      this.isStatsFollowersLoading
                      ? '<div style="width: 50px; height: 28px; border-radius: 5px" class="skeleton"></div>'
                      : this.stats.followers
                    }
                  </div>
                  <div class="stat-name">Followers</div>
                </div>
              </button>
              
              <!--
              <button class="stat" data-orientation="horizontal">
                <div class="stat-inner">
                  <div class="stat-value">
                    ${
                      this.isStatsRelaysLoading
                      ? '<div style="width: 20px; height: 28px; border-radius: 5px" class="skeleton"></div>'
                      : this.stats.relays
                    }
                  </div>
                  <div class="stat-name">Relays</div>
                </div>
              </button>
              -->
            `
          }
        </div>
      </div>
    `;

    this.attachEventListeners();
  }
}

customElements.define("nostr-profile", NostrProfile);
