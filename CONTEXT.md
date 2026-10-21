# Nostr Components

Vocabulary for this repo. Glossary only.

## Like and Zap

**Like**:
Approval of a page. The count is each pubkey's newest reaction.

**Unlike**:
Withdrawal of a like.

**Reaction**:
A like or an unlike from one pubkey on one page.

**Zap**:
A Lightning payment to a Nostr user. It may be for one page.

**Zap receipt**:
Confirmation that a zap was paid.

**Signer**:
What the user approves a like or a zap with.

**Canonical URL**:
The page identity a like or a zap uses.

## Directory

**Directory**:
Nostr Atlas's listing of verified creator identities. It connects an account an audience already knows to a Nostr identity.

**Handle**:
The social account a directory record is about.

**Claim**:
A creator's signed request to connect an account to a Nostr identity. Publishing a claim does not by itself mark the account verified.

**Verified**:
X account ownership checked by the projector. A NIP-05 address is profile metadata, not this check.

**Zappable**:
The directory has finished checking that this identity can receive a zap. Unset until that check finishes.

**Active identity**:
The handle's current identity. A pending claim and an obsolete identity are not it.

**Directory HTTP API**:
The HTTP API for the directory and for page activity. Atlas, the extension, and Storybook call it. They do not read Firestore directly.

## Crawler and Pulse

**Crawler**:
The jobs that read relays into the directory and into Web Pulse.

**Backfill**:
The crawler pass over older relay history.

**Frontfill**:
The crawler pass forward from where it last synced.

**Projection**:
The crawler pass that consumes the handle documents backfill and frontfill write.

**Web Pulse**:
Likes and zaps across pages, on Nostr Atlas at `/pulse/`.

**Pulse sweep**:
The crawler job that reads relays for those page likes and zaps.

**Rendezvous relay**:
A relay used for likes and zaps when the page has no host transport.

**Host transport**:
A page-provided path for Like and Zap. On x.com and YouTube the extension may use the directory HTTP API. On any other website, Like and Zap talk only to relays.
