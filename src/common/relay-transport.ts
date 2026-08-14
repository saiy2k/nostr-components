// SPDX-License-Identifier: MIT

export interface NostrRelayTransport {
  query(relays: string[], filter: Record<string, unknown>): Promise<any[]>;
  publish(relays: string[], event: any): Promise<void>;
}

/** Optional host transport used when page CSP prevents direct relay sockets. */
export function getRelayTransport(): NostrRelayTransport | null {
  const transport = (
    globalThis as typeof globalThis & {
      __nostrComponentsRelayTransport?: Partial<NostrRelayTransport>;
    }
  ).__nostrComponentsRelayTransport;

  if (
    !transport ||
    typeof transport.query !== 'function' ||
    typeof transport.publish !== 'function'
  ) {
    return null;
  }
  return transport as NostrRelayTransport;
}
