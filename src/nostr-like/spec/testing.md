# Nostr Like Component - Testing Considerations

## Functional Tests

- Test like action with NIP-07
- Test unlike action with confirmation dialog
- Test without NIP-07 (error state)
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
