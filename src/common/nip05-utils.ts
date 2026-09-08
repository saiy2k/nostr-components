// SPDX-License-Identifier: MIT

/**
 * NIP-05 utility functions for resolving nostr identifiers
 */

const NIP05_REGEX = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;
const HEX_PUBKEY_REGEX = /^[0-9a-fA-F]{64}$/;

/**
 * Resolves a NIP-05 identifier to a nostr public key.
 * Includes format validation, identifier lowercasing per spec, safe prototype lookup,
 * 64-character hex format verification, and request timeout.
 * 
 * @param nip05 - NIP-05 identifier in format username@domain.com
 * @param timeoutMs - Timeout in milliseconds (default: 5000)
 * @returns Resolved 64-character lowercase hexadecimal public key
 * @throws Error if validation fails, timeout occurs, or resolution fails
 */
export async function resolveNip05(nip05: string, timeoutMs: number = 5000): Promise<string> {
  if (!nip05 || typeof nip05 !== "string" || !NIP05_REGEX.test(nip05)) {
    throw new Error("Invalid NIP-05 format");
  }

  const [name, domain] = nip05.split("@");
  if (!name || !domain) {
    throw new Error("Invalid NIP-05: missing name or domain");
  }

  const localName = name.toLowerCase();
  const normalizedDomain = domain.toLowerCase();

  const url = `https://${normalizedDomain}/.well-known/nostr.json?name=${encodeURIComponent(localName)}`;
  
  // Set up AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const res = await fetch(url, { 
      headers: { accept: "application/json" },
      signal: controller.signal
    });
    
    if (!res.ok) {
      throw new Error("Unable to resolve NIP-05");
    }
    
    const json = await res.json();
    if (!json || typeof json !== "object" || !json.names || typeof json.names !== "object") {
      throw new Error("NIP-05 not found");
    }

    let pubkey: unknown = undefined;
    if (Object.prototype.hasOwnProperty.call(json.names, localName)) {
      pubkey = json.names[localName];
    } else if (Object.prototype.hasOwnProperty.call(json.names, name)) {
      pubkey = json.names[name];
    }
    
    if (!pubkey) {
      throw new Error("NIP-05 not found");
    }

    if (typeof pubkey !== "string" || !HEX_PUBKEY_REGEX.test(pubkey.trim())) {
      throw new Error("Invalid NIP-05 public key format");
    }
    
    return pubkey.trim().toLowerCase();
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("NIP-05 resolution timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
