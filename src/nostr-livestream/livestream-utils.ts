// SPDX-License-Identifier: MIT

import { NDKEvent } from '@nostr-dev-kit/ndk';
import { getTagValue, getTagValues, parseTimestamp, parseNumber } from '../common/utils';

export interface ParsedLivestreamEvent {
  dTag: string;
  title?: string;
  summary?: string;
  image?: string;
  streamingUrl?: string;
  recordingUrl?: string;
  starts?: number; // Unix timestamp in seconds
  ends?: number; // Unix timestamp in seconds
  status: LivestreamStatus;
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
 * Valid livestream status values
 */
export type LivestreamStatus = 'planned' | 'live' | 'ended';

/**
 * Validate and normalize a livestream status value
 * @param statusValue Raw status value from event tag
 * @returns Valid status or 'planned' as default
 */
export function validateStatus(statusValue: string | undefined): LivestreamStatus {
  if (statusValue === 'planned' || statusValue === 'live' || statusValue === 'ended') {
    return statusValue;
  }
  // Invalid or missing status value, default to 'planned'
  return 'planned';
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
  const status = validateStatus(statusValue);

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
    status,
    currentParticipants,
    totalParticipants,
    participants,
    relays: relays.length > 0 ? relays : undefined,
    hashtags: hashtags.length > 0 ? hashtags : [],
  };
}

/**
 * Find the host participant from a parsed livestream event
 * @param parsedLivestream Parsed livestream event
 * @returns Host participant or undefined if not found
 */
export function findHostParticipant(parsedLivestream: ParsedLivestreamEvent): Participant | undefined {
  return parsedLivestream.participants.find(
    p => p.role && p.role.toLowerCase() === 'host'
  );
}

/**
 * Extract unique participant pubkeys from a parsed livestream event
 * @param parsedLivestream Parsed livestream event
 * @returns Array of unique participant pubkeys
 */
export function getUniqueParticipantPubkeys(parsedLivestream: ParsedLivestreamEvent): string[] {
  const participantPubkeys = parsedLivestream.participants.map(p => p.pubkey);
  return [...new Set(participantPubkeys)];
}

/**
 * Check if video should be loading based on livestream status and streaming URL
 * @param parsedLivestream Parsed livestream event
 * @returns true if video should be loading (status is 'live' and streamingUrl exists)
 */
export function shouldVideoBeLoading(parsedLivestream: ParsedLivestreamEvent | null): boolean {
  return parsedLivestream?.status === 'live' && !!parsedLivestream?.streamingUrl;
}

// MediaError code constants (from MDN)
const MEDIA_ERR_ABORTED = 1;
const MEDIA_ERR_NETWORK = 2;
const MEDIA_ERR_DECODE = 3;
const MEDIA_ERR_SRC_NOT_SUPPORTED = 4;

/**
 * Get a user-friendly error message from a MediaError
 * @param error MediaError object or null/undefined
 * @returns User-friendly error message string
 */
export function getVideoErrorMessage(error: MediaError | null | undefined): string {
  if (!error) {
    return 'Video failed to load';
  }

  switch (error.code) {
    case MEDIA_ERR_ABORTED:
      return 'Video loading aborted';
    case MEDIA_ERR_NETWORK:
      return 'Network error while loading video';
    case MEDIA_ERR_DECODE:
      return 'Video decode error';
    case MEDIA_ERR_SRC_NOT_SUPPORTED:
      return 'Video format not supported';
    default:
      return 'Video failed to load';
  }
}
