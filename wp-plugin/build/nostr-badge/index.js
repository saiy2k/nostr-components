/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/nostr-badge/block.json":
/*!************************************!*\
  !*** ./src/nostr-badge/block.json ***!
  \************************************/
/***/ ((module) => {

module.exports = /*#__PURE__*/JSON.parse('{"$schema":"https://schemas.wp.org/trunk/block.json","apiVersion":3,"name":"create-block/nostr-badge","version":"0.1.0","title":"Nostr Badge","category":"nostr","icon":"smiley","description":"Integrate Nostr Badge into your WordPress site.","supports":{"html":false,"anchor":true},"attributes":{"npub":{"type":"string","default":""}},"textdomain":"nostr-badge","editorScript":"file:./index.js","editorStyle":"file:./index.css","style":"file:./style-index.css","viewScript":"file:./view.js"}');

/***/ }),

/***/ "./src/nostr-badge/edit.js":
/*!*********************************!*\
  !*** ./src/nostr-badge/edit.js ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Edit)
/* harmony export */ });
/* harmony import */ var _wordpress_components__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @wordpress/components */ "@wordpress/components");
/* harmony import */ var _wordpress_components__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_wordpress_components__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _wordpress_block_editor__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @wordpress/block-editor */ "@wordpress/block-editor");
/* harmony import */ var _wordpress_block_editor__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_wordpress_block_editor__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_wordpress_element__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react/jsx-runtime */ "react/jsx-runtime");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__);




function Edit({
  attributes,
  setAttributes
}) {
  const {
    npub
  } = attributes;

  // Load the external script when npub changes
  (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_2__.useLayoutEffect)(() => {
    if (!npub) return;
    const iframe = document.querySelector('iframe[name="editor-canvas"]');
    if (!iframe || !iframe.contentDocument) return;
    const scriptId = 'nostr-profile-badge-script';
    const iframeDoc = iframe.contentDocument;
    if (!iframeDoc.getElementById(scriptId)) {
      const script = iframeDoc.createElement('script');
      script.type = 'module';
      script.src = 'https://nostr-components.web.app/dist/nostr-profile-badge.js';
      script.id = scriptId;
      iframeDoc.body.appendChild(script);
    }
    return () => {
      const existingScript = iframeDoc.getElementById(scriptId);
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, [npub]);
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
    ...(0,_wordpress_block_editor__WEBPACK_IMPORTED_MODULE_1__.useBlockProps)(),
    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_wordpress_block_editor__WEBPACK_IMPORTED_MODULE_1__.InspectorControls, {
      children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_wordpress_components__WEBPACK_IMPORTED_MODULE_0__.PanelBody, {
        title: "Nostr Profile Badge Settings",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_wordpress_components__WEBPACK_IMPORTED_MODULE_0__.TextControl, {
          label: "Nostr Public Key (npub)",
          value: npub,
          onChange: value => setAttributes({
            npub: value
          }),
          placeholder: "npub1..."
        })
      })
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("div", {
      className: "nostr-profile-container",
      style: {
        color: 'red'
      },
      children: npub ? /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("nostr-profile-badge", {
        pubkey: npub
      }) : /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("p", {
        children: "Enter npub to display nostr Badge"
      })
    })]
  });
}

/***/ }),

/***/ "./src/nostr-badge/index.js":
/*!**********************************!*\
  !*** ./src/nostr-badge/index.js ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _wordpress_blocks__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @wordpress/blocks */ "@wordpress/blocks");
/* harmony import */ var _wordpress_blocks__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_wordpress_blocks__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _style_scss__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./style.scss */ "./src/nostr-badge/style.scss");
/* harmony import */ var _edit__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./edit */ "./src/nostr-badge/edit.js");
/* harmony import */ var _save__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./save */ "./src/nostr-badge/save.js");
/* harmony import */ var _block_json__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./block.json */ "./src/nostr-badge/block.json");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react/jsx-runtime */ "react/jsx-runtime");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__);
/**
 * Registers a new block provided a unique name and an object defining its behavior.
 *
 * @see https://developer.wordpress.org/block-editor/reference-guides/block-api/block-registration/
 */






// create a custom icon for the block

