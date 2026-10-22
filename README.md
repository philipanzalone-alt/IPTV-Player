# Minimalist IPTV Player (Tauri v2 + React + TypeScript + Tailwind)

A lightweight, high-performance, and visually minimalist IPTV player inspired by TiviMate and Apple TV.

## 🌟 Highlights & Architecture

- **Desktop Wrapper:** Tauri v2 (Rust 2021 edition)
- **Frontend Framework:** React 18 + TypeScript + Vite + Tailwind CSS
- **Styling Aesthetic:** Dark-mode-first, glassmorphic minimalist (`backdrop-blur-xl`, `border-white/10`, deep zinc/indigo accents)
- **Off-Heap Storage:** SQLite with WAL mode & foreign keys via `rusqlite` (Playlists and EPG XML trees are queried from database, not held in React memory)
- **Video Engine:** Dual engine:
  - `hls.js` for `.m3u8` HTTP Live Streaming
  - `mpegts.js` for raw `.ts` MPEG Transport Streams
  - Native HTML5 fallback with auto-recovery and custom keyboard shortcuts
- **Network Bypass:** Native Rust HTTP client with custom `User-Agent` headers (`VLC/3.0.20`, `TiviMate`, etc.) to bypass CORS and ISP blocks
- **EPG Engine:** Background streaming SAX parser via `quick-xml` with support for compressed `.xml.gz` files (via `flate2`) and Xtream `/xmltv.php`
- **Non-Destructive Editor:** User edits (renames, hides, custom logos, tvg-id mappings, custom groups) are stored in a persistent SQLite override layer that survives remote playlist syncs

---

## 🚀 Running the Application

### Prerequisites
- Node.js (v20+ or v24 LTS)
- Rust (1.78+)

### Development Mode
```powershell
# In the iptv-player directory
npm run dev

# Or launch the full desktop window with Tauri:
npm run tauri dev
```

### Production Build
```powershell
# Build frontend bundle
npm run build

# Build standalone Windows desktop executable
npm run tauri build
```
The compiled binary will be located in `src-tauri/target/release/iptv-player.exe`.

---

## 📁 Project Structure

```
iptv-player/
├── src/
│   ├── components/
│   │   ├── channels/          # ChannelGrid, ChannelCard, CategoryList
│   │   ├── editor/            # PlaylistEditor, OverridePanel, ExportModal
│   │   ├── epg/               # TimelineGrid (24h time-shift), NowPlaying
│   │   ├── player/            # VideoPlayer (hls.js + mpegts.js), PlayerControls
│   │   ├── providers/         # ProviderList, ProviderCard, AddProviderModal
│   │   ├── Layout.tsx         # Responsive glassmorphic shell
│   │   └── Sidebar.tsx        # Navigation & provider status
│   ├── hooks/
│   │   ├── useChannels.ts     # Channel loader with overrides applied
│   │   └── useEPG.ts          # EPG scheduler & live progress timer
│   ├── lib/
│   │   ├── api.ts             # Strongly typed Tauri IPC wrapper
│   │   └── utils.ts           # Time formatting, EPG math, classnames
│   ├── stores/                # Zustand stores (provider, channel, player, epg, editor)
│   └── types/                 # Shared TypeScript interfaces
└── src-tauri/
    ├── src/
    │   ├── db.rs              # SQLite schema, migrations, CRUD, overrides
    │   ├── epg.rs             # Streaming SAX XMLTV & .xml.gz parser
    │   ├── lib.rs             # Tauri IPC command registrations
    │   ├── m3u.rs             # M3U/M3U8 parser & clean M3U export
    │   ├── main.rs            # Windows entrypoint
    │   ├── proxy.rs           # CORS bypass proxy
    │   └── xtream.rs          # Xtream Codes API v2 client
    └── Cargo.toml
```
