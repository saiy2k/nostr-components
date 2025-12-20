var w=Object.defineProperty;var g=(n,e,o)=>e in n?w(n,e,{enumerable:!0,configurable:!0,writable:!0,value:o}):n[e]=o;var h=(n,e,o)=>g(n,typeof e!="symbol"?e+"":e,o);import{N as m}from"../assets/nostr-service-CP2wXEbP.js";import{N as p}from"../assets/nostr-user-component-BglMudsQ.js";import{g as y,a as S,b}from"../assets/theme-BN1Bvweb.js";import{e as a,g as C,N as s}from"../assets/base-styles-Cn9HxXPz.js";import{e as F}from"../assets/nostr-login-service-D2FmscPI.js";import"../assets/user-resolver-29rWDY2s.js";import"../assets/icons-Dr_d9MII.js";import"../assets/preload-helper-D7HrI6pR.js";function k({isLoading:n,isError:e,errorMessage:o,isFollowed:t,isFollowing:r,showAvatar:d=!1,user:l,profile:i,customText:f="Follow me on nostr"}){if(r)return N();if(n)return x();if(e)return L(o||"");const u=t?y("light"):d&&l&&(i!=null&&i.image)?`<img src="${a(i.image)}" alt="${a(i.name||l.npub)}" class="user-avatar" />`:S(),v=t?"Followed":`<span>${a(f)}</span>`;return c(u,v)}function x(){return c(b(),"<span>Loading...</span>")}function N(){return c(b(),"<span>Following...</span>")}function L(n){return c('<div class="error-icon">&#9888;</div>',a(n))}function c(n,e){return`
    <div class='nostr-follow-button-container'>
      <div class='nostr-follow-button-left-container'>
        ${n}
      </div>
      <div class='nostr-follow-button-right-container'>
        ${e}
      </div>
    </div>
  `}function E(){return C(`
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
  `)}class z extends p{constructor(){super(...arguments);h(this,"followStatus",this.channel("follow"));h(this,"isFollowed",!1)}static get observedAttributes(){return[...super.observedAttributes,"show-avatar","text"]}connectedCallback(){var o;(o=super.connectedCallback)==null||o.call(this),this.attachDelegatedListeners(),this.render()}attributeChangedCallback(o,t,r){t!==r&&(super.attributeChangedCallback(o,t,r),this.render())}onStatusChange(o){this.render()}onUserReady(o,t){this.render()}async handleFollowClick(){if(this.computeOverall()===s.Ready){this.followStatus.set(s.Loading),this.render();try{await F();const o=new m,t=this.nostrService.getNDK();if(t.signer=o,!this.user){this.followStatus.set(s.Error,"Could not resolve user to follow."),this.render();return}const r=await o.user();r&&await r.follow(this.user),this.isFollowed=!0,this.followStatus.set(s.Ready)}catch(o){const r=o.message||"Please authorize, click the button to try again!";this.followStatus.set(s.Error,r)}finally{this.render()}}}attachDelegatedListeners(){this.delegateEvent("click",".nostr-follow-button-container",o=>{var t,r;(t=o.preventDefault)==null||t.call(o),(r=o.stopPropagation)==null||r.call(o),this.handleFollowClick()})}renderContent(){const o=this.computeOverall()==s.Loading,t=this.followStatus.get()==s.Loading,r=this.computeOverall()===s.Error,d=super.renderError(this.errorMessage),l=this.hasAttribute("show-avatar"),i=this.getAttribute("text")||"Follow me on nostr",f={isLoading:o,isError:r,errorMessage:d,isFollowed:this.isFollowed,isFollowing:t,showAvatar:l,user:this.user,profile:this.profile,customText:i};this.shadowRoot.innerHTML=`
      ${E()}
      ${k(f)}
    `}}customElements.define("nostr-follow-button",z);export{z as default};
//# sourceMappingURL=nostr-follow-button.es.js.map
