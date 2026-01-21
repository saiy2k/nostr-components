// SPDX-License-Identifier: MIT

import { IRenderOptions } from '../base/render-options';
import { NDKUserProfile } from '@nostr-dev-kit/ndk';
import { ParsedLivestreamEvent } from './livestream-utils';
import { escapeHtml, hexToNpub } from '../common/utils';
import { formatEventDate } from '../common/date-utils';
import { NCStatus } from '../base/base-component/nostr-base-component';

export interface RenderLivestreamOptions extends IRenderOptions {
  author: NDKUserProfile | null;
  parsedLivestream: ParsedLivestreamEvent | null;
  showParticipants: boolean;
  showParticipantCount: boolean;
  autoPlay: boolean;
  participantProfiles: Map<string, any>;
  participantsStatus: NCStatus;
  videoStatus: NCStatus;
}

export function renderLivestream(options: RenderLivestreamOptions): string {
  const {
    isLoading,
    isError,
    errorMessage,
    author,
    parsedLivestream,
    showParticipants,
    showParticipantCount,
    participantProfiles,
    participantsStatus,
    videoStatus,
  } = options;

  // Handle error state
  if (isError) {
    return renderError(errorMessage || 'An error occurred');
  }

  // Handle loading state
  if (isLoading || !parsedLivestream) {
    return renderLoading();
  }

  // Handle ready state - full livestream display
  return `
    <div class="nostr-livestream-container">
      ${renderLivestreamHeader(author, parsedLivestream)}
      ${renderLivestreamMedia(parsedLivestream, options.autoPlay, videoStatus)}
      ${renderLivestreamMetadata(parsedLivestream, showParticipantCount)}
      ${showParticipants ? renderParticipants(parsedLivestream, participantProfiles, participantsStatus) : ''}
    </div>
  `;
}

function renderLivestreamHeader(
  author: NDKUserProfile | null,
  parsedLivestream: ParsedLivestreamEvent
): string {

  const authorImage = author?.picture || author?.image || '';
  const authorName = author?.displayName || author?.name || 'Unknown';
  const authorNip05 = author?.nip05 || '';
  const title = parsedLivestream.title || 'Untitled Livestream';
  const status = parsedLivestream.status || 'planned';
  const statusBadgeClass = `livestream-status-badge livestream-status-${status}`;
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

  return `
    <div class="livestream-header">
      <div class="livestream-title-row">
        <div class="livestream-title">${escapeHtml(title)}</div>
        <div class="livestream-header-right">
          <span class="${statusBadgeClass}">${escapeHtml(statusLabel)}</span>
        </div>
      </div>
      <div class="livestream-author-row">
        <div class="author-picture">
          ${authorImage ? `<img src="${escapeHtml(authorImage)}" alt="${escapeHtml(authorName)}" />` : ''}
        </div>
        <div class="livestream-author-info">
          ${authorName ? `<span class="author-name">${escapeHtml(authorName)}</span>` : ''}
          ${authorNip05 ? `<span class="author-username">${escapeHtml(authorNip05)}</span>` : ''}
        </div>
      </div>
    </div>
  `;
}

function renderLivestreamMedia(
  parsedLivestream: ParsedLivestreamEvent,
  autoPlay: boolean,
  videoStatus: NCStatus
): string {
  const status = parsedLivestream.status || 'planned';
  const streamingUrl = parsedLivestream.streamingUrl;
  const recordingUrl = parsedLivestream.recordingUrl;
  const imageUrl = parsedLivestream.image;

  // If live and has streaming URL, render video player (unless video failed)
  if (status === 'live' && streamingUrl && videoStatus !== NCStatus.Error) {
    return `
      <div class="livestream-media">
        ${renderVideoPlayer(streamingUrl, autoPlay)}
      </div>
    `;
  }

  // If video failed (error status), show preview image as fallback
  if (status === 'live' && streamingUrl && videoStatus === NCStatus.Error) {
    return `
      <div class="livestream-media">
        ${renderPreviewImage(imageUrl)}
      </div>
    `;
  }

  // If ended and has recording URL, show recording link
  if (status === 'ended' && recordingUrl) {
    return `
      <div class="livestream-media">
        ${renderPreviewImage(imageUrl)}
        ${renderRecordingLink(recordingUrl)}
      </div>
    `;
  }

  // Show preview image (planned or no streaming URL)
  return `
    <div class="livestream-media">
      ${renderPreviewImage(imageUrl)}
    </div>
  `;
}

