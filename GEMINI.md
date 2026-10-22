# Project Guidelines & Coding Standards: IPTV Player

## Stack Architecture
- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite, Zustand.
- **Backend**: Tauri v2, Rust 2021 edition.
- **Database**: Embedded SQLite via `rusqlite`.
- **Media**: `hls.js`, `mpegts.js`.

## Rules & Constraints
1. **Tauri v2 Permissions**: Always declare plugin capabilities in `src-tauri/capabilities/default.json` when adding or modifying Tauri plugins.
2. **Database Performance**:
   - Never insert bulk data (channels or EPG programs) in individual queries. Always use explicit transactions (`tx.prepare_cached` inside `conn.transaction()`).
   - SQLite should always run with `PRAGMA journal_mode=WAL;` and `PRAGMA synchronous=NORMAL;`.
3. **EPG & M3U Parsing**:
   - Streaming only. Do not load multi-megabyte XML/M3U files entirely into memory as monolithic objects.
   - Decompress `.gz` streams on-the-fly with `flate2`.
4. **Player Cleanup**:
   - Always destroy `Hls` and `mpegts` instances on channel change or component unmount to prevent audio/video memory leaks.
5. **No Broken Binaries in Git**:
   - Ensure build directories (`dist/`, `src-tauri/target/`), node modules, logs, and compiled `.exe` files stay out of git commits.
