import{g as m,a as c}from"../assets/base-styles-BBUNbLUX.js";import{N as v}from"../assets/nostr-user-component-iH2jRAjq.js";import{m as w,e as a,p as d}from"../assets/utils-Blx44Hni.js";import{f as y}from"../assets/nostr-service-w4c-zprD.js";import{r as C,a as E,b as N}from"../assets/render-name-DxPqJZ3i.js";import{a as A}from"../assets/copy-delegation-B6WaHIgt.js";function $({isLoading:n,isError:t,errorMessage:r,userProfile:o,ndkUser:e,showNpub:i,showFollow:l}){if(n)return x();if(t||o==null)return L(r||"");const s=o.displayName||o.name||w((e==null?void 0:e.npub)||""),u=a(s),h=a(o.picture||y),b=(e==null?void 0:e.npub)||"",f=(o==null?void 0:o.nip05)||"",g=a((e==null?void 0:e.pubkey)||"");return p(`<img src='${h}' alt='Nostr profile image of ${u}' loading="lazy" decoding="async"/>`,`${C({name:s})}
     ${o.nip05?E(f):""}
     ${i===!0?N(b||""):""}
     ${l===!0&&(e!=null&&e.pubkey)?`<nostr-follow-button pubkey="${g}"></nostr-follow-button>`:""}`)}function x(){return p('<div class="skeleton img-skeleton"></div>',`<div class="skeleton" style="width: 120px;"></div>
     <div class="skeleton" style="width: 160px;"></div>`)}function L(n){return p('<div class="error-icon">&#9888;</div>',a(n))}function p(n,t){return`
    <div class='nostrc-container nostr-profile-badge-container'>
      <div class='nostr-profile-badge-left-container'>
        ${n}
      </div>
      <div class='nostr-profile-badge-right-container'>
        ${t}
      </div>
    </div>
  `}function D(n){return m(n,`
    /* === PROFILE BADGE CONTAINER PATTERN === */
    .nostr-profile-badge-container {
      display: flex;
      gap: var(--nostrc-spacing-md);
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
    
    /* Skeleton specific styles */
    .img-skeleton {
      width: 48px;
      height: 48px;
      border-radius: var(--nostrc-border-radius-full);
    }
    
  `)}const _="nc:profile_badge";class R extends v{static get observedAttributes(){return[...super.observedAttributes,"show-npub","show-follow"]}connectedCallback(){var t;(t=super.connectedCallback)==null||t.call(this),this.attachDelegatedListeners(),A({addDelegatedListener:this.addDelegatedListener.bind(this)}),this.render()}attributeChangedCallback(t,r,o){var e;r!==o&&((e=super.attributeChangedCallback)==null||e.call(this,t,r,o),(t==="show-npub"||t==="show-follow")&&this.render())}onStatusChange(t){this.render()}onUserReady(t,r){this.render()}onProfileClick(){var o,e;if(this.computeOverall()!==c.Ready)return;const t=new CustomEvent(_,{detail:this.profile,bubbles:!0,composed:!0,cancelable:!0});if(this.dispatchEvent(t)){const i=((o=this.profile)==null?void 0:o.nip05)||this.getAttribute("nip05")||((e=this.user)==null?void 0:e.npub)||this.getAttribute("npub");i&&window.open(`https://njump.me/${i}`,"_blank","noopener,noreferrer")}}attachDelegatedListeners(){this.delegateEvent("click",".nostr-profile-badge-container",t=>{t.target.closest(".nc-copy-btn, .nostr-follow-button-container, nostr-follow-button")||this.onProfileClick()})}renderContent(){const t=this.computeOverall(),r=t===c.Loading,o=t===c.Error,e=d(this.getAttribute("show-follow")),i=d(this.getAttribute("show-npub")),l=o?super.renderError(this.errorMessage):"",s={theme:this.theme,isLoading:r,isError:o,errorMessage:l,userProfile:this.profile,ndkUser:this.user,showNpub:i,showFollow:e};this.shadowRoot.innerHTML=`
      ${D(this.theme)}
      ${$(s)}
    `}}customElements.define("nostr-profile-badge",R);
//# sourceMappingURL=nostr-profile-badge.es.js.map
