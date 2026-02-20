# Changelog

All notable changes to the `nostr-components` npm package will be documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).  
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Changed
- URL-based zaps now use `["a", "39735:<pubkey>:<url>"]` tag instead of `["k", "web"]` + `["i", url]` tags. The `a` tag is a valid NIP-01 addressable event coordinate that NIP-57 relays copy from the zap request (kind 9734) to the zap receipt (kind 9735), enabling true relay-side `#a` filtering. `fetchTotalZapAmount()` no longer downloads all receipts and parses `description` tags client-side when a `url` is provided.

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

[Unreleased]: https://github.com/saiy2k/nostr-components/compare/v0.5.6...HEAD
[0.5.6]: https://github.com/saiy2k/nostr-components/compare/v0.5.5...v0.5.6
[0.5.5]: https://github.com/saiy2k/nostr-components/compare/v0.5.4...v0.5.5
[0.5.4]: https://github.com/saiy2k/nostr-components/compare/v0.5.3...v0.5.4
[0.5.3]: https://github.com/saiy2k/nostr-components/compare/v0.5.2...v0.5.3
[0.5.2]: https://github.com/saiy2k/nostr-components/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/saiy2k/nostr-components/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/saiy2k/nostr-components/compare/v0.4.3...v0.5.0
[0.4.3]: https://github.com/saiy2k/nostr-components/compare/v0.4.0...v0.4.3
[0.4.0]: https://github.com/saiy2k/nostr-components/compare/v0.3.2...v0.4.0
[0.3.2]: https://github.com/saiy2k/nostr/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/saiy2k/nostr/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/saiy2k/nostr/releases/tag/v0.3.0
