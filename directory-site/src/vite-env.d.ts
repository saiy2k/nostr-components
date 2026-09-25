/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DIRECTORY_CLAIM_RELAYS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
