# Nostr Atlas QA

Web Pulse checks are at the end of this file. The claim checks below are unchanged.

# X account claim QA

PR: https://github.com/saiy2k/nostr-components/pull/144

The live path is: connect a NIP-07 signer, post a tweet that contains that npub, paste that tweet’s URL, sign a kind 10011 event, get an acknowledgement from a crawler relay, then `ingestClaim` re-checks the tweet and writes Firestore. A relay acknowledgement by itself does not verify the account. YouTube and GitHub are not in the dialog (those fields are commented out; the line under the handle tells people to DM you).

Unit tests mock the signer, relays, and tweet API. These are the live cases those tests do not cover. Deploy `checkClaimProof` and `ingestClaim` to the same project and Firestore database as the directory list before running them.

## Publish this first

1. **Happy path.** One extension enabled, X logged into the same handle you type, composer text left intact, paste `https://x.com/<handle>/status/<id>`, approve the signature. Expected: status becomes verified, toast appears, Refresh plus search by that handle shows that npub with the verified mark.
2. **The extension you expect people to use (Alby, nos2x, or both).** Some signers change `created_at`, reorder tags, or add their own client tag. Expected: either a clean publish, or the exact error “The Nostr signer returned an invalid claim event.” A generic failure here blocks every user of that extension.
3. **Brand-new npub, normal network, default relays** (`relay.damus.io`, `nos.lol`, `relay.primal.net`). The dialog reads kind 10011 from all of them before it will sign. One silent relay fails that read after 8 seconds, including for someone who has no identity yet. Expected: either the claim publishes, or you get “Could not read the existing Nostr identity before publishing.”
4. **Block one default relay** in devtools (for example `wss://nos.lol`) and claim again with a new key. This is the flaky-network version of the same read.
5. **`ingestClaim` down, blocked, or slow past 20 seconds** after you have already approved the signature. The event is already on relays. The dialog still reports success and says the directory will finish checking shortly. Expected to confirm: that message appears, and a refresh does not show a verified row. Check function logs so a 503, timeout, or wrong service account is not mistaken for “pending.”
6. **`checkClaimProof` down.** Expected: “The proof tweet could not be read.” No signature prompt. Nothing published.

## Dialog and timing

7. **Enter in the handle or proof field** after connecting. Enter submits Sign and publish. It does not close the dialog. Invalid fields show the browser tooltip and publish nothing. Enter does nothing while that button is disabled.
8. **Fill both fields, then connect.** Publish should enable only after connect, then succeed with those values.
9. **Connect, then Submit with empty fields, a handle with a space, or a proof with no `https://`.** The browser tooltip should block the request. No signature prompt.
10. **Double-click Sign and publish, and press Enter again while the status says it is waiting.** One signature prompt. Buttons stay disabled until that attempt finishes.
11. **Close with X, Cancel, Escape, or the backdrop while the extension prompt is open.** Reopen before you approve, and again after you approve or dismiss. Expected: you can still approve; the reopened dialog shows the real result; buttons are not stuck disabled if you dismissed the prompt.
12. **Leave the extension prompt sitting, and disable the extension or let it auto-lock.** Expected: an error, buttons usable again, no verified row.
13. **Deny the public-key prompt.** Expected: the signer error, npub stays “Not connected,” publish stays disabled.
14. **Approve the public key, deny the signature.** Expected: error, no toast, no directory row.
15. **Connect, copy npub, then switch account in the extension and publish.** Expected: “The Nostr signer account changed. Connect again before publishing.” The npub clears. No event for the new key.
16. **Switch account while the signature prompt is open** (if the extension allows it). The next screen is often “The Nostr signer returned an invalid claim event,” and the old npub can stay on screen until a second attempt.
17. **Connect as A, open the proof composer, connect as B, post from the already-open composer, paste that URL.** The tweet contains A. Expected: “The proof tweet does not contain the connected npub.”
18. **Close the dialog after a success or an error, then reopen.** The status goes back to “Signer connected…” or “Connect a signer to begin.” The form values remain. A second publish should replace the claim, not duplicate the directory row.
19. **Copy npub with the clipboard blocked, and again from a background window.** Expected: either “copied” or “could not be copied,” and the npub text stays intact.
20. **Open the proof link before connecting** (click and keyboard). It should not navigate. After connecting, it opens `https://x.com/intent/post` with `Verifying my Nostr identity for Nostr Atlas:` and the npub.
21. **Popup blocked, or the intent tab opened while logged out.** Log in, post, and come back. X often drops the prefilled text. Paste a manual tweet that contains the npub. That should still verify.
22. **Mobile, or a desktop browser with no NIP-07 extension.** Expected: “No NIP-07 signer was found…” There is no remote-signer fallback.
23. **Two extensions installed.** Only one should own `window.nostr`. Confirm the npub on screen is the account you think you signed with.