const nostrBadgeIcon = /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("svg", {
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: "0 0 533.31 533.31",
  style: {
    width: '100%',
    height: 'auto'
  },
  children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("circle", {
    cx: "266.65",
    cy: "266.65",
    r: "256",
    style: {
      fill: '#fff',
      stroke: '#a915ff',
      strokeMiterlimit: 10,
      strokeWidth: 6
    }
  }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("path", {
    d: "M374.82,278.35c.1,5.47-5.19,22.37-16.81,35.33-11.62,12.96-24.34,9.06-25.39,8.76s-1.34-1.94-3.43-1.64-4.17,2.68-8.19,3.13-7.6.74-11.32-.6c-1.94.3-2.23.31-3.13.97s-7.75,4.69-9.39,4.99c0,3.13-.6,19.37,0,24.29s1.64,11.17,3.28,15.64c1.64,4.47,1.19,4.62,3.28,4.32s5.81.15,6.85,1.79.6,2.83,2.38,3.58,26.37,7.45,43.21,8.34c11.62.3,18.62,1.19,22.65,8.49.6,3.43,3.28,5.66,4.92,6.11s3.58.89,5.21,2.53.45,3.58,2.38,5.07c1.94,1.49,6.41,3.72,11.03,5.96,4.62,2.23,6.56,5.81,6.85,7s.74,4.77.74,4.77c0,0-3.87,0-4.77-.89s-1.19-2.53-1.19-2.53c0,0-2.68.45-3.28,1.49s.3,1.19-3.43.3-5.07-1.64-7.9-3.72-7.15-7.45-10.88-7.3c1.79,3.58,2.53,3.58,4.62,4.77s3.58,2.53,3.58,2.53l-3.13,1.94s-1.94.89-6.41-.3c-4.47-1.19-5.07-1.94-5.51-4.62s0-4.02-1.19-6.26-1.79-6.85-9.68-9.24c-7.9-2.38-28.91-9.24-43.51-10.73-14.6-1.49-9.83-1.19-12.22-.6s-6.85,1.94-11.47-.6c-4.62-2.53-7.3-5.96-7.6-8.79s-.74-4.77,0-8.34,1.49-8.64.74-11.62-6.11-24.29-8.64-27.86c-5.66.45-22.05-.3-22.05-.3,0,0-1.04-.3-7.6,2.53-6.56,2.83-15.85,5.98-20.32,8.66-4.47,2.68-6.26,4.22-7,5.71.05,1.3-.53,3.35-1.21,3.94s-5.42,1.05-5.42,1.05c0,0-2.54,2.54-3.58,4.33-2.98,4.17-23.99,54.38-28.91,65.11-5.89,14.15-4.25,11.92-16.39,11.92s-3.5.13-3.5.13c0,0-5.36,2.55-7.3,2.55s-8.19-1.04-11.47,0-7.15,4.02-10.13,4.47c-2.98.45-2.15-.58-3.64-1.63-1.74-.09-6.2-.05-6.2-.05,0,0,.76-2.83,3.44-4.73,3.58-2.53,11.03-7,15.05-9.24,4.02-2.23,7.6-3.43,10.13-4.02,2.53-.6,8.05-2.68,13.26-4.32s8.49-3.58,12.96-13.71c4.47-10.13,21.9-48.42,22.35-50.51.28-1.29,1.62-2.81,2.09-6.56.29-2.32-1.08-5.67.74-9.83,4.77-10.88,9.39-8.79,11.47-8.79s7.45.15,11.47-.6c4.02-.74,6.7-1.19,10.73-3.43,4.02-2.23,4.92-3.87,4.92-3.87l-8.64-1.49s-8.05.3-10.88-1.94-6.7-6.85-6.7-6.85l-3.28-3.13.45,3.72s-2.23-3.87-2.83-4.47-3.72-2.83-4.92-4.92-3.28-10.88-3.28-10.88l-2.68,5.66-.74-8.19-2.23,3.13-1.19-7-2.09,3.58-1.49-6.26-2.53,1.94-1.04-4.47-2.53-1.49s-6.11-4.02-7.15-4.17-1.94,1.49-1.94,1.49l.6,5.21-5.3-2.72-3.04-5.17s1.02,1.74-4.18,3.27c-8.93,0-9.51-.99-10.83-1.71-.57-2.85-2.42-4.39-2.42-4.39h-8.94l-.15-2.98-3.43,1.34.3-4.47h-6.11l.45-4.92h-3.87s1.34-4.02,11.17-9.98c9.83-5.96,10.88-7.15,20.11-7.45,9.24-.3,14.3,1.19,20.11,3.58,5.81,2.38,16.84,5.96,19.07,7.6,4.92-4.32,12.37-8.64,14.9-8.64.45-1.04,2.69-5.36,7.81-7.65,15.34-6.87,46.99-14.78,57.16-15.45,13.56-.89,3.43-.6,16.99.89,13.56,1.49,23.54,3.28,30.25,5.51,5.46,1.82,10.88,4.17,14.9.89,1.88-.79,5.13-.58,7.75-2.23,13.34-10.9,15.09-14.06,18.96-18.23,3.87-4.17,8.75-10.83,9.8-19.62s1.94-25.33-4.62-38.29c-6.56-12.96-12.52-19.67-15.05-30.1-2.53-10.43-3.58-26.52-2.68-31.74s2.23-9.68,2.98-13.26,4.32-6.41,8.64-7.15c4.32-.74,7.75.6,9.68,2.09s5.06,2.73,5.81,4.47c.15.74-.6,2.83,3.58,3.58s6.97,1.81,6.97,1.81c0,0,6.8,1.87,1.35,3.36-5.51.89-8.92-.31-10.56.74s-3.13,4.38-4.17,4.83-3.13.15-5.21,1.79-4.17,2.98-5.51,6.26-2.38,6.85-1.49,11.62,3.72,13.71,6.26,18.77c2.53,5.07,8.79,17.73,10.58,20.71s6.85,12.81,7.3,23.39.45,19.22,0,23.84c-.45,4.62-4.71,22.45-15.44,37.35-3.54,6.14-10.09,13.86-10.72,15.22s-1.31,2.12-.7,3.32c2.01,3.93,5.59,9.62,6.39,12.7,1,2.89,3.04,7.01,3.14,12.48Z",
    style: {
      fill: '#a915ff',
      stroke: '#a915ff',
      strokeMiterlimit: 10,
      strokeWidth: 6
    }
  })]
});
(0,_wordpress_blocks__WEBPACK_IMPORTED_MODULE_0__.registerBlockType)(_block_json__WEBPACK_IMPORTED_MODULE_4__.name, {
  icon: nostrBadgeIcon,
  edit: _edit__WEBPACK_IMPORTED_MODULE_2__["default"],
  save: _save__WEBPACK_IMPORTED_MODULE_3__["default"]
});

