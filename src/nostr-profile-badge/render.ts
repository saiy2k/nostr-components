// SPDX-License-Identifier: MIT

import { NDKUser, NDKUserProfile } from '@nostr-dev-kit/ndk'
import { escapeHtml, maskNPub } from '../common/utils'
import { DEFAULT_PROFILE_IMAGE } from '../common/constants'
import { renderNpub } from '../base/text-row/render-npub'
import { renderNip05 } from '../base/text-row/render-nip05'
import { renderName } from '../base/text-row/render-name'

export interface RenderProfileBadgeOptions {
  isLoading: boolean
  isError: boolean
  errorMessage?: string
  userProfile: NDKUserProfile | null
  ndkUser: NDKUser | null
  showNpub: boolean
  showFollow: boolean
}

export function renderProfileBadge({
  isLoading,
  isError,
  errorMessage,
  userProfile,
  ndkUser,
  showNpub,
  showFollow
}: RenderProfileBadgeOptions): string {
  if (isLoading) {
    return renderLoading()
  }

  if (isError || userProfile == null) {
    return renderError(errorMessage || '')
  }

  const rawName =
    userProfile.displayName ||
    userProfile.name ||
    maskNPub(ndkUser?.npub || '')

  const escapedName = escapeHtml(rawName)
  const profileImage = escapeHtml(
    userProfile.picture || DEFAULT_PROFILE_IMAGE
  )

  const npub = ndkUser?.npub || ''
  const nip05 = userProfile.nip05 || ''
  const pubkey = escapeHtml(ndkUser?.pubkey || '')

  return renderContainer(
    `<img
      src="${profileImage}"
      alt="Nostr profile image of ${escapedName}"
      loading="lazy"
      decoding="async"
    />`,
    `${renderName({ name: rawName })}
     ${nip05 ? renderNip05(nip05) : ''}
     ${showNpub ? renderNpub(npub) : ''}
     ${
       showFollow && ndkUser?.pubkey
         ? `<nostr-follow-button pubkey="${pubkey}"></nostr-follow-button>`
         : ''
     }`,
    rawName
  )
}

function renderLoading(): string {
  return renderContainer(
    '<div class="skeleton img-skeleton"></div>',
    `<div class="skeleton" style="width: 120px;"></div>
     <div class="skeleton" style="width: 160px;"></div>`
  )
}

function renderError(errorMessage: string): string {
  return renderContainer(
    '<div class="error-icon">&#9888;</div>',
    escapeHtml(errorMessage)
  )
}

function renderContainer(
  leftContent: string,
  rightContent: string,
  name?: string
): string {
  return `
    <div
      class="nostr-profile-badge-container"
      tabindex="0"
      aria-label="Open Nostr profile${name ? ` of ${escapeHtml(name)}` : ''}"
    >
      <div class="nostr-profile-badge-left-container">
        ${leftContent}
      </div>
      <div class="nostr-profile-badge-right-container">
        ${rightContent}
      </div>
    </div>
  `
}
