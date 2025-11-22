var f=Object.defineProperty;var v=(e,s,t)=>s in e?f(e,s,{enumerable:!0,configurable:!0,writable:!0,value:t}):e[s]=t;var i=(e,s,t)=>v(e,typeof s!="symbol"?s+"":s,t);import{c as b}from"./nostr-service-w4c-zprD.js";import{a as p,b as k,i as y,v as $,d as x}from"./utils-Blx44Hni.js";var h=(e=>(e[e.Idle=0]="Idle",e[e.Loading=1]="Loading",e[e.Ready=2]="Ready",e[e.Error=3]="Error",e))(h||{});const S="nc:status";class I extends HTMLElement{constructor(t=!0){super();i(this,"nostrService",b.getInstance());i(this,"theme","light");i(this,"errorMessage","");i(this,"nostrReady");i(this,"nostrReadyResolve");i(this,"nostrReadyReject");i(this,"conn",this.channel("connection"));i(this,"_statuses",new Map);i(this,"_overall",0);i(this,"connectSeq",0);t&&this.attachShadow({mode:"open"}),this.resetNostrReadyBarrier()}static get observedAttributes(){return["theme","relays"]}connectedCallback(){this.validateInputs()&&(this.getTheme(),this.conn.get()===0&&this.connectToNostr())}disconnectedCallback(){this.shadowRoot&&this._delegated&&this._delegated.clear()}attributeChangedCallback(t,r,o){r!==o&&(t==="theme"||t==="relays")&&this.validateInputs()&&(t==="relays"&&(this.resetNostrReadyBarrier(),this.connectToNostr()),t==="theme"&&(this.getTheme(),this.render()))}setStatusFor(t,r,o){const n=this._statuses.get(t);if(!(n!==r||r===3&&!!o))return;this._statuses.set(t,r),r===3&&o?this.errorMessage=o:n===3&&r!==3&&(this.errorMessage="");const c=`${t}-status`,d=h[r].toLowerCase();this.getAttribute(c)!==d&&this.setAttribute(c,d);const l=this.computeOverall(),m=h[l].toLowerCase();this._overall!==l?(this._overall=l,this.setAttribute("status",m),this.onStatusChange(l)):l===3&&o&&this.onStatusChange(l),this.dispatchEvent(new CustomEvent(S,{detail:{key:t,status:r,all:this.snapshotStatuses(),overall:this._overall,errorMessage:this.errorMessage||void 0},bubbles:!0,composed:!0}))}getStatusFor(t){return this._statuses.get(t)??0}snapshotStatuses(){return Object.fromEntries(this._statuses.entries())}onStatusChange(t){}computeOverall(){const t=[...this._statuses.values()];return t.includes(3)?3:t.includes(1)?1:t.includes(2)?2:0}initChannelStatus(t,r,o={reflectOverall:!1}){if(this._statuses.set(t,r),this.setAttribute(`${t}-status`,h[r].toLowerCase()),o.reflectOverall){const n=this.computeOverall();this._overall=n,this.setAttribute("status",h[n].toLowerCase())}}channel(t){return{set:(r,o)=>this.setStatusFor(t,r,o),get:()=>this.getStatusFor(t)}}validateInputs(){const t=this.getAttribute("theme")||"light",r=this.getAttribute("relays"),o=this.tagName.toLowerCase();if(t==="light"||t==="dark"){if(r&&typeof r!="string")return this.conn.set(3,"Invalid relays list"),console.error(`Nostr-Components: ${o}: ${this.errorMessage}`),!1}else return this.conn.set(3,`Invalid theme '${t}'. Accepted values are 'light', 'dark'`),console.error(`Nostr-Components: ${o}: ${this.errorMessage}`),!1;return this.errorMessage="",!0}async connectToNostr(){var r,o;const t=++this.connectSeq;this.conn.set(1);try{if(await this.nostrService.connectToNostr(this.getRelays()),t!==this.connectSeq)return;this.conn.set(2),(r=this.nostrReadyResolve)==null||r.call(this)}catch(n){if(t!==this.connectSeq)return;console.error("Failed to connect to Nostr relays:",n),this.conn.set(3,"Failed to connect to relays"),(o=this.nostrReadyReject)==null||o.call(this,n)}}ensureNostrConnected(){return this.nostrReady}getRelays(){return p(this.getAttribute("relays"))}getTheme(){this.theme=k(this.getAttribute("theme"))}delegateEvent(t,r,o){var c;const n=this.shadowRoot;if(!n)return;const a=`${t}:${r}`;(c=this._delegated)!=null&&c.has(a)||(this._delegated||(this._delegated=new Set),this._delegated.add(a),n.addEventListener(t,d=>{d.target.closest(r)&&o(d)}))}addDelegatedListener(t,r,o){this.delegateEvent(t,r,o)}renderError(t){return`Error: ${t}`}updateHostClasses(){const t=this.computeOverall()===1,r=this.computeOverall()===3,o=this.computeOverall()===2;this.classList.remove("is-clickable","is-disabled","is-error"),t?this.classList.add("is-disabled"):r?this.classList.add("is-error"):o&&this.classList.add("is-clickable")}render(){this.updateHostClasses(),this.renderContent()}resetNostrReadyBarrier(){this.connectSeq++,this.nostrReady=new Promise((t,r)=>{this.nostrReadyResolve=t,this.nostrReadyReject=r})}}class C{constructor(s){this.nostrService=s}validateInputs({npub:s,pubkey:t,nip05:r}){return!s&&!t&&!r?"Provide npub, nip05 or pubkey attribute":t&&!y(t)?`Invalid Pubkey: ${t}`:r&&!$(r)?`Invalid Nip05: ${r}`:s&&!x(s)?`Invalid Npub: ${s}`:null}async resolveUser({npub:s,pubkey:t,nip05:r}){const o=await this.nostrService.resolveNDKUser({npub:s,pubkey:t,nip05:r});if(!o)throw new Error("Unable to resolve user from provided identifier");const n=await this.nostrService.getProfile(o);return{user:o,profile:n??null}}}const g={colors:{background:{light:"#ffffff",dark:"#1a1a1a"},hoverBackground:{light:"rgba(0, 0, 0, 0.05)",dark:"rgba(255, 255, 255, 0.05)"},text:{primary:{light:"#444444",dark:"#ffffff"},secondary:{light:"#666666",dark:"#ffffff"},muted:{light:"#808080",dark:"#a0a0a0"}},border:{light:"#e0e0e0",dark:"#333333"},error:{background:"#ffebee",text:"#d32f2f",icon:"#d32f2f"},accent:"#ca077c"},typography:{fontFamily:{primary:"Inter, sans-serif",mono:"monospace"},fontSize:{base:"1em",small:"0.8em",large:"1.2em"},fontWeight:{normal:400,medium:500,bold:700}},spacing:{xs:"4px",sm:"8px",md:"12px",lg:"16px",xl:"20px"},borders:{radius:{sm:"4px",md:"8px",lg:"12px",full:"50%"},width:"1px"},skeleton:{colors:{light:{min:"#f0f0f0",max:"#e0e0e0"},dark:{min:"#333333",max:"#2a2a2a"}},animation:{duration:"1.5s",timingFunction:"linear",iterationCount:"infinite"}},transitions:{duration:"0.2s",timing:"ease"}};function R(e,s=g){const{colors:t,typography:r,spacing:o,borders:n,skeleton:a,transitions:c}=s;return`
    /* === DESIGN TOKENS === */
    --nostrc-color-background-light: ${t.background.light};
    --nostrc-color-background-dark: ${t.background.dark};
    --nostrc-color-background: var(--nostrc-color-background-${e});
    
    --nostrc-color-hover-background-light: ${t.hoverBackground.light};
    --nostrc-color-hover-background-dark: ${t.hoverBackground.dark};
    --nostrc-color-hover-background: var(--nostrc-color-hover-background-${e});
    
    --nostrc-color-text-primary-light: ${t.text.primary.light};
    --nostrc-color-text-primary-dark: ${t.text.primary.dark};
    --nostrc-color-text-primary: var(--nostrc-color-text-primary-${e});
    
    --nostrc-color-text-secondary-light: ${t.text.secondary.light};
    --nostrc-color-text-secondary-dark: ${t.text.secondary.dark};
    --nostrc-color-text-secondary: var(--nostrc-color-text-secondary-${e});
    
    --nostrc-color-text-muted-light: ${t.text.muted.light};
    --nostrc-color-text-muted-dark: ${t.text.muted.dark};
    --nostrc-color-text-muted: var(--nostrc-color-text-muted-${e});
    
    --nostrc-color-border-light: ${t.border.light};
    --nostrc-color-border-dark: ${t.border.dark};
    --nostrc-color-border: var(--nostrc-color-border-${e});
    
    --nostrc-color-error-background: ${t.error.background};
    --nostrc-color-error-text: ${t.error.text};
    --nostrc-color-error-icon: ${t.error.icon};
    
    --nostrc-color-accent: ${t.accent};
    
    /* === TYPOGRAPHY === */
    --nostrc-font-family-primary: ${r.fontFamily.primary};
    --nostrc-font-family-mono: ${r.fontFamily.mono};
    --nostrc-font-size-base: ${r.fontSize.base};
    --nostrc-font-size-small: ${r.fontSize.small};
    --nostrc-font-size-large: ${r.fontSize.large};
    --nostrc-font-weight-normal: ${r.fontWeight.normal};
    --nostrc-font-weight-medium: ${r.fontWeight.medium};
    --nostrc-font-weight-bold: ${r.fontWeight.bold};
    
    /* === SPACING === */
    --nostrc-spacing-xs: ${o.xs};
    --nostrc-spacing-sm: ${o.sm};
    --nostrc-spacing-md: ${o.md};
    --nostrc-spacing-lg: ${o.lg};
    --nostrc-spacing-xl: ${o.xl};
    
    /* === BORDERS === */
    --nostrc-border-radius-sm: ${n.radius.sm};
    --nostrc-border-radius-md: ${n.radius.md};
    --nostrc-border-radius-lg: ${n.radius.lg};
    --nostrc-border-radius-full: ${n.radius.full};
    --nostrc-border-width: ${n.width};
    
    /* === SKELETON === */
    --nostrc-skeleton-color-min-light: ${a.colors.light.min};
    --nostrc-skeleton-color-max-light: ${a.colors.light.max};
    --nostrc-skeleton-color-min-dark: ${a.colors.dark.min};
    --nostrc-skeleton-color-max-dark: ${a.colors.dark.max};
    --nostrc-skeleton-color-min: var(--nostrc-skeleton-color-min-${e});
    --nostrc-skeleton-color-max: var(--nostrc-skeleton-color-max-${e});
    --nostrc-skeleton-duration: ${a.animation.duration};
    --nostrc-skeleton-timing-function: ${a.animation.timingFunction};
    --nostrc-skeleton-iteration-count: ${a.animation.iterationCount};
    
    /* === TRANSITIONS === */
    --nostrc-transition-duration: ${c.duration};
    --nostrc-transition-timing: ${c.timing};

    .margin-bottom-md {
      margin-bottom: var(--nostrc-spacing-md);
    }
  `}const u={error:()=>`
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
      color: var(--nostrc-color-text-primary);
      font-weight: var(--nostrc-font-weight-bold);
      padding-bottom: var(--nostrc-spacing-xs);
    }
  `,textRow:()=>`
    .text-row {
      display: flex;
      align-items: center;
      gap: var(--nostrc-spacing-sm);
      font-family: var(--nostrc-font-family-primary);
      font-size: var(--nostrc-font-size-base);
      color: var(--nostrc-color-text-secondary);
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
    }
  `};function w(e){return`
    <style>
      :host {
        ${R(e,g)}
      }
      
      /* === GENERIC CONTAINER STYLES === */
      .nostrc-container {
        display: block;
        font-family: var(--nostrc-font-family-primary);
        font-size: var(--nostrc-font-size-base);
        background-color: var(--nostrc-color-background);
        border-radius: var(--nostrc-border-radius-md);
        border: var(--nostrc-border-width) solid var(--nostrc-color-border);
        padding: var(--nostrc-spacing-md);
        transition: background-color var(--nostrc-transition-duration) var(--nostrc-transition-timing);
      }
      
      :host(.is-clickable) .nostrc-container {
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      :host(.is-clickable) .nostrc-container:hover {
        background-color: var(--nostrc-color-hover-background);
      }
      
      :host(.is-disabled) {
        opacity: 0.7;
        cursor: not-allowed;
      }
      
      :host(.is-error) .nostrc-container {
        color: var(--nostrc-color-error-text);
        border-color: var(--nostrc-color-error-text);
        cursor: not-allowed;
      }
      
      /* === ESSENTIAL UTILITY STYLES === */
      ${u.skeleton()}
      ${u.copyButton()}
      ${u.textRow()}
      ${u.profileName()}
      ${u.errorIcon()}
    </style>
  `}function L(e,s){return`
    ${w(e)}
    <style>
      /* === COMPONENT-SPECIFIC STYLES === */
      ${s}
    </style>
  `}export{I as N,C as U,h as a,L as g};
//# sourceMappingURL=base-styles-BBUNbLUX.js.map
