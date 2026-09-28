---
workflow: product-launch-video
flow: automation
storyboard: no
message: "Don't just like it. Zap it: send real sats to creators, right on X and YouTube."
destination: x-feed
aspect: 1080x1080
language: en
audience: "X and YouTube users who follow Bitcoin/Nostr creators and want to support them with more than a like"
length: 30s
angle: contrast
narration: no
---

## Intent

A sexy, 30-second (hard max) promo for the "Nostr Like & Zap" browser
extension: a zap button for x.com and YouTube. Sell it, don't tour it. Posted
first in the X feed, so it must hook in the first second and read on muted
autoplay; music + kinetic type + SFX carry it, no voice-over.

Chosen concept ("Strike"): the yellow lightning bolt is the protagonist. It
opens on the emotional contrast (a like is free and gives the creator
nothing), then the bolt strikes into the real X action row right after the
heart, gets clicked, the "Send a Zap" sheet picks 1000 sats, "Thank you!"
lands with a spark burst, and the same bolt drops into YouTube's action row.
Black canvas, electric yellow #FFC800, big confident type, glow and
shockwaves on the beat. Deliberately not the typical browser screen-recording
with a cursor, a feature-bullet list and a store badge.

## Customizations

- Recreate the product UI faithfully from the extension source: compact
  yellow bolt (#FFC800, path `M13 2L3 14h7v8l10-12h-7z`) inserted right after
  X's native heart; on YouTube a 40px pill beside the like/dislike pill;
  "Send a Zap" dialog with 21 / 100 / 1000 presets, "Open in wallet", success
  overlay "⚡ Thank you!".
- Sats counter counts up on the zap beat.
- Sound: SFX only — no music (the user chose this at the audio step instead of
  signing in to HeyGen). Cues are hand-placed on the 120 BPM beat grid in
  `audio_meta.json` (bgm null), with a riser ending on the 6.0s bolt strike.
- End card CTA: free, open-source browser extension;
  github.com/saiy2k/nostr-components (the extension link used by Nostr Atlas).

## Notes

- Accuracy: zaps go peer-to-peer to the creator's own Lightning wallet; the
  zap button only appears for creators who have linked their X handle / put an
  npub on their YouTube channel. Do not claim "zap anyone".
- Needs a Nostr signer (Alby, nos2x, any NIP-07) and a Lightning wallet; not a
  message for this 30s cut.
- Use fictional creators and handles; no real people's likeness.
- Previous attempt in promo/zap-x-youtube is ignored by request; this project
  starts from scratch.
- Do not run `audio.mjs` generate/fetch-sfx: with `music: none` and no
  SCRIPT.md it treats the project as fully silent and removes the hand-authored
  `audio_meta.json`. Edit that file directly, then re-run assemble + transitions.
