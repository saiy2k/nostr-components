import{e as r,m,f}from"./base-styles-Cn9HxXPz.js";function l(e){const{value:a,display:t=a,className:s="",monospace:o=!1,title:n=t,showCopyButton:c=!1}=e,i=s.replace(/[^\w\- ]/g,""),p=r(t),u=r(n),y="&#x2398;";if(c){const d=r(a);return`
      <div class="${`text-row nc-copy ${o?"mono":""} ${i}`.trim()}" data-copy="${d}" title="${u}">
        <span class="nc-copy-text">${p}</span>
        <button type="button" 
              class="nc-copy-btn"
              aria-label="Copy"
              title="Copy"
              >${y}</button>
      </div>
    `}return`
    <div class="${`text-row ${o?"mono":""} ${i}`.trim()}" title="${u}">
      ${p}
    </div>
  `}function w(e){return l({value:e,display:m(e),monospace:!0,showCopyButton:!0,title:e})}function v(e){return l({value:e,display:e,monospace:!0,showCopyButton:!0})}function N(e){const{name:a,className:t="",title:s,showCopyButton:o=!1}=e;return l({value:a,display:a,className:`nostr-profile-name ${t}`.trim(),title:s??a,showCopyButton:o})}function g(e){e.addDelegatedListener("click",".nc-copy-btn",async a=>{var n;a.stopPropagation();const t=(n=a.target)==null?void 0:n.closest(".nc-copy-btn");if(!t)return;const s=t==null?void 0:t.closest(".nc-copy"),o=(s==null?void 0:s.dataset.copy)??"";if(o)try{await f(o),t.classList.add("copied");const c=t.getAttribute("aria-label")||"Copy";t.setAttribute("aria-label","Copied!"),setTimeout(()=>{t.classList.remove("copied"),t.setAttribute("aria-label",c)},1200)}catch{}})}export{v as a,w as b,l as c,g as d,N as r};
//# sourceMappingURL=copy-delegation-BTm3jLGa.js.map
