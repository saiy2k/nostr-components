const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/zap-utils-B1sz0Abx.js","assets/nostr-service-pr_crY62.js","assets/utils--bxLbhGF.js"])))=>i.map(i=>d[i]);
import{_ as y}from"./preload-helper-D7HrI6pR.js";import"./dialog-component-Dqg0QU9I.js";import{getBatchedProfileMetadata as x,extractProfileMetadataContent as k}from"./zap-utils-B1sz0Abx.js";import{h as f,e as g,f as b,c as v}from"./base-styles-BNQtJP9X.js";import{i as $}from"./utils--bxLbhGF.js";import"./nostr-service-pr_crY62.js";function w(t="light"){const e=t==="dark";return`
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
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .like-status {
      font-weight: 500;
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 4px;
    }

    .like-status.liked {
      color: ${e?"#4a9eff":"#1877f2"};
      background: ${e?"rgba(74, 158, 255, 0.1)":"rgba(24, 119, 242, 0.1)"};
    }

    .like-status.disliked {
      color: #d32f2f;
      background: rgba(211, 47, 47, 0.1);
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
  `}const P=(t="light")=>{document.querySelectorAll("style[data-likers-dialog-styles]").forEach(a=>a.remove());const r=document.createElement("style");r.setAttribute("data-likers-dialog-styles","true"),r.textContent=w(t),document.head.appendChild(r)};function m(t,e){const r=g(t.authorName||"Unknown liker"),n=`https://njump.me/${$(t.authorNpub||"")?t.authorNpub:""}`,i=v(t.authorPicture||"")&&t.authorPicture||"",s=t.authorPicture?`<img src="${i}" alt="${r}" class="like-author-picture" />`:'<div class="like-author-picture-default">👤</div>',o=t.content==="-",l=o?"Disliked":"Liked",c=o?"disliked":"liked";return`
    <div class="like-entry" data-like-index="${e}" data-author-pubkey="${t.authorPubkey}">
      <div class="like-author-info">
        ${s}
        <div class="like-author-details">
          <a href="${n}" target="_blank" rel="noopener noreferrer" class="like-author-link">
            ${r}
          </a>
          <div class="like-date">
            ${b(Math.floor(t.date.getTime()/1e3))}
            <span class="like-status ${c}">${l}</span>
          </div>
        </div>
      </div>
    </div>
  `}function N(t,e,r){const a=t.content==="-",n=a?"Disliked":"Liked",i=a?"disliked":"liked";return`
    <div class="like-entry skeleton-entry" data-like-index="${r}" data-author-pubkey="${t.authorPubkey}">
      <div class="like-author-info">
        <div class="skeleton-picture"></div>
        <div class="like-author-details">
          <div class="like-author-link skeleton-name">
            ${g(e)}
          </div>
          <div class="like-date">
            ${b(Math.floor(t.date.getTime()/1e3))}
            <span class="like-status ${i}">${n}</span>
          </div>
        </div>
      </div>
    </div>
  `}async function D(t){var o;const{likeDetails:e,theme:r="light"}=t;P(r),customElements.get("dialog-component")||await customElements.whenDefined("dialog-component");const a=document.createElement("dialog-component");a.setAttribute("header","Likers"),t.theme&&a.setAttribute("data-theme",t.theme);const n=await L(e);a.innerHTML=n,a.showModal();const i=a.querySelector(".nostr-base-dialog")||((o=a.shadowRoot)==null?void 0:o.querySelector(".nostr-base-dialog"))||document.body.querySelector(".nostr-base-dialog");if(!i)throw console.error("[openLikersDialog] Failed to find dialog element after showModal()"),new Error("Dialog element not found. The dialog may not have been created properly.");const s=i;return s&&e.length>0&&E(s,e),a}async function L(t){if(t.length===0)return`
      <div class="likers-dialog-content">
        <div class="likers-list">
          <div class="no-likes">No likes yet</div>
        </div>
      </div>
    `;const e=t.map(a=>f(a.authorPubkey));return`
    <div class="likers-dialog-content">
      <div class="likers-list">
        ${t.map((a,n)=>N(a,e[n],n)).join("")}
      </div>
    </div>
  `}async function E(t,e){const r=t.querySelector(".likers-list");if(!r)return;const a=[...new Set(e.map(n=>n.authorPubkey))];console.log("Nostr-Components: Likers dialog: Fetching profiles for",a.length,"unique authors");try{const n=await x(a),i=new Map;n.forEach(o=>{i.set(o.id,o.profile)});const s=new Map;a.forEach(o=>{s.set(o,f(o))});for(let o=0;o<e.length;o++){const l=e[o],c=i.get(l.authorPubkey),d=s.get(l.authorPubkey)||l.authorPubkey;let u;if(c){const h=k(c);u={...l,authorName:h.display_name||h.name||d,authorPicture:h.picture,authorNpub:d}}else u={...l,authorName:d,authorNpub:d};const p=r.querySelector(`[data-like-index="${o}"]`);if(p){const h=m(u,o);p.outerHTML=h}}console.log("Nostr-Components: Likers dialog: Progressive enhancement completed for",e.length,"like entries")}catch(n){console.error("Nostr-Components: Likers dialog: Error in batched profile enhancement",n),console.log("Nostr-Components: Likers dialog: Falling back to individual profile fetching"),await S(t,e)}}async function S(t,e){const r=t.querySelector(".likers-list");if(!r)return;const a=new Map,n=e.map(async(i,s)=>{if(a.has(i.authorPubkey)){const o=a.get(i.authorPubkey);return{index:s,enhanced:{...i,authorName:o.authorName,authorPicture:o.authorPicture,authorNpub:o.authorNpub}}}try{const{getProfileMetadata:o}=await y(async()=>{const{getProfileMetadata:p}=await import("./zap-utils-B1sz0Abx.js");return{getProfileMetadata:p}},__vite__mapDeps([0,1,2])),l=await o(i.authorPubkey),c=k(l),d=f(i.authorPubkey),u={...i,authorName:c.display_name||c.name||d,authorPicture:c.picture,authorNpub:d};return a.set(i.authorPubkey,u),{index:s,enhanced:u}}catch(o){console.error("Nostr-Components: Likers dialog: Error fetching profile for",i.authorPubkey,o);const l=f(i.authorPubkey),c={...i,authorName:l,authorNpub:l};return a.set(i.authorPubkey,c),{index:s,enhanced:c}}});for(const i of n)try{const{index:s,enhanced:o}=await i,l=r.querySelector(`[data-like-index="${s}"]`);if(l){const c=m(o,s);l.outerHTML=c}}catch(s){console.error("Nostr-Components: Likers dialog: Error processing profile enhancement",s)}}export{P as injectLikersDialogStyles,D as openLikersDialog};
//# sourceMappingURL=dialog-likers-DWLqZN4p.js.map
