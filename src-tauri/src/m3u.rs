use crate::db::{self, SyncResult};
use rusqlite::Connection;
use tauri::Manager;

/// Parse M3U content and insert channels into the database.
/// Optimized with transaction batching and in-memory category caching to prevent OOM.
pub fn parse_m3u_content(
    conn: &Connection,
    provider_id: i64,
    content: &str,
) -> Result<SyncResult, String> {
    // Clear existing data for this provider before re-importing
    db::delete_channels_by_provider(conn, provider_id)
        .map_err(|e| format!("Failed to clear channels: {}", e))?;
    db::delete_categories_by_provider(conn, provider_id)
        .map_err(|e| format!("Failed to clear categories: {}", e))?;

    // In-memory cache for categories: name -> category_id
    let mut category_cache: std::collections::HashMap<String, i64> = std::collections::HashMap::new();
    let mut channels_count = 0;
    let mut sort_order = 0;

    // Use a single transaction for all category and channel inserts
    conn.execute_batch("BEGIN TRANSACTION;")
        .map_err(|e| format!("Failed to begin transaction: {}", e))?;

    let mut channel_stmt = conn
        .prepare(
            "INSERT INTO channels (provider_id, category_id, remote_id, tvg_id, name, logo_url, stream_url, stream_type, container_extension, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        )
        .map_err(|e| format!("Failed to prepare channel statement: {}", e))?;

    let mut lines = content.lines();

    while let Some(line_raw) = lines.next() {
        let line = line_raw.trim();

        if line.starts_with("#EXTINF:") {
            let extinf = parse_extinf(line);

            // Find the URL line following this EXTINF
            let mut url = String::new();
            for next_line_raw in lines.by_ref() {
                let next_line = next_line_raw.trim();
                if !next_line.is_empty() && !next_line.starts_with('#') {
                    url = next_line.to_string();
                    break;
                }
            }

            if !url.is_empty() {
                let group = extinf.group_title.as_deref().unwrap_or("Uncategorized");

                // Get category_id from in-memory cache or insert once
                let category_id = match category_cache.get(group) {
                    Some(&id) => id,
                    None => {
                        let id = db::insert_category(
                            conn,
                            provider_id,
                            None,
                            group,
                            "live",
                            category_cache.len() as i32,
                        )
                        .map_err(|e| format!("Failed to create category: {}", e))?;
                        category_cache.insert(group.to_string(), id);
                        id
                    }
                };

                let stream_type = if url.contains("/movie/") || url.ends_with(".mp4") || url.ends_with(".mkv") {
                    "vod"
                } else if url.contains("/series/") {
                    "series"
                } else {
                    "live"
                };

                let ext = url.rsplit('.').next().map(|s| s.to_string());

                channel_stmt
                    .execute(rusqlite::params![
                        provider_id,
                        Some(category_id),
                        Option::<&str>::None,
                        extinf.tvg_id.as_deref(),
                        &extinf.name,
                        extinf.tvg_logo.as_deref(),
                        &url,
                        stream_type,
                        ext.as_deref(),
                        sort_order,
                    ])
                    .map_err(|e| format!("Failed to insert channel: {}", e))?;

                channels_count += 1;
                sort_order += 1;
            }
        }
    }

    drop(channel_stmt);

    conn.execute_batch("COMMIT;")
        .map_err(|e| format!("Failed to commit transaction: {}", e))?;

    let categories_count = category_cache.len() as i32;

    Ok(SyncResult {
        categories_count,
        channels_count,
    })
}

#[derive(Debug, Default)]
struct ExtInf {
    tvg_id: Option<String>,
    tvg_name: Option<String>,
    tvg_logo: Option<String>,
    group_title: Option<String>,
    name: String,
}

fn parse_extinf(line: &str) -> ExtInf {
    let mut result = ExtInf::default();

    // Remove "#EXTINF:" prefix and duration
    let content = if let Some(after) = line.strip_prefix("#EXTINF:") {
        after
    } else {
        return result;
    };

    // Split by comma to get display name (last part after final comma)
    // But we need to be careful: the comma separating attrs from name
    // Format: #EXTINF:-1 tvg-id="..." tvg-name="..." tvg-logo="..." group-title="...",Channel Name
    if let Some(comma_pos) = content.rfind(',') {
        let attrs_part = &content[..comma_pos];
        result.name = content[comma_pos + 1..].trim().to_string();

        // Parse attributes from attrs_part
        result.tvg_id = extract_attr(attrs_part, "tvg-id");
        result.tvg_name = extract_attr(attrs_part, "tvg-name");
        result.tvg_logo = extract_attr(attrs_part, "tvg-logo");
        result.group_title = extract_attr(attrs_part, "group-title");
    } else {
        result.name = content.trim().to_string();
    }

    if result.name.is_empty() {
        if let Some(ref tvg_name) = result.tvg_name {
            result.name = tvg_name.clone();
        }
    }

    result
}

fn extract_attr(text: &str, attr_name: &str) -> Option<String> {
    let pattern = format!("{}=\"", attr_name);
    if let Some(start) = text.find(&pattern) {
        let value_start = start + pattern.len();
        if let Some(end) = text[value_start..].find('"') {
            let value = &text[value_start..value_start + end];
            if !value.is_empty() {
                return Some(value.to_string());
            }
        }
    }
    None
}

/// Fetch M3U content from a URL using reqwest with custom User-Agent
pub async fn fetch_m3u_from_url(url: &str, user_agent: &str) -> Result<String, String> {
    let client = reqwest::Client::new();
    let response = client
        .get(url)
        .header("User-Agent", user_agent)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch M3U: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "HTTP error fetching M3U: {}",
            response.status()
        ));
    }

    response
        .text()
        .await
        .map_err(|e| format!("Failed to read M3U response: {}", e))
}