## Proof tweet and URL

24. **Manual tweet** that only says the npub, or the npub plus extra words. The fixed sentence is not required.
25. **`nostr:npub1…` in the tweet.** Should pass.
26. **Uppercase `NPUB1…`.** Should pass.
27. **nprofile instead of npub, hex pubkey, npub split across two lines, or npub only in an image.** Expected: “does not contain the connected npub.” No signature.
28. **Wrong X account posts the tweet** (typed handle differs from the logged-in account). Expected: “The proof tweet was not posted by that X handle.”
29. **Someone else’s tweet that happens to contain your npub** (a reply, a quote, or you asking them to paste it). Pasting their status URL should verify their handle to your npub. Try this once with a second account you control so you know whether the directory flips.
30. **Quote-tweet and a plain repost** of a proof. Note which author fxtwitter returns.
31. **Reply URL, or the second post in a thread,** when the npub is only in the first post. Expected: rejection, no directory row.
32. **Delete the tweet, or edit the npub out, while the signature prompt is open, then approve.** The first check already passed. Projection checks again. Expected: “The proof check rejected this claim.” No toast. Search does not show the handle. The signed event can still be on relays.
33. **Protected post, deleted post, bad status id, or a post fxtwitter cannot read.** All of these surface as “The proof tweet could not be read.”
34. **Run two proofs back to back.** If fxtwitter rate-limits, the dialog stays on that same unreadable-tweet error, and an in-flight ingest can sit at “will finish checking shortly” without becoming verified.

URLs that should publish:

- `https://x.com/Handle/status/<id>`
- `https://www.x.com/...`, `https://twitter.com/...`, `https://www.twitter.com/...`
- `https://x.com/@handle/status/<id>`
- query strings such as `?s=20` or `?t=...`
- trailing slash
- `/photo/1` and `/video/1` (stored as the plain status URL)

URLs that should fail on the proof field, with no signature:

- `https://x.com/i/web/status/<id>` and `https://twitter.com/i/web/status/<id>` (X’s copy-link often looks like this)
- `https://x.com/<handle>` profile URL
- `https://t.co/...`, `https://mobile.twitter.com/...`, `http://x.com/...`
- a status URL whose handle is not the handle in the form
- `/analytics` or any extra path segment
- a lookalike host

Handle field:

- `@Alice` and `ALICE` should claim `alice`
- 1 character and 15 characters should be accepted
- 16 characters, a space, a hyphen, a dot, or a full profile URL should be rejected by the field
- reserved words `home`, `search`, `share`, `settings`, `explore`, `compose`, `intent`, `i`, `messages`, `notifications`, `hashtag` should be rejected as reserved

## Existing Nostr identity

