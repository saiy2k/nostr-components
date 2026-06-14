# Nostr Verify Identity Component Specification

## Overview

- Component: `nostr-verify-identity`
- Purpose: Let a Nostr user prove control of an X/Twitter account and publish a
  verifiable handle→pubkey mapping (NIP-39). It *creates* the identity proofs
  that a directory or browser extension can later consume.
- Architecture: Extends `NostrBaseComponent`
- NIP: [NIP-39 External Identities (kind 10011)](https://github.com/nostr-protocol/nips/blob/master/39.md)

## Why this exists

A live crawl of public relays shows the X→Nostr proof substrate barely exists
today (a handful of verified accounts). Rather than scrape an empty well, this
component *fills* it: every use adds one cryptographically verified mapping.

## Attributes

| Attribute    | Required | Description |
|--------------|----------|-------------|
| `platform`   | no       | Identity platform. `twitter` (default). |
| `handle`     | no       | Pre-declare the expected handle; when set, the proof tweet MUST be authored by it. When omitted, the proof links the npub to whichever account authored the tweet. |
| `relays`     | no       | Comma-separated relay URLs (publish targets). |
| `data-theme` | no       | `light` (default) or `dark`. |

## Events

- `nc:verified` — `{ platform, handle, npub, proofTweetId, publishedKinds }`
  dispatched after a successful verify + publish.

## Flow

1. **Connect** — get the user's pubkey via NIP-07 (`window.nostr`), encode npub.
2. **Proof** — show the canonical NIP-39 proof text (contains the npub) and an
   "Open X" intent link prefilled with it. User posts it, then pastes the tweet
   URL (or numeric status id).
3. **Verify** — load the tweet via Twitter's oEmbed endpoint over **JSONP**
   (no CORS, no backend, no paid X API). Require BOTH:
   - tweet authored by `<handle>` (when a handle is declared), AND
   - tweet text contains the exact `npub`.
4. **Publish** — build `["i","twitter:<handle>","<tweetId>"]` and publish:
   - **kind:10011** (canonical NIP-39 home), and
   - **kind:0** mirror (most clients read identity from the profile today).
   Both writes are a **non-destructive merge when the current event is
   retrievable**: the current event is fetched and its `content` + all existing
   `tags` are preserved; only this one `i` tag is appended/replaced (de-duped on
   `platform:handle`). kind:0 is only mirrored when a profile already exists —
   never created from scratch.

   **Caveat (inherent to replaceable events):** if the relay fetch returns null
   because of a timeout rather than a genuinely-absent event, the kind:10011
   republish could drop other-platform identities. This matches standard NIP-39
   client behavior and is acceptable for the PoC; a production version should
   confirm the fetch against multiple relays before republishing kind:10011.

## Verification security model

Bidirectional and free. Forging a proof requires the victim's Nostr
**secp256k1/Schnorr (BIP-340)** private key AND control of their X account
simultaneously. Real proof tweets do not all use NIP-39's canonical text, so the
check is "authored by handle AND contains npub", not a fixed-string match.

The permanent numeric `x_user_id` (rename-resilience) is only available from
`cdn.syndication.twimg.com`, which is not JSONP/CORS friendly. It is therefore a
directory-crawler enhancement, deliberately out of the in-browser verify path.

## Out of scope

- Reverse lookup / directory crawl (separate scheduled job; consumes these tags).
- Like/Zap buttons (separate components).
- GitHub / Mastodon / Telegram proofs (the `Platform` type is reserved for them
  but only `twitter` verification is implemented here).
