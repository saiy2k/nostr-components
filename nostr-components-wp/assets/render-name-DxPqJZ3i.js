import{e as n,m as f}from"./utils-Blx44Hni.js";function l(t){const{value:s,display:e=s,className:a="",monospace:o=!1,title:p=e,showCopyButton:u=!1}=t,r=a.replace(/[^\w\- ]/g,""),c=n(e),i=n(p),m="&#x2398;";if(u){const y=n(s);return`
      <div class="${`text-row nc-copy ${o?"mono":""} ${r}`.trim()}" data-copy="${y}" title="${i}">
        <span class="nc-copy-text">${c}</span>
        <button type="button" 
              class="nc-copy-btn"
              aria-label="Copy"
              title="Copy"
              >${m}</button>
      </div>
    `}return`
    <div class="${`text-row ${o?"mono":""} ${r}`.trim()}" title="${i}">
      ${c}
    </div>
  `}function C(t){return l({value:t,display:f(t),monospace:!0,showCopyButton:!0,title:t})}function v(t){return l({value:t,display:t,monospace:!0,showCopyButton:!0})}function N(t){const{name:s,className:e="",title:a,showCopyButton:o=!1}=t;return l({value:s,display:s,className:`nostr-profile-name ${e}`.trim(),title:a??s,showCopyButton:o})}export{v as a,C as b,l as c,N as r};
//# sourceMappingURL=render-name-DxPqJZ3i.js.map
