const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/dialog-likers-CQeJbBfh.js","assets/preload-helper-D7HrI6pR.js","assets/dialog-component-Da1ZIYh9.js","assets/zap-utils-W6R4npqU.js","assets/nostr-service-CP2wXEbP.js","assets/nostr-login-service-D2FmscPI.js","assets/utils--bxLbhGF.js","assets/base-styles-Cn9HxXPz.js"])))=>i.map(i=>d[i]);
var y=Object.defineProperty;var w=(o,e,t)=>e in o?y(o,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):o[e]=t;var d=(o,e,t)=>w(o,typeof e!="symbol"?e+"":e,t);import{_ as L}from"../assets/preload-helper-D7HrI6pR.js";import{e as f,g as C,c as x,N as i,i as S}from"../assets/base-styles-Cn9HxXPz.js";import{S as v,d as g}from"../assets/nostr-service-CP2wXEbP.js";import"../assets/dialog-component-Da1ZIYh9.js";import{e as p,g as E,s as A}from"../assets/nostr-login-service-D2FmscPI.js";function U({isLoading:o,isError:e,errorMessage:t,buttonText:r,isLiked:n,likeCount:s,hasLikes:a=!1,isCountLoading:l=!1,theme:u="light"}){if(e)return z(t||"");const c=$(n,u),h=n?"<span>Liked</span>":`<span>${f(r)}</span>`;return N(c,h,s,a,n,o,l)}function z(o){return D('<div class="error-icon">&#9888;</div>',f(o))}function D(o,e){return`
    <div class="nostr-like-button-container">
      <div class="nostr-like-button-left-container">
        ${o}
      </div>
      <div class="nostr-like-button-right-container">
        ${e}
      </div>
    </div>
  `}function N(o,e,t,r=!1,n=!1,s=!1,a=!1){let l="";return a?l='<span class="like-count skeleton"></span>':t>0&&(l=`<span class="like-count${r?" clickable":""}">${t} ${t===1?"like":"likes"}</span>`),`
    <div class="nostr-like-button-container">
      <button class="${n?"nostr-like-button liked":"nostr-like-button"}">
        ${o}
        ${s?'<span class="button-text-skeleton"></span>':e}
      </button>
      ${l} <button class="help-icon" title="What is a like?">?</button>
    </div>
  `}function $(o,e="light"){const t=e==="dark"?"#8ab4f8":"#1877f2",r=e==="dark"?"#e0e7ff":"#0d46a1";return o?`<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 100 100" width="24" height="24">
      <path d="M93.6,53.1c2.6-1.5,4.2-4.4,3.8-7.6c-0.5-4-4.2-6.8-8.2-6.8l-25,0c0.2-0.5,0.5-1.2,0.7-1.8c1.5-3.8,4.3-10.8,4.3-18 c0-8.1-5.7-13-9.6-13.3C57.2,5.5,55.4,7,55,9.7c-0.7,5.1-4.1,12.6-5.5,15.5c-0.4,0.9-0.9,1.7-1.6,2.4c-2.3,2.6-8.1,9-13.6,12.8 c0,0.2,0.1,0.5,0.1,0.7v47.9c0,0.4-0.1,0.8-0.1,1.2c9.4,2.7,17.9,4,27.2,4l21.3,0c3.7,0,7.2-2.5,7.9-6.1c0.6-3-0.5-5.7-2.5-7.5 c3.4-0.8,6-3.9,6-7.5c0-2.3-1-4.4-2.7-5.8c3.4-0.8,6-3.9,6-7.5C97.5,57,96,54.5,93.6,53.1z" fill="${t}"/>
      <path d="M23.4,36.9H6.7c-2.3,0-4.2,1.9-4.2,4.2v47.9c0,2.3,1.9,4.2,4.2,4.2h16.7c2.3,0,4.2-1.9,4.2-4.2V41.2 C27.6,38.8,25.8,36.9,23.4,36.9z M15.1,85.9c-2.4,0-4.4-2-4.4-4.4s2-4.4,4.4-4.4c2.4,0,4.4,2,4.4,4.4S17.5,85.9,15.1,85.9z" fill="${t}"/>
    </svg>`:`<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 100 100" width="24" height="24">
      <path d="M93.6,53.1c2.6-1.5,4.2-4.4,3.8-7.6c-0.5-4-4.2-6.8-8.2-6.8l-25,0c0.2-0.5,0.5-1.2,0.7-1.8c1.5-3.8,4.3-10.8,4.3-18 c0-8.1-5.7-13-9.6-13.3C57.2,5.5,55.4,7,55,9.7c-0.7,5.1-4.1,12.6-5.5,15.5c-0.4,0.9-0.9,1.7-1.6,2.4c-2.3,2.6-8.1,9-13.6,12.8 c0,0.2,0.1,0.5,0.1,0.7v47.9c0,0.4-0.1,0.8-0.1,1.2c9.4,2.7,17.9,4,27.2,4l21.3,0c3.7,0,7.2-2.5,7.9-6.1c0.6-3-0.5-5.7-2.5-7.5 c3.4-0.8,6-3.9,6-7.5c0-2.3-1-4.4-2.7-5.8c3.4-0.8,6-3.9,6-7.5C97.5,57,96,54.5,93.6,53.1z" fill="none" stroke="${r}" stroke-width="2"/>
      <path d="M23.4,36.9H6.7c-2.3,0-4.2,1.9-4.2,4.2v47.9c0,2.3,1.9,4.2,4.2,4.2h16.7c2.3,0,4.2-1.9,4.2-4.2V41.2 C27.6,38.8,25.8,36.9,23.4,36.9z M15.1,85.9c-2.4,0-4.4-2-4.4-4.4s2-4.4,4.4-4.4c2.4,0,4.4,2,4.4,4.4S17.5,85.9,15.1,85.9z" fill="none" stroke="${r}" stroke-width="2"/>
    </svg>`}function R(){return C(`
    /* === LIKE BUTTON CONTAINER PATTERN === */
    :host {
      /* Icon sizing (overridable via CSS variables) */
      --nostrc-icon-height: 25px;
      --nostrc-icon-width: 25px;

      /* Like button CSS variables (overridable by parent components) */
      --nostrc-like-btn-padding: var(--nostrc-spacing-sm) var(--nostrc-spacing-md);
      --nostrc-like-btn-border-radius: var(--nostrc-border-radius-md);
      --nostrc-like-btn-border: var(--nostrc-border-width) solid var(--nostrc-color-border);
      --nostrc-like-btn-min-height: 47px;
      --nostrc-like-btn-width: auto;
      --nostrc-like-btn-horizontal-alignment: left;
      --nostrc-like-btn-bg: var(--nostrc-theme-bg, #ffffff);
      --nostrc-like-btn-color: var(--nostrc-theme-text-primary, #333333);
      --nostrc-like-btn-font-family: var(--nostrc-font-family-primary);
      --nostrc-like-btn-font-size: var(--nostrc-font-size-base);
      
      /* Hover state variables */
      --nostrc-like-btn-hover-bg: var(--nostrc-theme-hover-bg, rgba(0, 0, 0, 0.05));
      --nostrc-like-btn-hover-color: var(--nostrc-theme-text-primary, #333333);
      --nostrc-like-btn-hover-border: var(--nostrc-border-width) solid var(--nostrc-theme-border, var(--nostrc-color-border));

      /* Liked state variables */
      --nostrc-like-btn-liked-bg: #e7f3ff;
      --nostrc-like-btn-liked-color: #1877f2;
      --nostrc-like-btn-liked-border: #1877f2;
      --nostrc-like-btn-liked-hover-bg: #d1e7ff;

      /* Make the host a flex container for button + count */
      display: inline-flex;
      flex-direction: row;
      align-items: center;
      gap: var(--nostrc-spacing-md);
      font-family: var(--nostrc-like-btn-font-family);
      font-size: var(--nostrc-like-btn-font-size);
    }

    /* Focus state for accessibility */
    :host(:focus-visible) {
      outline: 2px solid var(--nostrc-color-primary, #007bff);
      outline-offset: 2px;
    }

    :host(.is-error) .nostr-like-button-container {
      border: var(--nostrc-border-width) solid var(--nostrc-color-error-text);
      border-radius: var(--nostrc-border-radius-md);
      padding: var(--nostrc-spacing-sm);
      color: var(--nostrc-color-error-text);
    }

    .nostr-like-button-container {
      display: flex;
      align-items: center;
      gap: var(--nostrc-spacing-md);
      width: fit-content;
    }

    .nostr-like-button-left-container {
      display: flex;
      align-items: center;
    }

    .nostr-like-button-right-container {
      display: flex;
      align-items: center;
    }

    .nostr-like-button {
      display: flex;
      align-items: center;
      justify-content: var(--nostrc-like-btn-horizontal-alignment);
      gap: var(--nostrc-spacing-sm);
      background: var(--nostrc-like-btn-bg);
      color: var(--nostrc-like-btn-color);
      border: var(--nostrc-like-btn-border);
      border-radius: var(--nostrc-like-btn-border-radius);
      padding: var(--nostrc-like-btn-padding);
      min-height: var(--nostrc-like-btn-min-height);
      width: var(--nostrc-like-btn-width);
      cursor: pointer;
      transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
      font-family: inherit;
      font-size: inherit;
    }

    /* Hover state on the button */
    .nostr-like-button:hover {
      background: var(--nostrc-like-btn-hover-bg);
      color: var(--nostrc-like-btn-hover-color);
      border: var(--nostrc-like-btn-hover-border);
    }

    /* Liked state */
    .nostr-like-button.liked {
      background: var(--nostrc-like-btn-liked-bg);
      color: var(--nostrc-like-btn-liked-color);
      border: var(--nostrc-border-width) solid var(--nostrc-like-btn-liked-border);
    }

    .nostr-like-button.liked:hover {
      background: var(--nostrc-like-btn-liked-hover-bg);
    }

    .nostr-like-button:disabled {
      pointer-events: none;
      user-select: none;
      opacity: 0.6;
    }

    :host:not([status="ready"]) .nostr-like-button {
      cursor: not-allowed;
    }

    /* SVG Icon Styles */
    .nostr-like-button svg {
      display: inline-block;
      vertical-align: middle;
      width: var(--nostrc-icon-width);
      height: var(--nostrc-icon-height);
    }

    /* Like count display */
    .like-count {
      font-size: var(--nostrc-font-size-sm);
      color: var(--nostrc-theme-text-secondary, #666666);
      white-space: nowrap;
      text-decoration: underline;
      text-decoration-color: transparent;
      transition: text-decoration-color 0.2s ease, color 0.2s ease;
    }

    /* Clickable like count */
    .like-count.clickable {
      cursor: pointer;
      text-decoration-color: currentColor;
    }

    .like-count.clickable:hover {
      color: var(--nostrc-color-primary, #7f00ff);
      text-decoration-color: var(--nostrc-color-primary, #7f00ff);
    }

    /* Help icon */
    .help-icon {
      background: none;
      border: 1px solid var(--nostrc-color-border, #e0e0e0);
      border-radius: var(--nostrc-border-radius-full, 50%);
      width: var(--nostrc-help-icon-size, 16px);
      height: var(--nostrc-help-icon-size, 16px);
      font-size: calc(var(--nostrc-help-icon-size, 16px) * 0.7);
      font-weight: bold;
      color: var(--nostrc-theme-text-secondary, #666666);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-left: var(--nostrc-spacing-xs, 4px);
      transition: all 0.2s ease;
    }

    .help-icon:hover {
      background: var(--nostrc-color-hover-background, rgba(0, 0, 0, 0.05));
      border-color: var(--nostrc-color-primary, #7f00ff);
      color: var(--nostrc-color-primary, #7f00ff);
    }

    /* Skeleton loader for like count */
    .like-count.skeleton {
      background: linear-gradient(90deg, 
        var(--nostrc-skeleton-color-min) 25%, 
        var(--nostrc-skeleton-color-max) 50%, 
        var(--nostrc-skeleton-color-min) 75%
      );
      background-size: 200% 100%;
      animation: skeleton-loading var(--nostrc-skeleton-duration) var(--nostrc-skeleton-timing-function) var(--nostrc-skeleton-iteration-count);
      border-radius: var(--nostrc-border-radius-sm);
      width: 80px;
      height: 1.2em;
      display: inline-block;
    }

    /* Skeleton loader for button text */
    .button-text-skeleton {
      background: linear-gradient(90deg, 
        var(--nostrc-skeleton-color-min) 25%, 
        var(--nostrc-skeleton-color-max) 50%, 
        var(--nostrc-skeleton-color-min) 75%
      );
      background-size: 200% 100%;
      animation: skeleton-loading var(--nostrc-skeleton-duration) var(--nostrc-skeleton-timing-function) var(--nostrc-skeleton-iteration-count);
      border-radius: var(--nostrc-border-radius-sm);
      width: 60px;
      height: 1em;
      display: inline-block;
    }

    @keyframes skeleton-loading {
      0% {
        background-position: 200% 0;
      }
      100% {
        background-position: -200% 0;
      }
    }

    /* Error message styling */
    .nostr-like-button-error small {
      color: var(--nostrc-color-error-text);
      font-size: var(--nostrc-font-size-sm);
      line-height: 1em;
      max-width: 250px;
      white-space: pre-line;
    }
  `)}function I(){return`
    .help-content {
      padding: var(--nostrc-spacing-md, 12px);
    }

    .help-content p {
      margin: 0 0 var(--nostrc-spacing-md, 12px) 0;
      color: var(--nostrc-theme-text-primary, #333333);
      line-height: 1.5;
    }

    .help-content p:last-child {
      margin-bottom: 0;
    }

    .help-content ul {
      margin: 0 0 var(--nostrc-spacing-md, 12px) 0;
      padding-left: var(--nostrc-spacing-lg, 16px);
      color: var(--nostrc-theme-text-primary, #333333);
    }

    .help-content li {
      margin-bottom: var(--nostrc-spacing-xs, 4px);
      line-height: 1.5;
    }

    .help-content li:last-child {
      margin-bottom: 0;
    }

    .help-content strong {
      font-weight: 600;
      color: var(--nostrc-theme-text-primary, #333333);
    }

    .help-content a {
      color: var(--nostrc-theme-primary, #0066cc);
      text-decoration: underline;
    }

    .help-content a:hover {
      color: var(--nostrc-theme-primary-hover, #0052a3);
    }
  `}const M=()=>{if(document.querySelector("style[data-help-dialog-styles]"))return;const o=document.createElement("style");o.setAttribute("data-help-dialog-styles","true"),o.textContent=I(),document.head.appendChild(o)},H=async o=>{M(),customElements.get("dialog-component")||await customElements.whenDefined("dialog-component");const e=document.createElement("dialog-component");e.setAttribute("header","What is a Like?"),e.setAttribute("data-theme",o),e.innerHTML=`
    <div class="help-content">
      <p>Like any webpage to show your appreciation! Your likes are stored on Nostr, a decentralized network you control—no accounts needed.</p>
      <ul>
        <li>Like any webpage or article</li>
        <li>See who liked the content</li>
        <li>Works with a browser extension like <a href="https://getalby.com" target="_blank" rel="noopener noreferrer">Alby</a> or nos2x</li>
      </ul>
    </div>
  `,e.showModal()};new TextDecoder("utf-8");new TextEncoder;function k(o){try{o.indexOf("://")===-1&&(o="wss://"+o);let e=new URL(o);return e.protocol==="http:"?e.protocol="ws:":e.protocol==="https:"&&(e.protocol="wss:"),e.pathname=e.pathname.replace(/\/+/g,"/"),e.pathname.endsWith("/")&&(e.pathname=e.pathname.slice(0,-1)),(e.port==="80"&&e.protocol==="ws:"||e.port==="443"&&e.protocol==="wss:")&&(e.port=""),e.searchParams.sort(),e.hash="",e.toString()}catch{throw new Error(`Invalid URL: ${o}`)}}async function T(o,e){const t=k(o),r=new v;try{const n=await r.querySync(e,{kinds:[17],"#k":["web"],"#i":[t],limit:1e3}),s=[];let a=0,l=0;for(const c of n)s.push({authorPubkey:c.pubkey,date:new Date(c.created_at*1e3),content:c.content}),c.content==="-"?l++:a++;return s.sort((c,h)=>h.date.getTime()-c.date.getTime()),{totalCount:a-l,likeDetails:s,likedCount:a,dislikedCount:l}}catch(n){throw n instanceof Error?n:new Error(String(n))}finally{r.close(e)}}function m(o,e){return{kind:17,content:e,tags:[["k","web"],["i",o]],created_at:Math.floor(Date.now()/1e3)}}function P(o){return m(o,"+")}function _(o){return m(o,"-")}async function F(o,e,t){const r=new v,n=o;try{const s=await r.querySync(t,{kinds:[17],authors:[e],"#k":["web"],"#i":[n],limit:1});if(s.length===0)return!1;const a=s[0];return a.content==="+"||a.content===""}catch(s){return console.error("Nostr-Components: Like button: Error checking user like status",s),!1}finally{r.close(t)}}async function q(){try{return await p(),await E()}catch(o){return console.error("Nostr-Components: Like button: Error getting user pubkey",o),null}}async function b(o){try{return await p(),await A(o)}catch(e){throw console.error("Nostr-Components: Like button: Error signing event",e),e}}class O extends x{constructor(){super();d(this,"likeActionStatus",this.channel("likeAction"));d(this,"likeListStatus",this.channel("likeList"));d(this,"currentUrl","");d(this,"isLiked",!1);d(this,"likeCount",0);d(this,"cachedLikeDetails",null);d(this,"loadSeq",0)}connectedCallback(){var t;(t=super.connectedCallback)==null||t.call(this),this.likeListStatus.get()===i.Idle&&this.initChannelStatus("likeList",i.Loading,{reflectOverall:!1}),this.attachDelegatedListeners(),this.render()}static get observedAttributes(){return[...super.observedAttributes,"url","text"]}attributeChangedCallback(t,r,n){r!==n&&(super.attributeChangedCallback(t,r,n),(t==="url"||t==="text")&&(this.likeActionStatus.set(i.Ready),this.likeListStatus.set(i.Loading),this.isLiked=!1,this.errorMessage="",this.updateLikeCount(),this.render()))}validateInputs(){if(!super.validateInputs())return this.likeActionStatus.set(i.Idle),this.likeListStatus.set(i.Idle),!1;const t=this.getAttribute("url"),r=this.getAttribute("text"),n=this.tagName.toLowerCase();let s=null;return t&&(S(t)||(s="Invalid URL format")),r&&r.length>32&&(s="Max text length: 32 characters"),s?(this.likeActionStatus.set(i.Error,s),this.likeListStatus.set(i.Error,s),console.error(`Nostr-Components: ${n}: ${s}`),!1):!0}onStatusChange(t){this.render()}onNostrRelaysConnected(){this.updateLikeCount(),this.render()}ensureCurrentUrl(){this.currentUrl||(this.currentUrl=k(this.getAttribute("url")||window.location.href))}async updateLikeCount(){const t=++this.loadSeq;try{await this.ensureNostrConnected(),this.currentUrl=k(this.getAttribute("url")||window.location.href),this.likeListStatus.set(i.Loading),this.render();const r=await T(this.currentUrl,this.getRelays());if(t!==this.loadSeq)return;this.likeCount=r.totalCount,this.cachedLikeDetails=r,this.likeListStatus.set(i.Ready)}catch(r){console.error("[NostrLike] Failed to fetch like count:",r),this.likeListStatus.set(i.Error,"Failed to load likes")}finally{this.render()}}async handleLikeClick(){if(this.ensureCurrentUrl(),!this.currentUrl){this.likeActionStatus.set(i.Error,"Invalid URL"),this.render();return}this.likeActionStatus.set(i.Loading),this.render();try{await p();const t=await q();if(t&&(this.isLiked=await F(this.currentUrl,t,this.getRelays())),this.isLiked){if(!window.confirm("You have already liked this. Do you want to unlike it?")){this.likeActionStatus.set(i.Ready),this.render();return}await this.handleUnlike()}else await this.handleLike()}catch(t){console.error("[NostrLike] Failed to check user like status:",t);const r=t instanceof Error?t.message:"Failed to check user like status";this.likeActionStatus.set(i.Error,r),this.render()}}async handleLike(){if(this.ensureCurrentUrl(),!this.currentUrl){this.likeActionStatus.set(i.Error,"Invalid URL"),this.render();return}this.likeActionStatus.set(i.Loading),this.render();try{const t=P(this.currentUrl),r=await b(t);await new g(this.nostrService.getNDK(),r).publish(),this.isLiked=!0,this.likeCount++,this.likeActionStatus.set(i.Ready),await this.updateLikeCount()}catch(t){console.error("[NostrLike] Failed to like:",t),this.isLiked=!1,this.likeCount--;const r=t instanceof Error?t.message:"Failed to like";this.likeActionStatus.set(i.Error,r)}finally{this.render()}}async handleUnlike(){if(this.ensureCurrentUrl(),!this.currentUrl){this.likeActionStatus.set(i.Error,"Invalid URL"),this.render();return}this.likeActionStatus.set(i.Loading),this.render();try{const t=_(this.currentUrl),r=await b(t);await new g(this.nostrService.getNDK(),r).publish(),this.isLiked=!1,this.likeCount>0&&this.likeCount--,this.likeActionStatus.set(i.Ready),await this.updateLikeCount()}catch(t){console.error("[NostrLike] Failed to unlike:",t),this.isLiked=!0,this.likeCount++;const r=t instanceof Error?t.message:"Failed to unlike";this.likeActionStatus.set(i.Error,r)}finally{this.render()}}async handleCountClick(){if(!(this.likeCount===0||!this.cachedLikeDetails))try{const{openLikersDialog:t}=await L(async()=>{const{openLikersDialog:r}=await import("../assets/dialog-likers-CQeJbBfh.js");return{openLikersDialog:r}},__vite__mapDeps([0,1,2,3,4,5,6,7]));await t({likeDetails:this.cachedLikeDetails.likeDetails,theme:this.theme==="dark"?"dark":"light"})}catch(t){console.error("[NostrLike] Error opening likers dialog:",t)}}async handleHelpClick(){try{await H(this.theme==="dark"?"dark":"light")}catch(t){console.error("[NostrLike] Error showing help dialog:",t)}}attachDelegatedListeners(){this.delegateEvent("click",".nostr-like-button",t=>{var r,n;(r=t.preventDefault)==null||r.call(t),(n=t.stopPropagation)==null||n.call(t),this.handleLikeClick()}),this.delegateEvent("click",".like-count",t=>{var r,n;(r=t.preventDefault)==null||r.call(t),(n=t.stopPropagation)==null||n.call(t),this.handleCountClick()}),this.delegateEvent("click",".help-icon",t=>{var r,n;(r=t.preventDefault)==null||r.call(t),(n=t.stopPropagation)==null||n.call(t),this.handleHelpClick()})}renderContent(){const t=this.likeActionStatus.get()===i.Loading||this.conn.get()===i.Loading,r=this.likeListStatus.get()===i.Loading,n=this.computeOverall()===i.Error,s=this.errorMessage,a=this.getAttribute("text")||"Like",l={isLoading:t,isError:n,errorMessage:s,buttonText:a,isLiked:this.isLiked,likeCount:this.likeCount,hasLikes:this.likeCount>0,isCountLoading:r,theme:this.theme};this.shadowRoot.innerHTML=`
      ${R()}
      ${U(l)}
    `}}customElements.define("nostr-like",O);export{O as default};
//# sourceMappingURL=nostr-like.es.js.map
