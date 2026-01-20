// SPDX-License-Identifier: MIT

import { NDKEvent } from '@nostr-dev-kit/ndk';

export interface ParsedLivestreamEvent {
  dTag: string;
  title?: string;
  summary?: string;
  image?: string;
  streamingUrl?: string;
  recordingUrl?: string;
  starts?: number; // Unix timestamp in seconds
  ends?: number; // Unix timestamp in seconds
  status?: 'planned' | 'live' | 'ended';
  currentParticipants?: number;
  totalParticipants?: number;
  participants: Participant[];
  relays?: string[];
  hashtags: string[];
}

export interface Participant {
  pubkey: string;
  relay?: string;
  role?: string; // "Host", "Speaker", "Participant"
  proof?: string; // Hex-encoded signature proof
}

/**
 * Get the first value of a tag by tag name
 * @param tags Array of tag arrays from NDKEvent
 * @param tagName The tag name to search for (e.g., 'd', 'title')
 * @param index Index of the tag occurrence (0 for first)
 * @returns The tag value or undefined if not found
 */
function getTagValue(tags: string[][], tagName: string, index: number = 0): string | undefined {
  const matchingTags = tags.filter(tag => tag[0] === tagName);
  if (matchingTags.length > index && matchingTags[index].length > 1) {
    return matchingTags[index][1];
  }
  return undefined;
}

/**
 * Get all values for a tag by tag name
 * @param tags Array of tag arrays from NDKEvent
 * @param tagName The tag name to search for (e.g., 't', 'relays')
 * @returns Array of all values for the tag (excluding the tag name itself)
 */
function getTagValues(tags: string[][], tagName: string): string[] {
  return tags
    .filter(tag => tag[0] === tagName)
    .map(tag => tag.slice(1)) // Get all values after tag name
    .flat();
}

/**
 * Parse a timestamp string to a number
 * @param value String value to parse
 * @returns Unix timestamp as number, or undefined if invalid
 */
function parseTimestamp(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Parse a number string to a number
 * @param value String value to parse
 * @returns Number or undefined if invalid
 */
function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Parse a kind:30311 livestream event into a structured ParsedLivestreamEvent object
 * @param event NDKEvent of kind 30311
 * @returns ParsedLivestreamEvent with all extracted data
 * @throws Error if required 'd' tag is missing
 */
export function parseLivestreamEvent(event: NDKEvent): ParsedLivestreamEvent {
  const tags = event.tags || [];

  // Extract 'd' tag (required)
  const dTag = getTagValue(tags, 'd');
  if (!dTag) {
    throw new Error("Missing required 'd' tag in livestream event");
  }

  // Extract optional single-value tags
  const title = getTagValue(tags, 'title');
  const summary = getTagValue(tags, 'summary');
  const image = getTagValue(tags, 'image');
  const streamingUrl = getTagValue(tags, 'streaming');
  const recordingUrl = getTagValue(tags, 'recording');

  // Parse timestamp tags
  const starts = parseTimestamp(getTagValue(tags, 'starts'));
  const ends = parseTimestamp(getTagValue(tags, 'ends'));

  // Extract and validate status tag
  const statusValue = getTagValue(tags, 'status');
  let status: 'planned' | 'live' | 'ended' | undefined;
  if (statusValue === 'planned' || statusValue === 'live' || statusValue === 'ended') {
    status = statusValue;
  } else if (statusValue) {
    // Invalid status value, default to 'planned'
    status = 'planned';
  }

  // Parse participant count tags
  const currentParticipants = parseNumber(getTagValue(tags, 'current_participants'));
  const totalParticipants = parseNumber(getTagValue(tags, 'total_participants'));

  // Extract all 'p' tags and map to Participant objects
  const participants: Participant[] = [];
  const pTags = tags.filter(tag => tag[0] === 'p');
  for (const pTag of pTags) {
    if (pTag.length < 2 || !pTag[1]) {
      // Skip invalid p tags (must have at least pubkey)
      continue;
    }

    const participant: Participant = {
      pubkey: pTag[1],
    };

    // Optional fields
    if (pTag[2]) {
      participant.relay = pTag[2];
    }
    if (pTag[3]) {
      participant.role = pTag[3];
    }
    if (pTag[4]) {
      participant.proof = pTag[4];
    }

    participants.push(participant);
  }

  // Extract all 'relays' tags (all values)
  const relays = getTagValues(tags, 'relays');

  // Extract all 't' tags (hashtags, all values)
  const hashtags = getTagValues(tags, 't');

  return {
    dTag,
    title,
    summary,
    image,
    streamingUrl,
    recordingUrl,
    starts,
    ends,
    status: status || 'planned', // Default to 'planned' if not specified
    currentParticipants,
    totalParticipants,
    participants,
    relays: relays.length > 0 ? relays : undefined,
    hashtags: hashtags.length > 0 ? hashtags : [],
  };
}
