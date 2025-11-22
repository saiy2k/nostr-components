var A=Object.defineProperty;var L=(e,o,t)=>o in e?A(e,o,{enumerable:!0,configurable:!0,writable:!0,value:t}):e[o]=t;var C=(e,o,t)=>L(e,typeof o!="symbol"?o+"":o,t);import{S as E,g as k,h as D}from"./nostr-service-CmuKGzjo.js";import{n as x}from"./utils--bxLbhGF.js";const R=()=>`
    /* Base Dialog Styles */
    .nostr-base-dialog {
      width: 400px;
      max-width: 90vw;
      border: none;
      border-radius: var(--nostrc-border-radius-lg, 10px);
      padding: var(--nostrc-spacing-xl, 20px);
      background: var(--nostrc-theme-bg, #ffffff);
      color: var(--nostrc-theme-text-primary, #000000);
      position: relative;
      font-family: var(--nostrc-font-family-primary, ui-sans-serif, system-ui, sans-serif);
    }

    .nostr-base-dialog[open] {
      display: block;
    }

    .nostr-base-dialog::backdrop {
      background: rgba(0, 0, 0, 0.5);
    }

    .dialog-header {
      position: relative;
      margin-bottom: var(--nostrc-spacing-lg, 16px);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .dialog-header h2 {
      font-size: var(--nostrc-font-size-large, 1.25rem);
      font-weight: var(--nostrc-font-weight-bold, 700);
      margin: 0;
      flex: 1;
      text-align: left;
      padding-top: 2px;
      color: var(--nostrc-theme-text-primary, #000000);
    }

    .dialog-close-btn {
      border: none;
      background: var(--nostrc-theme-hover-bg, #f7fafc);
      border-radius: var(--nostrc-border-radius-full, 50%);
      width: 32px;
      height: 32px;
      min-width: 32px;
      font-size: var(--nostrc-font-size-base, 16px);
      cursor: pointer;
      color: var(--nostrc-theme-text-secondary, #666666);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .dialog-close-btn:hover {
      background: var(--nostrc-theme-border, rgba(0, 0, 0, 0.05));
      color: var(--nostrc-theme-text-primary, #000000);
    }

    .dialog-content {
      line-height: 1.6;
      color: var(--nostrc-theme-text-primary, #000000);
    }
  `;class U extends HTMLElement{constructor(){super();C(this,"dialog",null)}static get observedAttributes(){return["header","data-theme"]}injectStyles(){if(document.querySelector("style[data-dialog-component-styles]"))return;const t=document.createElement("style");t.setAttribute("data-dialog-component-styles","true"),t.textContent=R(),document.head.appendChild(t)}render(){this.injectStyles();const t=this.getAttribute("header")||"Dialog",s=this.getAttribute("data-theme");this.dialog=document.createElement("dialog"),this.dialog.className="nostr-base-dialog",s&&this.dialog.setAttribute("data-theme",s);const n=document.createElement("div");n.className="dialog-header";const i=document.createElement("h2");i.textContent=t;const a=document.createElement("button");a.className="dialog-close-btn",a.setAttribute("aria-label","Close dialog"),a.textContent="✕",n.appendChild(i),n.appendChild(a);const l=document.createElement("div");for(l.className="dialog-content";this.firstChild;)l.appendChild(this.firstChild);this.dialog.appendChild(n),this.dialog.appendChild(l),document.body.appendChild(this.dialog),this.setupEventListeners()}setupEventListeners(){if(!this.dialog)return;const t=this.dialog.querySelector(".dialog-close-btn");t==null||t.addEventListener("click",()=>{this.close()}),this.dialog.addEventListener("click",s=>{s.target===this.dialog&&this.close()}),this.dialog.addEventListener("cancel",s=>{s.preventDefault(),this.close()}),this.dialog.addEventListener("close",()=>{this.cleanup()})}show(){this.showModal()}showModal(){var t;this.dialog||this.render(),(t=this.dialog)==null||t.showModal()}close(){var t;(t=this.dialog)==null||t.close()}cleanup(){this.dialog&&this.dialog.isConnected&&this.dialog.remove(),this.isConnected&&this.remove(),this.dialog=null}disconnectedCallback(){this.cleanup()}attributeChangedCallback(t,s,n){if(t==="header"&&this.dialog){const i=this.dialog.querySelector(".dialog-header h2");i&&(i.textContent=n||"Dialog")}else t==="data-theme"&&this.dialog&&(n?this.dialog.setAttribute("data-theme",n):this.dialog.removeAttribute("data-theme"))}}customElements.get("dialog-component")||customElements.define("dialog-component",U);const f={},O=async e=>{if(f[e])return f[e];const o=new E,t=["wss://relay.nostr.band","wss://purplepag.es","wss://relay.damus.io","wss://nostr.wine"];try{const s=await o.get(t,{authors:[e],kinds:[0]});return f[e]=s,s}finally{o.close(t)}},q=async e=>{const o=e.filter(n=>!f[n]);if(o.length===0)return e.map(n=>({id:n,profile:f[n]}));const t=new E,s=["wss://relay.nostr.band","wss://purplepag.es","wss://relay.damus.io","wss://nostr.wine"];try{return(await t.querySync(s,{authors:o,kinds:[0]})).forEach(a=>{f[a.pubkey]=a}),e.map(a=>({id:a,profile:f[a]||null}))}finally{t.close(s)}},J=e=>{try{return JSON.parse((e==null?void 0:e.content)||"{}")}catch{return{}}},_=async e=>{const o=await k.getZapEndpoint(e);if(!o)throw new Error("Failed to retrieve zap LNURL");return o},P=async(e,o)=>{if(S())try{const t=window.nostr;if(t!=null&&t.signEvent)return await t.signEvent(e)}catch{}return D(e,Z())},z=async({profile:e,nip19Target:o,amount:t,relays:s,comment:n,anon:i,url:a})=>{const l={profile:e,amount:t,relays:s,comment:n||""},c=k.makeZapRequest(l);return a&&(c.tags.push(["k","web"]),c.tags.push(["i",x(a)])),(!S()||i)&&c.tags.push(["anon"]),P(c)},T=async({zapEndpoint:e,amount:o,comment:t,authorId:s,nip19Target:n,normalizedRelays:i,anon:a,url:l})=>{const c=await z({profile:s,nip19Target:n,amount:o,relays:i,comment:t??"",anon:a,url:l});let u=`${e}?amount=${o}&nostr=${encodeURIComponent(JSON.stringify(c))}`;t&&(u+=`&comment=${encodeURIComponent(t??"")}`);const d=await fetch(u,{method:"GET"});if(!d.ok)throw new Error(`LNURL request failed: ${d.status} ${d.statusText}`);let p;try{p=await d.json()}catch{throw new Error("Invalid JSON from LNURL endpoint")}const{pr:y,reason:v,status:b}=p||{};if(y)return y;throw b==="ERROR"?new Error(v??"Unable to fetch invoice"):new Error("Unable to fetch invoice")},Z=()=>{const e=new Uint8Array(32);if(typeof crypto<"u"&&typeof crypto.getRandomValues=="function")crypto.getRandomValues(e);else{console.warn("crypto.getRandomValues not available, using Math.random as fallback");for(let o=0;o<32;o++)e[o]=Math.floor(Math.random()*256)}return e},S=()=>typeof window<"u"&&!!window.nostr,B=async({pubkey:e,relays:o,url:t})=>{var l,c,u,d;const s=t?x(t):void 0,n=new E;let i=0;const a=[];try{const p={kinds:[9735],"#p":[e],limit:1e3},y=await n.querySync(o,p);for(const v of y){const b=(l=v.tags)==null?void 0:l.find(r=>r[0]==="description");if(b!=null&&b[1])try{const r=JSON.parse(b[1]),g=(c=r==null?void 0:r.tags)==null?void 0:c.find(h=>h[0]==="amount");if(s){const h=(u=r==null?void 0:r.tags)==null?void 0:u.find(m=>m[0]==="k"),w=(d=r==null?void 0:r.tags)==null?void 0:d.find(m=>m[0]==="i"),N=w!=null&&w[1]?x(w[1]):"";if((h==null?void 0:h[1])==="web"&&N===s&&(g!=null&&g[1])){const m=parseInt(g[1],10);m>0&&(i+=m,a.push({amount:m/1e3,date:new Date(v.created_at*1e3),authorPubkey:r.pubkey,comment:r.content}))}}else if(g!=null&&g[1]){const h=parseInt(g[1],10);h>0&&(i+=h,a.push({amount:h/1e3,date:new Date(v.created_at*1e3),authorPubkey:r.pubkey,comment:r.content}))}}catch(r){console.error("Nostr-Components: Zap button: Could not parse zap request from description tag",r)}}}catch(p){console.error("Nostr-Components: Zap button: Error fetching zap receipts",p)}finally{n.close(o)}return a.sort((p,y)=>y.date.getTime()-p.date.getTime()),{totalAmount:i/1e3,zapDetails:a}},F=({relays:e,receiversPubKey:o,invoice:t,onSuccess:s})=>{const n=new E,i=Array.from(new Set([...e,"wss://relay.nostr.band"])),a=Math.floor((Date.now()-24*60*60*1e3)/1e3);n.subscribe(i,{kinds:[9735],"#p":[o],since:a},{onevent(c){c.tags.some(d=>d[0]==="bolt11"&&d[1]===t)&&(s(),l())}});const l=()=>{n.close(i)};return l};export{J as extractProfileMetadataContent,T as fetchInvoice,B as fetchTotalZapAmount,q as getBatchedProfileMetadata,O as getProfileMetadata,_ as getZapEndpoint,S as isNip07ExtAvailable,F as listenForZapReceipt};
//# sourceMappingURL=zap-utils-M-zkfAkW.js.map
