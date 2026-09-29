---
format: 1080x1080
duration: 30.75s
message: "Don't just like it. Zap it: send real sats to creators, right on X and YouTube."
arc: BAB — a like gives nothing → zap it → on X → on YouTube → real sats to the creator → get it
audience: X and YouTube users who follow Bitcoin/Nostr creators
mode: autonomous
music: none
---

# Nostr Like & Zap — "Strike" (30.75s, 1:1 X feed, no voice-over)

This video tells X and YouTube users who follow Bitcoin/Nostr creators that a like
gives the creator nothing, and the zap button sends real sats right where they
already scroll. No voice-over and no music (SFX only): every reveal lands on a
120 BPM beat grid (one beat every 0.5s); the sound peak — a riser into a bass
impact — is the bolt strike at 7.75s.

## Video direction

- **Canvas** 1080×1080 (1:1, X mobile feed). All content in the top 83% (y ≤ 896); outer pad ~60px.
- **Phone-feed type scale.** frame.md's cqw ramp was authored for 1920-wide frames. On this 1080 canvas multiply every type size by 1.8 (display ≈ 23cqw, h1 ≈ 13.5cqw, h2 ≈ 8cqw, lead ≈ 2.9cqw, mono label ≈ 2.6cqw), then fit-to-measure (one line ≤ 78cqw). Floor: nothing load-bearing under ~28px.
- **Palette.** Dark register: ground #0A0A0A, text cream #F0ECE5, secondary cream-muted #888880, hairline #282826, the one accent #FFC800 (the product's bolt yellow). Yellow register: ground #FFC800, ink #0A0A0A, muted ink rgba(17,17,17,0.75) — only for the strike (end of Frame 2 into the start of Frame 3). Product surfaces (X, YouTube, zap dialog) keep their real colors, radii and UI fonts; purple #7f00ff exists only inside the zap dialog.
- **Type.** Headlines Barlow 900 lowercase, tracking −0.03…−0.04em. Kickers IBM Plex Mono 600 uppercase, +0.14em. X UI in Inter, YouTube UI in Roboto. Fonts ship in `assets/fonts/` (Barlow-400/600/700/800/900, IBMPlexMono-500/600, Inter-400/500/700/800, Roboto-400/500/700 `.woff2`); declare each used face with an in-file `@font-face` whose src is `url("assets/fonts/<file>")`.
- **Motion grammar.** Smooth long-tail settles (power3 default; expo-out for fast arrivals and the Frame 4 zoom-out). No bounce, overshoot or elastic. Every reveal lands on the beat times written in the Scene lines. Holds are still — no breathing, no drift.
- **Rhythm.** F1 reveal → F2 collision (the peak, on the 6.0s strike) → F3/F4 busy product demos → F5 held breather → F6 resolve and hold.
- **Negative list.** No glow halos, bloom or lens flares; no gradient grounds on the video's own frames (gradients inside the product UI or artwork are fine); no bitcoin-orange coins or ₿ marks; no floating particles or bokeh; no purple-blue "AI" gradients; no drop shadows on the video's own graphics; no emoji glyphs (draw the bolt as SVG); no repeat/yoyo; no Math.random/Date.now. Neither failure mode: slideshow (front-load then freeze) or screensaver (everything floating).
- **Cursor** (F3, F4): the `cursor-arrow` symbol from ui-icons.svg, ~48px, white with a dark outline — same look in both frames.

## Frame 1 — you liked it.

- scene: A giant X heart gets liked, pops pink and its count ticks up — "you liked it." — then it drains grey: "can they buy a coffee / with those likes?"
- voiceover: ""
- duration: 5s
- transition_in: cut
- status: animated
- src: compositions/frames/01-liked.html
- type: hook
- persuasion: Pain validation (negative contrast)
- beat: recognition → deflation
- blueprint: kinetic-type-beats (Adapt)
- focal: assets/ui-icons.svg
- roles: ui-icons = supporting (copy the `x-heart` outline and `x-heart-filled` paths)
- sfx: pop, click-soft
- asset_candidates: assets/ui-icons.svg — X heart outline and filled pink heart paths

