# Nostr Atlas directory site

Nostr Atlas is a self-contained Vite + TypeScript directory experience inspired
by the search-first structure of `nostr.directory`. It intentionally lives beside
the existing component library so the package build and backend jobs remain
unchanged.

## Run locally

From the repository root:

```sh
npm run dev:directory
```

Then open the URL printed by Vite.

## Build

```sh
npm run build:directory
```

The deployable static site is written to `directory-site/dist/`.

The current profile list is honest local demo data. Search, categories, sorting,
copy feedback, responsive navigation, and the add-profile preview are functional.
The Firestore-backed relay-directory projection can replace `src/data.ts` when a
public read API is available.
