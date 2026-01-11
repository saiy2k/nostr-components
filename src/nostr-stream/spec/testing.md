# Nostr Stream Component – Testing Considerations

## Functional Tests

### Basic Display
- Test with valid naddr attribute
- Test stream event loading and parsing
- Test author profile display
- Test metadata display (title, summary, image)
- Test hashtag display
- Test status badge rendering (planned/live/ended)

### Status States
- Test planned status display (countdown, preview image)
- Test live status display (video player, live indicator)
- Test ended status display (recording link, ended indicator)
- Test status transition from planned → live
- Test status transition from live → ended
- Test staleness detection (1 hour without update when live)

### Video Player
- Test video player rendering when status is "live"
- Test video player with valid streaming URL (HLS/M3U8)
- Test autoplay attribute (when `auto-play="true"`)
- Test video player fallback when URL is missing
- Test video player fallback when status is not "live"
- Test video load error handling
- Test recording link display when status is "ended"

### Participants
- Test participant list rendering
- Test participant profile loading (avatar, name)
- Test participant role badges (Host, Speaker, Participant)
- Test participant count display (current/total)
- Test with 0 participants
- Test with many participants (100+)
- Test participant list hiding (`show-participants="false"`)
- Test participant count hiding (`show-participant-count="false"`)
- Test participant profile fallback (npub when profile missing)

### Live Updates
- Test subscription to stream event updates
- Test handling of new events with updated participants
- Test handling of new events with status changes
- Test handling of new events with updated participant counts
- Test that only newer events (higher created_at) trigger updates
- Test subscription cleanup on component disconnect

### Attribute Changes
- Test naddr attribute change (re-subscribe to new stream)
- Test show-participants attribute toggle
- Test show-participant-count attribute toggle
- Test auto-play attribute toggle
- Test data-theme attribute change (light/dark)
- Test relays attribute change (reconnect and resubscribe)

## Edge Cases

### Invalid Inputs
- Test with invalid naddr format
- Test with missing naddr attribute
- Test with naddr that decodes to wrong kind (not 30311)
- Test with naddr that points to non-existent event

### Missing Data
- Test stream event with missing `d` tag
- Test stream event with missing optional tags (title, summary, image)
- Test stream event with missing streaming URL
- Test stream event with missing participant data
- Test stream event with invalid status value
- Test stream event with invalid timestamp values

### Network Issues
- Test relay connection failures
- Test subscription errors
- Test event fetch timeout
- Test profile fetch failures (individual and batch)

### Browser Compatibility
- Test video player on Safari (native HLS support)
- Test video player on Chrome/Edge Android (native HLS support)
- Test video player on Chrome/Edge Desktop (may need HLS.js fallback)
- Test video player on Firefox (may need HLS.js fallback)

### Large Data Sets
- Test with maximum participants (approaching 1000)
- Test with very long title/summary text
- Test with many hashtags
- Test with long participant list (scrolling)

### Concurrent Updates
- Test rapid event updates (debouncing)
- Test multiple components on same page (different streams)
- Test component removal during active subscription

## UI Tests

### Layout and Styling
- Test responsive layout (desktop vs mobile)
- Test theme switching (light/dark)
- Test status badge styling for each state
- Test participant list scrolling
- Test video player aspect ratio
- Test preview image display

### Interactive Elements
- Test video player controls
- Test participant list expansion/collapse (if implemented)
- Test recording link click (opens in new tab)
- Test hashtag links (if implemented)

### Loading States
- Test skeleton loaders during initial load
- Test skeleton loaders for participant profiles
- Test loading state for video player
- Test loading state transitions

### Error States
- Test error message display for invalid naddr
- Test error message display for missing event
- Test error message display for video load failures
- Test error message display for network failures
- Test error recovery (retry mechanism if implemented)

## Integration Tests

### With Other Components
- Test nostr-stream component alongside nostr-post
- Test nostr-stream component alongside nostr-profile
- Test multiple nostr-stream components on same page
- Test theme consistency across components

### Relay Integration
- Test with multiple relay URLs
- Test relay failover behavior
- Test subscription across multiple relays
- Test event updates from different relays

## Performance Tests

### Initial Load
- Test time to first render
- Test time to load stream event
- Test time to load participant profiles
- Test time to start video playback

### Update Performance
- Test render performance on event updates
- Test render performance on participant updates
- Test memory usage with many participants
- Test subscription overhead

### Resource Cleanup
- Test subscription cleanup on disconnect
- Test event listener cleanup
- Test timer cleanup (staleness detection)
- Test memory leak detection

## Accessibility Tests

### Keyboard Navigation
- Test video player keyboard controls
- Test focus management
- Test tab order

### Screen Reader
- Test ARIA labels for status badges
- Test ARIA labels for video player
- Test ARIA labels for participant list
- Test error message announcements

### Color Contrast
- Test status badge contrast (light/dark themes)
- Test text contrast in all themes
- Test video controls contrast

## Security Tests

### Input Validation
- Test XSS prevention in title/summary
- Test XSS prevention in participant names
- Test URL validation for streaming/recording links
- Test naddr validation and sanitization

### Content Security
- Test video source restrictions
- Test image source restrictions
- Test external link handling
