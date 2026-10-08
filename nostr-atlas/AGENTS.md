# Nostr Atlas site

Vite + TypeScript site in this directory. It is separate from the component library build.

- Dev: `npm run dev:atlas` from the repo root.
- The listing API is `listAtlasProfiles`. Pending claims and obsolete identities stay off the page; the UI uses each handle's current `activeIdentity`.
- A failed or empty load shows an honest empty or error state. Sample rows are not stand-ins for live records.
- `VITE_*` values are public. If `nostr-atlas/.env.local` points at the Functions emulator, override `VITE_ATLAS_API_URL` with the production function URL when running `npm run build:atlas`.
- Header, footer, and the like and zap component scripts live in `partials/` and are injected at `<!-- site-header -->` and `<!-- site-footer -->`. `src/site.ts` points those buttons at the current page. `directoryFunctionUrl` in `src/api.ts` builds other function URLs from the directory API URL.
- Checks: `npx vitest run nostr-atlas/src` and `npx tsc --project nostr-atlas/tsconfig.json`.
- Deploy the static site with `firebase deploy --only hosting:atlas --project nostr-components` after `npm run build:atlas`. That command does not deploy Cloud Functions.
- Browser checklist and claim-flow detail: [README.md](README.md) and [qa.md](qa.md).
