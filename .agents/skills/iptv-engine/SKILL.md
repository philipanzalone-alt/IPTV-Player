---
name: iptv-engine
description: Best practices for IPTV M3U/Xtream parsing, EPG XMLTV processing, and Rusqlite streaming batching.
---

# IPTV Engine & Streaming Data Architecture

## 1. M3U & Xtream Parsing
- **M3U Format**: Handle `#EXTM3U`, `#EXTINF:-1 tvg-id="..." tvg-name="..." tvg-logo="..." group-title="...",Channel Name`, followed by stream URL.
- **Xtream Codes API**:
  - Base authentication: `/player_api.php?username=...&password=...`
  - Live streams: `action=get_live_streams` & `action=get_live_categories`
  - VOD / Series: `action=get_vod_streams` / `action=get_series`

## 2. SQLite / Rusqlite Batch Performance
- Never insert channels or EPG programmes one-by-one. A playlist with 50,000 channels will freeze SQLite unless batched.
- Always wrap bulk inserts inside an explicit transaction:
  ```rust
  let mut tx = conn.transaction()?;
  {
      let mut stmt = tx.prepare_cached(
          "INSERT OR REPLACE INTO channels (id, provider_id, name, stream_url, logo, group_title, tvg_id)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"
      )?;
      for ch in channels {
          stmt.execute(params![ch.id, ch.provider_id, ch.name, ch.stream_url, ch.logo, ch.group_title, ch.tvg_id])?;
      }
  }
  tx.commit()?;
  ```
- Use `PRAGMA synchronous = NORMAL;` and `PRAGMA journal_mode = WAL;` for high throughput and simultaneous reads/writes.

## 3. EPG (XMLTV) Streaming Parser
- Large XMLTV files (`.xml` or `.xml.gz`) can be 100MB+ uncompressed.
- Never load the whole XML file into memory as a DOM.
- Use `quick_xml::Reader` with streaming event loops (`Event::Start`, `Event::Text`, `Event::End`) to process channel tags and programme tags chunk by chunk.
- Auto-decompress `.gz` streams using `flate2::read::GzDecoder`.

## 4. Local Streaming Proxy
- Many IPTV providers block requests missing specific `User-Agent` headers or enforce strict CORS when requested directly from a WebView.
- Forward requests through the Rust local HTTP proxy (`src-tauri/src/proxy.rs`) to inject required headers and stream chunks to the frontend video player seamlessly.