/***/ }),

/***/ "./src/nostr-badge/save.js":
/*!*********************************!*\
  !*** ./src/nostr-badge/save.js ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ save)
/* harmony export */ });
/* harmony import */ var _wordpress_block_editor__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @wordpress/block-editor */ "@wordpress/block-editor");
/* harmony import */ var _wordpress_block_editor__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_wordpress_block_editor__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react/jsx-runtime */ "react/jsx-runtime");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__);


function save({
  attributes
}) {
  const npub = attributes.npub;
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxs)("div", {
    ..._wordpress_block_editor__WEBPACK_IMPORTED_MODULE_0__.useBlockProps.save(),
    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)("script", {
      type: "module",
      src: "https://nostr-components.web.app/dist/nostr-profile-badge.js",
      "data-pubkey": npub
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)("nostr-profile-badge", {
      pubkey: npub
    })]
  });
}

/***/ }),

/***/ "./src/nostr-badge/style.scss":
/*!************************************!*\
  !*** ./src/nostr-badge/style.scss ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
// extracted by mini-css-extract-plugin


/***/ }),

/***/ "@wordpress/block-editor":
/*!*************************************!*\
  !*** external ["wp","blockEditor"] ***!
  \*************************************/
/***/ ((module) => {

module.exports = window["wp"]["blockEditor"];

/***/ }),

/***/ "@wordpress/blocks":
/*!********************************!*\
  !*** external ["wp","blocks"] ***!
  \********************************/
/***/ ((module) => {

module.exports = window["wp"]["blocks"];

/***/ }),

/***/ "@wordpress/components":
/*!************************************!*\
  !*** external ["wp","components"] ***!
  \************************************/
/***/ ((module) => {

module.exports = window["wp"]["components"];

/***/ }),

/***/ "@wordpress/element":
/*!*********************************!*\
  !*** external ["wp","element"] ***!
  \*********************************/
/***/ ((module) => {

module.exports = window["wp"]["element"];

/***/ }),

/***/ "react/jsx-runtime":
/*!**********************************!*\
  !*** external "ReactJSXRuntime" ***!
  \**********************************/
