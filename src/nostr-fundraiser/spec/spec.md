# Nostr Fundraiser Component Specification

## Overview

- Component: `nostr-fundraiser`
- Purpose: Render NIP-75 fundraising goals and let users support them with zaps
- Architecture: Extends `NostrEventComponent`
- NIP: NIP-75 Zap Goals (`kind: 9041`)

## What The Component Shows

- Banner image from the `image` tag when available
- Fundraiser title
- Fundraiser description
- Goal amount and progress bar
- Raised amount and donor count
- Donor list in a modal
- Zap CTA that zaps the fundraiser event itself

## Event Mapping

- `kind` must be `9041`
- `amount` tag is required and stored in millisats
- `relays` tag is required and used for tallying goal zaps
- `summary` is used as a compact title fallback when no explicit `title` tag exists
- `content` is treated as the long-form fundraiser copy
- `closed_at` marks the fundraiser as closed and caps tallying
- `r` is rendered as an optional “Learn more” link
- `zap` tags are forwarded into the zap request so beneficiary splits can travel with the fundraiser

## Attributes

- `hex` / `noteid` / `eventid`: fundraiser event identifier
- `text`: optional zap button label
- `data-theme`: `light` or `dark`
- `relays`: optional relay override / supplement

## Behaviour

- Progress is computed from zap receipts (`kind: 9735`) filtered by the fundraiser event id (`#e`)
- The zap button opens the existing invoice modal, but targets the fundraiser event instead of a profile-only zap
- Donors reuse the existing zappers dialog with a fundraiser-specific header
- Relay hints from the goal event are merged with component relay hints for fetches
