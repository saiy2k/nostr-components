// SPDX-License-Identifier: MIT

import { NDKEvent } from '@nostr-dev-kit/ndk';
import { SimplePool } from 'nostr-tools';
import { MILLISATS_PER_SAT } from '../common/constants';
import {
  escapeHtml,
  getTagValue,
  getTagValues,
  isValidHex,
  parseNumber,
  parseTimestamp,
} from '../common/utils';
import type { ZapDetails } from '../nostr-zap-button/zap-utils';

export interface ParsedFundraiserEvent {
  content: string;
  title: string;
  description?: string;
  summary?: string;
  image?: string;
  targetAmountMsats: number;
  targetAmountSats: number;
  relays: string[];
  closedAt?: number;
  resourceUrl?: string;
  resourceEventAddress?: string;
  beneficiaryZapTags: string[][];
}

export interface FundraiserProgressResult {
  totalRaised: number;
  donorCount: number;
  percentRaised: number;
  remainingAmount: number;
  isClosed: boolean;
  zapDetails: ZapDetails[];
}

const RECEIPT_PAGE_SIZE = 1000;

function sanitizeZapComment(comment: unknown): string | undefined {
  if (typeof comment !== 'string') {
    return undefined;
  }

  const normalizedComment = comment
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();

  return normalizedComment ? escapeHtml(normalizedComment) : undefined;
}

function normalizeZapAuthorPubkey(pubkey: unknown): string {
  return typeof pubkey === 'string' && isValidHex(pubkey)
    ? pubkey.toLowerCase()
    : '';
}

function deriveFundraiserTitle(content: string, summary?: string, titleTag?: string): string {
  return (titleTag || summary || content || 'Untitled fundraiser').trim();
}

function deriveFundraiserDescription(
  content: string,
  summary?: string,
  titleTag?: string
): string | undefined {
  if (titleTag) {
    return (content || summary || '').trim() || undefined;
  }

  if (summary) {
    return content && content.trim() !== summary.trim() ? content.trim() : undefined;
  }

  return undefined;
}

export function mergeRelayLists(...relayLists: Array<string[] | undefined>): string[] {
  return Array.from(
    new Set(
      relayLists
        .flatMap(list => list || [])
        .map(relay => relay.trim())
        .filter(Boolean)
    )
  );
}

export function parseFundraiserEvent(event: NDKEvent): ParsedFundraiserEvent {
  if (event.kind !== 9041) {
    throw new Error(`Expected kind 9041 fundraiser event, received kind ${event.kind}`);
  }

  const tags = event.tags || [];
  const amountMsats = parseNumber(getTagValue(tags, 'amount'));
  const relays = getTagValues(tags, 'relays').filter(Boolean);

  if (!amountMsats || amountMsats <= 0) {
    throw new Error("Missing required 'amount' tag in fundraiser event");
  }

  if (relays.length === 0) {
    throw new Error("Missing required 'relays' tag in fundraiser event");
  }

  const content = (event.content || '').trim();
  const summary = getTagValue(tags, 'summary')?.trim();
  const titleTag = getTagValue(tags, 'title')?.trim();
  const title = deriveFundraiserTitle(content, summary, titleTag);
  const description = deriveFundraiserDescription(content, summary, titleTag);

  return {
    content,
    title,
    description,
    summary,
    image: getTagValue(tags, 'image'),
    targetAmountMsats: amountMsats,
    targetAmountSats: amountMsats / MILLISATS_PER_SAT,
    relays,
    closedAt: parseTimestamp(getTagValue(tags, 'closed_at')),
    resourceUrl: getTagValue(tags, 'r'),
    resourceEventAddress: getTagValue(tags, 'a'),
    beneficiaryZapTags: tags
      .filter(tag => tag[0] === 'zap' && tag[1])
      .map(tag => [...tag]),
  };
}

export async function fetchFundraiserProgress({
  eventId,
  relays,
  targetAmountMsats,
  closedAt,
}: {
  eventId: string;
  relays: string[];
  targetAmountMsats: number;
  closedAt?: number;
}): Promise<FundraiserProgressResult> {
  const pool = new SimplePool();
  let totalRaisedMsats = 0;
  const zapDetails: ZapDetails[] = [];
  const seenReceiptIds = new Set<string>();
  let cursorUntil = closedAt;

  try {
    while (true) {
      const filter: any = {
        kinds: [9735],
        '#e': [eventId],
        limit: RECEIPT_PAGE_SIZE,
      };

      if (typeof cursorUntil === 'number') {
        filter.until = cursorUntil;
      }

      const events = await pool.querySync(relays, filter);
      const freshEvents = events.filter(event => {
        if (!event.id || seenReceiptIds.has(event.id)) {
          return false;
        }

        seenReceiptIds.add(event.id);
        return true;
      });

      for (const event of freshEvents) {
        const descriptionTag = event.tags?.find((tag: string[]) => tag[0] === 'description');
        if (!descriptionTag?.[1]) continue;

        try {
          const zapRequest = JSON.parse(descriptionTag[1]);
          const amountTag = zapRequest?.tags?.find((tag: string[]) => tag[0] === 'amount');
          const amountMsats = amountTag?.[1] ? parseInt(amountTag[1], 10) : 0;
          if (!amountMsats || amountMsats <= 0) continue;

          totalRaisedMsats += amountMsats;
          zapDetails.push({
            amount: amountMsats / MILLISATS_PER_SAT,
            date: new Date(event.created_at * 1000),
            authorPubkey: normalizeZapAuthorPubkey(zapRequest?.pubkey),
            comment: sanitizeZapComment(zapRequest?.content),
          });
        } catch (error) {
          console.error('Nostr-Components: Fundraiser: Failed to parse zap receipt', error);
        }
      }

      if (events.length < RECEIPT_PAGE_SIZE) {
        break;
      }

      const oldestCreatedAt = events.reduce((oldest, event) => (
        typeof event.created_at === 'number' && event.created_at < oldest
          ? event.created_at
          : oldest
      ), Number.POSITIVE_INFINITY);

      if (!Number.isFinite(oldestCreatedAt)) {
        break;
      }

      const nextCursorUntil = oldestCreatedAt - 1;
      if (nextCursorUntil < 0 || nextCursorUntil === cursorUntil) {
        break;
      }

      cursorUntil = nextCursorUntil;
    }
  } finally {
    pool.close(relays);
  }

  zapDetails.sort((a, b) => b.date.getTime() - a.date.getTime());

  const totalRaised = totalRaisedMsats / MILLISATS_PER_SAT;
  const donorCount = new Set(
    zapDetails
      .map(zap => zap.authorPubkey)
      .filter(Boolean)
  ).size;
  const percentRaised = targetAmountMsats > 0
    ? (totalRaisedMsats / targetAmountMsats) * 100
    : 0;
  const remainingAmount = Math.max(0, (targetAmountMsats - totalRaisedMsats) / MILLISATS_PER_SAT);

  return {
    totalRaised,
    donorCount,
    percentRaised,
    remainingAmount,
    isClosed: !!closedAt && closedAt <= Math.floor(Date.now() / 1000),
    zapDetails,
  };
}