/***/ ((module) => {

module.exports = window["ReactJSXRuntime"];

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = __webpack_modules__;
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/chunk loaded */
/******/ 	(() => {
/******/ 		var deferred = [];
/******/ 		__webpack_require__.O = (result, chunkIds, fn, priority) => {
/******/ 			if(chunkIds) {
/******/ 				priority = priority || 0;
/******/ 				for(var i = deferred.length; i > 0 && deferred[i - 1][2] > priority; i--) deferred[i] = deferred[i - 1];
/******/ 				deferred[i] = [chunkIds, fn, priority];
/******/ 				return;
/******/ 			}
/******/ 			var notFulfilled = Infinity;
/******/ 			for (var i = 0; i < deferred.length; i++) {
/******/ 				var [chunkIds, fn, priority] = deferred[i];
/******/ 				var fulfilled = true;
/******/ 				for (var j = 0; j < chunkIds.length; j++) {
/******/ 					if ((priority & 1 === 0 || notFulfilled >= priority) && Object.keys(__webpack_require__.O).every((key) => (__webpack_require__.O[key](chunkIds[j])))) {
/******/ 						chunkIds.splice(j--, 1);
/******/ 					} else {
/******/ 						fulfilled = false;
/******/ 						if(priority < notFulfilled) notFulfilled = priority;
/******/ 					}
/******/ 				}
/******/ 				if(fulfilled) {
/******/ 					deferred.splice(i--, 1)
/******/ 					var r = fn();
/******/ 					if (r !== undefined) result = r;
/******/ 				}
/******/ 			}
/******/ 			return result;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/jsonp chunk loading */
/******/ 	(() => {
/******/ 		// no baseURI
/******/ 		
/******/ 		// object to store loaded and loading chunks
/******/ 		// undefined = chunk not loaded, null = chunk preloaded/prefetched
/******/ 		// [resolve, reject, Promise] = chunk loading, 0 = chunk loaded
/******/ 		var installedChunks = {
/******/ 			"nostr-badge/index": 0,
/******/ 			"nostr-badge/style-index": 0
/******/ 		};
/******/ 		
/******/ 		// no chunk on demand loading
/******/ 		
/******/ 		// no prefetching
/******/ 		
/******/ 		// no preloaded
/******/ 		
/******/ 		// no HMR
/******/ 		
/******/ 		// no HMR manifest
/******/ 		
/******/ 		__webpack_require__.O.j = (chunkId) => (installedChunks[chunkId] === 0);
/******/ 		
/******/ 		// install a JSONP callback for chunk loading
/******/ 		var webpackJsonpCallback = (parentChunkLoadingFunction, data) => {
/******/ 			var [chunkIds, moreModules, runtime] = data;
/******/ 			// add "moreModules" to the modules object,
/******/ 			// then flag all "chunkIds" as loaded and fire callback
/******/ 			var moduleId, chunkId, i = 0;
/******/ 			if(chunkIds.some((id) => (installedChunks[id] !== 0))) {
/******/ 				for(moduleId in moreModules) {
/******/ 					if(__webpack_require__.o(moreModules, moduleId)) {
/******/ 						__webpack_require__.m[moduleId] = moreModules[moduleId];
/******/ 					}
/******/ 				}
/******/ 				if(runtime) var result = runtime(__webpack_require__);
/******/ 			}
/******/ 			if(parentChunkLoadingFunction) parentChunkLoadingFunction(data);
/******/ 			for(;i < chunkIds.length; i++) {
/******/ 				chunkId = chunkIds[i];
/******/ 				if(__webpack_require__.o(installedChunks, chunkId) && installedChunks[chunkId]) {
/******/ 					installedChunks[chunkId][0]();
/******/ 				}
/******/ 				installedChunks[chunkId] = 0;
/******/ 			}
/******/ 			return __webpack_require__.O(result);
/******/ 		}
/******/ 		
/******/ 		var chunkLoadingGlobal = globalThis["webpackChunknostr_components"] = globalThis["webpackChunknostr_components"] || [];
/******/ 		chunkLoadingGlobal.forEach(webpackJsonpCallback.bind(null, 0));
/******/ 		chunkLoadingGlobal.push = webpackJsonpCallback.bind(null, chunkLoadingGlobal.push.bind(chunkLoadingGlobal));
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module depends on other loaded chunks and execution need to be delayed
/******/ 	var __webpack_exports__ = __webpack_require__.O(undefined, ["nostr-badge/style-index"], () => (__webpack_require__("./src/nostr-badge/index.js")))
/******/ 	__webpack_exports__ = __webpack_require__.O(__webpack_exports__);
/******/ 	
/******/ })()
;
//# sourceMappingURL=index.js.map