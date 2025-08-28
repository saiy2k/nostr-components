// SPDX-License-Identifier: MIT

/// <reference types="vite/client" />

declare module '*.css?raw' {
  const content: string;
  export default content;
}
