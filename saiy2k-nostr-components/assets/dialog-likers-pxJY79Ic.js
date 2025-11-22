const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/zap-utils-M-zkfAkW.js","assets/nostr-service-CmuKGzjo.js","assets/utils--bxLbhGF.js"])))=>i.map(i=>d[i]);
import{_ as y}from"./preload-helper-D7HrI6pR.js";import{getBatchedProfileMetadata as x,extractProfileMetadataContent as k}from"./zap-utils-M-zkfAkW.js";import{h as f,e as g,f as m,c as v}from"./base-styles-CJ2FUUIh.js";import{i as w}from"./utils--bxLbhGF.js";import"./nostr-service-CmuKGzjo.js";function P(t="light"){const e=t==="dark";return`
    .likers-dialog-content {
      padding: 0;
      max-height: 60vh;
      overflow-y: auto;
    }

    .likers-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .like-entry {
      display: flex;
      align-items: center;
      padding: 12px;
      border-radius: 8px;
      background: ${e?"#2a2a2a":"#f8f9fa"};
      border: 1px solid ${e?"#3a3a3a":"#e9ecef"};
      transition: background-color 0.2s ease;
    }

    .like-entry:hover {
      background: ${e?"#3a3a3a":"#e9ecef"};
    }

    .like-author-info {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
    }

    .like-author-picture {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
    }

    .like-author-picture-default {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: ${e?"#3a3a3a":"#e9ecef"};
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      flex-shrink: 0;
    }

    .like-author-details {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
      min-width: 0;
    }

    .like-author-link {
      color: ${e?"#ffffff":"#000000"};
      text-decoration: none;
      font-weight: 500;
      font-size: 14px;
      transition: color 0.2s ease;
    }

    .like-author-link:hover {
      color: ${e?"#4a9eff":"#1877f2"};
      text-decoration: underline;
    }

    .like-date {
      color: ${e?"#b0b0b0":"#65676b"};
      font-size: 12px;
      font-weight: 400;
    }

    .no-likes {
      text-align: center;
      color: ${e?"#b0b0b0":"#65676b"};
      font-size: 14px;
      padding: 40px 20px;
    }

    /* Skeleton loading states */
    .skeleton-entry {
      opacity: 0.7;
    }

    .skeleton-picture {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: linear-gradient(90deg, 
        ${e?"#3a3a3a":"#f0f0f0"} 25%, 
        ${e?"#4a4a4a":"#e0e0e0"} 50%, 
        ${e?"#3a3a3a":"#f0f0f0"} 75%
      );
      background-size: 200% 100%;
      animation: skeleton-loading 1.5s infinite;
      flex-shrink: 0;
    }

    .skeleton-name {
      width: 120px;
      height: 14px;
      background: linear-gradient(90deg, 
        ${e?"#3a3a3a":"#f0f0f0"} 25%, 
        ${e?"#4a4a4a":"#e0e0e0"} 50%, 
        ${e?"#3a3a3a":"#f0f0f0"} 75%
      );
      background-size: 200% 100%;
      animation: skeleton-loading 1.5s infinite;
      border-radius: 2px;
    }

    @keyframes skeleton-loading {
      0% {
        background-position: -200% 0;
      }
      100% {
        background-position: 200% 0;
      }
    }

    /* Responsive */
    @media (max-width: 480px) {
      .likers-dialog-content {
        max-height: 70vh;
      }

      .like-entry {
        padding: 10px;
      }

      .like-author-picture,
      .like-author-picture-default,
      .skeleton-picture {
        width: 36px;
        height: 36px;
      }

      .like-author-link {
        font-size: 13px;
      }

      .like-date {
        font-size: 11px;
      }
    }

    /* Scrollbar styling */
    .likers-dialog-content::-webkit-scrollbar {
      width: 6px;
    }

    .likers-dialog-content::-webkit-scrollbar-track {
      background: ${e?"#2a2a2a":"#f1f1f1"};
      border-radius: 3px;
    }

    .likers-dialog-content::-webkit-scrollbar-thumb {
      background: ${e?"#555":"#c1c1c1"};
      border-radius: 3px;
    }

    .likers-dialog-content::-webkit-scrollbar-thumb:hover {
      background: ${e?"#777":"#a8a8a8"};
    }
  `}const $=(t="light")=>{document.querySelectorAll("style[data-likers-dialog-styles]").forEach(r=>r.remove());const i=document.createElement("style");i.setAttribute("data-likers-dialog-styles","true"),i.textContent=P(t),document.head.appendChild(i)};function b(t,e){const i=g(t.authorName||"Unknown liker"),s=`https://njump.me/${w(t.authorNpub||"")?t.authorNpub:""}`,a=v(t.authorPicture||"")&&t.authorPicture||"",n=t.authorPicture?`<img src="${a}" alt="${i}" class="like-author-picture" />`:'<div class="like-author-picture-default">👤</div>';return`
    <div class="like-entry" data-like-index="${e}" data-author-pubkey="${t.authorPubkey}">
      <div class="like-author-info">
        ${n}
        <div class="like-author-details">
          <a href="${s}" target="_blank" rel="noopener noreferrer" class="like-author-link">
            ${i}
          </a>
          <div class="like-date">
            ${m(Math.floor(t.date.getTime()/1e3))}
          </div>
        </div>
      </div>
    </div>
  `}function N(t,e,i){return`
    <div class="like-entry skeleton-entry" data-like-index="${i}" data-author-pubkey="${t.authorPubkey}">
      <div class="like-author-info">
        <div class="skeleton-picture"></div>
        <div class="like-author-details">
          <div class="like-author-link skeleton-name">
            ${g(e)}
          </div>
          <div class="like-date">
            ${m(Math.floor(t.date.getTime()/1e3))}
          </div>
        </div>
      </div>
    </div>
  `}async function z(t){var o;const{likeDetails:e,theme:i="light"}=t;$(i),customElements.get("dialog-component")||await customElements.whenDefined("dialog-component");const r=document.createElement("dialog-component");r.setAttribute("header","Likers"),t.theme&&r.setAttribute("data-theme",t.theme);const s=await E(e);r.innerHTML=s,r.showModal();const a=r.querySelector(".nostr-base-dialog")||((o=r.shadowRoot)==null?void 0:o.querySelector(".nostr-base-dialog"))||document.body.querySelector(".nostr-base-dialog");if(!a)throw console.error("[openLikersDialog] Failed to find dialog element after showModal()"),new Error("Dialog element not found. The dialog may not have been created properly.");const n=a;return n&&e.length>0&&L(n,e),r}async function E(t){if(t.length===0)return`
      <div class="likers-dialog-content">
        <div class="likers-list">
          <div class="no-likes">No likes yet</div>
        </div>
      </div>
    `;const e=t.map(r=>f(r.authorPubkey));return`
    <div class="likers-dialog-content">
      <div class="likers-list">
        ${t.map((r,s)=>N(r,e[s],s)).join("")}
      </div>
    </div>
  `}async function L(t,e){const i=t.querySelector(".likers-list");if(!i)return;const r=[...new Set(e.map(s=>s.authorPubkey))];console.log("Nostr-Components: Likers dialog: Fetching profiles for",r.length,"unique authors");try{const s=await x(r),a=new Map;s.forEach(o=>{a.set(o.id,o.profile)});const n=new Map;r.forEach(o=>{n.set(o,f(o))});for(let o=0;o<e.length;o++){const l=e[o],c=a.get(l.authorPubkey),d=n.get(l.authorPubkey)||l.authorPubkey;let u;if(c){const h=k(c);u={...l,authorName:h.display_name||h.name||d,authorPicture:h.picture,authorNpub:d}}else u={...l,authorName:d,authorNpub:d};const p=i.querySelector(`[data-like-index="${o}"]`);if(p){const h=b(u,o);p.outerHTML=h}}console.log("Nostr-Components: Likers dialog: Progressive enhancement completed for",e.length,"like entries")}catch(s){console.error("Nostr-Components: Likers dialog: Error in batched profile enhancement",s),console.log("Nostr-Components: Likers dialog: Falling back to individual profile fetching"),await S(t,e)}}async function S(t,e){const i=t.querySelector(".likers-list");if(!i)return;const r=new Map,s=e.map(async(a,n)=>{if(r.has(a.authorPubkey)){const o=r.get(a.authorPubkey);return{index:n,enhanced:{...a,authorName:o.authorName,authorPicture:o.authorPicture,authorNpub:o.authorNpub}}}try{const{getProfileMetadata:o}=await y(async()=>{const{getProfileMetadata:p}=await import("./zap-utils-M-zkfAkW.js");return{getProfileMetadata:p}},__vite__mapDeps([0,1,2])),l=await o(a.authorPubkey),c=k(l),d=f(a.authorPubkey),u={...a,authorName:c.display_name||c.name||d,authorPicture:c.picture,authorNpub:d};return r.set(a.authorPubkey,u),{index:n,enhanced:u}}catch(o){console.error("Nostr-Components: Likers dialog: Error fetching profile for",a.authorPubkey,o);const l=f(a.authorPubkey),c={...a,authorName:l,authorNpub:l};return r.set(a.authorPubkey,c),{index:n,enhanced:c}}});for(const a of s)try{const{index:n,enhanced:o}=await a,l=i.querySelector(`[data-like-index="${n}"]`);if(l){const c=b(o,n);l.outerHTML=c}}catch(n){console.error("Nostr-Components: Likers dialog: Error processing profile enhancement",n)}}export{$ as injectLikersDialogStyles,z as openLikersDialog};
//# sourceMappingURL=dialog-likers-pxJY79Ic.js.map