/// Sync an M3U provider: fetch content and parse it
pub async fn sync_m3u_provider(
    app_handle: tauri::AppHandle,
    provider_id: i64,
) -> Result<SyncResult, String> {
    let (m3u_url, m3u_local_path, user_agent) = {
        let state = app_handle.state::<db::DbState>();
        let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
        let provider = db::get_provider_by_id(&conn, provider_id)
            .map_err(|e| format!("Provider not found: {}", e))?;
        (provider.m3u_url, provider.m3u_local_path, provider.user_agent)
    };

    let content = if let Some(ref url) = m3u_url {
        fetch_m3u_from_url(url, &user_agent).await?
    } else if let Some(ref path) = m3u_local_path {
        std::fs::read_to_string(path)
            .map_err(|e| format!("Failed to read M3U file: {}", e))?
    } else {
        return Err("No M3U URL or local path configured".to_string());
    };

    // Re-acquire lock for parsing
    let state = app_handle.state::<db::DbState>();
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;

    let result = parse_m3u_content(&conn, provider_id, &content)?;

    db::update_provider_synced(&conn, provider_id)
        .map_err(|e| format!("Failed to update sync time: {}", e))?;

    Ok(result)
}

/// Generate M3U export content with overrides applied
pub fn export_m3u(conn: &Connection, provider_id: i64) -> Result<String, String> {
    let channels = db::get_all_channels_for_export(conn, provider_id)
        .map_err(|e| format!("Failed to get channels for export: {}", e))?;

    let mut output = String::from("#EXTM3U\n");

    for (channel, cat_name, override_name) in &channels {
        // Skip hidden channels
        if channel.is_hidden == Some(true) {
            continue;
        }

        let display_name = override_name
            .as_ref()
            .unwrap_or(&channel.name);
        let group = cat_name.as_deref().unwrap_or("Uncategorized");
        let tvg_id = channel.tvg_id.as_deref().unwrap_or("");
        let logo = channel.logo_url.as_deref().unwrap_or("");

        output.push_str(&format!(
            "#EXTINF:-1 tvg-id=\"{}\" tvg-name=\"{}\" tvg-logo=\"{}\" group-title=\"{}\",{}\n",
            tvg_id, display_name, logo, group, display_name
        ));
        output.push_str(&channel.stream_url);
        output.push('\n');
    }

    Ok(output)
}
