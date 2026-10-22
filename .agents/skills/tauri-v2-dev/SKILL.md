---
name: tauri-v2-dev
description: Architecture, IPC patterns, capabilities, and cross-platform desktop guidelines for Tauri v2 applications.
---

# Tauri v2 Development Guide

## 1. Project Structure & Core Architecture
- Frontend runs in a system WebView (`dist` output directory).
- Backend runs in Rust (`src-tauri/`).
- IPC calls between React and Rust communicate via `@tauri-apps/api/core` (`invoke()`).

## 2. Tauri v2 IPC Command Conventions
- Always write commands in Rust with `#[tauri::command]` and register them in `tauri::Builder::default().invoke_handler(tauri::generate_handler![...])`.
- Return `Result<T, String>` or a serializable error type so errors cleanly propagate to JavaScript `try/catch`.
- Use `tauri::State<'_, AppState>` to inject managed state (e.g. database pool, HTTP clients).
- For long-running or CPU/IO heavy tasks (such as parsing huge M3U playlists or downloading multi-megabyte EPG files), always use `tokio::task::spawn_blocking` to avoid blocking Tauri's main async event loop.

## 3. Permissions & Capabilities
- Tauri v2 strictly enforces capabilities in `src-tauri/capabilities/default.json`.
- When adding plugins (e.g. `tauri-plugin-fs`, `tauri-plugin-dialog`, `tauri-plugin-http`), declare their permissions in the capabilities manifest, e.g.:
  ```json
  "permissions": [
    "core:default",
    "fs:default",
    "dialog:default"
  ]
  ```

## 4. Building & Running
- Dev: `npm run tauri dev`
- Release build: `npm run tauri build`
