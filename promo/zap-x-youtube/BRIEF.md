---
workflow: product-launch-video
flow: automation
storyboard: yes
message: "The zap button is already on the posts and videos you love, and you want to press it."
destination: x-feed
aspect: 1080x1080
language: en
audience: "People who already scroll X and YouTube"
length: 32s
angle: "Desire object. The button arrives on X, then YouTube, then the press. No tutorial."
narration: yes
---

## Intent

A tasteful luxury desire ad for the zap button on X and YouTube. Slow, dark, gold lightning. The button is the object of want, not a setup guide. Sparse voiceover, written for this film. Square, for an X or Instagram feed.

The user chose: sell, not show; luxury desire; voiceover; about 30–45 seconds; X feed square; review sketches; the product-promo pipeline.

## Assets

- No logo, footage, or music was supplied.
- The lightning mark is the real component path from `src/nostr-zap-button/render.ts`: `M13 2L3 14h7v8l10-12h-7z`, fill `#FFC800`. Drawn inline. Not a captured file.

## Customizations

- Burned-in captions always on. X autoplay is muted; the voiceover is for people who unmute.
- Slow music bed and one zap hit on the press. A low hum under the open. A gold light sweep only on the final hold.
- Designed mockups of an action row. Do not scrape x.com or youtube.com. Do not draw those brands' logos.
- Custom design system. No shipped preset matches near-black and `#FFC800`.

## Notes

- Length is 32 seconds, inside the 30–45s band, so a square feed can finish. The button is in frame from the first moment.
- Copy may say "zap" and "sats." No signer, extension install, QR code, npub, or payment modal.
- Voice, four lines: "It's already there. On the posts. On the videos. Zap them."
- On-screen words: `ZAP` / `On X.` / `On YouTube.` / `Send sats. Right there.`
- The implement instruction completed the sketch review and the build in one run. Render stays gated.
- HeyGen is not signed in. Voice is Kokoro `af_sky`. The bed is a local low drone at `assets/bgm/bed.mp3`, because library music needs a HeyGen credential. Frame durations stay at the planned holds; they were not shrunk to the short voice clips.