function renderVideoPlayer(url: string, autoPlay: boolean): string {
  // Use <hls-video> custom element (not <video>) for cross-browser HLS support
  const autoplayAttr = autoPlay ? 'autoplay' : '';
  return `
    <hls-video
      class="livestream-video"
      src="${escapeHtml(url)}"
      controls
      ${autoplayAttr}
      preload="metadata"
    ></hls-video>
  `;
}

function renderPreviewImage(imageUrl?: string): string {
  if (imageUrl) {
    return `
      <div class="livestream-preview-image">
        <img src="${escapeHtml(imageUrl)}" alt="Livestream preview" loading="lazy" />
      </div>
    `;
  }

  // Default placeholder
  return `
    <div class="livestream-preview-image livestream-preview-placeholder">
      <div class="livestream-preview-placeholder-icon">📹</div>
      <p>No preview image</p>
    </div>
  `;
}

function renderRecordingLink(url: string): string {
  return `
    <div class="livestream-recording-link">
      <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">
        <span class="recording-icon">▶</span>
        <span>Watch Recording</span>
      </a>
    </div>
  `;
}

function formatParticipantCount(current?: number, total?: number): string {
  if (current !== undefined && total !== undefined) {
    return `${current} / ${total}`;
  }
  if (current !== undefined) {
    return `${current}`;
  }
  return `${total || 0}`;
}

function getParticipantDisplayName(participant: { pubkey: string }, profile: any): string {
  if (profile?.displayName) return profile.displayName;
  if (profile?.name) return profile.name;
  
  // Fallback to shortened npub format
  try {
    const npub = hexToNpub(participant.pubkey);
    return `${npub.slice(0, 8)}...${npub.slice(-8)}`;
  } catch {
    // If hexToNpub fails, use hex format
    return `${participant.pubkey.slice(0, 8)}...${participant.pubkey.slice(-8)}`;
  }
}

