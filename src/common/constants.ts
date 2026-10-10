// SPDX-License-Identifier: MIT

import relayRoles from '../../backend/relay-roles.json';

const roles = relayRoles as {
  rendezvous: readonly string[];
  indexers: readonly string[];
  profileArchives: readonly string[];
};

/** Relays clients write likes and zap receipts to. */
export const RENDEZVOUS_RELAYS: string[] = [...roles.rendezvous];

/** Kind 10002 indexers, queried in parallel. */
export const INDEXER_RELAYS: string[] = [...roles.indexers];

/** Kind 0 archives used when a pubkey's own relays are not enough. */
export const PROFILE_ARCHIVE_RELAYS: string[] = [...roles.profileArchives];

/** Public directory API that stores signed kind 0 profiles. */
export const DIRECTORY_API_ORIGIN =
  'https://us-central1-nostr-components.cloudfunctions.net';

export const DEFAULT_RELAYS = [
  'wss://relay.momostr.pink',
  'wss://relay.ditto.pub',
  'wss://relay.primal.net',
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://nostr.mom',
  'wss://nostr.twinkle.lol',
  'wss://nostr.wine',
  'wss://nostr.bitcoiner.social',
  'wss://relay.nostr.band',
  'wss://relay.snort.social',
  'wss://nostr.data.haus',
  'wss://purplepag.es',
  'wss://nostr.oxtr.dev',
  'wss://relay.0xchat.com',
  'wss://nostr.land',
  'wss://relay.us.whitenoise.chat',
  'wss://relay.eu.whitenoise.chat',
  'wss://relay.divine.video',
  'wss://offchain.pub',
  'wss://nostrelites.org',
  'wss://relay.nostr.wirednet.jp',
  'wss://relayable.org',
  'wss://shu01.shugur.net',
  'wss://www.nostr.ltd',
  'wss://nostr.rocks',
  'wss://relay.nostr.pub',
  'wss://cache1.primal.net',
  'wss://nostr-01.yakihonne.com',
  'wss://wot.nostr.net',
  'wss://relay.nyves.nl',
  'wss://relay.fountain.fm',
  'wss://relay.mostr.pub',
  'wss://nostr.lol',
  'wss://eden.nostr.land',
  'wss://wot.utxo.one',
  'wss://relay.current.fyi',
  'wss://relay.nmail.li',
  'wss://fanfares.nostr1.com',
  'wss://pyramid.fiatjaf.com',
  'wss://wot.nostr.party',
  'wss://relay.mostro.network',
  'wss://yabu.me',
  'wss://nostr-02.yakihonne.com',
  'wss://nostr-pub.wellorder.net',
  'wss://relay.nostr.net',
  'wss://nostr.einundzwanzig.space',
  'wss://relay.f7z.io',
  'wss://relay.wisp.talk',
  'wss://relay.wavlake.com',
] as const;

export const MILLISATS_PER_SAT = 1000;

export const NPUB_LENGTH = 63;

export const DEFAULT_PROFILE_IMAGE = './assets/default_dp.png';
