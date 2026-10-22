use rusqlite::{params, Connection, Result as SqliteResult};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;

pub struct DbState(pub Mutex<Connection>);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Provider {
    pub id: i64,
    pub name: String,
    #[serde(rename = "type")]
    pub provider_type: String,
    pub server_url: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub m3u_url: Option<String>,
    pub m3u_local_path: Option<String>,
    pub user_agent: String,
    pub epg_url: Option<String>,
    pub epg_time_offset_min: i32,
    pub account_status: Option<String>,
    pub account_expiry: Option<String>,
    pub max_connections: Option<i32>,
    pub active_connections: Option<i32>,
    pub last_synced_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Category {
    pub id: i64,
    pub provider_id: i64,
    pub remote_id: Option<String>,
    pub name: String,
    #[serde(rename = "type")]
    pub category_type: String,
    pub sort_order: i32,
    pub channel_count: Option<i32>,
    pub is_hidden: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Channel {
    pub id: i64,
    pub provider_id: i64,
    pub category_id: Option<i64>,
    pub remote_id: Option<String>,
    pub tvg_id: Option<String>,
    pub name: String,
    pub logo_url: Option<String>,
    pub stream_url: String,
    pub stream_type: String,
    pub container_extension: Option<String>,
    pub sort_order: i32,
    // Overlay fields
    pub display_name: Option<String>,
    pub is_hidden: Option<bool>,
    pub is_favorite: Option<bool>,
    pub custom_tvg_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EpgProgram {
    pub id: i64,
    pub provider_id: i64,
    pub channel_tvg_id: String,
    pub title: String,
    pub description: Option<String>,
    pub start_time: String,
    pub end_time: String,
    pub category: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Override {
    pub id: i64,
    pub provider_id: i64,
    pub target_type: String,
    pub target_id: i64,
    pub override_key: String,
    pub override_value: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomGroup {
    pub id: i64,
    pub name: String,
    pub sort_order: i32,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomPlaylist {
    pub id: i64,
    pub name: String,
    pub sort_order: i32,
    pub created_at: String,
    pub category_ids: Option<Vec<i64>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EpgSource {
    pub id: i64,
    pub name: String,
    pub url: String,
    pub provider_id: Option<i64>,
    pub last_synced_at: Option<String>,
    pub created_at: String,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Favorite {
    pub id: i64,
    pub channel_id: i64,
    pub sort_order: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncResult {
    pub categories_count: i32,
    pub channels_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EpgSyncResult {
    pub programs_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelMatchInfo {
    pub channel_id: i64,
    pub channel_name: String,
    pub original_tvg_id: Option<String>,
    pub matched_epg_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoMatchResult {
    pub matched_count: usize,
    pub already_matched: usize,
    pub total_channels: usize,
    pub matches: Vec<ChannelMatchInfo>,
}

pub fn get_db_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    std::fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Failed to create app data dir: {}", e))?;
    Ok(app_dir.join("iptv_player.db"))
}

pub fn init_db(app_handle: &tauri::AppHandle) -> Result<Connection, String> {
    let db_path = get_db_path(app_handle)?;
    let conn =
        Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

    conn.execute_batch("PRAGMA journal_mode = WAL;")
        .map_err(|e| format!("Failed to set WAL mode: {}", e))?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|e| format!("Failed to enable foreign keys: {}", e))?;

    create_tables(&conn)?;
    let _ = clean_invalid_epg_overrides(&conn);
    Ok(conn)
}

fn create_tables(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS providers (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('xtream', 'm3u')),
            server_url TEXT,
            username TEXT,
            password TEXT,
            m3u_url TEXT,
            m3u_local_path TEXT,
            user_agent TEXT DEFAULT 'VLC/3.0.20',
            epg_url TEXT,
            epg_time_offset_min INTEGER DEFAULT 0,
            account_status TEXT,
            account_expiry TEXT,
            max_connections INTEGER,
            active_connections INTEGER,
            last_synced_at TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY,
            provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
            remote_id TEXT,
            name TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('live', 'vod', 'series')),
            sort_order INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS channels (
            id INTEGER PRIMARY KEY,
            provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
            category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
            remote_id TEXT,
            tvg_id TEXT,
            name TEXT NOT NULL,
            logo_url TEXT,
            stream_url TEXT NOT NULL,
            stream_type TEXT DEFAULT 'live',
            container_extension TEXT,
            sort_order INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS epg_programs (
            id INTEGER PRIMARY KEY,
            provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
            channel_tvg_id TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            category TEXT
        );

        CREATE TABLE IF NOT EXISTS overrides (
            id INTEGER PRIMARY KEY,
            provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
            target_type TEXT NOT NULL CHECK(target_type IN ('category', 'channel')),
            target_id INTEGER NOT NULL,
            override_key TEXT NOT NULL,
            override_value TEXT,
            UNIQUE(provider_id, target_type, target_id, override_key)
        );

        CREATE TABLE IF NOT EXISTS custom_groups (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            sort_order INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS custom_group_channels (
            id INTEGER PRIMARY KEY,
            group_id INTEGER NOT NULL REFERENCES custom_groups(id) ON DELETE CASCADE,
            channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
            sort_order INTEGER DEFAULT 0,
            UNIQUE(group_id, channel_id)
        );

        CREATE TABLE IF NOT EXISTS favorites (
            id INTEGER PRIMARY KEY,
            channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
            sort_order INTEGER DEFAULT 0,
            UNIQUE(channel_id)
        );

        CREATE TABLE IF NOT EXISTS custom_playlists (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            sort_order INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS custom_playlist_categories (
            id INTEGER PRIMARY KEY,
            playlist_id INTEGER NOT NULL REFERENCES custom_playlists(id) ON DELETE CASCADE,
            category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
            UNIQUE(playlist_id, category_id)
        );

        CREATE TABLE IF NOT EXISTS epg_sources (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            url TEXT NOT NULL,
            provider_id INTEGER,
            last_synced_at TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_channels_provider ON channels(provider_id);
        CREATE INDEX IF NOT EXISTS idx_channels_category ON channels(category_id);
        CREATE INDEX IF NOT EXISTS idx_channels_tvg_id ON channels(tvg_id);
        CREATE INDEX IF NOT EXISTS idx_epg_channel_time ON epg_programs(channel_tvg_id, start_time, end_time);
        CREATE INDEX IF NOT EXISTS idx_overrides_target ON overrides(provider_id, target_type, target_id);
        CREATE INDEX IF NOT EXISTS idx_categories_provider ON categories(provider_id);
        ",
    )
    .map_err(|e| format!("Failed to create tables: {}", e))?;

    // Safely deduplicate any pre-existing duplicates in epg_programs before indexing
    let _ = conn.execute_batch(
        "DELETE FROM epg_programs
         WHERE id NOT IN (
             SELECT MIN(id)
             FROM epg_programs
             GROUP BY channel_tvg_id, start_time
         );",
    );

    // Safely create unique index for upserts
    let _ = conn.execute_batch(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_epg_unique ON epg_programs(channel_tvg_id, start_time);",
    );

    Ok(())
}

// ─── Provider CRUD ───

pub fn insert_provider(
    conn: &Connection,
    name: &str,
    provider_type: &str,
    server_url: Option<&str>,
    username: Option<&str>,
    password: Option<&str>,
    m3u_url: Option<&str>,
    m3u_local_path: Option<&str>,
    user_agent: &str,
    epg_url: Option<&str>,
) -> SqliteResult<i64> {
    conn.execute(
        "INSERT INTO providers (name, type, server_url, username, password, m3u_url, m3u_local_path, user_agent, epg_url)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            name,
            provider_type,
            server_url,
            username,
            password,
            m3u_url,
            m3u_local_path,
            user_agent,
            epg_url,
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get_all_providers(conn: &Connection) -> SqliteResult<Vec<Provider>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, type, server_url, username, password, m3u_url, m3u_local_path,
                user_agent, epg_url, epg_time_offset_min, account_status, account_expiry,
                max_connections, active_connections, last_synced_at, created_at
         FROM providers ORDER BY id",
    )?;
    let providers = stmt
        .query_map([], |row| {
            Ok(Provider {
                id: row.get(0)?,
                name: row.get(1)?,
                provider_type: row.get(2)?,
                server_url: row.get(3)?,
                username: row.get(4)?,
                password: row.get(5)?,
                m3u_url: row.get(6)?,
                m3u_local_path: row.get(7)?,
                user_agent: row.get(8)?,
                epg_url: row.get(9)?,
                epg_time_offset_min: row.get(10)?,
                account_status: row.get(11)?,
                account_expiry: row.get(12)?,
                max_connections: row.get(13)?,
                active_connections: row.get(14)?,
                last_synced_at: row.get(15)?,
                created_at: row.get(16)?,
            })
        })?
        .collect::<SqliteResult<Vec<_>>>()?;
    Ok(providers)
}

pub fn get_provider_by_id(conn: &Connection, id: i64) -> SqliteResult<Provider> {
    conn.query_row(
        "SELECT id, name, type, server_url, username, password, m3u_url, m3u_local_path,
                user_agent, epg_url, epg_time_offset_min, account_status, account_expiry,
                max_connections, active_connections, last_synced_at, created_at
         FROM providers WHERE id = ?1",
        params![id],
        |row| {
            Ok(Provider {
                id: row.get(0)?,
                name: row.get(1)?,
                provider_type: row.get(2)?,
                server_url: row.get(3)?,
                username: row.get(4)?,
                password: row.get(5)?,
                m3u_url: row.get(6)?,
                m3u_local_path: row.get(7)?,
                user_agent: row.get(8)?,
                epg_url: row.get(9)?,
                epg_time_offset_min: row.get(10)?,
                account_status: row.get(11)?,
                account_expiry: row.get(12)?,
                max_connections: row.get(13)?,
                active_connections: row.get(14)?,
                last_synced_at: row.get(15)?,
                created_at: row.get(16)?,
            })
        },
    )
}

pub fn update_provider_account_info(
    conn: &Connection,
    id: i64,
    status: &str,
    expiry: &str,
    max_conn: i32,
    active_conn: i32,
) -> SqliteResult<()> {
    conn.execute(
        "UPDATE providers SET account_status = ?1, account_expiry = ?2,
         max_connections = ?3, active_connections = ?4 WHERE id = ?5",
        params![status, expiry, max_conn, active_conn, id],
    )?;
    Ok(())
}

pub fn update_provider_synced(conn: &Connection, id: i64) -> SqliteResult<()> {
    conn.execute(
        "UPDATE providers SET last_synced_at = datetime('now') WHERE id = ?1",
        params![id],
    )?;
    Ok(())
}

pub fn delete_provider_by_id(conn: &Connection, id: i64) -> SqliteResult<()> {
    conn.execute("DELETE FROM providers WHERE id = ?1", params![id])?;
    Ok(())
}

// ─── Category CRUD ───

pub fn insert_category(
    conn: &Connection,
    provider_id: i64,
    remote_id: Option<&str>,
    name: &str,
    category_type: &str,
    sort_order: i32,
) -> SqliteResult<i64> {
    conn.execute(
        "INSERT INTO categories (provider_id, remote_id, name, type, sort_order)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![provider_id, remote_id, name, category_type, sort_order],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get_categories_by_provider(
    conn: &Connection,
    provider_id: i64,
    content_type: &str,
) -> SqliteResult<Vec<Category>> {
    let (sql, is_all) = if content_type == "all" || content_type.is_empty() {
        (
            "SELECT c.id, c.provider_id, c.remote_id, c.name, c.type,
                    COALESCE(CAST(o_sort.override_value AS INTEGER), c.sort_order) as effective_sort,
                    (SELECT COUNT(*) FROM channels ch WHERE ch.category_id = c.id) as channel_count,
                    o_hidden.override_value as is_hidden
             FROM categories c
             LEFT JOIN overrides o_sort ON o_sort.target_type = 'category' AND o_sort.target_id = c.id AND o_sort.override_key = 'sort_order' AND o_sort.provider_id = c.provider_id
             LEFT JOIN overrides o_hidden ON o_hidden.target_type = 'category' AND o_hidden.target_id = c.id AND o_hidden.override_key = 'hidden' AND o_hidden.provider_id = c.provider_id
             WHERE c.provider_id = ?1
             ORDER BY effective_sort, c.name",
            true,
        )
    } else {
        (
            "SELECT c.id, c.provider_id, c.remote_id, c.name, c.type,
                    COALESCE(CAST(o_sort.override_value AS INTEGER), c.sort_order) as effective_sort,
                    (SELECT COUNT(*) FROM channels ch WHERE ch.category_id = c.id) as channel_count,
                    o_hidden.override_value as is_hidden
             FROM categories c
             LEFT JOIN overrides o_sort ON o_sort.target_type = 'category' AND o_sort.target_id = c.id AND o_sort.override_key = 'sort_order' AND o_sort.provider_id = c.provider_id
             LEFT JOIN overrides o_hidden ON o_hidden.target_type = 'category' AND o_hidden.target_id = c.id AND o_hidden.override_key = 'hidden' AND o_hidden.provider_id = c.provider_id
             WHERE c.provider_id = ?1 AND c.type = ?2
             ORDER BY effective_sort, c.name",
            false,
        )
    };

    let mut stmt = conn.prepare(sql)?;
    let cats = if is_all {
        stmt.query_map(params![provider_id], |row| {
            let hidden_val: Option<String> = row.get(7)?;
            Ok(Category {
                id: row.get(0)?,
                provider_id: row.get(1)?,
                remote_id: row.get(2)?,
                name: row.get(3)?,
                category_type: row.get(4)?,
                sort_order: row.get(5)?,
                channel_count: row.get(6)?,
                is_hidden: Some(hidden_val.as_deref() == Some("true")),
            })
        })?
        .collect::<SqliteResult<Vec<_>>>()?
    } else {
        stmt.query_map(params![provider_id, content_type], |row| {
            let hidden_val: Option<String> = row.get(7)?;
            Ok(Category {
                id: row.get(0)?,
                provider_id: row.get(1)?,
                remote_id: row.get(2)?,
                name: row.get(3)?,
                category_type: row.get(4)?,
                sort_order: row.get(5)?,
                channel_count: row.get(6)?,
                is_hidden: Some(hidden_val.as_deref() == Some("true")),
            })
        })?
        .collect::<SqliteResult<Vec<_>>>()?
    };
    Ok(cats)
}

pub fn delete_category_by_id(conn: &Connection, category_id: i64) -> SqliteResult<()> {
    conn.execute("DELETE FROM channels WHERE category_id = ?1", params![category_id])?;
    conn.execute("DELETE FROM categories WHERE id = ?1", params![category_id])?;
    conn.execute(
        "DELETE FROM overrides WHERE target_type = 'category' AND target_id = ?1",
        params![category_id],
    )?;
    conn.execute(
        "DELETE FROM custom_playlist_categories WHERE category_id = ?1",
        params![category_id],
    )?;
    Ok(())
}

pub fn delete_channel_by_id(conn: &Connection, channel_id: i64) -> SqliteResult<()> {
    conn.execute("DELETE FROM channels WHERE id = ?1", params![channel_id])?;
    conn.execute(
        "DELETE FROM overrides WHERE target_type = 'channel' AND target_id = ?1",
        params![channel_id],
    )?;
    conn.execute("DELETE FROM favorites WHERE channel_id = ?1", params![channel_id])?;
    conn.execute("DELETE FROM group_channels WHERE channel_id = ?1", params![channel_id])?;
    Ok(())
}

pub fn reorder_categories(
    conn: &Connection,
    provider_id: i64,
    category_ids: &[i64],
) -> SqliteResult<()> {
    for (i, cat_id) in category_ids.iter().enumerate() {
        set_override_value(
            conn,
            provider_id,
            "category",
            *cat_id,
            "sort_order",
            &i.to_string(),
        )?;
    }
    Ok(())
}

pub fn reorder_channels(
    conn: &Connection,
    provider_id: i64,
    channel_ids: &[i64],
) -> SqliteResult<()> {
    for (i, ch_id) in channel_ids.iter().enumerate() {
        set_override_value(
            conn,
            provider_id,
            "channel",
            *ch_id,
            "sort_order",
            &i.to_string(),
        )?;
    }
    Ok(())
}

pub fn keep_only_sweden_categories(conn: &Connection, provider_id: i64) -> SqliteResult<usize> {
    let mut stmt = conn.prepare("SELECT id, name FROM categories WHERE provider_id = ?1")?;
    let cats = stmt
        .query_map(params![provider_id], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
        })?
        .collect::<SqliteResult<Vec<_>>>()?;

    let mut hidden_count = 0;
    for (cid, name) in cats {
        let n = name.to_lowercase();
        let is_se = n.contains("sweden")
            || n.contains("sverige")
            || n.starts_with("se:")
            || n.starts_with("se -")
            || n.starts_with("se |")
            || n.starts_with("se-")
            || n.starts_with("se ")
            || n.contains("[se]")
            || n.contains("(se)")
            || n.contains("| se |")
            || n.contains("| se")
            || n.contains("se /")
            || n.ends_with(" se")
            || n.ends_with(": se");

        if !is_se {
            set_override_value(conn, provider_id, "category", cid, "hidden", "true")?;
            hidden_count += 1;
        } else {
            remove_override_value(conn, provider_id, "category", cid, "hidden")?;
        }
    }
    Ok(hidden_count)
}

pub fn delete_categories_by_provider(conn: &Connection, provider_id: i64) -> SqliteResult<()> {
    conn.execute(
        "DELETE FROM categories WHERE provider_id = ?1",
        params![provider_id],
    )?;
    Ok(())
}

#[allow(dead_code)]
pub fn find_or_create_category(
    conn: &Connection,
    provider_id: i64,
    name: &str,
    category_type: &str,
) -> SqliteResult<i64> {
    let existing: Option<i64> = conn
        .query_row(
            "SELECT id FROM categories WHERE provider_id = ?1 AND name = ?2 AND type = ?3",
            params![provider_id, name, category_type],
            |row| row.get(0),
        )
        .ok();

    if let Some(id) = existing {
        Ok(id)
    } else {
        insert_category(conn, provider_id, None, name, category_type, 0)
    }
}

// ─── Channel CRUD ───

#[allow(dead_code)]
pub fn insert_channel(
    conn: &Connection,
    provider_id: i64,
    category_id: Option<i64>,
    remote_id: Option<&str>,
    tvg_id: Option<&str>,
    name: &str,
    logo_url: Option<&str>,
    stream_url: &str,
    stream_type: &str,
    container_extension: Option<&str>,
    sort_order: i32,
) -> SqliteResult<i64> {
    conn.execute(
        "INSERT INTO channels (provider_id, category_id, remote_id, tvg_id, name, logo_url, stream_url, stream_type, container_extension, sort_order)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            provider_id,
            category_id,
            remote_id,
            tvg_id,
            name,
            logo_url,
            stream_url,
            stream_type,
            container_extension,
            sort_order,
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get_channels_by_category(
    conn: &Connection,
    provider_id: i64,
    category_id: Option<i64>,
) -> SqliteResult<Vec<Channel>> {
    let sql = if let Some(cat_id) = category_id {
        format!(
            "SELECT ch.id, ch.provider_id, ch.category_id, ch.remote_id, ch.tvg_id, ch.name,
                    ch.logo_url, ch.stream_url, ch.stream_type, ch.container_extension, ch.sort_order,
                    o_name.override_value as display_name,
                    o_hidden.override_value as is_hidden,
                    CASE WHEN f.id IS NOT NULL THEN 1 ELSE 0 END as is_favorite,
                    o_tvg.override_value as custom_tvg_id
             FROM channels ch
             LEFT JOIN overrides o_name ON o_name.target_type = 'channel' AND o_name.target_id = ch.id AND o_name.override_key = 'name' AND o_name.provider_id = ch.provider_id
             LEFT JOIN overrides o_hidden ON o_hidden.target_type = 'channel' AND o_hidden.target_id = ch.id AND o_hidden.override_key = 'hidden' AND o_hidden.provider_id = ch.provider_id
             LEFT JOIN overrides o_tvg ON o_tvg.target_type = 'channel' AND o_tvg.target_id = ch.id AND o_tvg.override_key = 'tvg_id' AND o_tvg.provider_id = ch.provider_id
             LEFT JOIN favorites f ON f.channel_id = ch.id
             WHERE ch.provider_id = {} AND ch.category_id = {}
             ORDER BY ch.sort_order, ch.name",
            provider_id, cat_id
        )
    } else {
        format!(
            "SELECT ch.id, ch.provider_id, ch.category_id, ch.remote_id, ch.tvg_id, ch.name,
                    ch.logo_url, ch.stream_url, ch.stream_type, ch.container_extension, ch.sort_order,
                    o_name.override_value as display_name,
                    o_hidden.override_value as is_hidden,
                    CASE WHEN f.id IS NOT NULL THEN 1 ELSE 0 END as is_favorite,
                    o_tvg.override_value as custom_tvg_id
             FROM channels ch
             LEFT JOIN overrides o_name ON o_name.target_type = 'channel' AND o_name.target_id = ch.id AND o_name.override_key = 'name' AND o_name.provider_id = ch.provider_id
             LEFT JOIN overrides o_hidden ON o_hidden.target_type = 'channel' AND o_hidden.target_id = ch.id AND o_hidden.override_key = 'hidden' AND o_hidden.provider_id = ch.provider_id
             LEFT JOIN overrides o_tvg ON o_tvg.target_type = 'channel' AND o_tvg.target_id = ch.id AND o_tvg.override_key = 'tvg_id' AND o_tvg.provider_id = ch.provider_id
             LEFT JOIN overrides cat_hidden ON cat_hidden.target_type = 'category' AND cat_hidden.target_id = ch.category_id AND cat_hidden.override_key = 'hidden' AND cat_hidden.provider_id = ch.provider_id
             LEFT JOIN favorites f ON f.channel_id = ch.id
             WHERE ch.provider_id = {}
               AND (cat_hidden.override_value IS NULL OR cat_hidden.override_value != 'true')
             ORDER BY ch.sort_order, ch.name
             LIMIT 1500",
            provider_id
        )
    };

    let mut stmt = conn.prepare(&sql)?;
    let channels = stmt
        .query_map([], |row| {
            let hidden_val: Option<String> = row.get(12)?;
            let fav_val: i32 = row.get(13)?;
            Ok(Channel {
                id: row.get(0)?,
                provider_id: row.get(1)?,
                category_id: row.get(2)?,
                remote_id: row.get(3)?,
                tvg_id: row.get(4)?,
                name: row.get(5)?,
                logo_url: row.get(6)?,
                stream_url: row.get(7)?,
                stream_type: row.get(8)?,
                container_extension: row.get(9)?,
                sort_order: row.get(10)?,
                display_name: row.get(11)?,
                is_hidden: Some(hidden_val.as_deref() == Some("true")),
                is_favorite: Some(fav_val == 1),
                custom_tvg_id: row.get(14)?,
            })
        })?
        .collect::<SqliteResult<Vec<_>>>()?;
    Ok(channels)
}

pub fn search_channels_by_name(
    conn: &Connection,
    provider_id: i64,
    query: &str,
) -> SqliteResult<Vec<Channel>> {
    let pattern = format!("%{}%", query);
    let mut stmt = conn.prepare(
        "SELECT ch.id, ch.provider_id, ch.category_id, ch.remote_id, ch.tvg_id, ch.name,
                ch.logo_url, ch.stream_url, ch.stream_type, ch.container_extension, ch.sort_order,
                o_name.override_value as display_name,
                o_hidden.override_value as is_hidden,
                CASE WHEN f.id IS NOT NULL THEN 1 ELSE 0 END as is_favorite,
                o_tvg.override_value as custom_tvg_id
         FROM channels ch
         LEFT JOIN overrides o_name ON o_name.target_type = 'channel' AND o_name.target_id = ch.id AND o_name.override_key = 'name' AND o_name.provider_id = ch.provider_id
         LEFT JOIN overrides o_hidden ON o_hidden.target_type = 'channel' AND o_hidden.target_id = ch.id AND o_hidden.override_key = 'hidden' AND o_hidden.provider_id = ch.provider_id
         LEFT JOIN overrides o_tvg ON o_tvg.target_type = 'channel' AND o_tvg.target_id = ch.id AND o_tvg.override_key = 'tvg_id' AND o_tvg.provider_id = ch.provider_id
         LEFT JOIN favorites f ON f.channel_id = ch.id
         WHERE ch.provider_id = ?1 AND (ch.name LIKE ?2 OR COALESCE(o_name.override_value, '') LIKE ?2)
         ORDER BY ch.name
         LIMIT 100",
    )?;
    let channels = stmt
        .query_map(params![provider_id, pattern], |row| {
            let hidden_val: Option<String> = row.get(12)?;
            let fav_val: i32 = row.get(13)?;
            Ok(Channel {
                id: row.get(0)?,
                provider_id: row.get(1)?,
                category_id: row.get(2)?,
                remote_id: row.get(3)?,
                tvg_id: row.get(4)?,
                name: row.get(5)?,
                logo_url: row.get(6)?,
                stream_url: row.get(7)?,
                stream_type: row.get(8)?,
                container_extension: row.get(9)?,
                sort_order: row.get(10)?,
                display_name: row.get(11)?,
                is_hidden: Some(hidden_val.as_deref() == Some("true")),
                is_favorite: Some(fav_val == 1),
                custom_tvg_id: row.get(14)?,
            })
        })?
        .collect::<SqliteResult<Vec<_>>>()?;
    Ok(channels)
}

pub fn delete_channels_by_provider(conn: &Connection, provider_id: i64) -> SqliteResult<()> {
    conn.execute(
        "DELETE FROM channels WHERE provider_id = ?1",
        params![provider_id],
    )?;
    Ok(())
}

pub fn get_channel_by_id(conn: &Connection, channel_id: i64) -> SqliteResult<Channel> {
    conn.query_row(
        "SELECT ch.id, ch.provider_id, ch.category_id, ch.remote_id, ch.tvg_id, ch.name, ch.logo_url, ch.stream_url,
                ch.stream_type, ch.container_extension, ch.sort_order,
                o_name.override_value as display_name,
                o_hidden.override_value as is_hidden,
                CASE WHEN f.id IS NOT NULL THEN 1 ELSE 0 END as is_favorite,
                o_tvg.override_value as custom_tvg_id
         FROM channels ch
         LEFT JOIN overrides o_name ON o_name.target_type = 'channel' AND o_name.target_id = ch.id AND o_name.override_key = 'name' AND o_name.provider_id = ch.provider_id
         LEFT JOIN overrides o_hidden ON o_hidden.target_type = 'channel' AND o_hidden.target_id = ch.id AND o_hidden.override_key = 'hidden' AND o_hidden.provider_id = ch.provider_id
         LEFT JOIN overrides o_tvg ON o_tvg.target_type = 'channel' AND o_tvg.target_id = ch.id AND o_tvg.override_key = 'tvg_id' AND o_tvg.provider_id = ch.provider_id
         LEFT JOIN favorites f ON f.channel_id = ch.id
         WHERE ch.id = ?1",
        params![channel_id],
        |row| {
            let hidden_val: Option<String> = row.get(12)?;
            let fav_val: i32 = row.get(13)?;
            Ok(Channel {
                id: row.get(0)?,
                provider_id: row.get(1)?,
                category_id: row.get(2)?,
                remote_id: row.get(3)?,
                tvg_id: row.get(4)?,
                name: row.get(5)?,
                logo_url: row.get(6)?,
                stream_url: row.get(7)?,
                stream_type: row.get(8)?,
                container_extension: row.get(9)?,
                sort_order: row.get(10)?,
                display_name: row.get(11)?,
                is_hidden: Some(hidden_val.as_deref() == Some("true")),
                is_favorite: Some(fav_val == 1),
                custom_tvg_id: row.get(14)?,
            })
        },
    )
}

// ─── EPG CRUD ───

pub fn insert_epg_program(
    conn: &Connection,
    provider_id: i64,
    channel_tvg_id: &str,
    title: &str,
    description: Option<&str>,
    start_time: &str,
    end_time: &str,
    category: Option<&str>,
) -> SqliteResult<()> {
    conn.execute(
        "INSERT OR REPLACE INTO epg_programs (provider_id, channel_tvg_id, title, description, start_time, end_time, category)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            provider_id,
            channel_tvg_id,
            title,
            description,
            start_time,
            end_time,
            category,
        ],
    )?;
    Ok(())
}

pub fn get_channel_epg_programs(
    conn: &Connection,
    channel_tvg_id: &str,
    _provider_id: i64,
) -> SqliteResult<Vec<EpgProgram>> {
    let trimmed = channel_tvg_id.trim();
    if trimmed.is_empty() {
        return Ok(vec![]);
    }
    let mut stmt = conn.prepare(
        "SELECT id, provider_id, channel_tvg_id, title, description, start_time, end_time, category
         FROM epg_programs
         WHERE channel_tvg_id = ?1 COLLATE NOCASE
         ORDER BY start_time",
    )?;
    let programs = stmt
        .query_map(params![trimmed], |row| {
            Ok(EpgProgram {
                id: row.get(0)?,
                provider_id: row.get(1)?,
                channel_tvg_id: row.get(2)?,
                title: row.get(3)?,
                description: row.get(4)?,
                start_time: row.get(5)?,
                end_time: row.get(6)?,
                category: row.get(7)?,
            })
        })?
        .collect::<SqliteResult<Vec<_>>>()?;
    Ok(programs)
}

pub fn get_channel_epg_keys_batch(
    conn: &Connection,
    channel_ids: &[i64],
) -> SqliteResult<Vec<(i64, Vec<String>)>> {
    if channel_ids.is_empty() {
        return Ok(vec![]);
    }
    let placeholders: Vec<String> = channel_ids.iter().enumerate().map(|(i, _)| format!("?{}", i + 1)).collect();
    let sql = format!(
        "SELECT ch.id, ch.name, ch.tvg_id, o_tvg.override_value as custom_tvg, o_name.override_value as custom_name
         FROM channels ch
         LEFT JOIN overrides o_tvg ON o_tvg.target_type = 'channel' AND o_tvg.target_id = ch.id AND o_tvg.override_key = 'tvg_id' AND o_tvg.provider_id = ch.provider_id
         LEFT JOIN overrides o_name ON o_name.target_type = 'channel' AND o_name.target_id = ch.id AND o_name.override_key = 'name' AND o_name.provider_id = ch.provider_id
         WHERE ch.id IN ({})",
        placeholders.join(", ")
    );
    let mut stmt = conn.prepare(&sql)?;
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];
    for id in channel_ids {
        param_values.push(Box::new(*id));
    }
    let params_ref: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();

    let results = stmt
        .query_map(params_ref.as_slice(), |row| {
            let id: i64 = row.get(0)?;
            let name: String = row.get(1)?;
            let tvg_id: Option<String> = row.get(2)?;
            let custom_tvg: Option<String> = row.get(3)?;
            let custom_name: Option<String> = row.get(4)?;

            let mut keys = Vec::new();
            if let Some(tvg) = custom_tvg {
                let t = tvg.trim();
                let lower = t.to_lowercase();
                if !t.is_empty() && lower != "0" && lower != "-1" && lower != "null" && lower != "none" && !keys.contains(&t.to_string()) {
                    keys.push(t.to_string());
                }
            }
            if let Some(tvg) = tvg_id {
                let t = tvg.trim();
                let lower = t.to_lowercase();
                if !t.is_empty() && lower != "0" && lower != "-1" && lower != "null" && lower != "none" && !keys.contains(&t.to_string()) {
                    keys.push(t.to_string());
                }
            }
            if let Some(c_name) = custom_name {
                let t = c_name.trim();
                if !t.is_empty() && !keys.contains(&t.to_string()) {
                    keys.push(t.to_string());
                }
            }
            let n = name.trim();
            if !n.is_empty() && !keys.contains(&n.to_string()) {
                keys.push(n.to_string());
            }
            Ok((id, keys))
        })?
        .collect::<SqliteResult<Vec<_>>>()?;
    Ok(results)
}

pub fn get_now_playing_for_channels(
    conn: &Connection,
    _provider_id: i64,
    tvg_ids: &[String],
) -> SqliteResult<Vec<(String, EpgProgram)>> {
    if tvg_ids.is_empty() {
        return Ok(vec![]);
    }
    let placeholders: Vec<String> = tvg_ids.iter().enumerate().map(|(i, _)| format!("?{}", i + 1)).collect();
    let sql = format!(
        "SELECT id, provider_id, channel_tvg_id, title, description, start_time, end_time, category,
                CASE WHEN (datetime(start_time) <= datetime('now') AND datetime(end_time) > datetime('now')) THEN 1 ELSE 0 END as is_current
         FROM epg_programs
         WHERE channel_tvg_id IN ({}) COLLATE NOCASE
         AND (
             (datetime(start_time) <= datetime('now') AND datetime(end_time) > datetime('now'))
             OR
             (datetime(start_time) <= datetime('now', '+30 minutes') AND datetime(end_time) >= datetime('now', '-30 minutes'))
         )
         ORDER BY is_current DESC, start_time DESC",
        placeholders.join(", ")
    );
    let mut stmt = conn.prepare(&sql)?;

    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];
    for tvg_id in tvg_ids {
        param_values.push(Box::new(tvg_id.clone()));
    }
    let params_ref: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();

    let results = stmt
        .query_map(params_ref.as_slice(), |row| {
            let tvg_id: String = row.get(2)?;
            Ok((
                tvg_id,
                EpgProgram {
                    id: row.get(0)?,
                    provider_id: row.get(1)?,
                    channel_tvg_id: row.get(2)?,
                    title: row.get(3)?,
                    description: row.get(4)?,
                    start_time: row.get(5)?,
                    end_time: row.get(6)?,
                    category: row.get(7)?,
                },
            ))
        })?
        .collect::<SqliteResult<Vec<_>>>()?;
    Ok(results)
}

#[allow(dead_code)]
pub fn delete_epg_by_provider(conn: &Connection, provider_id: i64) -> SqliteResult<()> {
    conn.execute(
        "DELETE FROM epg_programs WHERE provider_id = ?1",
        params![provider_id],
    )?;
    Ok(())
}

// ─── EPG Source CRUD ───

pub fn create_epg_source_record(
    conn: &Connection,
    name: &str,
    url: &str,
    provider_id: Option<i64>,
) -> SqliteResult<EpgSource> {
    conn.execute(
        "INSERT INTO epg_sources (name, url, provider_id) VALUES (?1, ?2, ?3)",
        params![name, url, provider_id],
    )?;
    let id = conn.last_insert_rowid();
    let created_at: String = conn.query_row(
        "SELECT created_at FROM epg_sources WHERE id = ?1",
        params![id],
        |row| row.get(0),
    )?;
    Ok(EpgSource {
        id,
        name: name.to_string(),
        url: url.to_string(),
        provider_id,
        last_synced_at: None,
        created_at,
    })
}

pub fn delete_epg_source_record(conn: &Connection, id: i64) -> SqliteResult<()> {
    conn.execute("DELETE FROM epg_sources WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn get_all_epg_sources(
    conn: &Connection,
    provider_id: Option<i64>,
) -> SqliteResult<Vec<EpgSource>> {
    let mut stmt = if provider_id.is_some() {
        conn.prepare(
            "SELECT id, name, url, provider_id, last_synced_at, created_at
             FROM epg_sources
             WHERE provider_id IS NULL OR provider_id = ?1
             ORDER BY name",
        )?
    } else {
        conn.prepare(
            "SELECT id, name, url, provider_id, last_synced_at, created_at
             FROM epg_sources
             ORDER BY name",
        )?
    };

    let params: Vec<&dyn rusqlite::types::ToSql> = if let Some(ref pid) = provider_id {
        vec![pid]
    } else {
        vec![]
    };

    let sources = stmt
        .query_map(params.as_slice(), |row| {
            Ok(EpgSource {
                id: row.get(0)?,
                name: row.get(1)?,
                url: row.get(2)?,
                provider_id: row.get(3)?,
                last_synced_at: row.get(4)?,
                created_at: row.get(5)?,
            })
        })?
        .collect::<SqliteResult<Vec<_>>>()?;
    Ok(sources)
}

pub fn update_epg_source_synced_at(conn: &Connection, id: i64) -> SqliteResult<()> {
    conn.execute(
        "UPDATE epg_sources SET last_synced_at = datetime('now') WHERE id = ?1",
        params![id],
    )?;
    Ok(())
}

pub fn get_epg_source_by_id(conn: &Connection, id: i64) -> SqliteResult<EpgSource> {
    conn.query_row(
        "SELECT id, name, url, provider_id, last_synced_at, created_at FROM epg_sources WHERE id = ?1",
        params![id],
        |row| {
            Ok(EpgSource {
                id: row.get(0)?,
                name: row.get(1)?,
                url: row.get(2)?,
                provider_id: row.get(3)?,
                last_synced_at: row.get(4)?,
                created_at: row.get(5)?,
            })
        },
    )
}

// ─── Override CRUD ───

pub fn set_override_value(
    conn: &Connection,
    provider_id: i64,
    target_type: &str,
    target_id: i64,
    key: &str,
    value: &str,
) -> SqliteResult<()> {
    conn.execute(
        "INSERT INTO overrides (provider_id, target_type, target_id, override_key, override_value)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(provider_id, target_type, target_id, override_key)
         DO UPDATE SET override_value = excluded.override_value",
        params![provider_id, target_type, target_id, key, value],
    )?;
    Ok(())
}

pub fn remove_override_value(
    conn: &Connection,
    provider_id: i64,
    target_type: &str,
    target_id: i64,
    key: &str,
) -> SqliteResult<()> {
    conn.execute(
        "DELETE FROM overrides WHERE provider_id = ?1 AND target_type = ?2 AND target_id = ?3 AND override_key = ?4",
        params![provider_id, target_type, target_id, key],
    )?;
    Ok(())
}

pub fn get_overrides_by_provider(
    conn: &Connection,
    provider_id: i64,
) -> SqliteResult<Vec<Override>> {
    let mut stmt = conn.prepare(
        "SELECT id, provider_id, target_type, target_id, override_key, override_value
         FROM overrides WHERE provider_id = ?1",
    )?;
    let overrides = stmt
        .query_map(params![provider_id], |row| {
            Ok(Override {
                id: row.get(0)?,
                provider_id: row.get(1)?,
                target_type: row.get(2)?,
                target_id: row.get(3)?,
                override_key: row.get(4)?,
                override_value: row.get(5)?,
            })
        })?
        .collect::<SqliteResult<Vec<_>>>()?;
    Ok(overrides)
}

// ─── Custom Groups ───

pub fn create_custom_group_record(conn: &Connection, name: &str) -> SqliteResult<CustomGroup> {
    conn.execute(
        "INSERT INTO custom_groups (name) VALUES (?1)",
        params![name],
    )?;
    let id = conn.last_insert_rowid();
    Ok(CustomGroup {
        id,
        name: name.to_string(),
        sort_order: 0,
        created_at: chrono::Utc::now().to_rfc3339(),
    })
}

pub fn delete_custom_group_record(conn: &Connection, group_id: i64) -> SqliteResult<()> {
    conn.execute(
        "DELETE FROM custom_groups WHERE id = ?1",
        params![group_id],
    )?;
    Ok(())
}

pub fn get_all_custom_groups(conn: &Connection) -> SqliteResult<Vec<CustomGroup>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, sort_order, created_at FROM custom_groups ORDER BY sort_order, name",
    )?;
    let groups = stmt
        .query_map([], |row| {
            Ok(CustomGroup {
                id: row.get(0)?,
                name: row.get(1)?,
                sort_order: row.get(2)?,
                created_at: row.get(3)?,
            })
        })?
        .collect::<SqliteResult<Vec<_>>>()?;
    Ok(groups)
}

pub fn add_channel_to_custom_group(
    conn: &Connection,
    group_id: i64,
    channel_id: i64,
) -> SqliteResult<()> {
    conn.execute(
        "INSERT OR IGNORE INTO custom_group_channels (group_id, channel_id) VALUES (?1, ?2)",
        params![group_id, channel_id],
    )?;
    Ok(())
}

pub fn remove_channel_from_custom_group(
    conn: &Connection,
    group_id: i64,
    channel_id: i64,
) -> SqliteResult<()> {
    conn.execute(
        "DELETE FROM custom_group_channels WHERE group_id = ?1 AND channel_id = ?2",
        params![group_id, channel_id],
    )?;
    Ok(())
}

pub fn reorder_group_channel_entries(
    conn: &Connection,
    group_id: i64,
    channel_ids: &[i64],
) -> SqliteResult<()> {
    for (i, ch_id) in channel_ids.iter().enumerate() {
        conn.execute(
            "UPDATE custom_group_channels SET sort_order = ?1 WHERE group_id = ?2 AND channel_id = ?3",
            params![i as i32, group_id, ch_id],
        )?;
    }
    Ok(())
}

// ─── Favorites ───

pub fn toggle_favorite_channel(conn: &Connection, channel_id: i64) -> SqliteResult<bool> {
    let exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM favorites WHERE channel_id = ?1",
            params![channel_id],
            |row| row.get::<_, i32>(0),
        )
        .map(|c| c > 0)?;

    if exists {
        conn.execute(
            "DELETE FROM favorites WHERE channel_id = ?1",
            params![channel_id],
        )?;
        Ok(false)
    } else {
        let max_order: i32 = conn
            .query_row("SELECT COALESCE(MAX(sort_order), 0) FROM favorites", [], |row| {
                row.get(0)
            })
            .unwrap_or(0);
        conn.execute(
            "INSERT INTO favorites (channel_id, sort_order) VALUES (?1, ?2)",
            params![channel_id, max_order + 1],
        )?;
        Ok(true)
    }
}

pub fn get_favorite_channels(conn: &Connection) -> SqliteResult<Vec<Channel>> {
    let mut stmt = conn.prepare(
        "SELECT ch.id, ch.provider_id, ch.category_id, ch.remote_id, ch.tvg_id, ch.name,
                ch.logo_url, ch.stream_url, ch.stream_type, ch.container_extension, ch.sort_order
         FROM channels ch
         INNER JOIN favorites f ON f.channel_id = ch.id
         ORDER BY f.sort_order",
    )?;
    let channels = stmt
        .query_map([], |row| {
            Ok(Channel {
                id: row.get(0)?,
                provider_id: row.get(1)?,
                category_id: row.get(2)?,
                remote_id: row.get(3)?,
                tvg_id: row.get(4)?,
                name: row.get(5)?,
                logo_url: row.get(6)?,
                stream_url: row.get(7)?,
                stream_type: row.get(8)?,
                container_extension: row.get(9)?,
                sort_order: row.get(10)?,
                display_name: None,
                is_hidden: None,
                is_favorite: Some(true),
                custom_tvg_id: None,
            })
        })?
        .collect::<SqliteResult<Vec<_>>>()?;
    Ok(channels)
}

pub fn reorder_favorite_entries(conn: &Connection, channel_ids: &[i64]) -> SqliteResult<()> {
    for (i, ch_id) in channel_ids.iter().enumerate() {
        conn.execute(
            "UPDATE favorites SET sort_order = ?1 WHERE channel_id = ?2",
            params![i as i32, ch_id],
        )?;
    }
    Ok(())
}

// ─── Export ───

pub fn get_all_channels_for_export(
    conn: &Connection,
    provider_id: i64,
) -> SqliteResult<Vec<(Channel, Option<String>, Option<String>)>> {
    // Returns channels with category name and any override values
    let mut stmt = conn.prepare(
        "SELECT ch.id, ch.provider_id, ch.category_id, ch.remote_id, ch.tvg_id, ch.name,
                ch.logo_url, ch.stream_url, ch.stream_type, ch.container_extension, ch.sort_order,
                cat.name as category_name,
                o_name.override_value as override_name,
                o_hidden.override_value as is_hidden
         FROM channels ch
         LEFT JOIN categories cat ON cat.id = ch.category_id
         LEFT JOIN overrides o_name ON o_name.target_type = 'channel' AND o_name.target_id = ch.id AND o_name.override_key = 'name' AND o_name.provider_id = ch.provider_id
         LEFT JOIN overrides o_hidden ON o_hidden.target_type = 'channel' AND o_hidden.target_id = ch.id AND o_hidden.override_key = 'hidden' AND o_hidden.provider_id = ch.provider_id
         WHERE ch.provider_id = ?1
         ORDER BY ch.sort_order, ch.name",
    )?;
    let result = stmt
        .query_map(params![provider_id], |row| {
            let cat_name: Option<String> = row.get(11)?;
            let hidden: Option<String> = row.get(13)?;
            Ok((
                Channel {
                    id: row.get(0)?,
                    provider_id: row.get(1)?,
                    category_id: row.get(2)?,
                    remote_id: row.get(3)?,
                    tvg_id: row.get(4)?,
                    name: row.get(5)?,
                    logo_url: row.get(6)?,
                    stream_url: row.get(7)?,
                    stream_type: row.get(8)?,
                    container_extension: row.get(9)?,
                    sort_order: row.get(10)?,
                    display_name: row.get(12)?,
                    is_hidden: Some(hidden.as_deref() == Some("true")),
                    is_favorite: None,
                    custom_tvg_id: None,
                },
                cat_name,
                row.get(12)?,
            ))
        })?
        .collect::<SqliteResult<Vec<_>>>()?;
    Ok(result)
}

// ─── Custom Playlists (Consisting of Categories) ───

pub fn create_custom_playlist_record(conn: &Connection, name: &str) -> SqliteResult<CustomPlaylist> {
    conn.execute(
        "INSERT INTO custom_playlists (name) VALUES (?1)",
        params![name],
    )?;
    let id = conn.last_insert_rowid();
    Ok(CustomPlaylist {
        id,
        name: name.to_string(),
        sort_order: 0,
        created_at: chrono::Utc::now().to_rfc3339(),
        category_ids: Some(vec![]),
    })
}

pub fn delete_custom_playlist_record(conn: &Connection, playlist_id: i64) -> SqliteResult<()> {
    conn.execute(
        "DELETE FROM custom_playlists WHERE id = ?1",
        params![playlist_id],
    )?;
    Ok(())
}

pub fn get_all_custom_playlists(conn: &Connection) -> SqliteResult<Vec<CustomPlaylist>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, sort_order, created_at FROM custom_playlists ORDER BY sort_order, name",
    )?;
    let mut playlists = stmt
        .query_map([], |row| {
            Ok(CustomPlaylist {
                id: row.get(0)?,
                name: row.get(1)?,
                sort_order: row.get(2)?,
                created_at: row.get(3)?,
                category_ids: None,
            })
        })?
        .collect::<SqliteResult<Vec<_>>>()?;

    for pl in &mut playlists {
        let mut cat_stmt = conn.prepare(
            "SELECT category_id FROM custom_playlist_categories WHERE playlist_id = ?1",
        )?;
        let cat_ids = cat_stmt
            .query_map(params![pl.id], |row| row.get::<_, i64>(0))?
            .collect::<SqliteResult<Vec<_>>>()?;
        pl.category_ids = Some(cat_ids);
    }

    Ok(playlists)
}

pub fn set_custom_playlist_categories(
    conn: &Connection,
    playlist_id: i64,
    category_ids: &[i64],
) -> SqliteResult<()> {
    conn.execute(
        "DELETE FROM custom_playlist_categories WHERE playlist_id = ?1",
        params![playlist_id],
    )?;
    let mut stmt = conn.prepare(
        "INSERT OR IGNORE INTO custom_playlist_categories (playlist_id, category_id) VALUES (?1, ?2)",
    )?;
    for cat_id in category_ids {
        stmt.execute(params![playlist_id, cat_id])?;
    }
    Ok(())
}

pub fn get_channels_by_custom_playlist(
    conn: &Connection,
    playlist_id: i64,
    provider_id: i64,
) -> SqliteResult<Vec<Channel>> {
    let sql = format!(
        "SELECT ch.id, ch.provider_id, ch.category_id, ch.remote_id, ch.tvg_id, ch.name,
                ch.logo_url, ch.stream_url, ch.stream_type, ch.container_extension, ch.sort_order,
                o_name.override_value as display_name,
                o_hidden.override_value as is_hidden,
                CASE WHEN f.id IS NOT NULL THEN 1 ELSE 0 END as is_favorite,
                o_tvg.override_value as custom_tvg_id
         FROM channels ch
         INNER JOIN custom_playlist_categories cpc ON cpc.category_id = ch.category_id AND cpc.playlist_id = {}
         LEFT JOIN overrides o_name ON o_name.target_type = 'channel' AND o_name.target_id = ch.id AND o_name.override_key = 'name' AND o_name.provider_id = ch.provider_id
         LEFT JOIN overrides o_hidden ON o_hidden.target_type = 'channel' AND o_hidden.target_id = ch.id AND o_hidden.override_key = 'hidden' AND o_hidden.provider_id = ch.provider_id
         LEFT JOIN overrides o_tvg ON o_tvg.target_type = 'channel' AND o_tvg.target_id = ch.id AND o_tvg.override_key = 'tvg_id' AND o_tvg.provider_id = ch.provider_id
         LEFT JOIN favorites f ON f.channel_id = ch.id
         WHERE ch.provider_id = {}
         ORDER BY ch.sort_order, ch.name
         LIMIT 1500",
        playlist_id, provider_id
    );

    let mut stmt = conn.prepare(&sql)?;
    let channels = stmt
        .query_map([], |row| {
            let hidden_val: Option<String> = row.get(12)?;
            let fav_val: i32 = row.get(13)?;
            Ok(Channel {
                id: row.get(0)?,
                provider_id: row.get(1)?,
                category_id: row.get(2)?,
                remote_id: row.get(3)?,
                tvg_id: row.get(4)?,
                name: row.get(5)?,
                logo_url: row.get(6)?,
                stream_url: row.get(7)?,
                stream_type: row.get(8)?,
                container_extension: row.get(9)?,
                sort_order: row.get(10)?,
                display_name: row.get(11)?,
                is_hidden: Some(hidden_val.as_deref() == Some("true")),
                is_favorite: Some(fav_val == 1),
                custom_tvg_id: row.get(14)?,
            })
        })?
        .collect::<SqliteResult<Vec<_>>>()?;
    Ok(channels)
}

// ─── EPG Auto-Matching & Management ───

pub fn get_all_channels_raw(conn: &Connection, provider_id: i64) -> SqliteResult<Vec<Channel>> {
    let sql = format!(
        "SELECT ch.id, ch.provider_id, ch.category_id, ch.remote_id, ch.tvg_id, ch.name,
                ch.logo_url, ch.stream_url, ch.stream_type, ch.container_extension, ch.sort_order,
                o_name.override_value as display_name,
                o_hidden.override_value as is_hidden,
                CASE WHEN f.id IS NOT NULL THEN 1 ELSE 0 END as is_favorite,
                o_tvg.override_value as custom_tvg_id
         FROM channels ch
         LEFT JOIN overrides o_name ON o_name.target_type = 'channel' AND o_name.target_id = ch.id AND o_name.override_key = 'name' AND o_name.provider_id = ch.provider_id
         LEFT JOIN overrides o_hidden ON o_hidden.target_type = 'channel' AND o_hidden.target_id = ch.id AND o_hidden.override_key = 'hidden' AND o_hidden.provider_id = ch.provider_id
         LEFT JOIN overrides o_tvg ON o_tvg.target_type = 'channel' AND o_tvg.target_id = ch.id AND o_tvg.override_key = 'tvg_id' AND o_tvg.provider_id = ch.provider_id
         LEFT JOIN favorites f ON f.channel_id = ch.id
         WHERE ch.provider_id = {} AND ch.stream_type = 'live'
         ORDER BY ch.sort_order, ch.name",
        provider_id
    );

    let mut stmt = conn.prepare(&sql)?;
    let channels = stmt
        .query_map([], |row| {
            let hidden_val: Option<String> = row.get(12)?;
            let fav_val: i32 = row.get(13)?;
            Ok(Channel {
                id: row.get(0)?,
                provider_id: row.get(1)?,
                category_id: row.get(2)?,
                remote_id: row.get(3)?,
                tvg_id: row.get(4)?,
                name: row.get(5)?,
                logo_url: row.get(6)?,
                stream_url: row.get(7)?,
                stream_type: row.get(8)?,
                container_extension: row.get(9)?,
                sort_order: row.get(10)?,
                display_name: row.get(11)?,
                is_hidden: Some(hidden_val.as_deref() == Some("true")),
                is_favorite: Some(fav_val == 1),
                custom_tvg_id: row.get(14)?,
            })
        })?
        .collect::<SqliteResult<Vec<_>>>()?;
    Ok(channels)
}

pub fn get_distinct_epg_channel_ids(conn: &Connection) -> SqliteResult<Vec<String>> {
    let mut stmt = conn.prepare("SELECT DISTINCT channel_tvg_id FROM epg_programs ORDER BY channel_tvg_id")?;
    let ids = stmt
        .query_map([], |row| row.get::<_, String>(0))?
        .filter_map(Result::ok)
        .collect();
    Ok(ids)
}

pub fn clear_all_epg_programs(conn: &Connection) -> SqliteResult<()> {
    conn.execute("DELETE FROM epg_programs", [])?;
    Ok(())
}

#[derive(Debug, Clone)]
pub struct PreparedEpgId {
    pub original: String,
    pub lower: String,
    pub country: Option<String>,
    pub stripped_domain: String,
    pub tokens: Vec<String>,
    pub numbers: Vec<String>,
    pub categories: Vec<String>,
    pub normalized: String,
}

pub fn parse_country_code(s: &str, is_domain: bool) -> Option<String> {
    let lower = s.trim().to_lowercase();
    if is_domain {
        if let Some(dot_pos) = lower.rfind('.') {
            let suffix = &lower[dot_pos + 1..];
            if suffix.len() == 2 && suffix.chars().all(|c| c.is_ascii_alphabetic()) {
                return Some(suffix.to_string());
            }
        }
    } else {
        let trimmed = lower.trim_start_matches('[');
        for sep in [':', '|', ']'] {
            if let Some(pos) = trimmed.find(sep) {
                if pos >= 2 && pos <= 3 {
                    let code = trimmed[..pos].trim();
                    if code.len() == 2 && code.chars().all(|c| c.is_ascii_alphabetic()) {
                        return Some(code.to_string());
                    }
                }
            }
        }
    }
    None
}

pub fn strip_domain_suffix(s: &str) -> String {
    let lower = s.to_lowercase();
    for suffix in &[
        ".us", ".uk", ".ca", ".de", ".fr", ".es", ".it", ".nl", ".pl", ".ro", ".pt",
        ".tv", ".com", ".net", ".org", ".eu", ".ch", ".at", ".se", ".no", ".dk", ".fi",
        ".gr", ".cz", ".sk", ".hu", ".bg", ".tr", ".al", ".ee", ".is", ".ba", ".rs", ".il", ".au"
    ] {
        if lower.ends_with(suffix) {
            return lower[..lower.len() - suffix.len()].to_string();
        }
    }
    lower
}

static NOISE_TOKENS: &[&str] = &[
    "fhd", "uhd", "4k", "8k", "1080p", "1080i", "720p", "576p", "480p", "hevc", "h264", "h265",
    "raw", "50fps", "60fps", "backup", "vip", "sd", "hd", "t2", "multiaudio", "multisub", "multi"
];

static CATEGORY_KEYWORDS: &[&str] = &[
    "film", "movie", "cinema", "sport", "sports", "fotboll", "football", "soccer", "hockey",
    "tennis", "golf", "motor", "f1", "news", "vinter", "winter", "extra", "event", "action",
    "comedy", "family", "kids", "junior", "doc", "documentary", "music", "guld", "fakta",
    "plus", "barn", "live"
];

fn map_word_to_number(w: &str) -> Option<&'static str> {
    match w {
        "zero" => Some("0"),
        "one" | "ett" | "ettan" => Some("1"),
        "two" | "tva" | "två" | "tvaan" | "tvåan" => Some("2"),
        "three" | "tre" | "trean" => Some("3"),
        "four" | "fyra" | "fyran" => Some("4"),
        "five" | "fem" | "femman" => Some("5"),
        "six" | "sex" | "sexan" => Some("6"),
        "seven" | "sju" | "sjuan" => Some("7"),
        "eight" | "atta" | "åtta" | "attan" | "åttan" => Some("8"),
        "nine" | "nio" | "nian" => Some("9"),
        "ten" | "tio" | "tian" => Some("10"),
        "tolv" | "tolvan" => Some("12"),
        _ => None,
    }
}

pub fn clean_and_tokenize_channel(raw: &str) -> (Vec<String>, Vec<String>, Vec<String>, String) {
    let mut s = raw.to_lowercase();

    // 1. Remove contents of brackets and parens
    while let Some(start) = s.find('(') {
        if let Some(end) = s[start..].find(')') {
            s.replace_range(start..=start + end, " ");
        } else {
            break;
        }
    }
    while let Some(start) = s.find('[') {
        if let Some(end) = s[start..].find(']') {
            s.replace_range(start..=start + end, " ");
        } else {
            break;
        }
    }
    while let Some(start) = s.find('{') {
        if let Some(end) = s[start..].find('}') {
            s.replace_range(start..=start + end, " ");
        } else {
            break;
        }
    }

    // 2. Strip leading country prefix if present (e.g. "SE: ", "SE| ", "[SE] ")
    let trimmed = s.trim_start();
    if let Some(colon_pos) = trimmed.find(':') {
        if colon_pos >= 2 && colon_pos <= 4 {
            s = trimmed[colon_pos + 1..].to_string();
        }
    } else if let Some(pipe_pos) = trimmed.find('|') {
        if pipe_pos >= 2 && pipe_pos <= 4 {
            s = trimmed[pipe_pos + 1..].to_string();
        }
    }

    // 3. Remove video resolution and codec tags before splitting
    for term in &[
        "1080p", "1080i", "720p", "576p", "480p", "4k", "8k", "50fps", "60fps",
        "h264", "h265", "hevc", "live during events only"
    ] {
        s = s.replace(term, " ");
    }

    // 4. Split letters and digits
    let mut tokens = Vec::new();
    let mut numbers = Vec::new();
    let mut categories = Vec::new();

    let mut current = String::new();
    let mut current_is_digit: Option<bool> = None;

    for c in s.chars() {
        if c.is_alphabetic() {
            if current_is_digit == Some(true) {
                if !current.is_empty() {
                    process_token(&current, &mut tokens, &mut numbers, &mut categories);
                    current.clear();
                }
            }
            current.push(c.to_ascii_lowercase());
            current_is_digit = Some(false);
        } else if c.is_numeric() {
            if current_is_digit == Some(false) {
                if !current.is_empty() {
                    process_token(&current, &mut tokens, &mut numbers, &mut categories);
                    current.clear();
                }
            }
            current.push(c);
            current_is_digit = Some(true);
        } else {
            if !current.is_empty() {
                process_token(&current, &mut tokens, &mut numbers, &mut categories);
                current.clear();
            }
            current_is_digit = None;
        }
    }
    if !current.is_empty() {
        process_token(&current, &mut tokens, &mut numbers, &mut categories);
    }

    numbers.sort();
    numbers.dedup();
    categories.sort();
    categories.dedup();

    let normalized = tokens.concat();
    (tokens, numbers, categories, normalized)
}

fn process_token(token: &str, tokens: &mut Vec<String>, numbers: &mut Vec<String>, categories: &mut Vec<String>) {
    let t = token.trim();
    if t.is_empty() || NOISE_TOKENS.contains(&t) {
        return;
    }
    if let Some(mapped_num) = map_word_to_number(t) {
        tokens.push(mapped_num.to_string());
        if !numbers.contains(&mapped_num.to_string()) {
            numbers.push(mapped_num.to_string());
        }
    } else if t.chars().all(|c| c.is_numeric()) {
        tokens.push(t.to_string());
        if !numbers.contains(&t.to_string()) {
            numbers.push(t.to_string());
        }
    } else {
        tokens.push(t.to_string());
        if CATEGORY_KEYWORDS.contains(&t) && !categories.contains(&t.to_string()) {
            categories.push(t.to_string());
        }
    }
}

#[allow(dead_code)]
pub fn normalize_for_epg_match(raw: &str) -> String {
    let (_, _, _, normalized) = clean_and_tokenize_channel(raw);
    normalized
}

pub fn prepare_epg_lookup(epg_ids: &[String]) -> Vec<PreparedEpgId> {
    epg_ids
        .iter()
        .map(|id| {
            let lower = id.trim().to_lowercase();
            let country = parse_country_code(&lower, true);
            let stripped = strip_domain_suffix(&lower);
            let (tokens, numbers, categories, normalized) = clean_and_tokenize_channel(&stripped);
            PreparedEpgId {
                original: id.clone(),
                lower,
                country,
                stripped_domain: stripped,
                tokens,
                numbers,
                categories,
                normalized,
            }
        })
        .collect()
}

pub fn find_best_match_prepared(
    channel_name: &str,
    channel_tvg_id: Option<&str>,
    prepared_epg: &[PreparedEpgId],
) -> Option<String> {
    let lower_name = channel_name.trim().to_lowercase();
    let lower_tvg = channel_tvg_id
        .map(|s| s.trim().to_lowercase())
        .filter(|s| !s.is_empty() && s != "0" && s != "-1" && s != "null" && s != "none");

    // 1. Direct exact match on tvg_id
    if let Some(ref tvg) = lower_tvg {
        if let Some(m) = prepared_epg.iter().find(|p| p.lower == *tvg || p.stripped_domain == *tvg) {
            return Some(m.original.clone());
        }
        // Normalized tvg_id match
        let (_, tvg_nums, _, tvg_norm) = clean_and_tokenize_channel(tvg);
        if !tvg_norm.is_empty() {
            if let Some(m) = prepared_epg.iter().find(|p| p.normalized == tvg_norm && p.numbers == tvg_nums) {
                return Some(m.original.clone());
            }
        }
    }

    let ch_country = parse_country_code(&lower_name, false);
    let (ch_tokens, ch_numbers, ch_cats, ch_norm) = clean_and_tokenize_channel(&lower_name);
    if ch_norm.is_empty() {
        return None;
    }

    // Filter candidate EPGs:
    // - No country conflict (e.g. channel 'se' vs epg 'nl'/'es'/'pl')
    // - Strict number consistency (e.g. Channel 1 cannot match Channel 2 or unnumbered)
    // - Strict category consistency (e.g. Film cannot match Sport or TV)
    let candidates: Vec<&PreparedEpgId> = prepared_epg.iter().filter(|p| {
        if let (Some(ref cc), Some(ref ce)) = (&ch_country, &p.country) {
            if cc != ce {
                return false;
            }
        }
        if ch_numbers != p.numbers {
            return false;
        }
        if !ch_cats.is_empty() && !p.categories.is_empty() && ch_cats != p.categories {
            return false;
        }
        true
    }).collect();

    // 2. Direct exact match on stripped channel name
    let stripped_ch = strip_domain_suffix(&lower_name);
    if let Some(m) = candidates.iter().find(|p| p.stripped_domain == stripped_ch || p.lower == stripped_ch) {
        return Some(m.original.clone());
    }

    // 3. Exact normalized string match
    if let Some(m) = candidates.iter().find(|p| p.normalized == ch_norm) {
        return Some(m.original.clone());
    }

    // 4. Exact token set match (ignoring word order, e.g. "TV4 Sweden Film" vs "TV4 Film")
    if let Some(m) = candidates.iter().find(|p| {
        p.tokens.len() == ch_tokens.len() && p.tokens.iter().all(|t| ch_tokens.contains(t))
    }) {
        return Some(m.original.clone());
    }

    // 5. High-confidence subset match ONLY when same country is confirmed
    if let Some(ref cc) = ch_country {
        if let Some(m) = candidates.iter().find(|p| {
            if p.country.as_ref() == Some(cc) {
                p.tokens.iter().all(|t| ch_tokens.contains(t))
            } else {
                false
            }
        }) {
            return Some(m.original.clone());
        }
    }

    None
}

pub fn auto_match_epg_for_channel(conn: &Connection, channel_id: i64) -> SqliteResult<Option<String>> {
    let ch = get_channel_by_id(conn, channel_id)?;
    if ch.stream_type != "live" {
        return Ok(None);
    }
    let epg_ids = get_distinct_epg_channel_ids(conn)?;
    if epg_ids.is_empty() {
        return Ok(None);
    }
    let prepared = prepare_epg_lookup(&epg_ids);
    let matched = find_best_match_prepared(&ch.name, ch.tvg_id.as_deref(), &prepared);
    if let Some(ref matched_id) = matched {
        set_override_value(conn, ch.provider_id, "channel", channel_id, "tvg_id", matched_id)?;
    }
    Ok(matched)
}

pub fn auto_match_epg_for_provider(
    conn: &Connection,
    provider_id: i64,
    overwrite_existing: bool,
) -> SqliteResult<AutoMatchResult> {
    // 1. Clean up any stale tvg_id overrides on non-live channels
    let _ = conn.execute(
        "DELETE FROM overrides WHERE target_type = 'channel' AND override_key = 'tvg_id' AND provider_id = ?1 AND target_id IN (SELECT id FROM channels WHERE stream_type != 'live')",
        rusqlite::params![provider_id],
    );

    let channels = get_all_channels_raw(conn, provider_id)?;
    let epg_ids = get_distinct_epg_channel_ids(conn)?;
    let total = channels.len();
    let mut matched_count = 0;
    let mut already_matched = 0;
    let mut matches = Vec::new();

    if epg_ids.is_empty() {
        return Ok(AutoMatchResult {
            matched_count: 0,
            already_matched: 0,
            total_channels: total,
            matches: vec![],
        });
    }

    let prepared_epg = prepare_epg_lookup(&epg_ids);

    for ch in &channels {
        if !overwrite_existing && ch.custom_tvg_id.is_some() {
            already_matched += 1;
            continue;
        }

        if let Some(best_match) = find_best_match_prepared(&ch.name, ch.tvg_id.as_deref(), &prepared_epg) {
            set_override_value(conn, provider_id, "channel", ch.id, "tvg_id", &best_match)?;
            matched_count += 1;
            matches.push(ChannelMatchInfo {
                channel_id: ch.id,
                channel_name: ch.name.clone(),
                original_tvg_id: ch.tvg_id.clone(),
                matched_epg_id: best_match,
            });
        } else if overwrite_existing && ch.custom_tvg_id.is_some() {
            // Channel has no confident match under new rules; remove stale override
            let _ = remove_override_value(conn, provider_id, "channel", ch.id, "tvg_id");
        }
    }

    Ok(AutoMatchResult {
        matched_count,
        already_matched,
        total_channels: total,
        matches,
    })
}

pub fn clear_provider_epg_overrides(conn: &Connection, provider_id: Option<i64>) -> SqliteResult<usize> {
    if let Some(pid) = provider_id {
        conn.execute(
            "DELETE FROM overrides WHERE target_type = 'channel' AND override_key = 'tvg_id' AND provider_id = ?1",
            rusqlite::params![pid],
        )
    } else {
        conn.execute(
            "DELETE FROM overrides WHERE target_type = 'channel' AND override_key = 'tvg_id'",
            [],
        )
    }
}

pub fn clean_invalid_epg_overrides(conn: &Connection) -> SqliteResult<usize> {
    let mut deleted_count = 0;

    // 1. Delete all tvg_id overrides on channels that are not 'live' (movies, series, vod)
    let non_live_deleted = conn.execute(
        "DELETE FROM overrides 
         WHERE target_type = 'channel' 
           AND override_key = 'tvg_id' 
           AND target_id IN (SELECT id FROM channels WHERE stream_type != 'live')",
        [],
    )?;
    deleted_count += non_live_deleted;

    // 2. Fetch remaining channel:tvg_id overrides to validate
    let mut stmt = conn.prepare(
        "SELECT o.id, ch.name, o.override_value
         FROM overrides o
         JOIN channels ch ON ch.id = o.target_id
         WHERE o.target_type = 'channel' AND o.override_key = 'tvg_id'"
    )?;

    let rows = stmt
        .query_map([], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?))
        })?
        .collect::<SqliteResult<Vec<_>>>()?;

    let mut ids_to_delete = Vec::new();

    for (oid, name, matched) in rows {
        // Country conflict check
        let c_ch = parse_country_code(&name, false);
        let c_epg = parse_country_code(&matched, true);
        if let (Some(ref cc), Some(ref ce)) = (&c_ch, &c_epg) {
            if cc != ce {
                ids_to_delete.push(oid);
                continue;
            }
        }

        // Specific cleanup for the widespread 'Viaplay TV.nl' bogus match on non-Dutch channels
        if matched.eq_ignore_ascii_case("Viaplay TV.nl") {
            let lower_name = name.to_lowercase();
            if !lower_name.starts_with("nl:") && !lower_name.starts_with("nl|") && !lower_name.contains("netherlands") {
                ids_to_delete.push(oid);
                continue;
            }
        }

        // Strict numbers check
        let (_, ch_nums, _, _) = clean_and_tokenize_channel(&name);
        let (_, epg_nums, _, _) = clean_and_tokenize_channel(&matched);
        if ch_nums != epg_nums {
            ids_to_delete.push(oid);
            continue;
        }

        // Strict categories check
        let (_, _, ch_cats, _) = clean_and_tokenize_channel(&name);
        let (_, _, epg_cats, _) = clean_and_tokenize_channel(&matched);
        if !ch_cats.is_empty() && !epg_cats.is_empty() && ch_cats != epg_cats {
            ids_to_delete.push(oid);
            continue;
        }
    }

    if !ids_to_delete.is_empty() {
        for chunk in ids_to_delete.chunks(500) {
            let placeholders: Vec<String> = (1..=chunk.len()).map(|i| format!("?{}", i)).collect();
            let sql = format!("DELETE FROM overrides WHERE id IN ({})", placeholders.join(", "));
            let mut del_stmt = conn.prepare(&sql)?;
            let params: Vec<&dyn rusqlite::types::ToSql> = chunk.iter().map(|id| id as &dyn rusqlite::types::ToSql).collect();
            del_stmt.execute(params.as_slice())?;
            deleted_count += chunk.len();
        }
    }

    Ok(deleted_count)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_country_code_parsing() {
        assert_eq!(parse_country_code("SE: Viaplay Film 1 FHD", false), Some("se".to_string()));
        assert_eq!(parse_country_code("DK: Viaplay Event 42", false), Some("dk".to_string()));
        assert_eq!(parse_country_code("[NL] NPO 1", false), Some("nl".to_string()));
        assert_eq!(parse_country_code("Viaplay TV.nl", true), Some("nl".to_string()));
        assert_eq!(parse_country_code("SVT1.se", true), Some("se".to_string()));
        assert_eq!(parse_country_code("Film4 HD.uk", true), Some("uk".to_string()));
        assert_eq!(parse_country_code("Discovery Channel", false), None);
        assert_eq!(parse_country_code("global.com", true), None);
    }

    #[test]
    fn test_epg_matching_prevents_viaplay_mismatch() {
        let epg_pool = vec![
            "Viaplay TV.nl".to_string(),
            "Viaplay Sport HD.se".to_string(),
            "SVT1.se".to_string(),
            "SVT2.se".to_string(),
            "Eurosport 1 HD.se".to_string(),
            "Eurosport 2 HD.se".to_string(),
            "skyshowtime1.se".to_string(),
            "skyshowtime2.se".to_string(),
            "Ghost.se".to_string(),
            "Baby TV.es".to_string(),
        ];
        let prepared = prepare_epg_lookup(&epg_pool);

        // 1. Viaplay Film 1 & 2 must NOT match Viaplay TV.nl
        assert_eq!(find_best_match_prepared("SE: Viaplay Film 1 FHD", None, &prepared), None);
        assert_eq!(find_best_match_prepared("SE: Viaplay Film 2 FHD", None, &prepared), None);

        // 2. Viaplay Event must NOT match Viaplay TV.nl
        assert_eq!(find_best_match_prepared("SE: Viaplay Event 36", None, &prepared), None);

        // 3. Movies must NOT match linear channels
        assert_eq!(find_best_match_prepared("Ghost Light - 2026", None, &prepared), None);
        assert_eq!(find_best_match_prepared("Babysitters Vs. Vamps - 2026", None, &prepared), None);

        // 4. Legitimate channels with numbers match their exact counterparts
        assert_eq!(
            find_best_match_prepared("SE: SVT 1 FHD", None, &prepared),
            Some("SVT1.se".to_string())
        );
        assert_eq!(
            find_best_match_prepared("SE: SVT 2 FHD", None, &prepared),
            Some("SVT2.se".to_string())
        );
        assert_eq!(
            find_best_match_prepared("SE: Eurosport 1 FHD", None, &prepared),
            Some("Eurosport 1 HD.se".to_string())
        );
        assert_eq!(
            find_best_match_prepared("SE: Eurosport 2 FHD", None, &prepared),
            Some("Eurosport 2 HD.se".to_string())
        );
        assert_eq!(
            find_best_match_prepared("SE: Sky Showtime 1 FHD", None, &prepared),
            Some("skyshowtime1.se".to_string())
        );
        assert_eq!(
            find_best_match_prepared("SE: Sky Showtime 2 FHD", None, &prepared),
            Some("skyshowtime2.se".to_string())
        );
    }
}

