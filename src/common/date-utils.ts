// SPDX-License-Identifier: MIT

/**
 * Shared date formatting utilities for Nostr components
 */

/**
 * Formats a Unix timestamp to a readable date string
 * @param createdAt Unix timestamp in seconds
 * @returns Formatted date string (e.g., "Jan 15, 2024")
 */
export function formatEventDate(createdAt: number | undefined): string {
  if (createdAt === undefined) return '';
  
  return new Date(createdAt * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
