// SPDX-License-Identifier: MIT

import { IRenderOptions } from '../base/render-options';
import { NDKUserProfile } from '@nostr-dev-kit/ndk';
import { ParsedStreamEvent } from './stream-utils';
import { escapeHtml, hexToNpub } from '../common/utils';
import { formatEventDate } from '../common/date-utils';
import { NCStatus } from '../base/base-component/nostr-base-component';

export interface RenderStreamOptions extends IRenderOptions {
  author: NDKUserProfile | null;
  parsedStream: ParsedStreamEvent | null;
  showParticipants: boolean;
  showParticipantCount: boolean;
  autoPlay: boolean;
  participantProfiles: Map<string, any>;
  participantsStatus: NCStatus;
  videoStatus: NCStatus;
}

export function renderStream(options: RenderStreamOptions): string {
  const {
    isLoading,
    isError,
    errorMessage,
    author,
    parsedStream,
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
  if (isLoading || !parsedStream) {
    return renderLoading();
  }

  // Handle ready state - full stream display
  return `
    <div class="nostr-stream-container">
      ${renderStreamHeader(isLoading, author, parsedStream)}
      ${renderStreamMedia(parsedStream, options.autoPlay, videoStatus)}
      ${renderStreamMetadata(parsedStream, showParticipantCount)}
      ${showParticipants ? renderParticipants(parsedStream, participantProfiles, participantsStatus) : ''}
    </div>
  `;
}

function renderStreamHeader(
  isLoading: boolean,
  author: NDKUserProfile | null,
  parsedStream: ParsedStreamEvent
): string {
  if (isLoading) {
    return `
      <div class="stream-header">
        <div class="stream-title-row">
          <div style="display: block; width: 70%; height: 20px; border-radius: 10px; margin-bottom: 0;" class="skeleton"></div>
          <div style="display: block; width: 80px; height: 24px; border-radius: 12px; margin-bottom: 0;" class="skeleton"></div>
        </div>
        <div class="stream-author-row">
          <div class="author-picture">
            <div style="display: block; width: 35px; height: 35px; border-radius: 50%; margin-bottom: 0;" class="skeleton"></div>
          </div>
          <div class="stream-author-info">
            <div style="display: block; width: 150px; height: 16px; border-radius: 8px; margin-bottom: 4px;" class="skeleton"></div>
            <div style="display: block; width: 120px; height: 14px; border-radius: 8px; margin-bottom: 0;" class="skeleton"></div>
          </div>
        </div>
      </div>
    `;
  }

  const authorImage = author?.picture || author?.image || '';
  const authorName = author?.displayName || author?.name || 'Unknown';
  const authorNip05 = author?.nip05 || '';
  const title = parsedStream.title || 'Untitled Stream';
  const status = parsedStream.status || 'planned';
  const statusBadgeClass = `stream-status-badge stream-status-${status}`;

  return `
    <div class="stream-header">
      <div class="stream-title-row">
        <div class="stream-title">${escapeHtml(title)}</div>
        <div class="stream-header-right">
          <span class="${statusBadgeClass}">${escapeHtml(status.charAt(0).toUpperCase() + status.slice(1))}</span>
        </div>
      </div>
      <div class="stream-author-row">
        <div class="author-picture">
          ${authorImage ? `<img src="${escapeHtml(authorImage)}" alt="${escapeHtml(authorName)}" />` : ''}
        </div>
        <div class="stream-author-info">
          ${authorName ? `<span class="author-name">${escapeHtml(authorName)}</span>` : ''}
          ${authorNip05 ? `<span class="author-username">${escapeHtml(authorNip05)}</span>` : ''}
        </div>
      </div>
    </div>
  `;
}

function renderStreamMedia(
  parsedStream: ParsedStreamEvent,
  autoPlay: boolean,
  videoStatus: NCStatus
): string {
  const status = parsedStream.status || 'planned';
  const streamingUrl = parsedStream.streamingUrl;
  const recordingUrl = parsedStream.recordingUrl;
  const imageUrl = parsedStream.image;

  // If live and has streaming URL, render video player (unless video failed)
  if (status === 'live' && streamingUrl && videoStatus !== NCStatus.Error) {
    return `
      <div class="stream-media">
        ${renderVideoPlayer(streamingUrl, autoPlay)}
      </div>
    `;
  }

  // If video failed (error status), show preview image as fallback
  if (status === 'live' && streamingUrl && videoStatus === NCStatus.Error) {
    return `
      <div class="stream-media">
        ${renderPreviewImage(imageUrl)}
      </div>
    `;
  }

  // If ended and has recording URL, show recording link
  if (status === 'ended' && recordingUrl) {
    return `
      <div class="stream-media">
        ${renderPreviewImage(imageUrl)}
        ${renderRecordingLink(recordingUrl)}
      </div>
    `;
  }

  // Show preview image (planned or no streaming URL)
  return `
    <div class="stream-media">
      ${renderPreviewImage(imageUrl)}
    </div>
  `;
}

function renderVideoPlayer(url: string, autoPlay: boolean): string {
  // Use <hls-video> custom element (not <video>) for cross-browser HLS support
  const autoplayAttr = autoPlay ? 'autoplay' : '';
  return `
    <hls-video
      class="stream-video"
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
      <div class="stream-preview-image">
        <img src="${escapeHtml(imageUrl)}" alt="Stream preview" loading="lazy" />
      </div>
    `;
  }

  // Default placeholder
  return `
    <div class="stream-preview-image stream-preview-placeholder">
      <div class="stream-preview-placeholder-icon">📹</div>
      <p>No preview image</p>
    </div>
  `;
}

