import{m as v,e as s,g as m,N as d,p as b}from"../assets/base-styles-Cn9HxXPz.js";import{N as y}from"../assets/nostr-user-component-BglMudsQ.js";import{D as w}from"../assets/nostr-service-CP2wXEbP.js";import{r as x,a as C,b as E,d as N}from"../assets/copy-delegation-BTm3jLGa.js";import"../assets/user-resolver-29rWDY2s.js";function A({isLoading:n,isError:r,errorMessage:o,userProfile:e,ndkUser:t,showNpub:a,showFollow:c}){if(n)return L();if(r||e==null)return S(o||"");const i=e.displayName||e.name||v((t==null?void 0:t.npub)||""),p=s(i),f=s(e.picture||w),g=(t==null?void 0:t.npub)||"",h=(e==null?void 0:e.nip05)||"",u=s((t==null?void 0:t.pubkey)||"");return l(`<img src='${f}' alt='Nostr profile image of ${p}' loading="lazy" decoding="async"/>`,`${x({name:i})}
     ${e.nip05?C(h):""}
     ${a===!0?E(g||""):""}
     ${c===!0&&(t!=null&&t.pubkey)?`<nostr-follow-button pubkey="${u}"></nostr-follow-button>`:""}`)}function L(){return l('<div class="skeleton img-skeleton"></div>',`<div class="skeleton" style="width: 120px;"></div>
     <div class="skeleton" style="width: 160px;"></div>`)}function S(n){return l('<div class="error-icon">&#9888;</div>',s(n))}function l(n,r){return`
    <div class='nostr-profile-badge-container'>
      <div class='nostr-profile-badge-left-container'>
        ${n}
      </div>
      <div class='nostr-profile-badge-right-container'>
        ${r}
      </div>
    </div>
  `}function $(){return m(`
    /* === PROFILE BADGE SPECIFIC CSS VARIABLES === */
    :host {
      --nostrc-profile-badge-bg: var(--nostrc-theme-bg, #ffffff);
      --nostrc-profile-badge-text-primary: var(--nostrc-theme-text-primary, #333333);
      --nostrc-profile-badge-text-secondary: var(--nostrc-theme-text-secondary, #666666);
      --nostrc-profile-badge-border: var(--nostrc-theme-border, var(--nostrc-color-border));
      --nostrc-profile-badge-font-family: var(--nostrc-font-family-primary);
      --nostrc-profile-badge-font-size: var(--nostrc-font-size-base);
      
      /* Hover state variables */
      --nostrc-profile-badge-hover-bg: var(--nostrc-theme-hover-bg, rgba(0, 0, 0, 0.05));
      --nostrc-profile-badge-hover-color: var(--nostrc-theme-text-primary, #333333);
      --nostrc-profile-badge-hover-border: var(--nostrc-border-width) solid var(--nostrc-theme-border, var(--nostrc-color-border));

      /* Make the host the visual profile badge surface */
      display: block;
      background: var(--nostrc-profile-badge-bg);
      border: var(--nostrc-border-width) solid var(--nostrc-profile-badge-border);
      border-radius: var(--nostrc-border-radius-md);
      font-family: var(--nostrc-profile-badge-font-family);
      font-size: var(--nostrc-profile-badge-font-size);
      transition: background-color var(--nostrc-transition-duration) var(--nostrc-transition-timing);
    }
    
    /* === PROFILE BADGE CONTAINER PATTERN === */
    .nostr-profile-badge-container {
      display: flex;
      gap: var(--nostrc-spacing-md);
      padding: var(--nostrc-spacing-md);
    }

    /* Hover state */
    :host(.is-clickable:hover) {
      background: var(--nostrc-profile-badge-hover-bg);
      color: var(--nostrc-profile-badge-hover-color);
      border: var(--nostrc-profile-badge-hover-border);
    }

    :host(.is-error) .nostr-profile-badge-container {
      justify-content: center;
      align-items: center;
      color: var(--nostrc-color-error-text);
      border: var(--nostrc-border-width) solid var(--nostrc-color-error-text);
    }
    
    .nostr-profile-badge-left-container {
      width: 48px;
      height: 48px;
    }
    
    .nostr-profile-badge-left-container img {
      width: 100%;
      height: 100%;
      border-radius: var(--nostrc-border-radius-full);
      object-fit: cover;
    }
    
    .nostr-profile-badge-right-container {
      display: flex;
      flex-direction: column;
      justify-content: center;
      flex-grow: 1;
      min-width: 0;
    }
    
    /* Profile badge specific styling using component variables */
    .nostr-profile-badge-container .nostr-profile-name {
      color: var(--nostrc-profile-badge-text-primary);
    }
    
    .nostr-profile-badge-container .text-row {
      color: var(--nostrc-profile-badge-text-secondary);
    }
    
    /* Skeleton specific styles */
    .img-skeleton {
      width: 48px;
      height: 48px;
      border-radius: var(--nostrc-border-radius-full);
    }
    
  `)}const D="nc:profile_badge";class I extends y{static get observedAttributes(){return[...super.observedAttributes,"show-npub","show-follow"]}connectedCallback(){var r;(r=super.connectedCallback)==null||r.call(this),this.attachDelegatedListeners(),N({addDelegatedListener:this.addDelegatedListener.bind(this)}),this.render()}attributeChangedCallback(r,o,e){var t;o!==e&&((t=super.attributeChangedCallback)==null||t.call(this,r,o,e),(r==="show-npub"||r==="show-follow")&&this.render())}onStatusChange(r){this.render()}onUserReady(r,o){this.render()}onProfileClick(){var o,e;const r=((o=this.user)==null?void 0:o.npub)||this.getAttribute("npub")||((e=this.profile)==null?void 0:e.nip05)||this.getAttribute("nip05");r&&this.handleNjumpClick(D,this.profile,encodeURIComponent(r))}attachDelegatedListeners(){this.delegateEvent("click",".nostr-profile-badge-container",r=>{r.target.closest(".nc-copy-btn, .nostr-follow-button-container, nostr-follow-button")||this.onProfileClick()})}renderContent(){const r=this.computeOverall(),o=r===d.Loading,e=r===d.Error,t=b(this.getAttribute("show-follow")),a=b(this.getAttribute("show-npub")),c=e?super.renderError(this.errorMessage):"",i={isLoading:o,isError:e,errorMessage:c,userProfile:this.profile,ndkUser:this.user,showNpub:a,showFollow:t};this.shadowRoot.innerHTML=`
      ${$()}
      ${A(i)}
    `}}customElements.define("nostr-profile-badge",I);export{I as default};
//# sourceMappingURL=nostr-profile-badge.es.js.map
