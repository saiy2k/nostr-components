# Nostr Like Button – Testing Considerations

## Functional Tests

- Test like action with a connected signer via `window.nostr.js`
- Test unlike action with confirmation dialog
- Test without a connected signer (error state)
- Test with 0 likes
- Test with 1 like
- Test with many likes (100+)
- Test with unlikes (negative or zero net count)
- Test count calculation (likes - unlikes)

## Edge Cases

- Test URL normalization edge cases
- Test error states (network, signature)
- Test custom URL attribute
- Test default URL (window.location)
- Test multiple reactions from same user

## UI Tests

- Test profile loading in dialog
- Test reaction badges in likers dialog ("Liked" vs "Disliked")
- Test theme switching
