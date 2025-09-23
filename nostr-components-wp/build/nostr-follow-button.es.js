var d=Object.defineProperty;var h=(o,n,t)=>n in o?d(o,n,{enumerable:!0,configurable:!0,writable:!0,value:t}):o[n]=t;var c=(o,n,t)=>h(o,typeof n!="symbol"?n+"":n,t);import{d as g}from"../assets/nostr-service-w4c-zprD.js";import{N as f}from"../assets/nostr-user-component-iH2jRAjq.js";import{b as w,g as p,a as u}from"../assets/theme-ijSavGc-.js";import{e as m}from"../assets/utils-Blx44Hni.js";import{g as v,a as l}from"../assets/base-styles-BBUNbLUX.js";import"../assets/icons-FHzdQYXw.js";function b({theme:o,isLoading:n,isError:t,errorMessage:r,isFollowed:e,isFollowing:i}){if(i)return y(o);if(n)return C(o);if(t)return S(r||"");const s=e?w(o):p(o);return a(s,e?"Followed":"<span>Follow me on Nostr</span>")}function C(o){return a(u(o),"<span>Loading...</span>")}function y(o){return a(u(o),"<span>Following...</span>")}function S(o){return a('<div class="error-icon">&#9888;</div>',m(o))}function a(o,n){return`
    <div class='nostrc-container nostr-follow-button-container'>
      <div class='nostr-follow-button-left-container'>
        ${o}
      </div>
      <div class='nostr-follow-button-right-container'>
        ${n}
      </div>
    </div>
  `}function N(o){return v(o,`
    /* === FOLLOW BUTTON CONTAINER PATTERN === */
    :host {
      --nostrc-icon-height: 25px;
      --nostrc-icon-width: 25px;
    }
    
    .nostr-follow-button-container {
      display: flex;
      gap: var(--nostrc-spacing-md);
      width: fit-content;
    }
    
    .nostr-follow-button-right-container {
      margin: auto;
    }
    
    /* SVG Icon Styles */
    .nostr-follow-button-left-container svg {
      fill: currentColor;
      display: inline-block;
      vertical-align: middle;
      width: var(--nostrc-icon-width);
      height: var(--nostrc-icon-height);
    }
  `)}class k extends f{constructor(){super(...arguments);c(this,"followStatus",this.channel("follow"));c(this,"isFollowed",!1)}static get observedAttributes(){return[...super.observedAttributes]}connectedCallback(){var t;(t=super.connectedCallback)==null||t.call(this),this.attachDelegatedListeners(),this.render()}attributeChangedCallback(t,r,e){r!==e&&(super.attributeChangedCallback(t,r,e),this.render())}onStatusChange(t){this.render()}onUserReady(t,r){this.render()}async handleFollowClick(){var r;if(this.computeOverall()!==l.Ready)return;const t=new g;this.followStatus.set(l.Loading),this.render();try{const e=this.nostrService.getNDK();if(e.signer=t,!this.user){this.followStatus.set(l.Error,"Could not resolve user to follow."),this.render();return}const i=e.signer;if(!i)throw new Error("No signer available");const s=await i.user();s&&await s.follow(this.user),this.isFollowed=!0,this.followStatus.set(l.Ready)}catch(e){const i=e;let s;(r=i.message)!=null&&r.includes("NIP-07")?s=`Looks like you don't have any nostr signing browser extension.
                          Please checkout the following video to setup a signer extension - <a href="https://youtu.be/8thRYn14nB0?t=310" target="_blank">Video</a>`:s="Please authorize, click the button to try again!",this.followStatus.set(l.Error,s)}finally{this.render()}}attachDelegatedListeners(){this.delegateEvent("click",".nostr-follow-button-container",t=>{var r,e;(r=t.preventDefault)==null||r.call(t),(e=t.stopPropagation)==null||e.call(t),this.handleFollowClick()})}renderContent(){const t=this.computeOverall()==l.Loading,r=this.followStatus.get()==l.Loading,e=this.computeOverall()===l.Error,i=super.renderError(this.errorMessage),s={theme:this.theme,isLoading:t,isError:e,errorMessage:i,isFollowed:this.isFollowed,isFollowing:r};this.shadowRoot.innerHTML=`
      ${N(this.theme)}
      ${b(s)}
    `}}customElements.define("nostr-follow-button",k);
//# sourceMappingURL=nostr-follow-button.es.js.map
