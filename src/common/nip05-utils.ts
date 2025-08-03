/**
 * NIP-05 utility functions for resolving nostr identifiers
 */

/**
 * Resolves a NIP-05 identifier to a nostr public key
 * Includes input validation and request timeout for security
 * 
 * @param nip05 - NIP-05 identifier in format username@domain.com
 * @param timeoutMs - Timeout in milliseconds (default: 5000)
 * @returns Resolved public key
 * @throws Error if validation fails, timeout occurs, or resolution fails
 */
export async function resolveNip05(nip05: string, timeoutMs: number = 5000): Promise<string> {
  // Validate NIP-05 format (contains exactly one @ with valid characters)
  const nip05Regex = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;
  if (!nip05Regex.test(nip05)) {
    throw new Error("Invalid NIP-05 format");
  }

  const [name, domain] = nip05.split("@");
  if (!name || !domain) {
    throw new Error("Invalid NIP-05: missing name or domain");
  }

  const url = `https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(name)}`;
  
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
    const pubkey = json.names?.[name];
    
    if (!pubkey) {
      throw new Error("NIP-05 not found");
    }
    
    return pubkey as string;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error("NIP-05 resolution timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
