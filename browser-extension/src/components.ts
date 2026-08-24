// SPDX-License-Identifier: MIT

import '../../src/nostr-like-button/nostr-like';
import '../../src/nostr-zap-button/nostr-zap';
import { installComponentHydrator } from './component-hydrator';

const HYDRATOR_KEY = '__nostrComponentsMainWorldHydrator';
const transport = (globalThis as any).__nostrComponentsRelayTransport;
const previousHydrator = (globalThis as any)[HYDRATOR_KEY];

if (transport?.__channel) {
  previousHydrator?.dispose?.();
  (globalThis as any)[HYDRATOR_KEY] = installComponentHydrator({
    channel: transport.__channel,
  });
}