function renderRecordingLink(url: string): string {
  return `
    <div class="stream-recording-link">
      <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">
        <span class="recording-icon">▶</span>
        <span>Watch Recording</span>
      </a>
    </div>
  `;
}

function renderStreamMetadata(
  parsedStream: ParsedStreamEvent,
  showParticipantCount: boolean
): string {
  const summary = parsedStream.summary;
  const hashtags = parsedStream.hashtags || [];
  const currentParticipants = parsedStream.currentParticipants ||parsedStream.participants.length;
  const totalParticipants = parsedStream.totalParticipants;
  const starts = parsedStream.starts;
  const ends = parsedStream.ends;

  let metadataHtml = '<div class="stream-metadata">';

  // Summary
  if (summary) {
    metadataHtml += `
      <div class="stream-summary">
        ${escapeHtml(summary)}
      </div>
    `;
  }

  // Participant count
  if (showParticipantCount && (currentParticipants !== undefined || totalParticipants !== undefined)) {
    const countText = currentParticipants !== undefined && totalParticipants !== undefined
      ? `${currentParticipants} / ${totalParticipants}`
      : currentParticipants !== undefined
        ? `${currentParticipants}`
        : `${totalParticipants || 0}`;
    
    metadataHtml += `
      <div class="stream-participant-count">
        <strong>Participants:</strong> ${countText}
      </div>
    `;
  }

  // Start/End times
  if (starts || ends) {
    metadataHtml += '<div class="stream-timestamps">';
    if (starts) {
      metadataHtml += `<span class="stream-start-time">Starts: ${formatEventDate(starts)}</span>`;
    }
    if (ends) {
      metadataHtml += `<span class="stream-end-time">Ends: ${formatEventDate(ends)}</span>`;
    }
    metadataHtml += '</div>';
  }

  // Hashtags
  if (hashtags.length > 0) {
    metadataHtml += `
      <div class="stream-hashtags">
        ${hashtags.map(tag => `<span class="hashtag">#${escapeHtml(tag)}</span>`).join(' ')}
      </div>
    `;
  }

  metadataHtml += '</div>';
  return metadataHtml;
}

function renderParticipants(
  parsedStream: ParsedStreamEvent,
  participantProfiles: Map<string, any>,
  participantsStatus: NCStatus
): string {
  const participants = parsedStream.participants || [];

  // Show skeleton loaders while participants are loading
  if (participantsStatus === NCStatus.Loading) {
    return `
      <div class="stream-participants">
        <h3 class="participants-title">Participants</h3>
        <div class="participants-list">
          ${Array.from({ length: 3 }, () => `
            <div class="participant-item">
              <div style="width: 32px; height: 32px; border-radius: 50%;" class="skeleton"></div>
              <div style="width: 120px; height: 14px; border-radius: 4px; margin-left: 8px;" class="skeleton"></div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  if (participants.length === 0) {
    return `
      <div class="stream-participants">
        <h3 class="participants-title">Participants</h3>
        <p class="participants-empty">No participants yet</p>
      </div>
    `;
  }

  // Enhanced participant rendering with profiles
  return `
    <div class="stream-participants">
      <h3 class="participants-title">Participants (${participants.length})</h3>
      <div class="participants-list">
        ${participants.map(participant => {
          const profile = participantProfiles.get(participant.pubkey);
          
          // Get display name: profile.displayName or profile.name or npub short format
          let displayName: string;
          if (profile?.displayName) {
            displayName = profile.displayName;
          } else if (profile?.name) {
            displayName = profile.name;
          } else {
            // Fallback to shortened npub format
            try {
              const npub = hexToNpub(participant.pubkey);
              displayName = `${npub.slice(0, 8)}...${npub.slice(-8)}`;
            } catch {
              // If hexToNpub fails, use hex format
              displayName = `${participant.pubkey.slice(0, 8)}...${participant.pubkey.slice(-8)}`;
            }
          }
          
          // Get avatar image
          const image = profile?.picture || profile?.image || '';
          
          // Get role (Host/Speaker/Participant) - default to 'Participant'
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
        }).join('')}
      </div>
    </div>
  `;
}

function renderError(errorMessage: string): string {
  return `
    <div class="nostr-stream-container">
      <div class="stream-error">
        <div class="error-icon">⚠</div>
        <div class="error-message">${escapeHtml(errorMessage)}</div>
      </div>
    </div>
  `;
}

function renderLoading(): string {
  return `
    <div class="nostr-stream-container">
      <div class="stream-header">
        <div class="stream-title-row">
          <div style="display: block; width: 70%; height: 20px; border-radius: 10px; margin-bottom: 0;" class="skeleton"></div>
          <div style="display: block; width: 80px; height: 24px; border-radius: 12px; margin-bottom: 0;" class="skeleton"></div>
        </div>
        <div class="stream-author-row">
          <div class="author-picture">
            <div style="display: block; width: 35px; height: 35px; border-radius: 50%; margin-bottom: 0;" class="skeleton"></div>
          </div>
          <div class="stream-author-info">
            <div style="display: block; width: 150px; height: 16px; border-radius: 8px; margin-bottom: 4px;" class="skeleton"></div>
            <div style="display: block; width: 120px; height: 14px; border-radius: 8px; margin-bottom: 0;" class="skeleton"></div>
          </div>
        </div>
      </div>
      <div class="stream-media">
        <div style="display: block; width: 100%; height: 300px; border-radius: 8px; margin-bottom: 0;" class="skeleton"></div>
      </div>
      <div class="stream-metadata">
        <div style="display: block; width: 100%; height: 14px; border-radius: 4px; margin-bottom: 12px;" class="skeleton"></div>
        <div style="display: block; width: 80%; height: 14px; border-radius: 4px; margin-bottom: 12px;" class="skeleton"></div>
        <div style="display: block; width: 60%; height: 14px; border-radius: 4px; margin-bottom: 0;" class="skeleton"></div>
      </div>
    </div>
  `;
}