On-screen copy (exact): "you liked it." → "can they buy a coffee" / "with those likes?" · like count "12,399" → "12,400".

Adapt: keep the centered beat-triptych law (each beat alone at one fixed center, the last beat holds) and the in-place line swap by instant hard cut; change beat 1 into a non-text payload — X's heart being liked.

Scene 1 (0.0–0.5s): dark register ground (full-bleed clip). Upper center, one unit centered on x540 / y330: X's heart outline (~240px, stroke #71767B) with the like count "12,399" to its right (Inter 700 ~120px, #71767B). Visible from t=0, still.
Scene 2 (0.5–1.0s): on the 0.5s beat the heart is liked: outline swaps to the filled #F91880 heart with X's like pop — scale dips to 0.85 and settles back to 1 on a smooth long-tail (no overshoot), a thin pink ring expands and fades, 6 tiny pink dots burst outward at index-derived angles and fade by 0.9s; the count flips 12,399 → 12,400 by instant digit swap and turns #F91880.
Scene 3 (1.0–2.5s): beneath the unit (center y ~650) "you liked it." slams in word by word on 1.0 / 1.25 / 1.5s — Barlow 900 lowercase cream, ~96px — each word a distinct percussive entrance per the beat-slam recipe (kinetic-beat-slam). Holds.
Scene 4 (2.5–5.0s): hard cut on the 2.5s beat (discrete-text-sequence whole-line swap, no fade): the line becomes "can they buy a coffee" (Barlow 900 lowercase cream, 72px, first line aligned to the same band), and in the same instant the heart drains back to the grey outline and the count returns to grey #71767B (12,400 stays). On 3.0s "with those likes?" settles up beneath it in the same face and color. Hold dead still to the end: the stillness is the deflation.

narrativeRole: open on a gesture every X user makes a hundred times a day, then puncture it — the like feels generous but pays the creator nothing.
keyMessage: a like is free, and worth nothing to the creator.

## Frame 2 — zap it.

- scene: "don't just like it." — the verb cycles like → repost → bookmark — then a giant yellow bolt crashes in, shoves the line off-frame, and the screen flips electric yellow: "zap it."
- voiceover: ""
- duration: 4.75s
- transition_in: cut
- status: animated
- src: compositions/frames/02-zap-it.html
- type: product_intro
- persuasion: Reframe (every lazy engagement verb → the new verb) + pattern interrupt
- beat: tension → excitement
- blueprint: ticker-takeover (Adapt)
- focal: assets/zap-bolt.svg
- roles: zap-bolt = cutout hero (the crashing mark) · ui-icons = supporting (`x-heart`, `x-repost`, `x-bookmark` icons for the cycling slot)
- sfx: click-soft, whoosh-short, impact-bass-1, glitch-2
- asset_candidates: assets/zap-bolt.svg — the exact product bolt; assets/ui-icons.svg — X action icons
- handoff_out: static from 3.2s to 4.0s, exactly — ground full-frame #FFC800 (full-bleed clip) · bolt = zap-bolt path in a 400×400px box centered at (540, 330), fill #0A0A0A, scale 1, rotation 0, opacity 1, velocity 0 · text "zap it." Barlow 900, 210px, letter-spacing −0.04em, line-height 1, #0A0A0A, horizontally centered, vertical center y=640, opacity 1 · kicker "INSTANT BITCOIN TIPS" IBM Plex Mono 600, 30px, letter-spacing 0.14em, rgba(17,17,17,0.75), horizontally centered, vertical center y=800, opacity 1.

On-screen copy (exact): "don't just" / "like it." → "repost it." → "bookmark it." → "zap it." + kicker "INSTANT BITCOIN TIPS".

Adapt: keep the signature collision — the hero crashes in from off-screen and physically shoves the text group aside (reactive-displacement), then lands heavy; change: the lead-in types on fast and smooth, the accent slot is an X verb with its X icon, and the impact flips the register to full yellow.