35. **Pubkey that already has a kind 10011** from this site or from another client. Before and after, read that event from each default relay. Other `twitter:`, `x:`, and `com.twitter:` tags should remain. Tags that are not `i` tags are dropped. A second Atlas client tag should not pile up.
36. **The existing event is only on a relay this dialog does not read.** The new event can replace it on damus, nos.lol, or primal without those other accounts. Check the published event’s tags.
37. **Two claims in the same second, or two tabs publishing together.** One directory row, one npub. Refresh and confirm the row did not disappear.
38. **Claim handle B with a key that already verified handle A.** Search both. A should stay verified for that npub. B should appear. If A’s old proof tweet is already deleted, confirm A does not lose its current row.
39. **Computer clock several minutes fast, then several minutes slow,** for a key that already has a 10011. A clock far ahead of the existing event should stop the publish (“too far in the future”). A clock behind should still produce an event relays will store.
40. **An existing identity with a very large tag or more than 19 other accounts.** Expected: publish stops with the “could not be preserved” or “too many linked accounts” message, and the old event stays as it was.

## What the directory shows afterward

41. **Verified, then Refresh and search** by handle and by npub. The list does not update itself. The new row may have an empty name, no NIP-05, and no avatar, because this flow does not publish a profile. Confirm it still sorts and copies the npub you connected.
42. **Pending message, then refresh immediately and again after a minute.** Pending must not show a verified mark. If it later becomes verified, the row appears on a later refresh.
43. **Rejected proof.** No toast. No verified row. Search the old npub if that handle was already verified and confirm it did not flip.
44. **Handle already verified to your npub.** Claiming again with a new tweet should keep one row for your npub.
45. **Handle already verified to a different npub, using a new proof from the real X account.** The row should move to the new npub. The old npub should disappear from search.
46. **X bio already contains an npub, same as the signer, then different from the signer.** Projection also reads the bio. Expected for the different-npub case: the dialog’s claim can show rejected or verified while the directory row shows the bio npub. Search and compare the npub on the row with the npub in the dialog.
47. **Delete the proof tweet after the row is verified, then refresh.** The row can stay verified. This flow does not re-check accounts that are already active.
48. **Rename the X account after verification, or suspend it.** The old handle can remain in the directory. A claim pasted from the old URL should fail the author check against the new screen name.

## Deploy checks, once

49. Publish with the production directory API URL. Both calls should go to `checkClaimProof` and `ingestClaim` on that same host. A verified response whose handle never appears in the list means the function wrote a different Firestore database than the one the list reads.
50. Confirm the signed event on the acknowledged relay is kind 10011, content empty, `i` tag `twitter:<handle>` plus the canonical `https://x.com/<handle>/status/<id>`, and `["client","Nostr Atlas"]`.
51. Hero copy still says YouTube. The dialog should not offer a YouTube or GitHub field, and nothing in this flow should create a YouTube claim.

## Posted proof for this round

Use this public post. The matching secret is `CLAIM_TEST_NSEC` in `nostr-atlas/.env.local`. Leave that secret out of this file and out of any commit. `checkClaimProof` on `https://us-central1-nostr-components.cloudfunctions.net` already accepts this pair. The X bio has no npub, and the post is not a reply, a quote, or protected.

- Handle: `grayfaceofindia`
- Proof: `https://x.com/grayfaceofindia/status/2104276147907481649`
- npub: `npub1p5f3ma0gyvv347lv2jsg66gpd6yy5672f0llhz4hrs2psywte8vqh78xm2`
- Text: `Verifying my Nostr identity for Nostr Atlas:` plus that npub

Run the blocked `ingestClaim` attempt before the successful publish, so a missing row is from that block.

