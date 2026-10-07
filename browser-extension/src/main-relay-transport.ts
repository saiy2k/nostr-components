// SPDX-License-Identifier: MIT

import type { NostrRelayTransport } from '../../src/common/relay-transport';

export const RELAY_BOOTSTRAP_EVENT =
  'nostr-components-relay-bootstrap:v2';

const REQUEST_SOURCE = 'nostr-components-relay-main';
const RESPONSE_SOURCE = 'nostr-components-relay-extension';
const AUTH_CONTEXT = 'nostr-components-relay-v2';
const CHANNEL_PATTERN = /^[0-9a-f]{64}$/;
const REQUEST_ID_PATTERN = /^[0-9a-f]{32}$/;
const MESSAGE_MAC_PATTERN = /^[0-9a-f]{64}$/;

type BridgeWindow = Pick<
  Window,
  'addEventListener' | 'location' | 'postMessage'
>;

interface MainRelayTransportOptions {
  crypto?: Crypto;
  pageWindow?: BridgeWindow;
  structuredClone?: typeof globalThis.structuredClone;
}

interface PendingRequest {
  operation: string;
  requestMac: string;
  timeoutId: ReturnType<typeof setTimeout>;
  resolve: (value: any) => void;
  reject: (reason: Error) => void;
}

/**
 * Create the MAIN-world half of the relay bridge.
 *
 * This module is loaded as a static `document_start` content script. Capture
 * every security-sensitive browser intrinsic before page JavaScript runs and
 * keep the returned capability inside the component bundle's lexical scope.
 */