Scene 1 (0.0–0.5s): dark register. Two centered lines (block center y ~450, Barlow 900 lowercase cream, ~100px, the longest state ≤ 78cqw): line 1 "don't just", line 2 = the accent slot + " it." — the slot shows the X heart icon (outline, cream, cap-height) followed by "like". The block types on by character, fast and smooth (discrete-text-sequence), fully in by 0.4s.
Scene 2 (0.5–2.25s): the slot rolls vertically on the 0.75s and 1.5s beats: heart "like" → repost-arrows "repost" → bookmark "bookmark" (vertical-spring-ticker, 2 steps, footer unused); each verb holds 250ms longer than the original half-second beat.
Scene 3 (2.25–2.95s): the collision — the bolt (zap-bolt, #FFC800, 400px box) crashes in from off-screen top-right on a steep diagonal with a velocity streak that resolves sharp (motion-blur-streak) and strikes at exactly 2.75s (the sound peak). The impact shoves the text block off left-down — pushed, slightly rotated, clipped by the frame edge, never faded. At 2.75s the ground hard-flips to the yellow register (#FFC800) and the bolt's fill flips to ink #0A0A0A; one thin ink ring expands from the impact point and is gone by 3.05s.
Scene 4 (2.95–4.75s): the hero alone. The ink bolt settles into its rest box (400×400 at 540,330) on a heavy long-tail settle, done by 3.25s. On 3.25s "zap it." slams in beneath (one hit, per kinetic-beat-slam); on 3.75s the kicker "INSTANT BITCOIN TIPS" lands. By 3.95s every element sits exactly at the handoff_out values and holds dead still (no jitter) — the next frame starts from this exact picture.

narrativeRole: the promise, landed by beat 2 — every lazy engagement verb is not enough; strike with the new one.
keyMessage: don't just like it — zap it.

## Frame 3 — right on x.

- scene: The giant bolt shrinks into its real home — right after the heart on an X post — then a cursor zaps 1000 sats: Send a Zap → 1000 → Open in wallet → Thank you!
- voiceover: ""
- duration: 7s
- transition_in: cut
- status: animated
- src: compositions/frames/03-on-x.html
- type: feature_showcase
- persuasion: Show-don't-tell proof
- beat: curiosity → satisfaction
- blueprint: cursor-ui-demo (Adapt)
- focal: assets/zap-bolt.svg
- roles: zap-bolt = the product button (hero) · x-post-artwork = supporting (the tweet's image) · x-creator-avatar = supporting · x-logo = supporting (headline mark) · ui-icons = supporting (X action icons, verified badge, cursor)
- sfx: whoosh, click, sparkle, impact-bass-2, ping
- asset_candidates: assets/zap-bolt.svg — product bolt; assets/x-post-artwork.svg — Mira's artwork "last light"; assets/x-creator-avatar.svg — Mira's avatar; assets/x-logo.svg — official X mark (white); assets/ui-icons.svg — X icons, verified badge, cursor
- handoff_in: identical to Frame 2's final picture — ground full-frame #FFC800 · bolt = zap-bolt path in a 400×400px box centered at (540, 330), fill #0A0A0A, scale 1, rotation 0, opacity 1, velocity 0 · "zap it." Barlow 900, 210px, letter-spacing −0.04em, line-height 1, #0A0A0A, horizontally centered, vertical center y=640, opacity 1 · kicker "INSTANT BITCOIN TIPS" IBM Plex Mono 600, 30px, letter-spacing 0.14em, rgba(17,17,17,0.75), horizontally centered, vertical center y=800, opacity 1.

On-screen copy (exact): headline "right on x." · post: "Mira Okafor", "@miradraws · 2h", "Fun fact: There are 11.2 nostr users for each nostr client." · counts 248 · 1.2K · 12.4K · 96K · dialog "Send a Zap", "21", "100", "1000" (each followed by the bolt icon — never the ⚡ emoji), "Copy invoice", "Open in wallet", success "Thank you!" (bolt icon before it) · zap count "1,000".

X surface (dark mode at 2× native so it reads on a phone): full-bleed ground #0A0A0A. Card bg #000000, 2px border #2F3336, radius 32px, x 80–1000, y ~196–880. Avatar 80px circle; name Inter 700 30px #E7E9EA + verified badge 28px + handle Inter 400 30px #71767B on one line; text Inter 400 30px / 40px #E7E9EA (two lines); image = x-post-artwork at content width, 16:9, radius 32px, 1px #2F3336. Action row: icons 38px, stroke #71767B, counts Inter 400 26px #71767B, in X's order with the extension's slot inserted right after the heart: reply 248 · repost 1.2K · heart 12.4K (already liked: filled #F91880, count #F91880) · [zap slot] · views 96K · bookmark · share. Zap slot = the extension's real compact button: transparent round 68px button, bolt 40px #FFC800, hover-tint disc rgba(255,200,0,0.12); after the zap a compact count "1,000" (Inter 500 26px, #FFC800) sits right of the bolt.
Zap dialog (the component's real dark theme at 2×; custom-amount and comment rows omitted for legibility): 800px wide, centered, bg #1a1a1a, radius 20px, padding 40px, backdrop rgba(0,0,0,0.5) over the card. Header "Send a Zap" Inter 700 40px #fff, left; close button 88px circle #333 with "×" #999. Three equal amount buttons 72px tall, radius 12px, bg #262626, 2px border #3a3a3a, Inter 500 28px #fff + bolt icon 26px; the active one bg #7f00ff. QR code 300px white square with black modules and three finder squares (deterministic pattern), 2px #3a3a3a border, radius 16px. "Copy invoice" Inter 500 28px #7f00ff. "Open in wallet" full width, 88px, radius 12px, bg #7f00ff, Inter 600 32px #fff. Success overlay rgba(0,0,0,0.65) over the whole dialog: bolt 56px + "Thank you!" Inter 700 48px #fff, centered.

Adapt: keep the Key_Feature engine — the cursor performs a 3-step workflow the UI answers live, landing locked on the result; change: the camera stays locked (any "zoom" is element scale) and the shot opens by morphing Frame 2's bolt into the button (card-morph-anchor).

Scene 1 (0.0–1.0s): starts exactly at handoff_in. The yellow field (with "zap it." and the kicker printed on it) collapses as a shrinking circle mask toward the zap slot, clipping the text away and revealing the dark X card beneath. The bolt scales from its 400px box to the 40px button icon while travelling to the slot center; its fill crossfades ink → #FFC800 as it crosses onto the dark. The collapsing yellow circle ends as the 68px hover-tint disc behind the bolt at 1.0s (card-morph-anchor). On 0.5s the headline lands above the card, left-aligned at x80, center y ~110: the X logo (48px, white) + "right on x." (Barlow 900 lowercase cream ~80px).
Scene 2 (1.0–2.0s): the cursor enters from bottom-right, glides to the bolt and clicks on the 2.0s beat (cursor-click-ripple: cursor and button co-depress, yellow ripple).
Scene 3 (2.0–2.5s): the backdrop dims the card and the dialog grows out of the bolt's position to center on a smooth settle, "21" active.
Scene 4 (2.5–3.5s): the cursor moves to "1000" and clicks on 3.0s; the purple active state jumps to 1000; the QR materializes (module rows reveal top → bottom, 3.0–3.3s).
Scene 5 (3.5–4.5s): the cursor moves to "Open in wallet" and clicks on 4.0s (the button compresses and recovers).
Scene 6 (4.5–5.5s): success — on 4.5s the overlay fades in with bolt + "Thank you!", and 12 small yellow bolts burst outward from the dialog center at index-derived angles, fading by 5.3s.
Scene 7 (5.5–7.0s): the dialog shrinks back into the zap button (inverse of Scene 3), done by 6.0s, backdrop clears; on 6.0s the count "1,000" counts up from 0 beside the bolt in #FFC800 (6.0–6.6s). The cursor rests. Hold still to the end.

narrativeRole: proof on the first platform — the bolt is a real button that lives right after X's heart, and zapping takes three clicks.
keyMessage: it's right there on X, next to the like.

## Frame 4 — right on youtube.

- scene: Extreme close-up on YouTube's zap pill — click, 2,100 → 3,100 sats with sparks — then one decelerating zoom-out reveals the whole YouTube watch page.
- voiceover: ""
- duration: 6s
- transition_in: push-slide LEFT
- status: animated
- src: compositions/frames/04-on-youtube.html
- type: feature_showcase
- persuasion: Breadth proof (same button, second platform)
- beat: momentum → delight
- blueprint: zoom-out-workspace-reveal (Adapt)
- focal: assets/zap-bolt.svg
- roles: zap-bolt = the product button (hero) · yt-btc-sessions-nostr = supporting (the player frame) · yt-btc-sessions-avatar = supporting · youtube-logo = supporting (headline mark) · ui-icons = supporting (YouTube action icons, cursor)
- sfx: click, sparkle, whoosh-cinematic
- asset_candidates: assets/zap-bolt.svg — product bolt; assets/yt-btc-sessions-nostr.jpg — BTC Sessions video thumbnail (qn-Zp491t4Y); assets/yt-btc-sessions-avatar.jpg — BTC Sessions channel avatar; assets/youtube-logo.svg — official YouTube mark; assets/ui-icons.svg — YouTube icons, cursor

On-screen copy (exact): headline "right on youtube." · title "How To Use NOSTR - A Decentralized" / "Censorship Resistant Social Layer" · "BTC Sessions" · "Subscribe" · pills like/dislike (no count), "2,100" → "3,100", "Share", "Download".

YouTube surface (dark, ~1.4× native): full-bleed ground #0F0F0F. Content column x 90–990. Player 16:9, 900px wide (506px tall), radius 18px, yt-btc-sessions-nostr inside, red progress bar #FF0000 4px along its bottom at ~38% with a 14px red dot. Title Roboto 700 30px / 40px #F1F1F1, two lines. Channel row: avatar 56px, "BTC Sessions" Roboto 500 24px #F1F1F1 (no subscriber count), "Subscribe" pill bg #F1F1F1 / text #0F0F0F Roboto 500 20px, 48px tall. Action row on its own line under the channel row; all pills 48px tall, radius 999, bg rgba(255,255,255,0.1), icons 26px stroke #F1F1F1, labels Roboto 500 20px #F1F1F1: [thumbs-up | thumbs-down] with a 1px rgba(255,255,255,0.2) divider (no like count) · [zap pill = the extension's real YouTube pill, inserted right after like/dislike: bolt 30px #FFC800 + count] · [share "Share"] · [download "Download"] · [more, 48px circle]. Locked layout: headline band y 50–150; player y ~170–676; title ~686–766; channel row ~774–830; action row ~830–878.

Adapt: keep the signature — one continuous decelerating zoom-out from a full-bleed detail to the locked wide, no zoom-in anywhere, element-only motion after the lock; change: the close-up micro-action is a click plus a count-up on the zap pill (Benefits dwell → snap reveal).

Scene 1 (0.0–1.0s): the whole page is authored at final layout inside one world wrapper; the camera starts ~4× on the zap pill so it fills most of the frame and nothing else reads (viewport-change; measure the pill center after fonts load). The cursor glides in and clicks the pill on the 0.5s beat (cursor-click-ripple).
Scene 2 (1.0–2.0s): still in close-up: the count rolls 2,100 → 3,100 (counting-dynamic-scale, 1.0–1.6s) while 10 small yellow sparks fly out of the bolt at index-derived angles and fade by 1.8s; one thin yellow ring pulses once around the pill.
Scene 3 (2.0–3.0s): the reveal — ONE heavily decelerating zoom-out (expo-out) from ~4× to 1×, finished at 3.0s; the watch page appears and the frame LOCKS.
Scene 4 (3.0–6.0s): locked wide, element motion only. The headline lands in the top band, left-aligned at x90: the YouTube logo (56px wide) + "right on youtube." (Barlow 900 lowercase cream ~80px), words on 3.0 / 3.25 / 3.5s. The red progress bar creeps right (linear, ~2% over the rest of the shot); the cursor drifts to rest beside the pill. Hold.

narrativeRole: the same button on the second platform — breadth, delivered as a reveal.
keyMessage: and on YouTube too.

## Frame 5 — real sats.

- scene: The breather: "real sats." then, in yellow, "straight to the creator." with a quiet mono line — peer-to-peer, no platform cut.
- voiceover: ""
- duration: 3.5s
- transition_in: zoom-through
- status: animated
- src: compositions/frames/05-real-sats.html
- type: benefit_highlight
- persuasion: Value framing (direct, uncut value)
- beat: clarity → trust
- blueprint: titlecard-reveal (Adapt)
- focal: typography only
- roles: typography only
- sfx: whoosh-short
- asset_candidates: none — typography-only frame

On-screen copy (exact): "real sats." / "straight to the creator." / "PEER-TO-PEER · NO PLATFORM CUT".

Adapt: keep the calm Benefits shape — one restrained reveal, then a still hold (allocated stillness); change: line 1 stays while line 2 slides up beneath it into a two-line statement (broadside Statement: one clause inked yellow).

Scene 1 (0.0–0.5s): dark register. "real sats." (Barlow 900 lowercase cream, ~140px, left-aligned at x80, center y ~330) fades in, rising slightly with a 95→100% scale settle (scale-swap-transition, restrained in-settle).
Scene 2 (1.0–1.5s): on the 1.0s beat "straight to the creator." slides up into place beneath it in #FFC800 (~110px, two lines "straight to" / "the creator.", left-aligned at x80, top ~430) (discrete-text-sequence slide-up handoff; line 1 holds).
Scene 3 (1.5–3.5s): on 1.5s the kicker lands under the block, left-aligned: a 36×2 #FFC800 rule stub, then "PEER-TO-PEER · NO PLATFORM CUT" (IBM Plex Mono 600 uppercase, +0.14em, ~28px, cream-muted). Hold dead still.

narrativeRole: the value, said plainly after the demos — a zap is real money that goes straight to the person who made the thing.
keyMessage: real sats, straight to the creator.

## Frame 6 — nostr like & zap

- scene: The bolt draws itself and floods yellow; "nostr like & zap" builds beneath; "now zap on" X and YouTube; the GitHub URL types on and holds.
- voiceover: ""
- duration: 4.5s
- transition_in: cut
- status: animated
- src: compositions/frames/06-get-it.html
- type: cta
- persuasion: Risk reversal (free, open source) + one clear next step
- beat: confidence → urgency-to-act
- blueprint: logo-assemble-lockup (Adapt)
- focal: assets/zap-bolt.svg
- roles: zap-bolt = the mark (hero) · x-logo, youtube-logo = supporting (inline platform marks)
- sfx: impact-bass-1, pop
- asset_candidates: assets/zap-bolt.svg — the mark; assets/x-logo.svg — official X mark (white); assets/youtube-logo.svg — official YouTube mark

On-screen copy (exact): "nostr like & zap" · "now zap on" + [X logo] + "and" + [YouTube logo] · "https://nostr-component.web.app/".

Adapt: keep the Brand_Outro build — on a clear stage the mark draws itself stroke by stroke and the wordmark completes the lockup (svg-path-draw); change: the lockup stacks (mark over wordmark) and extends into an availability line plus the URL. This is the final frame: it holds to the last frame.

Scene 1 (0.0–1.0s): dark register, empty. The bolt outline draws on at center (300px box, center y ~290) as a #FFC800 stroke (0.0–0.7s); the fill floods in #FFC800 (0.7–0.9s); on the 1.0s beat it lands with one subtle scale settle 1.04 → 1.
Scene 2 (1.0–2.0s): "nostr like & zap" builds word by word beneath it (center y ~540; Barlow 900 lowercase, ~100px, ≤ 78cqw; "zap" in #FFC800, the rest cream) on 1.0 / 1.2 / 1.4 / 1.6s.
Scene 3 (2.0–3.2s): on 2.0s the availability line fades up (center y ~650): "now zap on" (Barlow 600 lowercase cream ~44px) followed inline by the X logo (40px tall, white), "and", and the YouTube logo (44px wide). On 2.5s the URL types on by character (discrete-text-sequence) below it (center y ~740): "https://nostr-component.web.app/" in IBM Plex Mono 500 ~34px cream-muted, lowercase (a URL is copy, not chrome); typing done by 3.2s.
Scene 4 (3.2–4.5s): the complete lockup holds dead still to the last frame.

narrativeRole: name the product and hand over the one next step — it's free and it's one link away.
keyMessage: now zap on X and YouTube.
