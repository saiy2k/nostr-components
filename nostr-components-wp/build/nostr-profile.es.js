var L=Object.defineProperty;var S=(o,e,t)=>e in o?L(o,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):o[e]=t;var a=(o,e,t)=>S(o,typeof e!="symbol"?e+"":e,t);import{g as $,a as p}from"../assets/base-styles-BBUNbLUX.js";import{N as F}from"../assets/nostr-user-component-iH2jRAjq.js";import{r as E,a as C,b as z,c as D}from"../assets/render-name-DxPqJZ3i.js";import{e as N}from"../assets/utils-Blx44Hni.js";import{a as R}from"../assets/copy-delegation-B6WaHIgt.js";import"../assets/nostr-service-w4c-zprD.js";function c(o,e,t){const r=N(o);return`
    <div class="stat" data-orientation="horizontal" aria-busy="${t}" aria-live="polite">
      <div class="stat-inner">
        <div class="stat-value">
          ${t?'<div style="width: 50px; height: 28px; border-radius: 5px" class="skeleton"></div>':e.toLocaleString()}
        </div>
        <div class="stat-name">${r}</div>
      </div>
    </div>
  `}function Z(o){const{theme:e,isLoading:t,isError:r,errorMessage:i,npub:n,userProfile:s,isStatsLoading:l,isStatsFollowersLoading:h,isStatsFollowsLoading:u,isZapsLoading:w,stats:d,showFollow:v,showNpub:m}=o;if(r)return _(i||"");const g=(s==null?void 0:s.displayName)||(s==null?void 0:s.name)||"",x=(s==null?void 0:s.nip05)||"",y=(s==null?void 0:s.image)||"",b=(s==null?void 0:s.about)||"",f=(s==null?void 0:s.website)||"",k=()=>v?`
      <nostr-follow-button
        npub="${v}"
        theme="${e}">
      </nostr-follow-button>
    `:"";return`
    <div class="nostrc-container nostr-profile-container">
      <div class="profile-banner">
        ${t?'<div style="width: 100%; height: 100%;" class="skeleton"></div>':s.banner?`<img src="${s.banner}" width="524px"/>`:'<div class="banner-placeholder"></div>'}

        <div class="dp-container">
          <div class="avatar" role="img" aria-label="${g}">
            ${t?'<div style="width: 100%; height: 100%; border-radius: 50%" class="skeleton"></div>':`<img
                  src="${y}"
                  alt="${g}"
                  width="142" height="142"
                  loading="lazy" decoding="async"
                  onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 142 142%22%3E%3Crect width=%22142%22 height=%22142%22 fill=%22%23ccc%22/%3E%3C/svg%3E'"
                />`}
          </div>
        </div>
      </div>

      <div class="profile_actions">
        ${t?'<div style="width: 100px; height: 36px; border-radius: 18px;" class="skeleton"></div>':k()}
      </div>
        
      <div class="profile_data">
        ${t?'<div style="width: 100px; height: 24px;" class="skeleton"></div>':E({name:g})}
          
        ${t?'<div style="width: 75px; height: 20px;" class="skeleton"></div>':C(x)}

        ${m?t?'<div style="width: 75px; height: 20px;" class="skeleton"></div>':z(n):""}

        <div class="margin-bottom-md"> </div>
        
        ${t?'<div style="width: 100%; margin-bottom: 12px; height: 18px" class="skeleton"></div>':D({display:b,value:b})}

        <div class="margin-bottom-md"> </div>
        
        ${t?'<div style="width: 150px" class="skeleton"></div>':f?`<div class="website">
              <a target="_blank" href="${f}">${f}</a>
              </div>`:""}
      
        <div class="stats">

          ${c("Following",d.follows,u)}
          
          ${c("Followers",d.followers,h)}

          ${c("Notes",d.notes,l)}
          
          ${c("Replies",d.replies,l)}
          
          ${c("Zaps",d.zaps,w)}
          
        </div>
      </div>
    </div>
  `}function _(o){return`
    <div class='nostrc-container nostr-profile-container'>
      <div class='nostr-profile-top-container'>
        <div class="error-icon">&#9888;</div>
      </div>
      <div class='nostr-profile-bottom-container'>
        ${o}
      </div>
    </div>
  `}function j(o){return $(o,`
    /* === PROFILE CONTAINER PATTERN === */
    :host {
      /* Override follow button styles for profile context */
      --nostrc-follow-btn-padding: 5px 8px !important;
      --nostrc-follow-btn-font-size: 14px !important;
      --nostrc-follow-btn-border-radius: 12px !important;
      --nostrc-follow-btn-border-dark: 1px solid #DDDDDD !important;
      --nostrc-follow-btn-border-light: 1px solid #DDDDDD !important;
      --nostrc-follow-btn-horizontal-alignment: end !important;
      --nostrc-follow-btn-min-height: auto !important;
      --nostrc-follow-btn-width: 280px;
    }

    .nostr-profile-container {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: var(--nostrc-spacing-md);

      min-height: 500px;
      padding: 0px;
    }
    
    :host(.is-clickable) .nostrc-container {
      cursor: auto;
    }
    
    :host(.is-clickable) .nostrc-container:hover {
      background-color: var(--nostrc-color-background);
    }

    :host(.is-error) .nostrc-container {
      justify-content: center;
      align-items: center;
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
      background-color: var(--nostrc-color-background);
      border: var(--avatar-ring) solid var(--nostrc-color-background);
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
      color: var(--nostrc-color-accent);
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
      background-color: var(--nostrc-color-background);
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
      color: var(--nostrc-color-text-primary);
    }

    .stat-inner .stat-name {
      font-weight: 400;
      line-height: 16px;
      color: var(--nostrc-color-text-secondary);
      text-transform: lowercase;
    }

    .error-container {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--nostrc-spacing-lg);
      min-height: 500px;
    }

    .error {
      width: 35px;
      height: 35px;
      border-radius: var(--nostrc-border-radius-full);
      background-color: var(--nostrc-color-error-text);
      display: flex;
      justify-content: center;
      align-items: center;
      color: var(--nostrc-color-background);
    }

    .error-text {
      color: var(--nostrc-color-error-text);
      font-weight: bold;
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

  `)}const A="nc:profile";class O extends F{constructor(){super(...arguments);a(this,"profileStatus",this.channel("profile"));a(this,"isStatsLoading",!0);a(this,"isStatsFollowsLoading",!0);a(this,"isStatsFollowersLoading",!0);a(this,"isZapsLoading",!0);a(this,"stats",{follows:0,followers:0,notes:0,replies:0,zaps:0,relays:0});a(this,"getUserStats",async()=>{try{this.isStatsLoading=!0,this.isStatsFollowsLoading=!0,this.isStatsFollowersLoading=!0,this.isZapsLoading=!0,this.nostrService.fetchFollows(this.user).then(t=>{this.stats={...this.stats,follows:t},this.isStatsFollowsLoading=!1,this.render()}).catch(t=>{console.error("Error loading follows:",t),this.isStatsFollowsLoading=!1,this.render()}),this.nostrService.fetchFollowers(this.user).then(t=>{this.stats={...this.stats,followers:t},this.isStatsFollowersLoading=!1,this.render()}).catch(t=>{console.error("Error loading followers:",t),this.isStatsFollowersLoading=!1,this.render()}),this.nostrService.fetchNotesAndReplies(this.user).then(([t,r])=>{this.stats={...this.stats,notes:t,replies:r},this.isStatsLoading=!1,this.render()}).catch(t=>{console.error("Error loading notes and replies",t),this.isStatsLoading=!1,this.render()}),this.nostrService.fetchZaps(this.user).then(t=>{this.stats={...this.stats,zaps:t},this.isZapsLoading=!1,this.render()}).catch(t=>{console.error("Error loading Zaps:",t),this.isZapsLoading=!1,this.render()})}catch(t){this.profileStatus.set(p.Error),console.error("getUserStats failed:",t)}finally{this.render()}})}static get observedAttributes(){return[...super.observedAttributes,"show-npub","show-follow"]}async connectedCallback(){var t;(t=super.connectedCallback)==null||t.call(this),this.attachDelegatedListeners(),R({addDelegatedListener:this.addDelegatedListener.bind(this)}),this.render()}disconnectedCallback(){}onStatusChange(t){this.render()}onUserReady(t,r){this.getUserStats(),this.render()}attributeChangedCallback(t,r,i){var n;r!==i&&((n=super.attributeChangedCallback)==null||n.call(this,t,r,i),(t==="show-npub"||t==="show-follow")&&this.render())}onProfileClick(){var i,n;if(this.profileStatus.get()===p.Error)return;const t=new CustomEvent(A,{detail:this.profile,bubbles:!0,composed:!0,cancelable:!0});if(this.dispatchEvent(t)){const s=((i=this.profile)==null?void 0:i.nip05)||this.getAttribute("nip05")||((n=this.user)==null?void 0:n.npub)||this.getAttribute("npub");s&&window.open(`https://njump.me/${encodeURIComponent(s)}`,"_blank")}}attachDelegatedListeners(){this.delegateEvent("click",".profile-banner",t=>{t.target.closest(".nc-copy-btn, .nostr-follow-button-container, nostr-follow-button")||this.onProfileClick()})}renderContent(){var l,h;const t=this.computeOverall()===p.Loading,r=this.computeOverall()===p.Error,i=this.getAttribute("show-npub")!=="false",n=this.getAttribute("show-follow")!=="false",s={theme:this.theme,isLoading:t,isError:r,errorMessage:this.errorMessage,npub:((l=this.user)==null?void 0:l.npub)||"",userProfile:this.profile,isStatsLoading:this.isStatsLoading,isStatsFollowersLoading:this.isStatsFollowersLoading,isStatsFollowsLoading:this.isStatsFollowsLoading,isZapsLoading:this.isZapsLoading,stats:{notes:this.stats.notes,replies:this.stats.replies,follows:this.stats.follows,followers:this.stats.followers,zaps:this.stats.zaps,relays:this.stats.relays},showFollow:n&&((h=this.user)!=null&&h.npub)?this.user.npub:"",showNpub:i};this.shadowRoot.innerHTML=`
      ${j(this.theme)}
      ${Z(s)}
    `}}customElements.define("nostr-profile",O);
//# sourceMappingURL=nostr-profile.es.js.map
