# Nostr Stream Component – Testing Considerations

## Core Functionality

### Basic Display
- Valid naddr attribute
- Stream event loading and parsing
- Status badge rendering (planned/live/ended)
- Metadata display (title, summary, image, hashtags)

### Status States
- Planned: countdown and preview image
- Live: video player with live indicator
- Ended: recording link and ended indicator
- Status transitions (planned → live → ended)

### Video Player
- Video player renders when status is "live"
- Uses `<hls-video>` custom element with HLS/M3U8 URL
- Autoplay support (`auto-play="true"`)

### Participants
- Participant list with profiles (avatar, name, roles)
- Participant count display (current/total)
- Attribute toggles (`show-participants`, `show-participant-count`)

### Live Updates
- Subscription to stream event updates
- Handles participant and status changes
- Subscription cleanup on disconnect

## Edge Cases

### Invalid Inputs
- Invalid or missing naddr attribute
- Non-existent stream event

### Missing Data
- Missing optional tags (title, summary, image)
- Missing streaming URL
- Missing participant data

### Network Issues
- Relay connection failures
- Profile fetch failures

## Browser Compatibility
- HLS video playback across major browsers (Safari, Chrome, Firefox)
