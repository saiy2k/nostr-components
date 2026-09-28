---
version: 1
name: Zap desire — Frame
description: >
  Near-black square field, one gold lightning bolt, tight serif statements.
  The zap pill is the only product object. No pastel, no tutorial chrome.
unit: the frame — 1080×1080
principle: one object · gold is scarce · type stays above the caption band

colors:
  canvas: "#070709"
  ink: "#F6F1E6"
  gold: "#FFC800"
  gold-deep: "#A67C00"
  mist: "#9A9386"
  card: "#14141A"

typography:
  body: { fontFamily: "Montserrat", cqw: 1.6, weight: 400, lineHeight: 1.35 }
  label: { fontFamily: "Montserrat", cqw: 1.5, weight: 700, tracking: "0.16em", upper: true }
  mono: { fontFamily: "JetBrains Mono", cqw: 2.4, weight: 700, lineHeight: 1 }
  headline: { fontFamily: "Playfair Display", cqw: 8.2, weight: 400, lineHeight: 0.92, tracking: "-0.03em" }
  display: { fontFamily: "Playfair Display", cqw: 13, weight: 400, lineHeight: 0.88, tracking: "-0.04em" }

spacing:
  pad: "6cqw"
  gap: "2.4cqw"
  caption-keepout: "bottom 17%"

components:
  pill:
    backgroundColor: "{colors.card}"
    border: "1px solid {colors.gold}"
    rounded: "9999px"
    typography: "{typography.label}"
    description: "Compact zap control. Gold bolt, word Zap, gold hairline. The only button in the film."
  card:
    backgroundColor: "{colors.card}"
    border: "1px solid rgba(255,200,0,0.28)"
    rounded: "28px"
    description: "Designed post or watch surface. No vendor logo."
---

# Zap desire

Luxury product desire for a square feed. The field is `canvas`. Words are `ink`. The bolt and the pill rim are `gold`. Nothing else is gold.

## The Frame

1080×1080. Content lives in the top 83%. The bottom band belongs to captions.

The zap pill is the spine. It starts large, settles beside a like control, stays there while the surface changes from a post to a video, then returns large.

## Composition Rules

- One dominant object per moment.
- Serif (`display` / `headline`) speaks. Sans (`label`) is the button. Mono is the sat count.
- Feed scale: headlines at least 90px, labels at least 28px.
- No X logo, no YouTube logo, no browser chrome, no QR, no install steps.
- No purple glow, no confetti, no extra icons.

## Do

- Keep the bolt path and `#FFC800` fill faithful to the component.
- Press the pill with a short compression, then a gold bloom.
- Hold still after the press.

## Don't

- Do not tour a website.
- Do not explain signers.
- Do not put type in the caption band.
