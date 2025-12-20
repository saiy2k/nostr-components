var S=Object.defineProperty;var L=(e,o,t)=>o in e?S(e,o,{enumerable:!0,configurable:!0,writable:!0,value:t}):e[o]=t;var n=(e,o,t)=>L(e,typeof o!="symbol"?o+"":o,t);import{e as k,g as $,N as p}from"../assets/base-styles-Cn9HxXPz.js";import{N as z}from"../assets/nostr-user-component-BglMudsQ.js";import{r as F,a as C,b as E,c as N,d as A}from"../assets/copy-delegation-BTm3jLGa.js";import"../assets/nostr-service-CP2wXEbP.js";import"../assets/user-resolver-29rWDY2s.js";function l(e,o,t){const s=k(e);return`
    <div class="stat" data-orientation="horizontal" aria-busy="${t}" aria-live="polite">
      <div class="stat-inner">
        <div class="stat-value">
          ${t?'<div style="width: 50px; height: 28px; border-radius: 5px" class="skeleton"></div>':o.toLocaleString()}
        </div>
        <div class="stat-name">${s}</div>
      </div>
    </div>
  `}function R(e){const{isLoading:o,isError:t,errorMessage:s,npub:i,userProfile:r,isStatsLoading:d,isStatsFollowersLoading:c,isStatsFollowsLoading:b,isZapsLoading:w,stats:a,showFollow:v,showNpub:m}=e;if(t)return Z(s||"");const h=(r==null?void 0:r.displayName)||(r==null?void 0:r.name)||"",u=(r==null?void 0:r.nip05)||"",x=(r==null?void 0:r.picture)||"",g=(r==null?void 0:r.about)||"",f=(r==null?void 0:r.website)||"",y=()=>!v||i===""?"":`
      <nostr-follow-button
        npub="${i}">
      </nostr-follow-button>
    `;return`
    <div class="nostr-profile-container">
      <div class="profile-banner">
        ${o?'<div style="width: 100%; height: 100%;" class="skeleton"></div>':r!=null&&r.banner?`<img src="${r.banner}" width="524px"/>`:'<div class="banner-placeholder"></div>'}

        <div class="dp-container">
          <div class="avatar" role="img" aria-label="${h}">
            ${o?'<div style="width: 100%; height: 100%; border-radius: 50%" class="skeleton"></div>':`<img
                  src="${x}"
                  alt="${h}"
                  width="142" height="142"
                  loading="lazy" decoding="async"
                  onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 142 142%22%3E%3Crect width=%22142%22 height=%22142%22 fill=%22%23ccc%22/%3E%3C/svg%3E'"
                />`}
          </div>
        </div>
      </div>

      <div class="profile_actions">
        ${v?o?'<div style="width: 100px; height: 36px; border-radius: 18px;" class="skeleton"></div>':y():""}
      </div>
        
      <div class="profile_data">
        ${o?'<div style="width: 100px; height: 24px;" class="skeleton"></div>':F({name:h})}
          
        ${o?'<div style="width: 75px; height: 20px;" class="skeleton"></div>':C(u)}

        ${m?o?'<div style="width: 75px; height: 20px;" class="skeleton"></div>':E(i):""}

        <div class="margin-bottom-md"> </div>
        
        ${o?'<div style="width: 100%; margin-bottom: 12px; height: 18px" class="skeleton"></div>':N({display:g,value:g})}

        <div class="margin-bottom-md"> </div>
        
        ${o?'<div style="width: 150px" class="skeleton"></div>':f?`<div class="website">
              <a target="_blank" href="${f}">${f}</a>
              </div>`:""}
      
        <div class="stats">

          ${l("Following",a.follows,b)}
          
          ${l("Followers",a.followers,c)}

          ${l("Notes",a.notes,d)}
          
          ${l("Replies",a.replies,d)}
          
          ${l("Zaps",a.zaps,w)}
          
        </div>
      </div>
    </div>
  `}function Z(e){return`
    <div class='nostr-profile-container'>
      <div class='nostr-profile-top-container'>
        <div class="error-icon">&#9888;</div>
      </div>
      <div class='nostr-profile-bottom-container'>
        ${e}
      </div>
    </div>
  `}function _(){return $(`
    /* === PROFILE CSS VARIABLES & CONTAINER PATTERN === */
    :host {
      /* Override follow button styles for profile context */
      --nostrc-follow-btn-padding: 5px 8px !important;
      --nostrc-follow-btn-font-size: 14px !important;
      --nostrc-follow-btn-border-radius: 12px !important;
      --nostrc-follow-btn-border: var(--nostrc-border-width) solid var(--nostrc-color-border) !important;
      --nostrc-follow-btn-horizontal-alignment: end !important;
      --nostrc-follow-btn-min-height: auto !important;
      --nostrc-follow-btn-width: 280px;

      /* Component theme variables (fallback to global theme tokens) */
      --nostrc-profile-bg: var(--nostrc-theme-bg, #ffffff);
      --nostrc-profile-text-primary: var(--nostrc-theme-text-primary, #333333);
      --nostrc-profile-text-secondary: var(--nostrc-theme-text-secondary, #666666);
      --nostrc-profile-border: var(--nostrc-theme-border, var(--nostrc-border-width) solid var(--nostrc-color-border));
      --nostrc-profile-banner-placeholder: var(--nostrc-profile-border);
      --nostrc-profile-font-family: var(--nostrc-font-family-primary);
      --nostrc-profile-font-size: var(--nostrc-font-size-base);
      
      /* Hover state variables */
      --nostrc-profile-hover-bg: var(--nostrc-theme-hover-bg, rgba(0, 0, 0, 0.05));
      --nostrc-profile-hover-color: var(--nostrc-theme-text-primary, #333333);
      --nostrc-profile-hover-border: var(--nostrc-theme-hover-border, var(--nostrc-border-width) solid var(--nostrc-color-border));

      /* Make the host the visual profile surface */
      display: block;
      background: var(--nostrc-profile-bg);
      color: var(--nostrc-profile-text-primary);
      border: var(--nostrc-profile-border);
      border-radius: var(--nostrc-border-radius-md);
      font-family: var(--nostrc-profile-font-family);
      font-size: var(--nostrc-profile-font-size);
      transition: background-color var(--nostrc-transition-duration) var(--nostrc-transition-timing);
    }

    .nostr-profile-container {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: var(--nostrc-spacing-md);
      min-height: 500px;
      padding: 0px;
    }

    :host(.is-error) .nostr-profile-container {
      justify-content: center;
      align-items: center;
      color: var(--nostrc-color-error-text);
      border: var(--nostrc-border-width) solid var(--nostrc-color-error-text);
    }

    /* Hover state */
    :host(.is-clickable:hover) {
      background: var(--nostrc-profile-hover-bg);
      color: var(--nostrc-profile-hover-color);
      border: var(--nostrc-profile-hover-border);
    }

    .nostr-profile-top-container img {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      object-fit: cover;
    }

    .nostr-profile-bottom-container {
      min-width: 0;
      text-align: center;
    }

    .profile-banner {
      position: relative;
      width: 100%;
      height: 214px;
      cursor: pointer;
      border-radius: var(--nostrc-border-radius-md) var(--nostrc-border-radius-md) 0px 0px;
    }

    .banner-placeholder {
      width: 100%;
      height: 100%;
      background-color: var(--nostrc-profile-banner-placeholder);
      border-radius: var(--nostrc-border-radius-md) var(--nostrc-border-radius-md) 0px 0px;
    }

    .profile-banner img {
      width: 100%;
      height: 214px;
      object-fit: cover;
    }

    .dp-container {
      position: absolute;
      top: 140px;
      left: var(--nostrc-spacing-md);
    }

    .avatar {
      --avatar-size: 142px;
      --avatar-ring: 4px;

      inline-size: var(--avatar-size);
      block-size: var(--avatar-size);
      border-radius: var(--nostrc-border-radius-full);
      overflow: hidden;

      /* ring + backfill in one place */
      background-color: var(--nostrc-profile-bg);
      border: var(--avatar-ring) solid var(--nostrc-profile-bg);
    }

    .avatar img {
      inline-size: 100%;
      block-size: 100%;
      border-radius: var(--nostrc-border-radius-full);
      display: block;
      object-fit: cover;
    }

    .profile_actions {
      height: 56px;
      align-self: flex-end;
      padding: 0 var(--nostrc-spacing-lg);
    }

    .profile_data {
      padding: var(--nostrc-spacing-md);
    }

    .website {
      font-weight: 400;
      font-size: var(--nostrc-font-size-base);
      line-height: 20px;
      display: flex;
      align-items: center;
    }

    .website a {
      line-height: 20px;
      outline: none;
      color: var(--nostrc-profile-accent);
      max-width: 350px;
      overflow: hidden;
      text-overflow: ellipsis;
      word-wrap: normal;
    }

    .stats {
      position: relative;
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      border-radius: 0;
      border-top: none;
      margin-top: var(--nostrc-spacing-md);
    }

    .stat {
      position: relative;
      display: inline-block;
      padding-inline: var(--nostrc-spacing-md);
      padding-block: var(--nostrc-spacing-xs);
      border: none;
      background: none;
      width: fit-content;
      height: 40px;
      margin: 0 0 var(--nostrc-spacing-md);
    }

    .stat-inner {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    }

    .stat-inner .stat-value {
      font-weight: 100;
      font-size: 1.5em;
      color: var(--nostrc-profile-text-primary);
    }

    .stat-inner .stat-name {
      font-weight: 400;
      line-height: 16px;
      text-transform: lowercase;
      color: var(--nostrc-profile-text-secondary);
    }

    @media only screen and (max-width: 600px) {
      .stat .stat-value {
        font-size: 18px !important;
      }
      :host {
        --nostrc-follow-btn-padding: 5px 8px !important;
        --nostrc-follow-btn-font-size: 12px !important;
        --nostrc-follow-btn-min-height: auto !important;
        --nostrc-follow-btn-border-radius: 8px !important;
        --nostrc-follow-btn-error-max-width: 150px !important;
      }
    }

  `)}const j="nc:profile";class O extends z{constructor(){super(...arguments);n(this,"profileStatus",this.channel("profile"));n(this,"isStatsLoading",!0);n(this,"isStatsFollowsLoading",!0);n(this,"isStatsFollowersLoading",!0);n(this,"isZapsLoading",!0);n(this,"stats",{follows:0,followers:0,notes:0,replies:0,zaps:0,relays:0});n(this,"getUserStats",async()=>{try{this.isStatsLoading=!0,this.isStatsFollowsLoading=!0,this.isStatsFollowersLoading=!0,this.isZapsLoading=!0,this.nostrService.fetchFollows(this.user).then(t=>{this.stats={...this.stats,follows:t},this.isStatsFollowsLoading=!1,this.render()}).catch(t=>{console.error("Error loading follows:",t),this.isStatsFollowsLoading=!1,this.render()}),this.nostrService.fetchFollowers(this.user).then(t=>{this.stats={...this.stats,followers:t},this.isStatsFollowersLoading=!1,this.render()}).catch(t=>{console.error("Error loading followers:",t),this.isStatsFollowersLoading=!1,this.render()}),this.nostrService.fetchNotesAndReplies(this.user).then(([t,s])=>{this.stats={...this.stats,notes:t,replies:s},this.isStatsLoading=!1,this.render()}).catch(t=>{console.error("Error loading notes and replies",t),this.isStatsLoading=!1,this.render()}),this.nostrService.fetchZaps(this.user).then(t=>{this.stats={...this.stats,zaps:t},this.isZapsLoading=!1,this.render()}).catch(t=>{console.error("Error loading Zaps:",t),this.isZapsLoading=!1,this.render()})}catch(t){this.profileStatus.set(p.Error),console.error("getUserStats failed:",t)}finally{this.render()}})}static get observedAttributes(){return[...super.observedAttributes,"show-npub","show-follow"]}async connectedCallback(){var t;(t=super.connectedCallback)==null||t.call(this),this.attachDelegatedListeners(),A({addDelegatedListener:this.addDelegatedListener.bind(this)}),this.render()}onStatusChange(t){this.render()}onUserReady(t,s){this.getUserStats(),this.render()}attributeChangedCallback(t,s,i){var r;s!==i&&((r=super.attributeChangedCallback)==null||r.call(this,t,s,i),(t==="show-npub"||t==="show-follow")&&this.render())}onProfileClick(){var s,i;if(this.profileStatus.get()===p.Error)return;const t=((s=this.user)==null?void 0:s.npub)||this.getAttribute("npub")||((i=this.profile)==null?void 0:i.nip05)||this.getAttribute("nip05");t&&this.handleNjumpClick(j,this.profile,encodeURIComponent(t))}attachDelegatedListeners(){this.delegateEvent("click",".profile-banner",t=>{t.target.closest(".nc-copy-btn, .nostr-follow-button-container, nostr-follow-button")||this.onProfileClick()})}renderContent(){var c;const t=this.computeOverall()===p.Loading,s=this.computeOverall()===p.Error,i=this.getAttribute("show-npub")==="true",r=this.getAttribute("show-follow")==="true",d={isLoading:t,isError:s,errorMessage:this.errorMessage,npub:((c=this.user)==null?void 0:c.npub)||"",userProfile:this.profile,isStatsLoading:this.isStatsLoading,isStatsFollowersLoading:this.isStatsFollowersLoading,isStatsFollowsLoading:this.isStatsFollowsLoading,isZapsLoading:this.isZapsLoading,stats:{notes:this.stats.notes,replies:this.stats.replies,follows:this.stats.follows,followers:this.stats.followers,zaps:this.stats.zaps,relays:this.stats.relays},showFollow:r,showNpub:i};this.shadowRoot.innerHTML=`
      ${_()}
      ${R(d)}
    `}}customElements.define("nostr-profile",O);export{O as default};
//# sourceMappingURL=nostr-profile.es.js.map
