// SPDX-License-Identifier: MIT

/**
 * Shared date formatting utilities for Nostr components
 */

/**
 * Formats a Unix timestamp to a readable date string
 * @param createdAt Unix timestamp in seconds
 * @returns Formatted date string (e.g., "Jan 15, 2024") or empty string if invalid or non-positive
 */
export function formatEventDate(createdAt?: number | null): string {
  if (typeof createdAt !== 'number' || !Number.isFinite(createdAt) || createdAt <= 0) {
    return '';
  }

  const date = new Date(createdAt * 1000);
  if (isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
