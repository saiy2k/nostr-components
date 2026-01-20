# Nostr Livestream Component – Testing Considerations

## Core Functionality

- Valid `naddr` attribute loading and parsing
- Status badge rendering (planned/live/ended)
- Metadata display (title, summary, image, hashtags)
- Status-based rendering:
  - **Planned**: Preview image, scheduled time
  - **Live**: Video player with live indicator
  - **Ended**: Recording link and ended indicator
- Video player renders when `status === 'live'` with HLS/M3U8 URL
- Autoplay support (`auto-play="true"`)
- Participant list with profiles (avatar, name, roles)
- Participant count display (current/total)
- Attribute toggles (`show-participants`, `show-participant-count`)

## Edge Cases

- Invalid or missing `naddr` attribute
- Non-existent livestream event
- Missing optional tags (title, summary, image, streaming URL)
- Missing participant data
- Relay connection failures
- Profile fetch failures
- Video load failures (fallback to preview image)

## Browser Compatibility

- HLS video playback across major browsers (Safari, Chrome, Firefox, Edge)
