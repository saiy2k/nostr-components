/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ATLAS_API_URL?: string;
  readonly VITE_SITE_ORIGIN?: string;
  readonly VITE_DIRECTORY_CLAIM_RELAYS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
