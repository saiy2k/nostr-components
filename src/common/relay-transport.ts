// SPDX-License-Identifier: MIT

export interface NostrRelayHttpGetResult {
  status: number;
  json: any;
}

export interface NostrRelayZapProvider {
  lnurl: string;
  callback: string;
  nostrPubkey: string;
}

export interface NostrRelayTransport {
  query(
    relays: string[],
    filter: Record<string, unknown>,
    actionId?: string,
  ): Promise<any[]>;
  getCachedLikeState?(
    relays: string[],
    url: string,
  ): Promise<{
    found: boolean;
    isLiked: boolean;
  }>;
  getLikeState?(
    relays: string[],
    url: string,
  ): Promise<{
    totalCount: number;
    likedCount: number;
    dislikedCount: number;
    /** Null when the viewer lookup failed and the host will not guess. */
    isLiked: boolean | null;
    /** Directory lastActivityAt. Null when the row has no timestamp. */
    activityAt?: number | null;
  }>;
  publish(
    relays: string[],
    event: any,
    actionId?: string,
  ): Promise<void>;
  getZapProvider?(
    actionId: string,
    relays: string[],
  ): Promise<NostrRelayZapProvider>;
  fetchZapInvoice?(
    actionId: string,
    request: {
      relays: string[];
      amount: number;
      comment: string;
      zapEvent: any;
    },
  ): Promise<{
    invoice: string;
    provider: NostrRelayZapProvider;
  }>;
  /** Host-proxied HTTPS GET for LNURL/invoice JSON when page CSP blocks fetch. */
  httpGet?(url: string): Promise<NostrRelayHttpGetResult>;
  /** Signed kind 0 and kind 10002 events. Absent on transports that still query relays. */
  getProfiles?(actionId: string, pubkeys: string[]): Promise<unknown[]>;
  getZapRoute?(
    actionId: string,
  ): Promise<{
    provider: NostrRelayZapProvider;
    zapRelays: string[];
  }>;
  getZapSummary?(
    actionId: string,
  ): Promise<{
    totalAmount: number;
    zapDetails: Array<{
      amount: number;
      date: Date;
      authorPubkey: string | null;
      comment?: string;
    }>;
  }>;
  listZaps?(
    actionId: string,
  ): Promise<
    Array<{
      amount: number;
      date: Date;
      authorPubkey: string | null;
      comment?: string;
    }>
  >;
}

let installedRelayTransport: NostrRelayTransport | null = null;

/**
 * Install a transport into this bundle's private module scope.
 *
 * The browser extension uses this path so page code cannot discover or invoke
 * its relay and cross-origin HTTP capability through `globalThis`.
 */
export function installRelayTransport(
  transport: NostrRelayTransport,
): void {
  if (installedRelayTransport) {
    throw new Error('Relay transport is already installed');
  }
  if (
    !transport ||
    typeof transport.query !== 'function' ||
    typeof transport.publish !== 'function'
  ) {
    throw new Error('Invalid relay transport');
  }
  installedRelayTransport = transport;
}

export function hasInstalledRelayTransport(): boolean {
  return installedRelayTransport !== null;
}

/** Optional host transport used when page CSP prevents direct relay sockets. */
export function getRelayTransport(): NostrRelayTransport | null {
  if (installedRelayTransport) return installedRelayTransport;

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

const ZAP_HTTP_TIMEOUT_MS = 10_000;

/** JSON GET that uses the host bridge when the page cannot reach Lightning HTTP. */
export async function httpGetJson(url: string): Promise<NostrRelayHttpGetResult> {
  const transport = getRelayTransport();
  if (typeof transport?.httpGet === 'function') {
    return transport.httpGet(url);
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(ZAP_HTTP_TIMEOUT_MS),
  });
  let json: any = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }
  return { status: response.status, json };
}
