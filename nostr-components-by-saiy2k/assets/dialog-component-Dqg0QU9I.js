var d=Object.defineProperty;var c=(a,t,e)=>t in a?d(a,t,{enumerable:!0,configurable:!0,writable:!0,value:e}):a[t]=e;var l=(a,t,e)=>c(a,typeof t!="symbol"?t+"":t,e);const h=()=>`
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
  `;class g extends HTMLElement{constructor(){super();l(this,"dialog",null)}static get observedAttributes(){return["header","data-theme"]}injectStyles(){if(document.querySelector("style[data-dialog-component-styles]"))return;const e=document.createElement("style");e.setAttribute("data-dialog-component-styles","true"),e.textContent=h(),document.head.appendChild(e)}render(){this.injectStyles();const e=this.getAttribute("header")||"Dialog",o=this.getAttribute("data-theme");this.dialog=document.createElement("dialog"),this.dialog.className="nostr-base-dialog",o&&this.dialog.setAttribute("data-theme",o);const i=document.createElement("div");i.className="dialog-header";const s=document.createElement("h2");s.textContent=e;const n=document.createElement("button");n.className="dialog-close-btn",n.setAttribute("aria-label","Close dialog"),n.textContent="✕",i.appendChild(s),i.appendChild(n);const r=document.createElement("div");for(r.className="dialog-content";this.firstChild;)r.appendChild(this.firstChild);this.dialog.appendChild(i),this.dialog.appendChild(r),document.body.appendChild(this.dialog),this.setupEventListeners()}setupEventListeners(){if(!this.dialog)return;const e=this.dialog.querySelector(".dialog-close-btn");e==null||e.addEventListener("click",()=>{this.close()}),this.dialog.addEventListener("click",o=>{o.target===this.dialog&&this.close()}),this.dialog.addEventListener("cancel",o=>{o.preventDefault(),this.close()}),this.dialog.addEventListener("close",()=>{this.cleanup()})}show(){this.showModal()}showModal(){var e;this.dialog||this.render(),(e=this.dialog)==null||e.showModal()}close(){var e;(e=this.dialog)==null||e.close()}cleanup(){this.dialog&&this.dialog.isConnected&&this.dialog.remove(),this.isConnected&&this.remove(),this.dialog=null}disconnectedCallback(){this.cleanup()}attributeChangedCallback(e,o,i){if(e==="header"&&this.dialog){const s=this.dialog.querySelector(".dialog-header h2");s&&(s.textContent=i||"Dialog")}else e==="data-theme"&&this.dialog&&(i?this.dialog.setAttribute("data-theme",i):this.dialog.removeAttribute("data-theme"))}}customElements.get("dialog-component")||customElements.define("dialog-component",g);
//# sourceMappingURL=dialog-component-Dqg0QU9I.js.map
