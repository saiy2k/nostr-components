const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/zap-utils-W6R4npqU.js","assets/nostr-service-CP2wXEbP.js","assets/nostr-login-service-D2FmscPI.js","assets/preload-helper-D7HrI6pR.js","assets/utils--bxLbhGF.js"])))=>i.map(i=>d[i]);
var Jt=Object.defineProperty;var $t=(e,t,n)=>t in e?Jt(e,t,{enumerable:!0,configurable:!0,writable:!0,value:n}):e[t]=n;var Z=(e,t,n)=>$t(e,typeof t!="symbol"?t+"":t,n);import{N as Gt}from"../assets/nostr-user-component-BglMudsQ.js";import{h as Qt,g as St,j as G,e as X,k as kt,i as At,N}from"../assets/base-styles-Cn9HxXPz.js";import"../assets/dialog-component-Da1ZIYh9.js";import{getProfileMetadata as Wt,getZapEndpoint as Xt,fetchInvoice as te,listenForZapReceipt as ee,getBatchedProfileMetadata as ne,extractProfileMetadataContent as Nt,fetchTotalZapAmount as oe}from"../assets/zap-utils-W6R4npqU.js";import{_ as re}from"../assets/preload-helper-D7HrI6pR.js";import{i as ae}from"../assets/utils--bxLbhGF.js";import{e as ie}from"../assets/nostr-login-service-D2FmscPI.js";import"../assets/user-resolver-29rWDY2s.js";import"../assets/nostr-service-CP2wXEbP.js";const se=(e="light")=>{const t=e==="dark";return`
    /* === ZAP DIALOG CONTENT STYLES === */
    .zap-dialog-content {
      text-align: center;
      color: ${t?"#ffffff":"#000000"};
    }

    .zap-dialog-content p {
      margin: 4px 0;
      word-break: break-word;
    }

    /* === AMOUNT BUTTONS === */
    .zap-dialog-content .amount-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 16px 0 8px;
    }

    .zap-dialog-content .amount-buttons button {
      flex: 1 1 30%;
      min-width: 72px;
      padding: 8px 0;
      border: 1px solid ${t?"#3a3a3a":"#e2e8f0"};
      border-radius: 6px;
      background: ${t?"#262626":"#f7fafc"};
      cursor: pointer;
      font-size: 14px;
      color: ${t?"#ffffff":"#000000"};
    }

    .zap-dialog-content .amount-buttons button.active {
      background: #7f00ff;
      color: #ffffff;
    }

    /* === ACTION BUTTONS === */
    .zap-dialog-content .cta-btn {
      width: 100%;
      padding: 12px 0;
      border: none;
      border-radius: 6px;
      font-size: 16px;
      margin-top: 16px;
      cursor: pointer;
      background: #7f00ff;
      color: #ffffff;
    }

    .zap-dialog-content .copy-btn {
      margin-top: 12px;
      cursor: pointer;
      font-size: 14px;
      background: none;
      border: none;
      color: #7f00ff;
    }

    .zap-dialog-content .update-zap-btn {
      background: #7f00ff;
      color: #ffffff;
    }

    /* === QR CODE === */
    .zap-dialog-content img.qr {
      margin-top: 16px;
      border: 1px solid ${t?"#3a3a3a":"#e2e8f0"};
      border-radius: 8px;
    }

    /* === INPUT CONTAINERS === */
    .zap-dialog-content .update-zap-container {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-top: 8px;
    }

    .zap-dialog-content .update-zap-container .custom-amount {
      flex-grow: 1;
    }

    .zap-dialog-content .comment-container {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-top: 8px;
    }

    .zap-dialog-content .comment-container .comment-input {
      flex-grow: 1;
    }

    .zap-dialog-content input {
      background: ${t?"#262626":"#ffffff"};
      border: 1px solid ${t?"#3a3a3a":"#e2e8f0"};
      color: ${t?"#ffffff":"#000000"};
    }

    /* === LOADING OVERLAY === */
    .nostr-base-dialog .loading-overlay {
      position: absolute;
      inset: 0;
      background: ${t?"rgba(0, 0, 0, 0.7)":"rgba(255, 255, 255, 0.7)"};
      display: flex;
      justify-content: center;
      align-items: center;
      border-radius: 10px;
      opacity: 0;
      transition: opacity 0.2s ease;
      pointer-events: none;
    }

    .nostr-base-dialog.loading .loading-overlay {
      opacity: 1;
      pointer-events: auto;
    }

    .nostr-base-dialog .loading-overlay .loader {
      width: 40px;
      height: 40px;
      border: 4px solid ${t?"#3a3a3a":"#ccc"};
      border-top-color: #7f00ff;
      border-radius: 50%;
      animation: nstrc-spin 1s linear infinite;
    }

    /* === SUCCESS OVERLAY === */
    .nostr-base-dialog .success-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.65);
      display: flex;
      justify-content: center;
      align-items: center;
      color: #ffffff;
      font-size: 24px;
      border-radius: 10px;
      opacity: 0;
      transition: opacity 0.3s ease;
      pointer-events: none;
    }

    .nostr-base-dialog.success .success-overlay {
      opacity: 1;
      pointer-events: auto;
    }

    /* === ANIMATIONS === */
    @keyframes nstrc-spin {
      to {
        transform: rotate(360deg);
      }
    }
  `};var ce=function(){return typeof Promise=="function"&&Promise.prototype&&Promise.prototype.then},xt={},P={};let pt;const le=[0,26,44,70,100,134,172,196,242,292,346,404,466,532,581,655,733,815,901,991,1085,1156,1258,1364,1474,1588,1706,1828,1921,2051,2185,2323,2465,2611,2761,2876,3034,3196,3362,3532,3706];P.getSymbolSize=function(t){if(!t)throw new Error('"version" cannot be null or undefined');if(t<1||t>40)throw new Error('"version" should be in range from 1 to 40');return t*4+17};P.getSymbolTotalCodewords=function(t){return le[t]};P.getBCHDigit=function(e){let t=0;for(;e!==0;)t++,e>>>=1;return t};P.setToSJISFunction=function(t){if(typeof t!="function")throw new Error('"toSJISFunc" is not a valid function.');pt=t};P.isKanjiModeEnabled=function(){return typeof pt<"u"};P.toSJIS=function(t){return pt(t)};var tt={};(function(e){e.L={bit:1},e.M={bit:0},e.Q={bit:3},e.H={bit:2};function t(n){if(typeof n!="string")throw new Error("Param is not a string");switch(n.toLowerCase()){case"l":case"low":return e.L;case"m":case"medium":return e.M;case"q":case"quartile":return e.Q;case"h":case"high":return e.H;default:throw new Error("Unknown EC Level: "+n)}}e.isValid=function(o){return o&&typeof o.bit<"u"&&o.bit>=0&&o.bit<4},e.from=function(o,r){if(e.isValid(o))return o;try{return t(o)}catch{return r}}})(tt);function Tt(){this.buffer=[],this.length=0}Tt.prototype={get:function(e){const t=Math.floor(e/8);return(this.buffer[t]>>>7-e%8&1)===1},put:function(e,t){for(let n=0;n<t;n++)this.putBit((e>>>t-n-1&1)===1)},getLengthInBits:function(){return this.length},putBit:function(e){const t=Math.floor(this.length/8);this.buffer.length<=t&&this.buffer.push(0),e&&(this.buffer[t]|=128>>>this.length%8),this.length++}};var ue=Tt;function K(e){if(!e||e<1)throw new Error("BitMatrix size must be defined and greater than 0");this.size=e,this.data=new Uint8Array(e*e),this.reservedBit=new Uint8Array(e*e)}K.prototype.set=function(e,t,n,o){const r=e*this.size+t;this.data[r]=n,o&&(this.reservedBit[r]=!0)};K.prototype.get=function(e,t){return this.data[e*this.size+t]};K.prototype.xor=function(e,t,n){this.data[e*this.size+t]^=n};K.prototype.isReserved=function(e,t){return this.reservedBit[e*this.size+t]};var de=K,Bt={};(function(e){const t=P.getSymbolSize;e.getRowColCoords=function(o){if(o===1)return[];const r=Math.floor(o/7)+2,a=t(o),s=a===145?26:Math.ceil((a-13)/(2*r-2))*2,i=[a-7];for(let c=1;c<r-1;c++)i[c]=i[c-1]-s;return i.push(6),i.reverse()},e.getPositions=function(o){const r=[],a=e.getRowColCoords(o),s=a.length;for(let i=0;i<s;i++)for(let c=0;c<s;c++)i===0&&c===0||i===0&&c===s-1||i===s-1&&c===0||r.push([a[i],a[c]]);return r}})(Bt);var It={};const fe=P.getSymbolSize,Ct=7;It.getPositions=function(t){const n=fe(t);return[[0,0],[n-Ct,0],[0,n-Ct]]};var Pt={};(function(e){e.Patterns={PATTERN000:0,PATTERN001:1,PATTERN010:2,PATTERN011:3,PATTERN100:4,PATTERN101:5,PATTERN110:6,PATTERN111:7};const t={N1:3,N2:3,N3:40,N4:10};e.isValid=function(r){return r!=null&&r!==""&&!isNaN(r)&&r>=0&&r<=7},e.from=function(r){return e.isValid(r)?parseInt(r,10):void 0},e.getPenaltyN1=function(r){const a=r.size;let s=0,i=0,c=0,l=null,u=null;for(let y=0;y<a;y++){i=c=0,l=u=null;for(let p=0;p<a;p++){let d=r.get(y,p);d===l?i++:(i>=5&&(s+=t.N1+(i-5)),l=d,i=1),d=r.get(p,y),d===u?c++:(c>=5&&(s+=t.N1+(c-5)),u=d,c=1)}i>=5&&(s+=t.N1+(i-5)),c>=5&&(s+=t.N1+(c-5))}return s},e.getPenaltyN2=function(r){const a=r.size;let s=0;for(let i=0;i<a-1;i++)for(let c=0;c<a-1;c++){const l=r.get(i,c)+r.get(i,c+1)+r.get(i+1,c)+r.get(i+1,c+1);(l===4||l===0)&&s++}return s*t.N2},e.getPenaltyN3=function(r){const a=r.size;let s=0,i=0,c=0;for(let l=0;l<a;l++){i=c=0;for(let u=0;u<a;u++)i=i<<1&2047|r.get(l,u),u>=10&&(i===1488||i===93)&&s++,c=c<<1&2047|r.get(u,l),u>=10&&(c===1488||c===93)&&s++}return s*t.N3},e.getPenaltyN4=function(r){let a=0;const s=r.data.length;for(let c=0;c<s;c++)a+=r.data[c];return Math.abs(Math.ceil(a*100/s/5)-10)*t.N4};function n(o,r,a){switch(o){case e.Patterns.PATTERN000:return(r+a)%2===0;case e.Patterns.PATTERN001:return r%2===0;case e.Patterns.PATTERN010:return a%3===0;case e.Patterns.PATTERN011:return(r+a)%3===0;case e.Patterns.PATTERN100:return(Math.floor(r/2)+Math.floor(a/3))%2===0;case e.Patterns.PATTERN101:return r*a%2+r*a%3===0;case e.Patterns.PATTERN110:return(r*a%2+r*a%3)%2===0;case e.Patterns.PATTERN111:return(r*a%3+(r+a)%2)%2===0;default:throw new Error("bad maskPattern:"+o)}}e.applyMask=function(r,a){const s=a.size;for(let i=0;i<s;i++)for(let c=0;c<s;c++)a.isReserved(c,i)||a.xor(c,i,n(r,c,i))},e.getBestMask=function(r,a){const s=Object.keys(e.Patterns).length;let i=0,c=1/0;for(let l=0;l<s;l++){a(l),e.applyMask(l,r);const u=e.getPenaltyN1(r)+e.getPenaltyN2(r)+e.getPenaltyN3(r)+e.getPenaltyN4(r);e.applyMask(l,r),u<c&&(c=u,i=l)}return i}})(Pt);var et={};const U=tt,J=[1,1,1,1,1,1,1,1,1,1,2,2,1,2,2,4,1,2,4,4,2,4,4,4,2,4,6,5,2,4,6,6,2,5,8,8,4,5,8,8,4,5,8,11,4,8,10,11,4,9,12,16,4,9,16,16,6,10,12,18,6,10,17,16,6,11,16,19,6,13,18,21,7,14,21,25,8,16,20,25,8,17,23,25,9,17,23,34,9,18,25,30,10,20,27,32,12,21,29,35,12,23,34,37,12,25,34,40,13,26,35,42,14,28,38,45,15,29,40,48,16,31,43,51,17,33,45,54,18,35,48,57,19,37,51,60,19,38,53,63,20,40,56,66,21,43,59,70,22,45,62,74,24,47,65,77,25,49,68,81],$=[7,10,13,17,10,16,22,28,15,26,36,44,20,36,52,64,26,48,72,88,36,64,96,112,40,72,108,130,48,88,132,156,60,110,160,192,72,130,192,224,80,150,224,264,96,176,260,308,104,198,288,352,120,216,320,384,132,240,360,432,144,280,408,480,168,308,448,532,180,338,504,588,196,364,546,650,224,416,600,700,224,442,644,750,252,476,690,816,270,504,750,900,300,560,810,960,312,588,870,1050,336,644,952,1110,360,700,1020,1200,390,728,1050,1260,420,784,1140,1350,450,812,1200,1440,480,868,1290,1530,510,924,1350,1620,540,980,1440,1710,570,1036,1530,1800,570,1064,1590,1890,600,1120,1680,1980,630,1204,1770,2100,660,1260,1860,2220,720,1316,1950,2310,750,1372,2040,2430];et.getBlocksCount=function(t,n){switch(n){case U.L:return J[(t-1)*4+0];case U.M:return J[(t-1)*4+1];case U.Q:return J[(t-1)*4+2];case U.H:return J[(t-1)*4+3];default:return}};et.getTotalCodewordsCount=function(t,n){switch(n){case U.L:return $[(t-1)*4+0];case U.M:return $[(t-1)*4+1];case U.Q:return $[(t-1)*4+2];case U.H:return $[(t-1)*4+3];default:return}};var Lt={},nt={};const V=new Uint8Array(512),Q=new Uint8Array(256);(function(){let t=1;for(let n=0;n<255;n++)V[n]=t,Q[t]=n,t<<=1,t&256&&(t^=285);for(let n=255;n<512;n++)V[n]=V[n-255]})();nt.log=function(t){if(t<1)throw new Error("log("+t+")");return Q[t]};nt.exp=function(t){return V[t]};nt.mul=function(t,n){return t===0||n===0?0:V[Q[t]+Q[n]]};(function(e){const t=nt;e.mul=function(o,r){const a=new Uint8Array(o.length+r.length-1);for(let s=0;s<o.length;s++)for(let i=0;i<r.length;i++)a[s+i]^=t.mul(o[s],r[i]);return a},e.mod=function(o,r){let a=new Uint8Array(o);for(;a.length-r.length>=0;){const s=a[0];for(let c=0;c<r.length;c++)a[c]^=t.mul(r[c],s);let i=0;for(;i<a.length&&a[i]===0;)i++;a=a.slice(i)}return a},e.generateECPolynomial=function(o){let r=new Uint8Array([1]);for(let a=0;a<o;a++)r=e.mul(r,new Uint8Array([1,t.exp(a)]));return r}})(Lt);const Mt=Lt;function gt(e){this.genPoly=void 0,this.degree=e,this.degree&&this.initialize(this.degree)}gt.prototype.initialize=function(t){this.degree=t,this.genPoly=Mt.generateECPolynomial(this.degree)};gt.prototype.encode=function(t){if(!this.genPoly)throw new Error("Encoder not initialized");const n=new Uint8Array(t.length+this.degree);n.set(t);const o=Mt.mod(n,this.genPoly),r=this.degree-o.length;if(r>0){const a=new Uint8Array(this.degree);return a.set(o,r),a}return o};var pe=gt,Rt={},_={},ht={};ht.isValid=function(t){return!isNaN(t)&&t>=1&&t<=40};var L={};const Dt="[0-9]+",ge="[A-Z $%*+\\-./:]+";let j="(?:[u3000-u303F]|[u3040-u309F]|[u30A0-u30FF]|[uFF00-uFFEF]|[u4E00-u9FAF]|[u2605-u2606]|[u2190-u2195]|u203B|[u2010u2015u2018u2019u2025u2026u201Cu201Du2225u2260]|[u0391-u0451]|[u00A7u00A8u00B1u00B4u00D7u00F7])+";j=j.replace(/u/g,"\\u");const he="(?:(?![A-Z0-9 $%*+\\-./:]|"+j+`)(?:.|[\r
]))+`;L.KANJI=new RegExp(j,"g");L.BYTE_KANJI=new RegExp("[^A-Z0-9 $%*+\\-./:]+","g");L.BYTE=new RegExp(he,"g");L.NUMERIC=new RegExp(Dt,"g");L.ALPHANUMERIC=new RegExp(ge,"g");const me=new RegExp("^"+j+"$"),be=new RegExp("^"+Dt+"$"),ye=new RegExp("^[A-Z0-9 $%*+\\-./:]+$");L.testKanji=function(t){return me.test(t)};L.testNumeric=function(t){return be.test(t)};L.testAlphanumeric=function(t){return ye.test(t)};(function(e){const t=ht,n=L;e.NUMERIC={id:"Numeric",bit:1,ccBits:[10,12,14]},e.ALPHANUMERIC={id:"Alphanumeric",bit:2,ccBits:[9,11,13]},e.BYTE={id:"Byte",bit:4,ccBits:[8,16,16]},e.KANJI={id:"Kanji",bit:8,ccBits:[8,10,12]},e.MIXED={bit:-1},e.getCharCountIndicator=function(a,s){if(!a.ccBits)throw new Error("Invalid mode: "+a);if(!t.isValid(s))throw new Error("Invalid version: "+s);return s>=1&&s<10?a.ccBits[0]:s<27?a.ccBits[1]:a.ccBits[2]},e.getBestModeForData=function(a){return n.testNumeric(a)?e.NUMERIC:n.testAlphanumeric(a)?e.ALPHANUMERIC:n.testKanji(a)?e.KANJI:e.BYTE},e.toString=function(a){if(a&&a.id)return a.id;throw new Error("Invalid mode")},e.isValid=function(a){return a&&a.bit&&a.ccBits};function o(r){if(typeof r!="string")throw new Error("Param is not a string");switch(r.toLowerCase()){case"numeric":return e.NUMERIC;case"alphanumeric":return e.ALPHANUMERIC;case"kanji":return e.KANJI;case"byte":return e.BYTE;default:throw new Error("Unknown mode: "+r)}}e.from=function(a,s){if(e.isValid(a))return a;try{return o(a)}catch{return s}}})(_);(function(e){const t=P,n=et,o=tt,r=_,a=ht,s=7973,i=t.getBCHDigit(s);function c(p,d,m){for(let C=1;C<=40;C++)if(d<=e.getCapacity(C,m,p))return C}function l(p,d){return r.getCharCountIndicator(p,d)+4}function u(p,d){let m=0;return p.forEach(function(C){const A=l(C.mode,d);m+=A+C.getBitsLength()}),m}function y(p,d){for(let m=1;m<=40;m++)if(u(p,m)<=e.getCapacity(m,d,r.MIXED))return m}e.from=function(d,m){return a.isValid(d)?parseInt(d,10):m},e.getCapacity=function(d,m,C){if(!a.isValid(d))throw new Error("Invalid QR Code version");typeof C>"u"&&(C=r.BYTE);const A=t.getSymbolTotalCodewords(d),g=n.getTotalCodewordsCount(d,m),v=(A-g)*8;if(C===r.MIXED)return v;const f=v-l(C,d);switch(C){case r.NUMERIC:return Math.floor(f/10*3);case r.ALPHANUMERIC:return Math.floor(f/11*2);case r.KANJI:return Math.floor(f/13);case r.BYTE:default:return Math.floor(f/8)}},e.getBestVersionForData=function(d,m){let C;const A=o.from(m,o.M);if(Array.isArray(d)){if(d.length>1)return y(d,A);if(d.length===0)return 1;C=d[0]}else C=d;return c(C.mode,C.getLength(),A)},e.getEncodedBits=function(d){if(!a.isValid(d)||d<7)throw new Error("Invalid QR Code version");let m=d<<12;for(;t.getBCHDigit(m)-i>=0;)m^=s<<t.getBCHDigit(m)-i;return d<<12|m}})(Rt);var Ut={};const lt=P,_t=1335,we=21522,Et=lt.getBCHDigit(_t);Ut.getEncodedBits=function(t,n){const o=t.bit<<3|n;let r=o<<10;for(;lt.getBCHDigit(r)-Et>=0;)r^=_t<<lt.getBCHDigit(r)-Et;return(o<<10|r)^we};var Zt={};const ve=_;function F(e){this.mode=ve.NUMERIC,this.data=e.toString()}F.getBitsLength=function(t){return 10*Math.floor(t/3)+(t%3?t%3*3+1:0)};F.prototype.getLength=function(){return this.data.length};F.prototype.getBitsLength=function(){return F.getBitsLength(this.data.length)};F.prototype.write=function(t){let n,o,r;for(n=0;n+3<=this.data.length;n+=3)o=this.data.substr(n,3),r=parseInt(o,10),t.put(r,10);const a=this.data.length-n;a>0&&(o=this.data.substr(n),r=parseInt(o,10),t.put(r,a*3+1))};var Ce=F;const Ee=_,rt=["0","1","2","3","4","5","6","7","8","9","A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z"," ","$","%","*","+","-",".","/",":"];function q(e){this.mode=Ee.ALPHANUMERIC,this.data=e}q.getBitsLength=function(t){return 11*Math.floor(t/2)+6*(t%2)};q.prototype.getLength=function(){return this.data.length};q.prototype.getBitsLength=function(){return q.getBitsLength(this.data.length)};q.prototype.write=function(t){let n;for(n=0;n+2<=this.data.length;n+=2){let o=rt.indexOf(this.data[n])*45;o+=rt.indexOf(this.data[n+1]),t.put(o,11)}this.data.length%2&&t.put(rt.indexOf(this.data[n]),6)};var ze=q;const Se=_;function H(e){this.mode=Se.BYTE,typeof e=="string"?this.data=new TextEncoder().encode(e):this.data=new Uint8Array(e)}H.getBitsLength=function(t){return t*8};H.prototype.getLength=function(){return this.data.length};H.prototype.getBitsLength=function(){return H.getBitsLength(this.data.length)};H.prototype.write=function(e){for(let t=0,n=this.data.length;t<n;t++)e.put(this.data[t],8)};var ke=H;const Ae=_,Ne=P;function O(e){this.mode=Ae.KANJI,this.data=e}O.getBitsLength=function(t){return t*13};O.prototype.getLength=function(){return this.data.length};O.prototype.getBitsLength=function(){return O.getBitsLength(this.data.length)};O.prototype.write=function(e){let t;for(t=0;t<this.data.length;t++){let n=Ne.toSJIS(this.data[t]);if(n>=33088&&n<=40956)n-=33088;else if(n>=57408&&n<=60351)n-=49472;else throw new Error("Invalid SJIS character: "+this.data[t]+`
Make sure your charset is UTF-8`);n=(n>>>8&255)*192+(n&255),e.put(n,13)}};var xe=O,Ft={exports:{}};(function(e){var t={single_source_shortest_paths:function(n,o,r){var a={},s={};s[o]=0;var i=t.PriorityQueue.make();i.push(o,0);for(var c,l,u,y,p,d,m,C,A;!i.empty();){c=i.pop(),l=c.value,y=c.cost,p=n[l]||{};for(u in p)p.hasOwnProperty(u)&&(d=p[u],m=y+d,C=s[u],A=typeof s[u]>"u",(A||C>m)&&(s[u]=m,i.push(u,m),a[u]=l))}if(typeof r<"u"&&typeof s[r]>"u"){var g=["Could not find a path from ",o," to ",r,"."].join("");throw new Error(g)}return a},extract_shortest_path_from_predecessor_list:function(n,o){for(var r=[],a=o;a;)r.push(a),n[a],a=n[a];return r.reverse(),r},find_path:function(n,o,r){var a=t.single_source_shortest_paths(n,o,r);return t.extract_shortest_path_from_predecessor_list(a,r)},PriorityQueue:{make:function(n){var o=t.PriorityQueue,r={},a;n=n||{};for(a in o)o.hasOwnProperty(a)&&(r[a]=o[a]);return r.queue=[],r.sorter=n.sorter||o.default_sorter,r},default_sorter:function(n,o){return n.cost-o.cost},push:function(n,o){var r={value:n,cost:o};this.queue.push(r),this.queue.sort(this.sorter)},pop:function(){return this.queue.shift()},empty:function(){return this.queue.length===0}}};e.exports=t})(Ft);var Te=Ft.exports;(function(e){const t=_,n=Ce,o=ze,r=ke,a=xe,s=L,i=P,c=Te;function l(g){return unescape(encodeURIComponent(g)).length}function u(g,v,f){const h=[];let E;for(;(E=g.exec(f))!==null;)h.push({data:E[0],index:E.index,mode:v,length:E[0].length});return h}function y(g){const v=u(s.NUMERIC,t.NUMERIC,g),f=u(s.ALPHANUMERIC,t.ALPHANUMERIC,g);let h,E;return i.isKanjiModeEnabled()?(h=u(s.BYTE,t.BYTE,g),E=u(s.KANJI,t.KANJI,g)):(h=u(s.BYTE_KANJI,t.BYTE,g),E=[]),v.concat(f,h,E).sort(function(b,S){return b.index-S.index}).map(function(b){return{data:b.data,mode:b.mode,length:b.length}})}function p(g,v){switch(v){case t.NUMERIC:return n.getBitsLength(g);case t.ALPHANUMERIC:return o.getBitsLength(g);case t.KANJI:return a.getBitsLength(g);case t.BYTE:return r.getBitsLength(g)}}function d(g){return g.reduce(function(v,f){const h=v.length-1>=0?v[v.length-1]:null;return h&&h.mode===f.mode?(v[v.length-1].data+=f.data,v):(v.push(f),v)},[])}function m(g){const v=[];for(let f=0;f<g.length;f++){const h=g[f];switch(h.mode){case t.NUMERIC:v.push([h,{data:h.data,mode:t.ALPHANUMERIC,length:h.length},{data:h.data,mode:t.BYTE,length:h.length}]);break;case t.ALPHANUMERIC:v.push([h,{data:h.data,mode:t.BYTE,length:h.length}]);break;case t.KANJI:v.push([h,{data:h.data,mode:t.BYTE,length:l(h.data)}]);break;case t.BYTE:v.push([{data:h.data,mode:t.BYTE,length:l(h.data)}])}}return v}function C(g,v){const f={},h={start:{}};let E=["start"];for(let z=0;z<g.length;z++){const b=g[z],S=[];for(let T=0;T<b.length;T++){const I=b[T],R=""+z+T;S.push(R),f[R]={node:I,lastCount:0},h[R]={};for(let D=0;D<E.length;D++){const B=E[D];f[B]&&f[B].node.mode===I.mode?(h[B][R]=p(f[B].lastCount+I.length,I.mode)-p(f[B].lastCount,I.mode),f[B].lastCount+=I.length):(f[B]&&(f[B].lastCount=I.length),h[B][R]=p(I.length,I.mode)+4+t.getCharCountIndicator(I.mode,v))}}E=S}for(let z=0;z<E.length;z++)h[E[z]].end=0;return{map:h,table:f}}function A(g,v){let f;const h=t.getBestModeForData(g);if(f=t.from(v,h),f!==t.BYTE&&f.bit<h.bit)throw new Error('"'+g+'" cannot be encoded with mode '+t.toString(f)+`.
 Suggested mode is: `+t.toString(h));switch(f===t.KANJI&&!i.isKanjiModeEnabled()&&(f=t.BYTE),f){case t.NUMERIC:return new n(g);case t.ALPHANUMERIC:return new o(g);case t.KANJI:return new a(g);case t.BYTE:return new r(g)}}e.fromArray=function(v){return v.reduce(function(f,h){return typeof h=="string"?f.push(A(h,null)):h.data&&f.push(A(h.data,h.mode)),f},[])},e.fromString=function(v,f){const h=y(v,i.isKanjiModeEnabled()),E=m(h),z=C(E,f),b=c.find_path(z.map,"start","end"),S=[];for(let T=1;T<b.length-1;T++)S.push(z.table[b[T]].node);return e.fromArray(d(S))},e.rawSplit=function(v){return e.fromArray(y(v,i.isKanjiModeEnabled()))}})(Zt);const ot=P,at=tt,Be=ue,Ie=de,Pe=Bt,Le=It,ut=Pt,dt=et,Me=pe,W=Rt,Re=Ut,De=_,it=Zt;function Ue(e,t){const n=e.size,o=Le.getPositions(t);for(let r=0;r<o.length;r++){const a=o[r][0],s=o[r][1];for(let i=-1;i<=7;i++)if(!(a+i<=-1||n<=a+i))for(let c=-1;c<=7;c++)s+c<=-1||n<=s+c||(i>=0&&i<=6&&(c===0||c===6)||c>=0&&c<=6&&(i===0||i===6)||i>=2&&i<=4&&c>=2&&c<=4?e.set(a+i,s+c,!0,!0):e.set(a+i,s+c,!1,!0))}}function _e(e){const t=e.size;for(let n=8;n<t-8;n++){const o=n%2===0;e.set(n,6,o,!0),e.set(6,n,o,!0)}}function Ze(e,t){const n=Pe.getPositions(t);for(let o=0;o<n.length;o++){const r=n[o][0],a=n[o][1];for(let s=-2;s<=2;s++)for(let i=-2;i<=2;i++)s===-2||s===2||i===-2||i===2||s===0&&i===0?e.set(r+s,a+i,!0,!0):e.set(r+s,a+i,!1,!0)}}function Fe(e,t){const n=e.size,o=W.getEncodedBits(t);let r,a,s;for(let i=0;i<18;i++)r=Math.floor(i/3),a=i%3+n-8-3,s=(o>>i&1)===1,e.set(r,a,s,!0),e.set(a,r,s,!0)}function st(e,t,n){const o=e.size,r=Re.getEncodedBits(t,n);let a,s;for(a=0;a<15;a++)s=(r>>a&1)===1,a<6?e.set(a,8,s,!0):a<8?e.set(a+1,8,s,!0):e.set(o-15+a,8,s,!0),a<8?e.set(8,o-a-1,s,!0):a<9?e.set(8,15-a-1+1,s,!0):e.set(8,15-a-1,s,!0);e.set(o-8,8,1,!0)}function qe(e,t){const n=e.size;let o=-1,r=n-1,a=7,s=0;for(let i=n-1;i>0;i-=2)for(i===6&&i--;;){for(let c=0;c<2;c++)if(!e.isReserved(r,i-c)){let l=!1;s<t.length&&(l=(t[s]>>>a&1)===1),e.set(r,i-c,l),a--,a===-1&&(s++,a=7)}if(r+=o,r<0||n<=r){r-=o,o=-o;break}}}function He(e,t,n){const o=new Be;n.forEach(function(c){o.put(c.mode.bit,4),o.put(c.getLength(),De.getCharCountIndicator(c.mode,e)),c.write(o)});const r=ot.getSymbolTotalCodewords(e),a=dt.getTotalCodewordsCount(e,t),s=(r-a)*8;for(o.getLengthInBits()+4<=s&&o.put(0,4);o.getLengthInBits()%8!==0;)o.putBit(0);const i=(s-o.getLengthInBits())/8;for(let c=0;c<i;c++)o.put(c%2?17:236,8);return Oe(o,e,t)}function Oe(e,t,n){const o=ot.getSymbolTotalCodewords(t),r=dt.getTotalCodewordsCount(t,n),a=o-r,s=dt.getBlocksCount(t,n),i=o%s,c=s-i,l=Math.floor(o/s),u=Math.floor(a/s),y=u+1,p=l-u,d=new Me(p);let m=0;const C=new Array(s),A=new Array(s);let g=0;const v=new Uint8Array(e.buffer);for(let b=0;b<s;b++){const S=b<c?u:y;C[b]=v.slice(m,m+S),A[b]=d.encode(C[b]),m+=S,g=Math.max(g,S)}const f=new Uint8Array(o);let h=0,E,z;for(E=0;E<g;E++)for(z=0;z<s;z++)E<C[z].length&&(f[h++]=C[z][E]);for(E=0;E<p;E++)for(z=0;z<s;z++)f[h++]=A[z][E];return f}function Ve(e,t,n,o){let r;if(Array.isArray(e))r=it.fromArray(e);else if(typeof e=="string"){let l=t;if(!l){const u=it.rawSplit(e);l=W.getBestVersionForData(u,n)}r=it.fromString(e,l||40)}else throw new Error("Invalid data");const a=W.getBestVersionForData(r,n);if(!a)throw new Error("The amount of data is too big to be stored in a QR Code");if(!t)t=a;else if(t<a)throw new Error(`
The chosen QR Code version cannot contain this amount of data.
Minimum version required to store current data is: `+a+`.
`);const s=He(t,n,r),i=ot.getSymbolSize(t),c=new Ie(i);return Ue(c,t),_e(c),Ze(c,t),st(c,n,0),t>=7&&Fe(c,t),qe(c,s),isNaN(o)&&(o=ut.getBestMask(c,st.bind(null,c,n))),ut.applyMask(o,c),st(c,n,o),{modules:c,version:t,errorCorrectionLevel:n,maskPattern:o,segments:r}}xt.create=function(t,n){if(typeof t>"u"||t==="")throw new Error("No input text");let o=at.M,r,a;return typeof n<"u"&&(o=at.from(n.errorCorrectionLevel,at.M),r=W.from(n.version),a=ut.from(n.maskPattern),n.toSJISFunc&&ot.setToSJISFunction(n.toSJISFunc)),Ve(t,r,o,a)};var qt={},mt={};(function(e){function t(n){if(typeof n=="number"&&(n=n.toString()),typeof n!="string")throw new Error("Color should be defined as hex string");let o=n.slice().replace("#","").split("");if(o.length<3||o.length===5||o.length>8)throw new Error("Invalid hex color: "+n);(o.length===3||o.length===4)&&(o=Array.prototype.concat.apply([],o.map(function(a){return[a,a]}))),o.length===6&&o.push("F","F");const r=parseInt(o.join(""),16);return{r:r>>24&255,g:r>>16&255,b:r>>8&255,a:r&255,hex:"#"+o.slice(0,6).join("")}}e.getOptions=function(o){o||(o={}),o.color||(o.color={});const r=typeof o.margin>"u"||o.margin===null||o.margin<0?4:o.margin,a=o.width&&o.width>=21?o.width:void 0,s=o.scale||4;return{width:a,scale:a?4:s,margin:r,color:{dark:t(o.color.dark||"#000000ff"),light:t(o.color.light||"#ffffffff")},type:o.type,rendererOpts:o.rendererOpts||{}}},e.getScale=function(o,r){return r.width&&r.width>=o+r.margin*2?r.width/(o+r.margin*2):r.scale},e.getImageWidth=function(o,r){const a=e.getScale(o,r);return Math.floor((o+r.margin*2)*a)},e.qrToImageData=function(o,r,a){const s=r.modules.size,i=r.modules.data,c=e.getScale(s,a),l=Math.floor((s+a.margin*2)*c),u=a.margin*c,y=[a.color.light,a.color.dark];for(let p=0;p<l;p++)for(let d=0;d<l;d++){let m=(p*l+d)*4,C=a.color.light;if(p>=u&&d>=u&&p<l-u&&d<l-u){const A=Math.floor((p-u)/c),g=Math.floor((d-u)/c);C=y[i[A*s+g]?1:0]}o[m++]=C.r,o[m++]=C.g,o[m++]=C.b,o[m]=C.a}}})(mt);(function(e){const t=mt;function n(r,a,s){r.clearRect(0,0,a.width,a.height),a.style||(a.style={}),a.height=s,a.width=s,a.style.height=s+"px",a.style.width=s+"px"}function o(){try{return document.createElement("canvas")}catch{throw new Error("You need to specify a canvas element")}}e.render=function(a,s,i){let c=i,l=s;typeof c>"u"&&(!s||!s.getContext)&&(c=s,s=void 0),s||(l=o()),c=t.getOptions(c);const u=t.getImageWidth(a.modules.size,c),y=l.getContext("2d"),p=y.createImageData(u,u);return t.qrToImageData(p.data,a,c),n(y,l,u),y.putImageData(p,0,0),l},e.renderToDataURL=function(a,s,i){let c=i;typeof c>"u"&&(!s||!s.getContext)&&(c=s,s=void 0),c||(c={});const l=e.render(a,s,c),u=c.type||"image/png",y=c.rendererOpts||{};return l.toDataURL(u,y.quality)}})(qt);var Ht={};const je=mt;function zt(e,t){const n=e.a/255,o=t+'="'+e.hex+'"';return n<1?o+" "+t+'-opacity="'+n.toFixed(2).slice(1)+'"':o}function ct(e,t,n){let o=e+t;return typeof n<"u"&&(o+=" "+n),o}function Ke(e,t,n){let o="",r=0,a=!1,s=0;for(let i=0;i<e.length;i++){const c=Math.floor(i%t),l=Math.floor(i/t);!c&&!a&&(a=!0),e[i]?(s++,i>0&&c>0&&e[i-1]||(o+=a?ct("M",c+n,.5+l+n):ct("m",r,0),r=0,a=!1),c+1<t&&e[i+1]||(o+=ct("h",s),s=0)):r++}return o}Ht.render=function(t,n,o){const r=je.getOptions(n),a=t.modules.size,s=t.modules.data,i=a+r.margin*2,c=r.color.light.a?"<path "+zt(r.color.light,"fill")+' d="M0 0h'+i+"v"+i+'H0z"/>':"",l="<path "+zt(r.color.dark,"stroke")+' d="'+Ke(s,a,r.margin)+'"/>',u='viewBox="0 0 '+i+" "+i+'"',p='<svg xmlns="http://www.w3.org/2000/svg" '+(r.width?'width="'+r.width+'" height="'+r.width+'" ':"")+u+' shape-rendering="crispEdges">'+c+l+`</svg>
`;return typeof o=="function"&&o(null,p),p};const Ye=ce,ft=xt,Ot=qt,Je=Ht;function bt(e,t,n,o,r){const a=[].slice.call(arguments,1),s=a.length,i=typeof a[s-1]=="function";if(!i&&!Ye())throw new Error("Callback required as last argument");if(i){if(s<2)throw new Error("Too few arguments provided");s===2?(r=n,n=t,t=o=void 0):s===3&&(t.getContext&&typeof r>"u"?(r=o,o=void 0):(r=o,o=n,n=t,t=void 0))}else{if(s<1)throw new Error("Too few arguments provided");return s===1?(n=t,t=o=void 0):s===2&&!t.getContext&&(o=n,n=t,t=void 0),new Promise(function(c,l){try{const u=ft.create(n,o);c(e(u,t,o))}catch(u){l(u)}})}try{const c=ft.create(n,o);r(null,e(c,t,o))}catch(c){r(c)}}ft.create;bt.bind(null,Ot.render);var $e=bt.bind(null,Ot.renderToDataURL);bt.bind(null,function(e,t,n){return Je.render(e,n)});const Ge=(e="light")=>{document.querySelectorAll("style[data-zap-dialog-styles]").forEach(o=>o.remove());const n=document.createElement("style");n.setAttribute("data-zap-dialog-styles","true"),n.textContent=se(e),document.head.appendChild(n)};async function Qe(e){var wt;const{npub:t,relays:n,cachedDialogComponent:o,buttonColor:r,fixedAmount:a,defaultAmount:s,initialAmount:i,url:c}=e,l=Qt(t);if(customElements.get("dialog-component")||await customElements.whenDefined("dialog-component"),o){const w=document.querySelector(".nostr-base-dialog");if(w){w.classList.remove("success"),w.querySelectorAll(".amount-buttons, .update-zap-container, .comment-container, .cta-btn, .copy-btn").forEach(Y=>{Y instanceof HTMLElement&&(Y.style.display="")});const k=w.querySelector(".update-zap-btn");k&&(k.style.display="");const M=w.querySelector(".success-overlay");return M&&(M.style.opacity="0",M.style.pointerEvents="none"),v(w),o.showModal(),o}}const u=[21,100,1e3];let y;typeof a=="number"&&a>0?y=a:typeof s=="number"&&s>0?y=s:typeof i=="number"&&i>0?y=i:y=u[0];let p="",d="",m=null;async function C(w,x){const k=l,M=await Wt(k),Y=await Xt(M),vt=await te({zapEndpoint:Y,amount:w*1e3,comment:x,authorId:k,nip19Target:void 0,normalizedRelays:n.split(","),anon:e.anon,url:c});d=vt;const Yt=n.split(",");m&&m(),m=ee({relays:Yt,receiversPubKey:l,invoice:vt,onSuccess:yt})}async function A(w){try{return await $e(w,{width:240,margin:1,color:{dark:"#000000",light:"#ffffff"}})}catch(x){return console.error("Failed to generate QR code:",x),`data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 100 100">
        <rect width="100%" height="100%" fill="white"/>
        <text x="50%" y="50%" font-family="monospace" font-size="10" text-anchor="middle" dominant-baseline="middle" fill="black">
          Invoice: ${w.substring(0,10)}...
        </text>
      </svg>`}}function g(w,x){w.querySelectorAll("button").forEach(k=>{k.dataset.val===String(x)?k.classList.add("active"):k.classList.remove("active")})}async function v(w){w.classList.add("loading");try{await C(y,p);const x=w.querySelector("img.qr");A(d).then(M=>{x.src=M});const k=w.querySelector(".cta-btn");k.disabled=!1}finally{w.classList.remove("loading")}}Ge(e.theme||"light");const f=document.createElement("dialog-component");f.setAttribute("header","Send a Zap"),e.theme&&f.setAttribute("data-theme",e.theme);const h=u.map(w=>`<button type="button" data-val="${w}">${w} ⚡</button>`).join(""),E=typeof a=="number"&&a>0;f.innerHTML=`
      <div class="zap-dialog-content">
        ${E?"":`<div class="amount-buttons">${h}</div>`}
        ${E?`<p class="zapping-amount">Zapping ${a} sats</p>`:""}
        ${E?"":`<div class="update-zap-container">
          <input type="number" min="1" placeholder="Custom sats" class="custom-amount" style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:6px" />
          <button type="button" class="update-zap-btn" style="padding:8px 12px;border:none;border-radius:6px;background:#7f00ff;color:#fff">Update Zap</button>
        </div>`}
        ${E?"":`<div class="comment-container">
          <input type="text" placeholder="Comment (optional)" class="comment-input" style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:6px" />
          <button type="button" class="add-comment-btn" style="padding:8px 12px;border:none;border-radius:6px;background:#7f00ff;color:#fff">Add</button>
        </div>`}
        <img class="qr" width="240" height="240" alt="QR" style="cursor:pointer" />
        <br />
        <button type="button" class="copy-btn">Copy invoice</button>
        <button type="button" class="cta-btn" disabled>Open in wallet</button>
        <div class="loading-overlay"><div class="loader"></div></div>
        <div class="success-overlay">⚡ Thank you!</div>
      </div>
  `,f.showModal();const z=f.querySelector(".nostr-base-dialog")||((wt=f.shadowRoot)==null?void 0:wt.querySelector(".nostr-base-dialog"))||document.body.querySelector(".nostr-base-dialog");if(!z)throw console.error("[showZapDialog] Failed to find dialog element after showModal()"),new Error("Dialog element not found. The dialog may not have been created properly.");const b=z,S=b.querySelector(".amount-buttons");S&&S.addEventListener("click",async w=>{const x=w.target;if(x.tagName==="BUTTON"){const k=Number(x.dataset.val);if(!isNaN(k)){y=k,g(S,k);const M=b.querySelector(".cta-btn");M.disabled=!0,await v(b)}}});const T=b.querySelector(".custom-amount");T&&T.addEventListener("input",async w=>{const x=Number(w.target.value);if(x>0){y=x,S&&g(S,-1);const k=b.querySelector(".cta-btn");k.disabled=!0}});const I=b.querySelector(".comment-input");I&&I.addEventListener("input",w=>{p=w.target.value.slice(0,200)});const R=async()=>{d&&(await navigator.clipboard.writeText(d),b.querySelector(".copy-btn").textContent="Copied!",setTimeout(()=>{b.querySelector(".copy-btn").textContent="Copy invoice"},1500))};b.querySelector(".copy-btn").onclick=R,b.querySelector("img.qr").onclick=R;const D=b.querySelector(".update-zap-btn");D&&D.addEventListener("click",async()=>{const w=Number(T==null?void 0:T.value);!isNaN(w)&&w>0&&(y=w,D.disabled=!0,await v(b),D.disabled=!1)});const B=b.querySelector(".add-comment-btn");B&&B.addEventListener("click",async()=>{B.disabled=!0,await v(b),B.disabled=!1}),b.querySelector(".cta-btn").onclick=async()=>{if(d){if(window.webln)try{await window.webln.enable(),await window.webln.sendPayment(d),yt();return}catch(w){console.error("Nostr-Components: Zap button: webln payment failed",w),b.close()}window.location.href=`lightning:${d}`}};function yt(){b.classList.add("success");const w=b.querySelector(".success-overlay");w.style.opacity="1",w.style.pointerEvents="none",b.querySelectorAll(".amount-buttons, .update-zap-container, .comment-container, .cta-btn, .copy-btn").forEach(k=>{k instanceof HTMLElement&&(k.style.display="none")})}if(b.addEventListener("close",()=>{m&&m()}),r){const w=r;b.querySelector(".cta-btn").style.background=w,b.querySelector(".cta-btn").style.color=We(w)}if(await v(b),S&&u.includes(y))g(S,y);else if(!E){const w=b.querySelector(".custom-amount");w&&(w.value=String(y)),S&&g(S,-1)}return f}function We(e){e=e.replace("#",""),e.length===3&&(e=e.split("").map(a=>a+a).join(""));const t=parseInt(e.slice(0,2),16),n=parseInt(e.slice(2,4),16),o=parseInt(e.slice(4,6),16);return(t*299+n*587+o*114)/1e3>125?"#000":"#fff"}const Xe=()=>`
    /* Help Dialog Content Styles */
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

    .help-content a:not(.youtube-link) {
      color: var(--nostrc-theme-primary, #0066cc);
      text-decoration: underline;
    }

    .help-content a:not(.youtube-link):hover {
      color: var(--nostrc-theme-primary-hover, #0052a3);
    }

    .youtube-link {
      display: inline-block;
      background: var(--nostrc-color-primary, #7f00ff);
      color: var(--nostrc-color-text-on-primary, #ffffff);
      padding: var(--nostrc-spacing-sm, 8px) var(--nostrc-spacing-md, 12px);
      border-radius: var(--nostrc-border-radius-md, 6px);
      text-decoration: none;
      font-weight: var(--nostrc-font-weight-medium, 500);
      margin-top: var(--nostrc-spacing-md, 12px);
      transition: background-color 0.2s ease;
    }

    .youtube-link:hover {
      background: var(--nostrc-color-primary-hover, #6b00d9);
    }
  `,tn="https://www.youtube.com/shorts/PDnrh8pkF3g",en=()=>{if(document.querySelector("style[data-help-dialog-styles]"))return;const e=document.createElement("style");e.setAttribute("data-help-dialog-styles","true"),e.textContent=Xe(),document.head.appendChild(e)},nn=async e=>{en(),customElements.get("dialog-component")||await customElements.whenDefined("dialog-component");const t=document.createElement("dialog-component");t.setAttribute("header","What is a Zap?"),t.setAttribute("data-theme",e),t.innerHTML=`
    <div class="help-content">
      <p>Send instant tips to support content creators! Zaps are small Bitcoin Lightning payments that go directly to creators—no middleman.</p>
      <ul>
        <li>Send any amount instantly</li>
        <li>Money goes straight to the creator</li>
        <li>Powered by Bitcoin Lightning Network</li>
      </ul>
      <p><strong>How it works:</strong> Click zap, choose amount, scan QR code with a Lightning wallet, done!</p>
      <a href="${tn}" target="_blank" rel="noopener noreferrer" class="youtube-link">
        Watch Tutorial
      </a>
    </div>
  `,t.showModal()};function on(e="light"){const t=e==="dark";return St(`
    /* === ZAPPERS DIALOG CONTENT STYLES === */
    .zappers-dialog-content {
      overflow: hidden;
    }

    .zappers-list {
      max-height: 60vh;
      overflow-y: auto;
    }

    /* Individual zap entry */
    .zap-entry {
      padding: var(--nostrc-spacing-md, 16px);
      border-bottom: 1px solid ${t?"#333333":"#f3f4f6"};
      transition: background-color 0.2s ease;
    }

    .zap-entry:last-child {
      border-bottom: none;
    }

    .zap-entry:hover {
      background: ${t?"#2a2a2a":"#f9fafb"};
    }

    .zap-author-info {
      display: flex;
      align-items: center;
      gap: var(--nostrc-spacing-md, 16px);
    }

    .zap-author-picture {
      width: 40px;
      height: 40px;
      border-radius: var(--nostrc-border-radius-full, 50%);
      object-fit: cover;
      border: 2px solid ${t?"#374151":"#e5e7eb"};
    }

    .zap-author-picture-default {
      width: 40px;
      height: 40px;
      border-radius: var(--nostrc-border-radius-full, 50%);
      background: ${t?"#374151":"#f3f4f6"};
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: var(--nostrc-font-size-lg, 18px);
      color: ${t?"#9ca3af":"#6b7280"};
      border: 2px solid ${t?"#4b5563":"#d1d5db"};
    }

    .zap-author-details {
      flex: 1;
      min-width: 0;
    }

    .zap-author-link {
      display: block;
      font-weight: 500;
      color: ${t?"#ffffff":"#1a1a1a"};
      text-decoration: none;
      font-size: var(--nostrc-font-size-base, 16px);
      margin-bottom: var(--nostrc-spacing-xs, 4px);
      transition: color 0.2s ease;
    }

    .zap-author-link:hover {
      color: var(--nostrc-color-primary, #7f00ff);
    }

    .zap-comment {
      font-size: var(--nostrc-font-size-sm, 14px);
      color: ${t?"#d1d5db":"#4b5563"};
      margin: var(--nostrc-spacing-xs, 4px) 0;
      line-height: 1.4;
      word-wrap: break-word;
      white-space: pre-wrap;
    }

    .zap-amount-date {
      font-size: var(--nostrc-font-size-sm, 14px);
      color: ${t?"#9ca3af":"#6b7280"};
      display: flex;
      align-items: center;
      gap: var(--nostrc-spacing-xs, 4px);
    }

    /* Loading skeleton with npub */
    .skeleton-entry {
      display: flex;
      align-items: center;
      gap: var(--nostrc-spacing-md, 16px);
      padding: var(--nostrc-spacing-md, 16px);
      border-bottom: 1px solid ${t?"#333333":"#f3f4f6"};
    }

    .skeleton-entry:last-child {
      border-bottom: none;
    }

    .skeleton-picture {
      width: 40px;
      height: 40px;
      border-radius: var(--nostrc-border-radius-full, 50%);
      background: linear-gradient(90deg, 
        ${t?"#374151":"#f0f0f0"} 25%, 
        ${t?"#4b5563":"#e0e0e0"} 50%, 
        ${t?"#374151":"#f0f0f0"} 75%
      );
      background-size: 200% 100%;
      animation: skeleton-loading 1.5s infinite;
    }

    .skeleton-name {
      font-size: var(--nostrc-font-size-base, 16px);
      font-weight: 500;
      color: ${t?"#9ca3af":"#6b7280"};
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
      word-break: break-all;
      line-height: 1.2;
    }

    @keyframes skeleton-loading {
      0% {
        background-position: 200% 0;
      }
      100% {
        background-position: -200% 0;
      }
    }

    /* Empty state */
    .no-zaps {
      text-align: center;
      padding: var(--nostrc-spacing-xl, 32px);
      color: ${t?"#9ca3af":"#6b7280"};
      font-size: var(--nostrc-font-size-base, 16px);
    }

    /* Responsive design */
    @media (max-width: 640px) {
      .zap-author-picture,
      .zap-author-picture-default,
      .skeleton-picture {
        width: 36px;
        height: 36px;
      }
      
      .zap-author-link {
        font-size: var(--nostrc-font-size-sm, 14px);
      }
      
      .zap-amount-date {
        font-size: var(--nostrc-font-size-xs, 12px);
      }
    }

    /* Scrollbar styling */
    .zappers-list::-webkit-scrollbar {
      width: 6px;
    }

    .zappers-list::-webkit-scrollbar-track {
      background: ${t?"#2a2a2a":"#f1f5f9"};
      border-radius: 3px;
    }

    .zappers-list::-webkit-scrollbar-thumb {
      background: ${t?"#4b5563":"#cbd5e1"};
      border-radius: 3px;
    }

    .zappers-list::-webkit-scrollbar-thumb:hover {
      background: ${t?"#6b7280":"#94a3b8"};
    }
  `)}const rn=(e="light")=>{document.querySelectorAll("style[data-zappers-dialog-styles]").forEach(o=>o.remove());const n=document.createElement("style");n.setAttribute("data-zappers-dialog-styles","true"),n.textContent=on(e),document.head.appendChild(n)};function Vt(e,t){const n=X(e.authorName||"Unknown zapper"),r=`https://njump.me/${ae(e.authorNpub||"")?e.authorNpub:""}`,a=At(e.authorPicture||"")&&e.authorPicture||"",s=e.authorPicture?`<img src="${a}" alt="${n}" class="zap-author-picture" />`:'<div class="zap-author-picture-default">👤</div>',i=e.comment?`<div class="zap-comment">${e.comment}</div>`:"";return`
    <div class="zap-entry" data-zap-index="${t}" data-author-pubkey="${e.authorPubkey}">
      <div class="zap-author-info">
        ${s}
        <div class="zap-author-details">
          <a href="${r}" target="_blank" rel="noopener noreferrer" class="zap-author-link">
            ${n}
          </a>
          ${i}
          <div class="zap-amount-date">
            ${e.amount.toLocaleString()} ⚡ • ${kt(Math.floor(e.date.getTime()/1e3))}
          </div>
        </div>
      </div>
    </div>
  `}function an(e,t,n){return`
    <div class="zap-entry skeleton-entry" data-zap-index="${n}" data-author-pubkey="${e.authorPubkey}">
      <div class="zap-author-info">
        <div class="skeleton-picture"></div>
        <div class="zap-author-details">
          <div class="zap-author-link skeleton-name">
            ${X(t)}
          </div>
          <div class="zap-amount-date">
            ${e.amount.toLocaleString()} ⚡ • ${kt(Math.floor(e.date.getTime()/1e3))}
          </div>
        </div>
      </div>
    </div>
  `}async function sn(e){var i;const{zapDetails:t,theme:n="light"}=e;rn(n),customElements.get("dialog-component")||await customElements.whenDefined("dialog-component");const o=document.createElement("dialog-component");o.setAttribute("header","Zappers"),e.theme&&o.setAttribute("data-theme",e.theme);const r=await cn(t);o.innerHTML=r,o.showModal();const a=o.querySelector(".nostr-base-dialog")||((i=o.shadowRoot)==null?void 0:i.querySelector(".nostr-base-dialog"))||document.body.querySelector(".nostr-base-dialog");if(!a)throw console.error("[showZappersDialog] Failed to find dialog element after showModal()"),new Error("Dialog element not found. The dialog may not have been created properly.");const s=a;return s&&t.length>0&&ln(s,t),o}async function cn(e){if(e.length===0)return`
      <div class="zappers-dialog-content">
        <div class="zappers-list">
          <div class="no-zaps">No zaps received yet</div>
        </div>
      </div>
    `;const t=e.map(o=>G(o.authorPubkey));return`
    <div class="zappers-dialog-content">
      <div class="zappers-list">
        ${e.map((o,r)=>an(o,t[r],r)).join("")}
      </div>
    </div>
  `}async function ln(e,t){const n=e.querySelector(".zappers-list");if(!n)return;const o=[...new Set(t.map(r=>r.authorPubkey))];console.log("Nostr-Components: Zappers dialog: Fetching profiles for",o.length,"unique authors");try{const r=await ne(o),a=new Map;r.forEach(i=>{a.set(i.id,i.profile)});const s=new Map;o.forEach(i=>{s.set(i,G(i))});for(let i=0;i<t.length;i++){const c=t[i],l=a.get(c.authorPubkey),u=s.get(c.authorPubkey)||c.authorPubkey;let y;if(l){const d=Nt(l);y={...c,authorName:d.display_name||d.name||u,authorPicture:d.picture,authorNpub:u}}else y={...c,authorName:u,authorNpub:u};const p=n.querySelector(`[data-zap-index="${i}"]`);if(p){const d=Vt(y,i);p.outerHTML=d}}console.log("Nostr-Components: Zappers dialog: Progressive enhancement completed for",t.length,"zap entries")}catch(r){console.error("Nostr-Components: Zappers dialog: Error in batched profile enhancement",r),console.log("Nostr-Components: Zappers dialog: Falling back to individual profile fetching"),await un(e,t)}}async function un(e,t){const n=e.querySelector(".zappers-list");if(!n)return;const o=new Map,r=t.map(async(a,s)=>{if(o.has(a.authorPubkey)){const i=o.get(a.authorPubkey);return{index:s,enhanced:{...a,authorName:i.authorName,authorPicture:i.authorPicture,authorNpub:i.authorNpub}}}try{const{getProfileMetadata:i}=await re(async()=>{const{getProfileMetadata:p}=await import("../assets/zap-utils-W6R4npqU.js");return{getProfileMetadata:p}},__vite__mapDeps([0,1,2,3,4])),c=await i(a.authorPubkey),l=Nt(c),u=G(a.authorPubkey),y={...a,authorName:l.display_name||l.name||u,authorPicture:l.picture,authorNpub:u};return o.set(a.authorPubkey,y),{index:s,enhanced:y}}catch(i){console.error("Nostr-Components: Zappers dialog: Error fetching profile for",a.authorPubkey,i);const c=G(a.authorPubkey),l={...a,authorName:c,authorNpub:c};return o.set(a.authorPubkey,l),{index:s,enhanced:l}}});for(const a of r)try{const{index:s,enhanced:i}=await a,c=n.querySelector(`[data-zap-index="${s}"]`);if(c){const l=Vt(i,s);c.outerHTML=l}}catch(s){console.error("Nostr-Components: Zappers dialog: Error processing profile enhancement",s)}}function dn({isLoading:e,isError:t,isSuccess:n,errorMessage:o,buttonText:r,totalZapAmount:a,isAmountLoading:s,hasZaps:i=!1}){if(t)return pn(o||"");if(e)return fn(s);const c=Kt(),l=`<span>${X(r)}</span>`;return jt(c,l,a,s,i)}function fn(e){return jt(Kt(),'<span class="button-text-skeleton"></span>',null,e)}function pn(e){return gn('<div class="error-icon">&#9888;</div>',X(e))}function gn(e,t){return`
    <div class="nostr-zap-button-container">
      <div class="nostr-zap-button-left-container">
        ${e}
      </div>
      <div class="nostr-zap-button-right-container">
        ${t}
      </div>
    </div>
  `}function jt(e,t,n,o,r=!1){const a=o?'<span class="total-zap-amount skeleton"></span>':n!==null?`<span class="total-zap-amount${r?" clickable":""}">${n.toLocaleString()} ⚡ sats received</span>`:"";return`
    <div class="nostr-zap-button-container">
      <button class="nostr-zap-button">
        ${e}
        ${t}
      </button>
      ${a} <button class="help-icon" title="What is a zap?">?</button>
    </div>
  `}function Kt(){return'<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M13 2L3 14h7v8l10-12h-7z" fill="#FFC800"/></svg>'}function hn(){return St(`
    /* === ZAP BUTTON CONTAINER PATTERN === */
    :host {
      /* Icon sizing (overridable via CSS variables) */
      --nostrc-icon-height: 25px;
      --nostrc-icon-width: 25px;

      /* Zap button CSS variables (overridable by parent components) */
      --nostrc-zap-btn-padding: var(--nostrc-spacing-sm) var(--nostrc-spacing-md);
      --nostrc-zap-btn-border-radius: var(--nostrc-border-radius-md);
      --nostrc-zap-btn-border: var(--nostrc-border-width) solid var(--nostrc-color-border);
      --nostrc-zap-btn-min-height: 47px;
      --nostrc-zap-btn-width: auto;
      --nostrc-zap-btn-horizontal-alignment: left;
      --nostrc-zap-btn-bg: var(--nostrc-theme-bg, #ffffff);
      --nostrc-zap-btn-color: var(--nostrc-theme-text-primary, #333333);
      --nostrc-zap-btn-font-family: var(--nostrc-font-family-primary);
      --nostrc-zap-btn-font-size: var(--nostrc-font-size-base);
      
      /* Hover state variables */
      --nostrc-zap-btn-hover-bg: var(--nostrc-theme-hover-bg, rgba(0, 0, 0, 0.05));
      --nostrc-zap-btn-hover-color: var(--nostrc-theme-text-primary, #333333);
      --nostrc-zap-btn-hover-border: var(--nostrc-border-width) solid var(--nostrc-theme-border, var(--nostrc-color-border));

      /* Make the host a flex container for button + amount */
      display: inline-flex;
      flex-direction: row;
      align-items: center;
      gap: var(--nostrc-spacing-md);
      font-family: var(--nostrc-zap-btn-font-family);
      font-size: var(--nostrc-zap-btn-font-size);
    }

    /* Focus state for accessibility */
    :host(:focus-visible) {
      outline: 2px solid var(--nostrc-color-primary, #007bff);
      outline-offset: 2px;
    }

    :host(.is-error) .nostr-zap-button-container {
      border: var(--nostrc-border-width) solid var(--nostrc-color-error-text);
      border-radius: var(--nostrc-border-radius-md);
      padding: var(--nostrc-spacing-sm);
      color: var(--nostrc-color-error-text);
    }

    .nostr-zap-button-container {
      display: flex;
      align-items: center;
      gap: var(--nostrc-spacing-md);
      width: fit-content;
    }

    .nostr-zap-button-left-container {
      display: flex;
      align-items: center;
    }

    .nostr-zap-button-right-container {
      display: flex;
      align-items: center;
    }

    .nostr-zap-button {
      display: flex;
      align-items: center;
      justify-content: var(--nostrc-zap-btn-horizontal-alignment);
      gap: var(--nostrc-spacing-sm);
      background: var(--nostrc-zap-btn-bg);
      color: var(--nostrc-zap-btn-color);
      border: var(--nostrc-zap-btn-border);
      border-radius: var(--nostrc-zap-btn-border-radius);
      padding: var(--nostrc-zap-btn-padding);
      min-height: var(--nostrc-zap-btn-min-height);
      width: var(--nostrc-zap-btn-width);
      cursor: pointer;
      transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
      font-family: inherit;
      font-size: inherit;
    }

    /* Hover state on the button */
    .nostr-zap-button:hover {
      background: var(--nostrc-zap-btn-hover-bg);
      color: var(--nostrc-zap-btn-hover-color);
      border: var(--nostrc-zap-btn-hover-border);
    }

    .nostr-zap-button:disabled {
      pointer-events: none;
      user-select: none;
      opacity: 0.6;
    }

    :host:not([user-status="ready"]) .nostr-zap-button {
      cursor: not-allowed;
    }

    /* SVG Icon Styles */
    .nostr-zap-button svg {
      display: inline-block;
      vertical-align: middle;
      width: var(--nostrc-icon-width);
      height: var(--nostrc-icon-height);
    }

    /* Total zap amount display */
    .total-zap-amount {
      font-size: var(--nostrc-font-size-sm);
      color: var(--nostrc-theme-text-secondary, #666666);
      white-space: nowrap;
    }

    /* Clickable zap amount */
    .total-zap-amount.clickable {
      cursor: pointer;
      transition: color 0.2s ease;
    }

    .total-zap-amount.clickable:hover {
      color: var(--nostrc-color-primary, #7f00ff);
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

    /* Skeleton loader for zap amount */
    .total-zap-amount.skeleton {
      background: linear-gradient(90deg, 
        var(--nostrc-color-skeleton, #f0f0f0) 25%, 
        var(--nostrc-color-skeleton-highlight, #e0e0e0) 50%, 
        var(--nostrc-color-skeleton, #f0f0f0) 75%
      );
      background-size: 200% 100%;
      animation: skeleton-loading 1.5s infinite;
      border-radius: var(--nostrc-border-radius-sm);
      width: 80px;
      height: 1.2em;
      display: inline-block;
    }

    /* Skeleton loader for button text */
    .button-text-skeleton {
      background: linear-gradient(90deg, 
        var(--nostrc-color-skeleton, #f0f0f0) 25%, 
        var(--nostrc-color-skeleton-highlight, #e0e0e0) 50%, 
        var(--nostrc-color-skeleton, #f0f0f0) 75%
      );
      background-size: 200% 100%;
      animation: skeleton-loading 1.5s infinite;
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
    .nostr-zap-button-error small {
      color: var(--nostrc-color-error-text);
      font-size: var(--nostrc-font-size-sm);
      line-height: 1em;
      max-width: 250px;
      white-space: pre-line;
    }
  `)}class mn extends Gt{constructor(){super();Z(this,"zapActionStatus",this.channel("zapAction"));Z(this,"zapListStatus",this.channel("zapList"));Z(this,"totalZapAmount",null);Z(this,"cachedZapDetails",[]);Z(this,"cachedAmountDialog",null)}connectedCallback(){var n;(n=super.connectedCallback)==null||n.call(this),this.zapListStatus.get()==N.Idle&&this.initChannelStatus("zapList",N.Loading,{reflectOverall:!1}),this.attachDelegatedListeners(),this.render()}static get observedAttributes(){return[...super.observedAttributes,"text","amount","default-amount","url"]}attributeChangedCallback(n,o,r){o!==r&&(super.attributeChangedCallback(n,o,r),this.render())}disconnectedCallback(){this.cachedAmountDialog&&typeof this.cachedAmountDialog.close=="function"&&this.cachedAmountDialog.close()}onStatusChange(n){this.render()}onUserReady(n,o){this.render(),this.updateZapCount()}validateInputs(){if(!super.validateInputs())return this.zapActionStatus.set(N.Idle),this.zapListStatus.set(N.Idle),!1;const n=this.getAttribute("text"),o=this.getAttribute("amount"),r=this.getAttribute("default-amount"),a=this.getAttribute("url"),s=this.tagName.toLowerCase();let i=null;if(n&&n.length>128)i="Max text length: 128 characters";else if(o){const c=Number(o);isNaN(c)||c<=0?i="Invalid amount":c>21e4&&(i="Amount too high (max 210,000 sats)")}else if(r){const c=Number(r);isNaN(c)||c<=0?i="Invalid default-amount":c>21e4&&(i="Default-amount too high (max 210,000 sats)")}else a&&(At(a)||(i="Invalid URL format"));return i?(this.zapActionStatus.set(N.Error,i),this.zapListStatus.set(N.Error,i),this.userStatus.set(N.Idle),console.error(`Nostr-Components: ${s}: ${i}`),!1):!0}async handleZapClick(){if(this.userStatus.get()===N.Ready){this.zapActionStatus.set(N.Loading),this.render();try{if(await ie(),!this.user){this.zapActionStatus.set(N.Error,"Could not resolve user to zap."),this.render();return}const n=this.getRelays().join(","),o=this.user.npub;this.cachedAmountDialog=await Qe({npub:o,relays:n,cachedDialogComponent:this.cachedAmountDialog,theme:this.theme==="dark"?"dark":"light",fixedAmount:(()=>{const r=this.getAttribute("amount");if(!r)return;const a=Number(r);if(isNaN(a)||a<=0||a>21e4){console.error("Nostr-Components: Zap button: Max zap amount: 210,000 sats");return}return a})(),defaultAmount:(()=>{const r=this.getAttribute("default-amount");if(!r)return 21;const a=Number(r);return isNaN(a)||a<=0||a>21e4?(console.error("Nostr-Components: Zap button: Max zap amount: 210,000 sats"),21):a})(),url:this.getAttribute("url")||void 0,anon:!1}),this.zapActionStatus.set(N.Ready)}catch(n){this.zapActionStatus.set(N.Error,(n==null?void 0:n.message)||"Unable to zap")}finally{this.render()}}}async handleHelpClick(){try{await nn(this.theme==="dark"?"dark":"light")}catch(n){console.error("Error showing help dialog:",n)}}async handleZappersClick(){if(this.cachedZapDetails.length!==0)try{await sn({zapDetails:this.cachedZapDetails,theme:this.theme==="dark"?"dark":"light"})}catch(n){console.error("Nostr-Components: Zap button: Error opening zappers dialog",n)}}attachDelegatedListeners(){this.delegateEvent("click",".nostr-zap-button",n=>{var o,r;(o=n.preventDefault)==null||o.call(n),(r=n.stopPropagation)==null||r.call(n),this.handleZapClick()}),this.delegateEvent("click",".help-icon",n=>{var o,r;(o=n.preventDefault)==null||o.call(n),(r=n.stopPropagation)==null||r.call(n),this.handleHelpClick()}),this.delegateEvent("click",".total-zap-amount",n=>{var o,r;(o=n.preventDefault)==null||o.call(n),(r=n.stopPropagation)==null||r.call(n),this.handleZappersClick()})}async updateZapCount(){if(this.user)try{this.zapListStatus.set(N.Loading),this.render(),await this.ensureNostrConnected();const n=await oe({pubkey:this.user.pubkey,relays:this.getRelays(),url:this.getAttribute("url")||void 0});this.totalZapAmount=n.totalAmount,this.cachedZapDetails=n.zapDetails,this.zapListStatus.set(N.Ready)}catch(n){console.error("Nostr-Components: Zap button: Failed to fetch zap count",n),this.totalZapAmount=null,this.zapListStatus.set(N.Error)}finally{this.render()}}renderContent(){const n=this.userStatus.get()==N.Loading,o=this.zapListStatus.get()==N.Loading,r=this.computeOverall()===N.Error,a=this.errorMessage,s=this.getAttribute("text")||"Zap",i={isLoading:n,isAmountLoading:o,isError:r,isSuccess:!1,errorMessage:a,buttonText:s,totalZapAmount:this.totalZapAmount,hasZaps:this.cachedZapDetails.length>0};this.shadowRoot.innerHTML=`
      ${hn()}
      ${dn(i)}
    `}}customElements.define("nostr-zap",mn);export{mn as default};
//# sourceMappingURL=nostr-zap.es.js.map
