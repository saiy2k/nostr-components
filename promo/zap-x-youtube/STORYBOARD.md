---
format: 1080x1080
duration: 32s
message: "The zap button is already on the posts and videos you love, and you want to press it."
arc: "Hook → X → YouTube → Hold"
audience: "People who already scroll X and YouTube"
mode: collaborative
music: "slow dark luxury pulse, sparse, low, no vocals"
---

## Decisions

- Message: the zap button is already on the posts and videos you love, and you want to press it.
- Audience and arc: people already on X and YouTube. Hook, then the post, then the video, then the held ask.
- Format: 1080×1080, 32s, voiceover yes, music yes. Caption keep-out is the bottom 17%.
- Spine: one zap pill. It starts large, settles into the action row, stays put while the surface changes, then returns large.
- Brand: canvas `#070709`, ink `#F6F1E6`, gold `#FFC800`, card `#14141A`. Display Playfair Display, label Montserrat, numbers JetBrains Mono. Bolt path from the component.
- Bans: no vendor logos, no tutorial, no QR, no signer, no purple glow, no slideshow of unrelated cards, no floating screensaver motion.
- Held frame: Frame 4, after the pill returns.

## Locked

The approved plan plus the instruction to finish every todo locks these four beats. Sketches are in `storyboard.html`. Render stays gated.

## Video direction

- Palette: canvas field, ink type, gold only on the bolt, the pill rim, and the final sweep. Card is `#14141A`.
- Motion: power3 eases. Reveal on the spoken line, then let the picture finish the thought. Holds stay still. No breathing camera.
- Rhythm: Frame 1 is the arrival. Frames 2 and 3 carry the press. Frame 4 is the held read.
- Never: a second button, a logo of X or YouTube, type inside the caption band, a payment modal.

## Frame 1 — Hook

- scene: The zap pill is already large on a black field. The word ZAP sits above it.
- duration: 3s
- poster: 2.2s
- transition_in: cut
- status: animated
- type: hook
- blueprint: logo-assemble-lockup (Adapt)
- voiceover: "It's already there."
- asset_candidates: bolt-mark
- focal: bolt-mark
- roles: bolt-mark = cutout
- sfx: impact-bass-2
- src: compositions/frames/01-hook.html
- handoff_out: "pill x:0 y:0 scale:1 opacity:1, anchored left 442 top 400"

Adapt: keep the mark resolving into a centered lockup. The mark is the pill, not a logo build from parts.
Scene 1 (0.0–1.4s): near-black field, gold bloom behind center. The pill eases up into place. Centered, pill is the primary mass. Slow push via scale only.
Scene 2 (1.4–3.0s): the word ZAP fades in above the pill and holds. No further travel.

The pill is in frame from the first frames of the fade, not after a black hold.

## Frame 2 — X

- scene: A designed post card. The pill travels from center into the action row and is pressed.
- duration: 11s
- poster: 8s
- transition_in: cut
- status: animated
- type: feature_showcase
- blueprint: cursor-ui-demo (Adapt)
- voiceover: "On the posts."
- asset_candidates: bolt-mark
- focal: bolt-mark
- roles: bolt-mark = cutout
- sfx: click
- src: compositions/frames/02-x.html
- handoff_in: "pill x:0 y:0 scale:1 opacity:1, anchored left 442 top 400"
- handoff_out: "pill x:-200 y:168 scale:0.72 opacity:1, anchored left 442 top 400"

Adapt: no drawn cursor. The press is the pill compressing. The surface is an abstract post, not x.com.
Scene 1 (0.0–1.2s): same pill and ZAP as the hook. ZAP fades out. The post card starts to appear.
Scene 2 (1.2–4.0s): the pill travels down into the action row, scale 1 to 0.72. The words On X. fade in.
Scene 3 (4.0–6.4s): hold. The row is readable.
Scene 4 (6.4–7.2s): the pill compresses and releases. Gold bloom on the press.
Scene 5 (7.2–11.0s): still hold. Pill stays at the row.

## Frame 3 — YouTube

- scene: A designed watch card. The same pill is pressed. Sats count up. A short thank-you.
- duration: 11s
- poster: 8.5s
- transition_in: cut
- status: animated
- type: feature_showcase
- blueprint: dataviz-countup (Adapt)
- voiceover: "On the videos."
- asset_candidates: bolt-mark
- focal: bolt-mark
- roles: bolt-mark = cutout
- sfx: click
- src: compositions/frames/03-youtube.html
- handoff_in: "pill x:-200 y:168 scale:0.72 opacity:1, anchored left 442 top 400"
- handoff_out: "pill x:-200 y:168 scale:0.72 opacity:1, anchored left 442 top 400"

Adapt: the signature is the count-up, not a chart. The pill does not move. The surface is an abstract video, not youtube.com.
Scene 1 (0.0–1.6s): watch card and pill already in the row. The words On YouTube. fade in.
Scene 2 (1.6–4.2s): hold.
Scene 3 (4.2–5.0s): press and gold bloom.
Scene 4 (5.0–8.2s): the sat count steps 0, 21, 210, 1000.
Scene 5 (8.2–11.0s): Thank you fades in and holds. No modal.

## Frame 4 — Hold

- scene: The pill returns large. The line Send sats. Right there. A gold sweep crosses the pill.
- duration: 7s
- poster: 5.2s
- transition_in: cut
- status: animated
- type: cta
- blueprint: titlecard-reveal (Adapt)
- voiceover: "Zap them."
- asset_candidates: bolt-mark
- focal: bolt-mark
- roles: bolt-mark = cutout
- sfx: sparkle
- src: compositions/frames/04-hold.html
- handoff_in: "pill x:-200 y:168 scale:0.72 opacity:1, anchored left 442 top 400"

Adapt: one restrained move, then a still hold. The move is the pill returning to center. The sweep is the only extra gold.
Scene 1 (0.0–2.2s): the watch card fades. The pill travels back to center and grows.
Scene 2 (2.2–4.4s): Send sats. Right there. fades in under the pill.
Scene 3 (4.4–5.4s): a gold sheen crosses the pill once.
Scene 4 (5.4–7.0s): still hold.