function renderParticipantItem(participant: { pubkey: string; role?: string; proof?: string }, participantProfiles: Map<string, any>): string {
  const profile = participantProfiles.get(participant.pubkey);
  const displayName = getParticipantDisplayName(participant, profile);
  const image = profile?.picture || profile?.image || '';
  const role = participant.role || 'Participant';
  const roleClass = `participant-role participant-role-${role.toLowerCase()}`;

  return `
    <div class="participant-item">
      <div class="participant-avatar">
        ${image
          ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(displayName)}" loading="lazy" />`
          : '<div class="participant-avatar-placeholder"></div>'
        }
      </div>
      <div class="participant-info">
        <span class="participant-name">${escapeHtml(displayName)}</span>
        <span class="${roleClass}">${escapeHtml(role)}</span>
      </div>
      ${participant.proof ? '<span class="participant-proof" title="Verified">✓</span>' : ''}
    </div>
  `;
}

function renderLivestreamMetadata(
  parsedLivestream: ParsedLivestreamEvent,
  showParticipantCount: boolean
): string {
  const summary = parsedLivestream.summary;
  const hashtags = parsedLivestream.hashtags || [];
  // Use explicit undefined check to preserve 0 as a valid value
  const currentParticipants = parsedLivestream.currentParticipants !== undefined 
    ? parsedLivestream.currentParticipants 
    : parsedLivestream.participants.length;
  const totalParticipants = parsedLivestream.totalParticipants;
  const starts = parsedLivestream.starts;
  const ends = parsedLivestream.ends;

  let metadataHtml = '<div class="livestream-metadata">';

  // Summary
  if (summary) {
    metadataHtml += `
      <div class="livestream-summary">
        ${escapeHtml(summary)}
      </div>
    `;
  }

  // Participant count
  if (showParticipantCount && (currentParticipants !== undefined || totalParticipants !== undefined)) {
    const countText = formatParticipantCount(currentParticipants, totalParticipants);
    metadataHtml += `
      <div class="livestream-participant-count">
        <strong>Participants:</strong> ${countText}
      </div>
    `;
  }

  // Start/End times
  if (starts || ends) {
    metadataHtml += '<div class="livestream-timestamps">';
    if (starts) {
      metadataHtml += `<span class="livestream-start-time">Starts: ${formatEventDate(starts)}</span>`;
    }
    if (ends) {
      metadataHtml += `<span class="livestream-end-time">Ends: ${formatEventDate(ends)}</span>`;
    }
    metadataHtml += '</div>';
  }

  // Hashtags
  if (hashtags.length > 0) {
    metadataHtml += `
      <div class="livestream-hashtags">
        ${hashtags.map(tag => `<span class="hashtag">#${escapeHtml(tag)}</span>`).join(' ')}
      </div>
    `;
  }

  metadataHtml += '</div>';
  return metadataHtml;
}

function renderParticipants(
  parsedLivestream: ParsedLivestreamEvent,
  participantProfiles: Map<string, any>,
  participantsStatus: NCStatus
): string {
  const participants = parsedLivestream.participants || [];

  // Show skeleton loaders while participants are loading
  if (participantsStatus === NCStatus.Loading) {
    return `
      <div class="livestream-participants">
        <h3 class="participants-title">Participants</h3>
        <div class="participants-list">
          ${Array.from({ length: 3 }, () => `
            <div class="participant-item">
              <div class="skeleton" style="width: 32px; height: 32px; border-radius: 50%;"></div>
              <div class="skeleton" style="width: 120px; height: 14px; border-radius: 4px; margin-left: 8px;"></div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  if (participants.length === 0) {
    return `
      <div class="livestream-participants">
        <h3 class="participants-title">Participants</h3>
        <p class="participants-empty">No participants yet</p>
      </div>
    `;
  }

  // Enhanced participant rendering with profiles
  return `
    <div class="livestream-participants">
      <h3 class="participants-title">Participants (${participants.length})</h3>
      <div class="participants-list">
        ${participants.map(participant => renderParticipantItem(participant, participantProfiles)).join('')}
      </div>
    </div>
  `;
}

function renderError(errorMessage: string): string {
  return `
    <div class="nostr-livestream-container">
      <div class="livestream-error">
        <div class="error-icon">⚠</div>
        <div class="error-message">${escapeHtml(errorMessage)}</div>
      </div>
    </div>
  `;
}

function renderSkeletonHeader(): string {
  return `
    <div class="livestream-header">
      <div class="livestream-title-row">
        <div class="skeleton" style="width: 70%; height: 20px; border-radius: 10px;"></div>
        <div class="skeleton" style="width: 80px; height: 24px; border-radius: 12px;"></div>
      </div>
      <div class="livestream-author-row">
        <div class="author-picture">
          <div class="skeleton" style="width: 35px; height: 35px; border-radius: 50%;"></div>
        </div>
        <div class="livestream-author-info">
          <div class="skeleton" style="width: 150px; height: 16px; border-radius: 8px; margin-bottom: 4px;"></div>
          <div class="skeleton" style="width: 120px; height: 14px; border-radius: 8px;"></div>
        </div>
      </div>
    </div>
  `;
}

function renderLoading(): string {
  return `
    <div class="nostr-livestream-container">
      ${renderSkeletonHeader()}
      <div class="livestream-media">
        <div class="skeleton" style="width: 100%; height: 300px; border-radius: 8px;"></div>
      </div>
      <div class="livestream-metadata">
        <div class="skeleton" style="width: 100%; height: 14px; border-radius: 4px; margin-bottom: 12px;"></div>
        <div class="skeleton" style="width: 80%; height: 14px; border-radius: 4px; margin-bottom: 12px;"></div>
        <div class="skeleton" style="width: 60%; height: 14px; border-radius: 4px;"></div>
      </div>
    </div>
  `;
}
