---
name: video-player-hls
description: Guidelines for video playback using hls.js and mpegts.js in WebView/React environments.
---

# Video Playback (HLS & MPEG-TS) Guidelines

## 1. Stream Format Detection
- `.m3u8` or stream URL ending in `.m3u8`: Use `Hls.js`.
- `.ts` or raw MPEG-TS streams: Use `mpegts.js`.
- Standard MP4/WebM: Native HTML5 `<video src="...">`.

## 2. HLS.js Lifecycle & Resource Cleanup
- Always destroy the previous `Hls` instance before attaching a new stream:
  ```typescript
  if (hlsRef.current) {
    hlsRef.current.destroy();
    hlsRef.current = null;
  }
  ```
- Listen to critical events:
  - `Hls.Events.ERROR`: Inspect `data.fatal`
    - `Hls.ErrorTypes.NETWORK_ERROR`: Call `hls.startLoad()` to attempt recovery.
    - `Hls.ErrorTypes.MEDIA_ERROR`: Call `hls.recoverMediaError()`.
    - Other fatal errors: Display a user-friendly playback error state.

## 3. WebView Constraints
- WebViews on Windows (WebView2) enforce autoplay policies. Always handle `.play().catch(...)` gracefully.
- Pass video requests through the local proxy (`http://127.0.0.1:<proxy_port>/...`) when providers require custom `Referer` or `User-Agent` headers.
