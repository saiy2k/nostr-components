var E=Object.defineProperty;var T=(t,r,e)=>r in t?E(t,r,{enumerable:!0,configurable:!0,writable:!0,value:e}):t[r]=e;var c=(t,r,e)=>T(t,typeof r!="symbol"?r+"":r,e);import{D as v,n as p,e as m,M as S,N as L}from"./nostr-service-CWmHXqrf.js";const M=t=>{if(typeof t!="string"||!t.startsWith("npub1"))return"";try{const r=p.decode(t);if(r&&typeof r.data=="string")return r.data}catch(r){console.error("Failed to decode npub:",r)}return""};function O(t){if(!t||!b(t))return"";try{return p.npubEncode(t.toLowerCase())}catch(r){return console.error("Failed to encode hex to npub:",r),""}}function z(t="",r=3){const e=t.length;if(!t.startsWith("npub1"))return"Invalid nPub: expected npub1...";if(!w(t))return"Invalid nPub";let s="npub1";for(let n=5;n<r+5;n++)s+=t[n];s+="...";let o="";for(let n=e-1;n>=e-r;n--)o=t[n]+o;return s+=o,s}async function P(t,r){const e=await t.fetchEvents({kinds:[m.Repost],"#e":[r||""]}),s=d=>d.tags.filter(g=>g[0]==="p").length===1,o=d=>d.tags.filter(g=>g[0]==="e").length===1,n=Array.from(e).filter(s).length,i=await t.fetchEvents({kinds:[m.Reaction],"#e":[r||""]}),a=0,u=await t.fetchEvents({kinds:[m.Text],"#e":[r||""]}),l=Array.from(u).filter(o).length;return{likes:i.size,reposts:n,zaps:a/S,replies:l}}function $(t){if(t){const r=t.split(",").map(e=>e.trim()).filter(Boolean).filter(y);return r.length?Array.from(new Set(r)):[...v]}return[...v]}function C(t){const r=t==null?void 0:t.trim().toLowerCase();return r==="light"||r==="dark"?r:"light"}function U(t){return t===null?!1:t===""||t.toLowerCase()==="true"}function B(t){const r=document.createElement("div");return r.textContent=t,r.innerHTML}function F(t){try{const r=new URL(t);return["http:","https:"].includes(r.protocol)}catch{return!1}}function y(t){try{const r=new URL(t);return r.protocol==="wss:"||r.protocol==="ws:"}catch{return!1}}function b(t){return/^[0-9a-fA-F]+$/.test(t)&&t.length===64}function w(t){try{const{type:r}=p.decode(t);return r==="npub"}catch{return!1}}function N(t){return/^[a-zA-Z0-9_\-\.]+@[a-zA-Z0-9_\-\.]+\.[a-zA-Z]{2,}$/.test(t)}function R(t,r){try{const{type:e}=p.decode(t);return e===r}catch{return!1}}function j(t){return R(t,"note")}function D(t){return R(t,"nevent")}function H(t){return navigator.clipboard.writeText(t)}function K(t){try{const r=Date.now(),e=t*1e3,s=r-e,o=Math.floor(s/1e3);if(o<60)return"just now";if(o<3600){const i=Math.floor(o/60);return`${i} ${i===1?"min":"mins"} ago`}if(o<86400){const i=Math.floor(o/3600);return`${i} ${i===1?"hour":"hours"} ago`}if(o<2592e3){const i=Math.floor(o/86400);return`${i} ${i===1?"day":"days"} ago`}if(o<31536e3){const i=Math.floor(o/2592e3);return`${i} ${i===1?"month":"months"} ago`}const n=Math.floor(o/31536e3);return`${n} ${n===1?"year":"years"} ago`}catch(r){return console.error("Error formatting relative time:",r),"unknown"}}var f=(t=>(t[t.Idle=0]="Idle",t[t.Loading=1]="Loading",t[t.Ready=2]="Ready",t[t.Error=3]="Error",t))(f||{});const x="nc:status";class q extends HTMLElement{constructor(e=!0){super();c(this,"nostrService",L.getInstance());c(this,"theme","light");c(this,"errorMessage","");c(this,"nostrReady");c(this,"nostrReadyResolve");c(this,"nostrReadyReject");c(this,"conn",this.channel("connection"));c(this,"_statuses",new Map);c(this,"_overall",0);c(this,"connectSeq",0);e&&this.attachShadow({mode:"open"}),this.resetNostrReadyBarrier()}static get observedAttributes(){return["data-theme","relays"]}connectedCallback(){this.validateInputs()&&(this.getTheme(),this.conn.get()===0&&this.connectToNostr())}disconnectedCallback(){this.shadowRoot&&this._delegated&&this._delegated.clear()}attributeChangedCallback(e,s,o){s!==o&&(e==="data-theme"||e==="relays")&&this.validateInputs()&&(e==="relays"&&(this.resetNostrReadyBarrier(),this.connectToNostr()),e==="data-theme"&&(this.getTheme(),this.render()))}setStatusFor(e,s,o){const n=this._statuses.get(e);if(!(n!==s||s===3&&!!o))return;this._statuses.set(e,s),s===3&&o?this.errorMessage=o:n===3&&s!==3&&(this.errorMessage="");const a=`${e}-status`,u=f[s].toLowerCase();this.getAttribute(a)!==u&&this.setAttribute(a,u);const l=this.computeOverall(),d=f[l].toLowerCase();this._overall!==l?(this._overall=l,this.setAttribute("status",d),this.onStatusChange(l)):l===3&&o&&this.onStatusChange(l),this.dispatchEvent(new CustomEvent(x,{detail:{key:e,status:s,all:this.snapshotStatuses(),overall:this._overall,errorMessage:this.errorMessage||void 0},bubbles:!0,composed:!0}))}getStatusFor(e){return this._statuses.get(e)??0}snapshotStatuses(){return Object.fromEntries(this._statuses.entries())}onStatusChange(e){}computeOverall(){const e=[...this._statuses.values()];return e.includes(3)?3:e.includes(1)?1:e.includes(2)?2:0}initChannelStatus(e,s,o={reflectOverall:!1}){if(this._statuses.set(e,s),this.setAttribute(`${e}-status`,f[s].toLowerCase()),o.reflectOverall){const n=this.computeOverall();this._overall=n,this.setAttribute("status",f[n].toLowerCase())}}channel(e){return{set:(s,o)=>this.setStatusFor(e,s,o),get:()=>this.getStatusFor(e)}}validateInputs(){const e=this.getAttribute("data-theme")||"light",s=this.getAttribute("relays"),o=this.tagName.toLowerCase();if(e==="light"||e==="dark"){if(s&&typeof s!="string")return this.conn.set(3,"Invalid relays list"),console.error(`Nostr-Components: ${o}: ${this.errorMessage}`),!1;if(s){const i=s.split(",").map(a=>a.trim()).filter(Boolean).filter(a=>!y(a));if(i.length>0){const a=i.join(", ");return this.conn.set(3,`Invalid relay URLs: ${a}. Relay URLs must start with 'wss://' or 'ws://'`),console.error(`Nostr-Components: ${o}: ${this.errorMessage}`),!1}}}else return this.conn.set(3,`Invalid theme '${e}'. Accepted values are 'light', 'dark'`),console.error(`Nostr-Components: ${o}: ${this.errorMessage}`),!1;return this.errorMessage="",!0}async connectToNostr(){var s,o;const e=++this.connectSeq;this.conn.set(1);try{if(await this.nostrService.connectToNostr(this.getRelays()),e!==this.connectSeq)return;this.conn.set(2),(s=this.nostrReadyResolve)==null||s.call(this)}catch(n){if(e!==this.connectSeq)return;console.error("Failed to connect to Nostr relays:",n),this.conn.set(3,"Failed to connect to relays"),(o=this.nostrReadyReject)==null||o.call(this,n)}}ensureNostrConnected(){return this.nostrReady}getRelays(){return $(this.getAttribute("relays"))}getTheme(){this.theme=C(this.getAttribute("data-theme"))}delegateEvent(e,s,o){var a;const n=this.shadowRoot;if(!n)return;const i=`${e}:${s}`;(a=this._delegated)!=null&&a.has(i)||(this._delegated||(this._delegated=new Set),this._delegated.add(i),n.addEventListener(e,u=>{u.target.closest(s)&&o(u)}))}addDelegatedListener(e,s,o){this.delegateEvent(e,s,o)}renderError(e){return`Error: ${e}`}updateHostClasses(){const e=this.computeOverall()===1,s=this.computeOverall()===3,o=this.computeOverall()===2;this.classList.remove("is-clickable","is-disabled","is-error"),e?this.classList.add("is-disabled"):s?this.classList.add("is-error"):o&&this.classList.add("is-clickable")}render(){this.updateHostClasses(),this.renderContent()}handleNjumpClick(e,s,o){if(this.computeOverall()!==2)return;const n=new CustomEvent(e,{detail:s,bubbles:!0,composed:!0,cancelable:!0});this.dispatchEvent(n)&&window.open(`https://njump.me/${o}`,"_blank","noopener,noreferrer")}resetNostrReadyBarrier(){this.connectSeq++,this.nostrReady=new Promise((e,s)=>{this.nostrReadyResolve=e,this.nostrReadyReject=s})}}class V{constructor(r){this.nostrService=r}validateInputs({npub:r,pubkey:e,nip05:s}){return!r&&!e&&!s?"Provide npub, nip05 or pubkey attribute":e&&!b(e)?`Invalid Pubkey: ${e}`:s&&!N(s)?`Invalid Nip05: ${s}`:r&&!w(r)?`Invalid Npub: ${r}`:null}async resolveUser({npub:r,pubkey:e,nip05:s}){const o=await this.nostrService.resolveNDKUser({npub:r,pubkey:e,nip05:s});if(!o)throw new Error("Unable to resolve user from provided identifier");const n=await this.nostrService.getProfile(o);return{user:o,profile:n??null}}}function I(){return`
      :host {
        /* === GENERIC DESIGN TOKENS === */
        --nostrc-color-background: #ffffff;
        --nostrc-color-hover-background: rgba(0, 0, 0, 0.05);
        --nostrc-color-border: #e0e0e0;
        --nostrc-color-error-background: #ffebee;
        --nostrc-color-error-text: #d32f2f;
        --nostrc-color-error-icon: #d32f2f;
        
        /* === TYPOGRAPHY === */
        --nostrc-font-family-primary: ui-sans-serif, system-ui, sans-serif;
        --nostrc-font-family-mono: monospace;
        --nostrc-font-size-base: 1em;
        --nostrc-font-size-small: 0.8em;
        --nostrc-font-size-large: 1.2em;
        --nostrc-font-weight-normal: 400;
        --nostrc-font-weight-medium: 500;
        --nostrc-font-weight-bold: 700;
        
        /* === SPACING === */
        --nostrc-spacing-xs: 4px;
        --nostrc-spacing-sm: 8px;
        --nostrc-spacing-md: 12px;
        --nostrc-spacing-lg: 16px;
        --nostrc-spacing-xl: 20px;
        
        /* === BORDERS === */
        --nostrc-border-radius-sm: 4px;
        --nostrc-border-radius-md: 8px;
        --nostrc-border-radius-lg: 12px;
        --nostrc-border-radius-full: 50%;
        --nostrc-border-width: 1px;
        
        /* === SKELETON === */
        --nostrc-skeleton-color-min: #f0f0f0;
        --nostrc-skeleton-color-max: #e0e0e0;
        --nostrc-skeleton-duration: 1.5s;
        --nostrc-skeleton-timing-function: linear;
        --nostrc-skeleton-iteration-count: infinite;
        
        /* === TRANSITIONS === */
        --nostrc-transition-duration: 0.2s;
        --nostrc-transition-timing: ease;
      }
      
      :host(.is-disabled) {
        opacity: 0.7;
        cursor: not-allowed;
      }
      
      /* === ESSENTIAL UTILITY STYLES === */
      ${h.skeleton()}
      ${h.copyButton()}
      ${h.textRow()}
      ${h.profileName()}
      ${h.errorIcon()}
  `}function Y(t){return`
    <style>
      ${I()}
      /* === COMPONENT-SPECIFIC STYLES === */
      ${t}
    </style>
  `}const h={error:()=>`
    :host(.is-error) {
      color: var(--nostrc-color-error-text);
    }
  `,skeleton:()=>`
    .skeleton {
      background: linear-gradient(
        90deg,
        var(--nostrc-skeleton-color-min) 0%,
        var(--nostrc-skeleton-color-max) 50%,
        var(--nostrc-skeleton-color-min) 100%
      );
      background-size: 200% 100%;
      animation: skeleton-loading var(--nostrc-skeleton-duration) var(--nostrc-skeleton-timing-function) var(--nostrc-skeleton-iteration-count);
      border-radius: var(--nostrc-border-radius-sm);
      height: 16px;
      margin-bottom: var(--nostrc-spacing-xs);
    }
    
    .skeleton:last-child {
      margin-bottom: 0;
    }
    
    @keyframes skeleton-loading {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    @media (prefers-reduced-motion: reduce) {
      .skeleton { animation: none; }
    }
  `,copyButton:()=>`
    .nc-copy-btn {
      cursor: pointer;
      opacity: 0.7;
      transition: opacity var(--nostrc-transition-duration) var(--nostrc-transition-timing);
      font-size: 1.5em;
      border: none;
      background: transparent;
      color: var(--nostrc-color-text-muted);
    }
    
    .nc-copy-btn:hover {
      opacity: 1;
    }
    
    .nc-copy-btn.copied {
      color: var(--nostrc-color-accent);
    }
  `,profileName:()=>`
    .nostr-profile-name {
      color: var(--nostrc-theme-text-primary, #333333);
      font-weight: var(--nostrc-font-weight-bold);
      padding-bottom: var(--nostrc-spacing-xs);
    }
  `,textRow:()=>`
    .text-row {
      display: flex;
      align-items: center;
      gap: var(--nostrc-spacing-sm);
      font-size: var(--nostrc-font-size-base);
    }
    
    .text-row.mono {
      font-family: var(--nostrc-font-family-mono);
      font-size: var(--nostrc-font-size-small);
    }
  `,errorIcon:()=>`
    .error-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border-radius: var(--nostrc-border-radius-full);
      background-color: var(--nostrc-color-error-background);
      color: var(--nostrc-color-error-icon);
      font-size: 2em;
      margin: auto;
    }
  `};export{q as N,V as U,f as a,b,H as c,D as d,B as e,P as f,Y as g,M as h,F as i,O as j,K as k,z as m,U as p,j as v};
//# sourceMappingURL=base-styles-Gp1Vfp3g.js.map
