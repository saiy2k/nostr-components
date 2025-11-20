function t(e){try{const r=new URL(e);return r.origin.replace("://m.","://").replace("://mobile.","://").replace("http://","https://").replace(/:\d+/,n=>n===":443"||n===":80"?"":n)+r.pathname.replace(/\/+/g,"/").replace(/\/*$/,"")}catch{return console.error("Invalid URL:",e),e}}function a(e){return/^[a-f0-9]{64}$/.test(e)}export{a as i,t as n};
//# sourceMappingURL=utils--bxLbhGF.js.map