52. **Happy path with this post.** Sign as this npub, paste the proof URL, publish to the default relays, and let `ingestClaim` run. Expected: verified status, a toast, and after Refresh one verified row for `grayfaceofindia` and for this npub.
53. **Identity read, then this publish.** Before signing, the dialog reads kind 10011 for this npub from `wss://relay.damus.io`, `wss://nos.lol`, and `wss://relay.primal.net`. Expected: the claim publishes, or the status is “Could not read the existing Nostr identity before publishing.”
54. **Block `wss://nos.lol` and publish this proof again.** Expected: the read still completes from the other two relays and the claim publishes, or the same unreadable-identity error. No half-written directory row.
55. **Block `ingestClaim` after the signature.** The event is already on a relay. Expected: the dialog says the directory will finish checking shortly. Refresh does not show a verified row. Function logs distinguish a 503, a timeout, and a wrong service account from a real pending projection.
56. **Second publish of this same handle and npub.** Close the dialog after success, reopen, and publish again. Expected: the status resets, the form values remain, and search still shows one row for this npub.
57. **Directory row for this claim.** Refresh, then search by `grayfaceofindia` and by the npub. The list does not update itself. Expected: one verified row, the npub copies, and it still sorts with an empty name, no NIP-05, and no avatar.
58. **Production host.** Both `checkClaimProof` and `ingestClaim` go to `https://us-central1-nostr-components.cloudfunctions.net`. A verified response whose handle never appears in the list means the function wrote a different Firestore database than the one the list reads.
59. **Relay event for this claim.** On the acknowledged relay the event is kind 10011, content empty, `i` tag `twitter:grayfaceofindia` plus `https://x.com/grayfaceofindia/status/2104276147907481649`, and `["client","Nostr Atlas"]`.
60. **URL variants of this status.** With this npub, `checkClaimProof` accepts `www.x.com`, `twitter.com`, `www.twitter.com`, `@grayfaceofindia`, a `?s=20` query, a trailing slash, `/photo/1`, and `/video/1`. A publish stores the canonical `https://x.com/grayfaceofindia/status/2104276147907481649`.
61. **Different npub, this same tweet.** Expected: “The proof tweet does not contain the connected npub.” No signature.

# Web Pulse

Open `/pulse/` with `npm run preview:atlas` after `npm run build:atlas`, against the Functions emulator or the deployed pulse functions. The directory API URL is the same origin the page uses for `getPulseOverview`, `getPulseDomain`, `listPulseActivity`, `listUrlEvents`, and `lookupNostrProfiles`.

1. **Menu.** Directory and Web Pulse are in the header, between the brand and the like and zap buttons. Web Pulse is the current page. Directory returns to `/`. Check the header at 1280, 980, 761, 760, and 375 pixels. At 761 and above the header stays on one row and the zap button does not shrink. At 760 and below the nav is its own full-width row under the brand and above the like and zap row.
2. **Overview.** The page shows the title, four all-time stat cards with icons, the purple-to-orange Nostr Components banner, latest activity with 7D selected, domain search, and the domain table sorted by reactions. A failed load shows an error and no sample rows. An empty index says there are no domains yet.
3. **Day tabs.** Switch to 1D and 30D. Only the latest-activity request changes. The stat cards and the domain table stay as they were.
4. **Sort and search.** Sorting by sats, zaps, dislikes, emoji, or last active asks for that column, still descending. A domain prefix search asks again and returns the matching rows. Clearing the search restores the unfiltered table.
5. **Domain view.** Open a domain. The URL is `/pulse/?domain=<domain>`. There is no banner and no search. Three all-time stat cards come first, then the URL table sorted by sats, then that domain's latest activity. Each URL cell shows the path and query. The separate icon opens the full `https` URL. An `http` URL is text, not a link.
6. **Expanded row.** Open a URL row. Reactions and zaps share one list in time order, with names and avatars. A missing name is a short npub linking to njump. A zap with no sender says Anonymous and still shows its comment. Close the row and it collapses.
7. **Header buttons.** On `/pulse/` the like and zap buttons target `https://nostr-atlas.web.app/pulse/` even when `?domain=` is set. On `/` they target `https://nostr-atlas.web.app/`.
8. **Missing domain.** `?domain=` for a domain the API does not have says it is not in the index. A domain with a space says it is not valid. Neither shows sample rows.