export function createMainRelayTransport(
  channel: string,
  options: MainRelayTransportOptions = {},
): NostrRelayTransport {
  if (!CHANNEL_PATTERN.test(String(channel || ''))) {
    throw new Error('Invalid relay bridge channel');
  }

  const cryptoImpl = options.crypto || globalThis.crypto;
  const pageWindow = options.pageWindow || globalThis.window;
  const cloneImpl =
    options.structuredClone || globalThis.structuredClone?.bind(globalThis);
  if (!cryptoImpl?.subtle || !pageWindow || typeof cloneImpl !== 'function') {
    throw new Error('Secure relay bridge primitives are unavailable');
  }

  const subtle = cryptoImpl.subtle;
  const importKey = subtle.importKey.bind(subtle);
  const sign = subtle.sign.bind(subtle);
  const verify = subtle.verify.bind(subtle);
  const getRandomValues = cryptoImpl.getRandomValues.bind(cryptoImpl);
  const cloneValue = cloneImpl;
  const encoder = new TextEncoder();
  const encode = encoder.encode.bind(encoder);
  const parseHex = Number.parseInt.bind(Number);
  const stringifyPrimitive = JSON.stringify.bind(JSON);
  const sliceString = Function.call.bind(String.prototype.slice) as (
    value: string,
    start: number,
    end: number,
  ) => string;
  const objectKeys = Object.keys.bind(Object);
  const hasOwn = Object.hasOwn.bind(Object);
  const arrayIsArray = Array.isArray.bind(Array);
  const testPattern = Function.call.bind(RegExp.prototype.test) as (
    pattern: RegExp,
    value: string,
  ) => boolean;
  const sortArray = Function.call.bind(Array.prototype.sort) as (
    value: string[],
  ) => string[];
  const pushArray = Function.call.bind(Array.prototype.push) as (
    value: any[],
    item: any,
  ) => number;
  const joinArray = Function.call.bind(Array.prototype.join) as (
    value: any[],
    separator: string,
  ) => string;
  const scheduleTimeout = globalThis.setTimeout.bind(globalThis);
  const cancelTimeout = globalThis.clearTimeout.bind(globalThis);
  const postMessage = pageWindow.postMessage.bind(pageWindow);
  const addEventListener = pageWindow.addEventListener.bind(pageWindow);
  const StringConstructor = String;
  const Uint8ArrayConstructor = Uint8Array;
  const PromiseConstructor = Promise;
  const ErrorConstructor = Error;
  const DateConstructor = Date;
  const pending = new Map<string, PendingRequest>();
  const pendingHas = pending.has.bind(pending);
  const pendingGet = pending.get.bind(pending);
  const pendingSet = pending.set.bind(pending);
  const pendingDelete = pending.delete.bind(pending);
  const pageOrigin = pageWindow.location.origin;

  function isRecord(value: unknown): value is Record<string, any> {
    return (
      Boolean(value) &&
      typeof value === 'object' &&
      !arrayIsArray(value)
    );
  }

  function canonicalJson(value: any): string {
    if (value === null) return 'null';
    if (typeof value === 'string' || typeof value === 'number') {
      const serialized = stringifyPrimitive(value);
      if (serialized === undefined) {
        throw new ErrorConstructor('Relay bridge value is not serializable');
      }
      return serialized;
    }
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (arrayIsArray(value)) {
      const items: string[] = [];
      for (let index = 0; index < value.length; index += 1) {
        pushArray(
          items,
          hasOwn(value, index) && value[index] !== undefined
            ? canonicalJson(value[index])
            : 'null',
        );
      }
      return `[${joinArray(items, ',')}]`;
    }
    if (!isRecord(value)) {
      throw new ErrorConstructor('Relay bridge value is not serializable');
    }
    const keys = sortArray(objectKeys(value));
    const entries: string[] = [];
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index];
      if (value[key] === undefined) continue;
      pushArray(
        entries,
        `${stringifyPrimitive(key)}:${canonicalJson(value[key])}`,
      );
    }
    return `{${joinArray(entries, ',')}}`;
  }

  function authPayload(type: 'request' | 'response', message: any): string {
    return canonicalJson(
      type === 'request'
        ? [
            AUTH_CONTEXT,
            'request',
            message.requestId,
            message.operation,
            message.payload,
          ]
        : [
            AUTH_CONTEXT,
            'response',
            message.requestId,
            message.requestMac,
            message.operation,
            message.ok === true,
            message.ok === true ? message.result : null,
            message.ok === true
              ? null
              : StringConstructor(message.error || 'Relay request failed'),
          ],
    );
  }

  function hexToBytes(value: string): Uint8Array {
    const bytes = new Uint8ArrayConstructor(value.length / 2);
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = parseHex(
        sliceString(value, index * 2, index * 2 + 2),
        16,
      );
    }
    return bytes;
  }

  function bytesToHex(value: ArrayBuffer): string {
    const bytes = new Uint8ArrayConstructor(value);
    const digits = '0123456789abcdef';
    let result = '';
    for (let index = 0; index < bytes.length; index += 1) {
      const byte = bytes[index];
      result += digits[byte >>> 4] + digits[byte & 15];
    }
    return result;
  }

  const keyPromise = importKey(
    'raw',
    hexToBytes(channel),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );

  async function signRequest(message: any): Promise<string> {
    const key = await keyPromise;
    return bytesToHex(
      await sign(
        'HMAC',
        key,
        encode(authPayload('request', message)),
      ),
    );
  }

  async function verifyResponse(message: any): Promise<boolean> {
    if (!testPattern(MESSAGE_MAC_PATTERN, StringConstructor(message?.mac || ''))) {
      return false;
    }
    const key = await keyPromise;
    return verify(
      'HMAC',
      key,
      hexToBytes(message.mac),
      encode(authPayload('response', message)),
    );
  }

  function createRequestId(): string {
    const bytes = new Uint8ArrayConstructor(16);
    getRandomValues(bytes);
    const digits = '0123456789abcdef';
    let result = '';
    for (let index = 0; index < bytes.length; index += 1) {
      const byte = bytes[index];
      result += digits[byte >>> 4] + digits[byte & 15];
    }
    return result;
  }

  async function onMessage(event: MessageEvent): Promise<void> {
    if (
      event.source !== pageWindow ||
      event.origin !== pageOrigin
    ) {
      return;
    }

    let message: any;
    try {
      message = cloneValue(event.data);
    } catch {
      return;
    }
    if (
      !isRecord(message) ||
      message.source !== RESPONSE_SOURCE ||
      !testPattern(
        REQUEST_ID_PATTERN,
        StringConstructor(message.requestId || ''),
      ) ||
      !testPattern(
        MESSAGE_MAC_PATTERN,
        StringConstructor(message.requestMac || ''),
      ) ||
      !testPattern(
        MESSAGE_MAC_PATTERN,
        StringConstructor(message.mac || ''),
      ) ||
      typeof message.operation !== 'string' ||
      !pendingHas(message.requestId)
    ) {
      return;
    }

    const request = pendingGet(message.requestId);
    if (
      !request ||
      request.operation !== message.operation ||
      request.requestMac !== message.requestMac
    ) {
      return;
    }

    let authenticated = false;
    try {
      authenticated = await verifyResponse(message);
    } catch {
      return;
    }
    if (
      !authenticated ||
      pendingGet(message.requestId) !== request
    ) {
      return;
    }
    pendingDelete(message.requestId);
    cancelTimeout(request.timeoutId);
    if (message.ok === true) {
      request.resolve(cloneValue(message.result));
    } else {
      request.reject(
        new ErrorConstructor(message.error || 'Relay request failed'),
      );
    }
  }

  function bridgeTimeout(operation: string): number {
    if (operation === 'fetchZapInvoice') return 25_000;
    if (operation === 'getZapRoute') return 20_000;
    if (operation === 'getZapProvider') return 15_000;
    if (operation === 'publish') return 12_000;
    if (operation === 'getProfiles') return 10_000;
    if (
      operation === 'getLikeState' ||
      operation === 'getZapSummary' ||
      operation === 'listZaps'
    ) {
      return 7_000;
    }
    return 4_000;
  }

  function zapRows(rows: any): any[] {
    if (!arrayIsArray(rows)) return [];
    const out: any[] = [];
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      if (!isRecord(row)) continue;
      const createdAt = typeof row.createdAt === 'number' ? row.createdAt : 0;
      pushArray(out, {
        amount: row.amount,
        date: new DateConstructor(createdAt * 1000),
        authorPubkey:
          typeof row.authorPubkey === 'string' && row.authorPubkey
            ? row.authorPubkey
            : null,
        comment: typeof row.comment === 'string' ? row.comment : '',
      });
    }
    return out;
  }

  async function request(operation: string, payload: any): Promise<any> {
    const requestId = createRequestId();
    const message: any = {
      source: REQUEST_SOURCE,
      requestId,
      operation,
      payload: cloneValue(payload),
    };
    message.mac = await signRequest(message);

    return new PromiseConstructor((resolve, reject) => {
      const timeoutId = scheduleTimeout(
        () => {
          pendingDelete(requestId);
          reject(new ErrorConstructor('Relay request timed out'));
        },
        bridgeTimeout(operation),
      );
      pendingSet(requestId, {
        operation,
        resolve,
        reject,
        requestMac: message.mac,
        timeoutId,
      });
      postMessage(message, pageOrigin);
    });
  }

  addEventListener('message', onMessage as EventListener);
  return Object.freeze({
    query: (
      relays: string[],
      filter: Record<string, unknown>,
      actionId?: string,
    ) =>
      request(
        'query',
        actionId
          ? { relays, filter, actionId }
          : { relays, filter },
      ),
    getCachedLikeState: (relays: string[], url: string) =>
      request('getCachedLikeState', { relays, url }),
    getLikeState: (relays: string[], url: string) =>
      request('getLikeState', { relays, url }),
    publish: (relays: string[], event: any, actionId?: string) =>
      request('publish', { relays, event, actionId }),
    getZapProvider: (actionId: string, relays: string[]) =>
      request('getZapProvider', { actionId, relays }),
    getProfiles: (actionId: string, pubkeys: string[]) =>
      request('getProfiles', { actionId, pubkeys }),
    getZapRoute: (actionId: string) =>
      request('getZapRoute', { actionId }),
    getZapSummary: async (actionId: string) => {
      const summary = await request('getZapSummary', { actionId });
      return {
        totalAmount: summary?.totalAmount,
        zapDetails: zapRows(summary?.zapDetails),
      };
    },
    listZaps: async (actionId: string) =>
      zapRows(await request('listZaps', { actionId })),
    fetchZapInvoice: (
      actionId: string,
      input: {
        relays: string[];
        amount: number;
        comment: string;
        zapEvent: any;
      },
    ) =>
      request('fetchZapInvoice', {
        actionId,
        relays: input.relays,
        amount: input.amount,
        comment: input.comment,
        zapEvent: input.zapEvent,
      }),
  });
}

export function createRelayChannels(cryptoImpl: Crypto = globalThis.crypto): {
  relayChannel: string;
  hydrationChannel: string;
} {
  const createChannel = () => {
    const bytes = new Uint8Array(32);
    cryptoImpl.getRandomValues(bytes);
    const digits = '0123456789abcdef';
    let result = '';
    for (let index = 0; index < bytes.length; index += 1) {
      const byte = bytes[index];
      result += digits[byte >>> 4] + digits[byte & 15];
    }
    return result;
  };
  return {
    relayChannel: createChannel(),
    hydrationChannel: createChannel(),
  };
}
