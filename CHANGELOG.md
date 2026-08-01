# Changelog

All notable changes to the `nostr-components` npm package will be documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).  
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Removed
- **BREAKING:** The `./components/nostr-comment`, `./components/nostr-dm`, and `./components/nostr-live-chat` subpath exports are no longer published, and the UMD default export no longer includes `NostrComment`, `NostrDm`, or `NostrLiveChat`. These components were already disabled; their source remains in the repo but is excluded from builds. **Migration:** remove any `nostr-components/components/nostr-comment` (or `-dm` / `-live-chat`) imports — there is no replacement in this package yet.

### Security
- Zap totals and the zap-success overlay now only count kind-9735 receipts that pass NIP-57 Appendix F validation (receipt signed by the LNURL `nostrPubkey`, embedded zap request signature-verified, `p` tags matching the recipient, bolt11 amount matching the zap request, `lnurl` tag matching the recipient LNURL). If the recipient's LNURL provider metadata cannot be resolved over HTTPS, totals fail closed to `0`.
- Like counts are netted per pubkey (only the newest reaction counts), so one author can no longer inflate social proof with repeated kind-17 events.
- `hasSigner()` no longer treats a `localStorage` nsec as an available signer; only NIP-07 / NDK signers count.
- Anonymous zap keys are generated with `crypto.getRandomValues` and the insecure `Math.random` fallback now throws instead.
- `.gitignore` now covers env files, keys, and credential globs.

### Fixed
- Double-clicking the like or zap button no longer fires duplicate actions; buttons are `disabled` + `aria-busy` while an action is in flight, and stale async results are discarded via load-sequence guards.
- `normalizeURL` (shared by zaps, likes, and comments) preserves query strings in the identity key and handles ports/IPv6 literals via the URL parser instead of regexing the origin.

### Accessibility
- Dialogs use native `showModal()` with `::backdrop`, `aria-labelledby`, focus trap + restore, and 44px close targets.
- Like/zap counts are keyboard-operable (`role="button"`, `tabindex="0"`, Enter/Space), help icons have `aria-label`s and 44px targets, carousel bullets are labelled, and `prefers-reduced-motion` disables skeleton animations.

---

## [0.7.0] - 2026-08-01

### Added
- `show-replies` support on `nostr-post` for loading and displaying direct replies
- Shared signer onboarding dialog for like, zap, and follow actions

### Fixed
- Concurrent component mounts no longer race multiple relay connection attempts; they share one in-flight connect (#105)
- Like count drift when a like or unlike request fails
- XSS hardening across rendered surfaces, including URL escaping in profile and DM UI
- Storybook testing helpers and boolean attribute handling cleanup (#83)

---

## [0.6.1] - 2026-02-20

### Changed
- URL-based zaps now use `["a", "39735:<pubkey>:<url>"]` tag instead of `["k", "web"]` + `["i", url]` tags. The `a` tag is a valid NIP-01 addressable event coordinate that NIP-57 relays copy from the zap request (kind 9734) to the zap receipt (kind 9735), enabling true relay-side `#a` filtering. `fetchTotalZapAmount()` no longer downloads all receipts and parses `description` tags client-side when a `url` is provided.
This is a breaking change. Zaps sent to any URL via the previous strategy will no longer be shown.

---

## [0.5.6] - 2026-02-18

### Fixed
- SSR guard in `ensureInitialized` to avoid DOM access in Node/SSR environments
- Race condition in `injectScript` when script tag exists but has not loaded
- Failed script element left in DOM blocking retries
- Duplicate backdrop creation on repeated `showModal()` calls

### Changed
- Typed `signEvent` with `UnsignedEvent`/`NostrEvent` from nostr-tools
- Pinned `window.nostr.js` CDN to `@0.7.1` with SRI hash for supply-chain safety
- Added focus trap, `aria-modal`, and focus restore to dialog component

---

## [0.5.5] - 2026-02-18

### Changed
- Replaced `nostr-login` with `window.nostr.js` for lighter authentication widget

### Fixed
- Dialog backdrop z-index covering `window.nostr.js` floating widget

---

## [0.5.4] - 2026-01-22

### Fixed
- Follow button keyboard event handling (moved `tabindex` to container for `delegateEvent` compatibility)
- Zap dialog profile metadata error handling

### Added
- Focus color CSS variable for follow button

---

## [0.5.3] - 2026-01-22

### Fixed
- Zap dialog QR code generation and error handling
- Profile metadata validation in zap invoice loading

---

## [0.5.2] - 2026-01-22

### Fixed
- Mobile view stream title layout fix missing from 0.5.1 build

---

## [0.5.1] - 2026-01-22

### Fixed
- Mobile view stream title layout issue (prevented vertical character rendering)

---

## [0.5.0] - 2026-01-22

### Added
- `nostr-livestream` component (NIP-53)

---

## [0.4.3] - 2026-01-07

### Changed
- Temporarily disabled `nostr-comment`, `nostr-dm`, and `nostr-live-chat` components due to asset resolution issues in React applications

---

## [0.4.0] - 2026-01-07

### Added
- Renamed `nostr-like` → `nostr-like-button`, `nostr-zap` → `nostr-zap-button`

### Fixed
- Relay connection handling — service continues working even if some relays fail
- Relay connection status detection to correctly identify connected vs failed relays

### Changed
- URL normalization now uses `normalizeURL` from `nostr-tools`

---

## [0.3.2] - 2025-12-27

### Fixed
- Zap button error

### Changed
- Improved documentation in README files

---

## [0.3.1] - 2025-12-20

### Fixed
- NostrLogin integration
- Component initialization

---

## [0.3.0] - 2025-11-22

### Added
- Initial release of `nostr-components` npm package
- `nostr-zap-button` — Lightning zap button with QR code, WebLN, and zap receipt confirmation
- `nostr-follow-button` — Follow button with NIP-07 signing
- `nostr-profile` — Profile display component
- `nostr-profile-badge` — Compact profile badge component
- `nostr-post` — Display a Nostr note by event ID
- Light and dark theme support via `data-theme` attribute
- Custom relay configuration via `relays` attribute
- Responsive design for all components

[Unreleased]: https://github.com/saiy2k/nostr-components/compare/v0.7.0...HEAD
[0.7.0]: https://github.com/saiy2k/nostr-components/compare/v0.6.1...v0.7.0
[0.6.1]: https://github.com/saiy2k/nostr-components/compare/v0.5.6...v0.6.1
[0.5.6]: https://github.com/saiy2k/nostr-components/compare/v0.5.5...v0.5.6
[0.5.5]: https://github.com/saiy2k/nostr-components/compare/v0.5.4...v0.5.5
[0.5.4]: https://github.com/saiy2k/nostr-components/compare/v0.5.3...v0.5.4
[0.5.3]: https://github.com/saiy2k/nostr-components/compare/v0.5.2...v0.5.3
[0.5.2]: https://github.com/saiy2k/nostr-components/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/saiy2k/nostr-components/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/saiy2k/nostr-components/compare/v0.4.3...v0.5.0
[0.4.3]: https://github.com/saiy2k/nostr-components/compare/v0.4.0...v0.4.3
[0.4.0]: https://github.com/saiy2k/nostr-components/compare/v0.3.2...v0.4.0
[0.3.2]: https://github.com/saiy2k/nostr-components/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/saiy2k/nostr-components/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/saiy2k/nostr-components/releases/tag/v0.3.0
