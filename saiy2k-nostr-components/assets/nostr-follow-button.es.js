var v=Object.defineProperty;var w=(n,e,o)=>e in n?v(n,e,{enumerable:!0,configurable:!0,writable:!0,value:o}):n[e]=o;var f=(n,e,o)=>w(n,typeof e!="symbol"?e+"":e,o);import{d as m}from"../assets/nostr-service-pr_crY62.js";import{N as p}from"../assets/nostr-user-component-BnJsHUrA.js";import{b as y,g as k,a as b}from"../assets/theme-C1r1Zw8r.js";import{e as c,g as S,a as l}from"../assets/base-styles-BNQtJP9X.js";import"../assets/user-resolver-Bo16ugek.js";import"../assets/icons-Dr_d9MII.js";function C({isLoading:n,isError:e,errorMessage:o,isFollowed:t,isFollowing:r,showAvatar:i=!1,user:s,profile:a,customText:h="Follow me on nostr"}){if(r)return F();if(n)return x();if(e)return N(o||"");const u=t?y("light"):i&&s&&(a!=null&&a.image)?`<img src="${c(a.image)}" alt="${c(a.name||s.npub)}" class="user-avatar" />`:k(),g=t?"Followed":`<span>${c(h)}</span>`;return d(u,g)}function x(){return d(b(),"<span>Loading...</span>")}function F(){return d(b(),"<span>Following...</span>")}function N(n){return d('<div class="error-icon">&#9888;</div>',c(n))}function d(n,e){return`
    <div class='nostr-follow-button-container'>
      <div class='nostr-follow-button-left-container'>
        ${n}
      </div>
      <div class='nostr-follow-button-right-container'>
        ${e}
      </div>
    </div>
  `}function L(){return S(`
    /* === FOLLOW BUTTON CONTAINER PATTERN === */
    :host {
      /* Icon sizing (overridable) */
      --nostrc-icon-height: 25px;
      --nostrc-icon-width: 25px;

      /* Follow button CSS variables (overridable by parent components) */
      --nostrc-follow-btn-padding: var(--nostrc-spacing-sm) var(--nostrc-spacing-md);
      --nostrc-follow-btn-border-radius: var(--nostrc-border-radius-md);
      --nostrc-follow-btn-border: var(--nostrc-border-width) solid var(--nostrc-color-border);
      --nostrc-follow-btn-min-height: auto;
      --nostrc-follow-btn-width: auto;
      --nostrc-follow-btn-horizontal-alignment: left;
      --nostrc-follow-btn-bg: var(--nostrc-theme-bg, #ffffff);
      --nostrc-follow-btn-color: var(--nostrc-theme-text-primary, #333333);
      --nostrc-follow-btn-font-family: var(--nostrc-font-family-primary);
      --nostrc-follow-btn-font-size: var(--nostrc-font-size-base);
      
      /* Hover state variables */
      --nostrc-follow-btn-hover-bg: var(--nostrc-theme-hover-bg, rgba(0, 0, 0, 0.05));
      --nostrc-follow-btn-hover-color: var(--nostrc-theme-text-primary, #333333);
      --nostrc-follow-btn-hover-border: var(--nostrc-border-width) solid var(--nostrc-theme-border, var(--nostrc-color-border));

      /* Make the host the visual button surface */
      display: inline-flex;
      align-items: center;
      justify-content: var(--nostrc-follow-btn-horizontal-alignment);
      gap: var(--nostrc-spacing-md);
      background: var(--nostrc-follow-btn-bg);
      color: var(--nostrc-follow-btn-color);
      border: var(--nostrc-follow-btn-border);
      border-radius: var(--nostrc-follow-btn-border-radius);
      font-family: var(--nostrc-follow-btn-font-family);
      font-size: var(--nostrc-follow-btn-font-size);
      min-height: var(--nostrc-follow-btn-min-height);
      width: var(--nostrc-follow-btn-width);
      cursor: pointer;
      transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
    }

    /* Hover state */
    :host(.is-clickable:hover) {
      background: var(--nostrc-follow-btn-hover-bg);
      color: var(--nostrc-follow-btn-hover-color);
      border: var(--nostrc-follow-btn-hover-border);
    }

    /* Focus state for accessibility */
    :host(:focus-visible) {
      outline: 2px solid var(--nostrc-color-primary, #007bff);
      outline-offset: 2px;
    }

    :host(.is-error) .nostr-follow-button-container {
      color: var(--nostrc-color-error-text);
      border: var(--nostrc-border-width) solid var(--nostrc-color-error-text);
    }

    .nostr-follow-button-container {
      display: flex;
      gap: var(--nostrc-spacing-md);
      width: fit-content;
      padding: var(--nostrc-follow-btn-padding);
    }
    
    .nostr-follow-button-right-container {
      margin: auto;
    }
    
    /* SVG Icon Styles */
    .nostr-follow-button-left-container svg {
      fill: var(--nostrc-follow-btn-color);
      display: inline-block;
      vertical-align: middle;
      width: var(--nostrc-icon-width);
      height: var(--nostrc-icon-height);
    }

    /* User Avatar Styles */
    .nostr-follow-button-left-container .user-avatar {
      width: var(--nostrc-icon-width);
      height: var(--nostrc-icon-height);
      border-radius: 50%;
      object-fit: cover;
      display: inline-block;
      vertical-align: middle;
    }
  `)}class E extends p{constructor(){super(...arguments);f(this,"followStatus",this.channel("follow"));f(this,"isFollowed",!1)}static get observedAttributes(){return[...super.observedAttributes,"show-avatar","text"]}connectedCallback(){var o;(o=super.connectedCallback)==null||o.call(this),this.attachDelegatedListeners(),this.render()}attributeChangedCallback(o,t,r){t!==r&&(super.attributeChangedCallback(o,t,r),this.render())}onStatusChange(o){this.render()}onUserReady(o,t){this.render()}async handleFollowClick(){var t;if(this.computeOverall()!==l.Ready)return;const o=new m;this.followStatus.set(l.Loading),this.render();try{const r=this.nostrService.getNDK();if(r.signer=o,!this.user){this.followStatus.set(l.Error,"Could not resolve user to follow."),this.render();return}const i=r.signer;if(!i)throw new Error("No signer available");const s=await i.user();s&&await s.follow(this.user),this.isFollowed=!0,this.followStatus.set(l.Ready)}catch(r){const i=r;let s;(t=i.message)!=null&&t.includes("NIP-07")?s=`Looks like you don't have any nostr signing browser extension.
                          Please checkout the following video to setup a signer extension - <a href="https://youtu.be/8thRYn14nB0?t=310" target="_blank">Video</a>`:s="Please authorize, click the button to try again!",this.followStatus.set(l.Error,s)}finally{this.render()}}attachDelegatedListeners(){this.delegateEvent("click",".nostr-follow-button-container",o=>{var t,r;(t=o.preventDefault)==null||t.call(o),(r=o.stopPropagation)==null||r.call(o),this.handleFollowClick()})}renderContent(){const o=this.computeOverall()==l.Loading,t=this.followStatus.get()==l.Loading,r=this.computeOverall()===l.Error,i=super.renderError(this.errorMessage),s=this.hasAttribute("show-avatar"),a=this.getAttribute("text")||"Follow me on nostr",h={isLoading:o,isError:r,errorMessage:i,isFollowed:this.isFollowed,isFollowing:t,showAvatar:s,user:this.user,profile:this.profile,customText:a};this.shadowRoot.innerHTML=`
      ${L()}
      ${C(h)}
    `}}customElements.define("nostr-follow-button",E);
//# sourceMappingURL=nostr-follow-button.es.js.map
