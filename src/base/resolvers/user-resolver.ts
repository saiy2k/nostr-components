// SPDX-License-Identifier: MIT

import { NDKUser, NDKUserProfile } from '@nostr-dev-kit/ndk';
import { NostrService } from '../../common/nostr-service';
import { DEFAULT_PROFILE_IMAGE } from '../../common/constants';
import { isValidHex, validateNpub, validateNip05 } from '../../common/utils'

export class UserResolver {
  constructor(private nostrService: NostrService) { }

  validateInputs({ npub, pubkey, nip05 }: { npub?: string | null; pubkey?: string | null; nip05?: string | null }): string | null {
    if (!npub && !pubkey && !nip05) {
      return "Provide npub, nip05 or pubkey attribute";
    }
    if (pubkey && !isValidHex(pubkey)) return `Invalid Pubkey: ${pubkey}`;
    if (nip05 && !validateNip05(nip05)) return `Invalid Nip05: ${nip05}`;
    if (npub && !validateNpub(npub)) return `Invalid Npub: ${npub}`;
    return null;
  }

  async resolveUser({ npub, pubkey, nip05 }: { npub?: string | null; pubkey?: string | null; nip05?: string | null }): Promise<{ user: NDKUser, profile: NDKUserProfile | null }> {
    const user = await this.nostrService.resolveNDKUser({ npub, pubkey, nip05 });
    if (!user) throw new Error("Unable to resolve user from provided identifier");

    const profile = await this.nostrService.getProfile(user);

    return { user, profile: profile ?? null };
  }
}
