// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest';
import { formatEventDate } from '../date-utils';

describe('formatEventDate', () => {
  it('formats a valid Unix timestamp in seconds', () => {
    // 2024-01-15 12:00:00 UTC
    const timestamp = 1705320000;
    const expected = new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    expect(formatEventDate(timestamp)).toBe(expected);
  });

  it('returns empty string when timestamp is undefined', () => {
    expect(formatEventDate(undefined)).toBe('');
    expect(formatEventDate()).toBe('');
  });

  it('returns empty string when timestamp is null', () => {
    expect(formatEventDate(null)).toBe('');
  });

  it('returns empty string when timestamp is 0', () => {
    expect(formatEventDate(0)).toBe('');
  });

  it('returns empty string when timestamp is negative', () => {
    expect(formatEventDate(-1)).toBe('');
    expect(formatEventDate(-1705320000)).toBe('');
  });

  it('returns empty string when timestamp is NaN', () => {
    expect(formatEventDate(NaN)).toBe('');
  });

  it('returns empty string when timestamp is infinite', () => {
    expect(formatEventDate(Infinity)).toBe('');
    expect(formatEventDate(-Infinity)).toBe('');
  });

  it('returns empty string when timestamp is out of range for valid dates', () => {
    expect(formatEventDate(1e20)).toBe('');
  });

  it('returns empty string when input is not a number at runtime', () => {
    // @ts-expect-error testing invalid runtime argument
    expect(formatEventDate('1705320000')).toBe('');
    // @ts-expect-error testing invalid runtime argument
    expect(formatEventDate({})).toBe('');
    // @ts-expect-error testing invalid runtime argument
    expect(formatEventDate([])).toBe('');
  });
});
