use crate::db::{self, SyncResult};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct XtreamAccountInfo {
    pub username: Option<String>,
    pub password: Option<String>,
    pub status: Option<String>,
    pub exp_date: Option<String>,
    pub is_trial: Option<String>,
    pub active_cons: Option<String>,
    pub created_at: Option<String>,
    pub max_connections: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct XtreamAuthResponse {
    pub user_info: Option<XtreamAccountInfo>,
    pub server_info: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct XtreamCategory {
    pub category_id: Option<String>,
    pub category_name: Option<String>,
    pub parent_id: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct XtreamStream {
    pub num: Option<i64>,
    pub name: Option<String>,
    pub stream_type: Option<String>,
    pub stream_id: Option<serde_json::Value>,
    pub stream_icon: Option<String>,
    pub epg_channel_id: Option<String>,
    pub category_id: Option<String>,
    pub container_extension: Option<String>,
}

fn build_api_url(server_url: &str, username: &str, password: &str) -> String {
    let base = server_url.trim_end_matches('/');
    format!(
        "{}/player_api.php?username={}&password={}",
        base, username, password
    )
}

fn build_stream_url(
    server_url: &str,
    username: &str,
    password: &str,
    stream_id: &str,
    extension: &str,
) -> String {
    let base = server_url.trim_end_matches('/');
    format!(
        "{}/{}/{}/{}.{}",
        base, username, password, stream_id, extension
    )
}

fn build_live_stream_url(
    server_url: &str,
    username: &str,
    password: &str,
    stream_id: &str,
) -> String {
    let base = server_url.trim_end_matches('/');
    format!("{}/{}/{}/{}.ts", base, username, password, stream_id)
}

async fn http_get(url: &str, user_agent: &str) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let response = client
        .get(url)
        .header("User-Agent", user_agent)
        .send()
        .await
        .map_err(|e| format!("HTTP request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()));
    }

    response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))
}

/// Authenticate with Xtream Codes API
pub async fn authenticate(
    server_url: &str,
    username: &str,
    password: &str,
    user_agent: &str,
) -> Result<XtreamAuthResponse, String> {
    let url = build_api_url(server_url, username, password);
    let body = http_get(&url, user_agent).await?;
    let auth: XtreamAuthResponse =
        serde_json::from_str(&body).map_err(|e| format!("Failed to parse auth response: {}", e))?;
    Ok(auth)
}

/// Fetch live categories
pub async fn get_live_categories(
    server_url: &str,
    username: &str,
    password: &str,
    user_agent: &str,
) -> Result<Vec<XtreamCategory>, String> {
    let url = format!(
        "{}&action=get_live_categories",
        build_api_url(server_url, username, password)
    );
    let body = http_get(&url, user_agent).await?;
    let categories: Vec<XtreamCategory> = serde_json::from_str(&body)
        .map_err(|e| format!("Failed to parse live categories: {}", e))?;
    Ok(categories)
}

/// Fetch live streams (optionally filtered by category)
pub async fn get_live_streams(
    server_url: &str,
    username: &str,
    password: &str,
    user_agent: &str,
    category_id: Option<&str>,
) -> Result<Vec<XtreamStream>, String> {
    let mut url = format!(
        "{}&action=get_live_streams",
        build_api_url(server_url, username, password)
    );
    if let Some(cat_id) = category_id {
        url.push_str(&format!("&category_id={}", cat_id));
    }
    let body = http_get(&url, user_agent).await?;
    let streams: Vec<XtreamStream> = serde_json::from_str(&body)
        .map_err(|e| format!("Failed to parse live streams: {}", e))?;
    Ok(streams)
}

/// Fetch VOD categories
pub async fn get_vod_categories(
    server_url: &str,
    username: &str,
    password: &str,
    user_agent: &str,
) -> Result<Vec<XtreamCategory>, String> {
    let url = format!(
        "{}&action=get_vod_categories",
        build_api_url(server_url, username, password)
    );
    let body = http_get(&url, user_agent).await?;
    let categories: Vec<XtreamCategory> = serde_json::from_str(&body)
        .map_err(|e| format!("Failed to parse VOD categories: {}", e))?;
    Ok(categories)
}

/// Fetch series categories
#[allow(dead_code)]
pub async fn get_series_categories(
    server_url: &str,
    username: &str,
    password: &str,
    user_agent: &str,
) -> Result<Vec<XtreamCategory>, String> {
    let url = format!(
        "{}&action=get_series_categories",
        build_api_url(server_url, username, password)
    );
    let body = http_get(&url, user_agent).await?;
    let categories: Vec<XtreamCategory> = serde_json::from_str(&body)
        .map_err(|e| format!("Failed to parse series categories: {}", e))?;
    Ok(categories)
}

/// Fetch VOD streams
pub async fn get_vod_streams(
    server_url: &str,
    username: &str,
    password: &str,
    user_agent: &str,
    category_id: Option<&str>,
) -> Result<Vec<XtreamStream>, String> {
    let mut url = format!(
        "{}&action=get_vod_streams",
        build_api_url(server_url, username, password)
    );
    if let Some(cat_id) = category_id {
        url.push_str(&format!("&category_id={}", cat_id));
    }
    let body = http_get(&url, user_agent).await?;
    let streams: Vec<XtreamStream> = serde_json::from_str(&body)
        .map_err(|e| format!("Failed to parse VOD streams: {}", e))?;
    Ok(streams)
}

/// Fetch short EPG for a stream
#[allow(dead_code)]
pub async fn get_short_epg(
    server_url: &str,
    username: &str,
    password: &str,
    user_agent: &str,
    stream_id: &str,
) -> Result<serde_json::Value, String> {
    let url = format!(
        "{}&action=get_short_epg&stream_id={}",
        build_api_url(server_url, username, password),
        stream_id
    );
    let body = http_get(&url, user_agent).await?;
    let epg: serde_json::Value =
        serde_json::from_str(&body).map_err(|e| format!("Failed to parse short EPG: {}", e))?;
    Ok(epg)
}

/// Full sync of an Xtream provider: authenticate, fetch categories and streams, store in DB
pub async fn sync_xtream_provider(
    app_handle: tauri::AppHandle,
    provider_id: i64,
) -> Result<SyncResult, String> {
    let (server_url, username, password, user_agent) = {
        let state = app_handle.state::<db::DbState>();
        let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
        let provider = db::get_provider_by_id(&conn, provider_id)
            .map_err(|e| format!("Provider not found: {}", e))?;

        let server_url = provider
            .server_url
            .ok_or("No server URL configured")?;
        let username = provider.username.ok_or("No username configured")?;
        let password = provider.password.ok_or("No password configured")?;
        let user_agent = provider.user_agent;

        (server_url, username, password, user_agent)
    };

    // Authenticate and update account info
    let auth = authenticate(&server_url, &username, &password, &user_agent).await?;
    if let Some(user_info) = &auth.user_info {
        let state = app_handle.state::<db::DbState>();
        let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
        db::update_provider_account_info(
            &conn,
            provider_id,
            user_info.status.as_deref().unwrap_or("unknown"),
            user_info.exp_date.as_deref().unwrap_or(""),
            user_info
                .max_connections
                .as_ref()
                .and_then(|s| s.parse().ok())
                .unwrap_or(0),
            user_info
                .active_cons
                .as_ref()
                .and_then(|s| s.parse().ok())
                .unwrap_or(0),
        )
        .map_err(|e| format!("Failed to update account info: {}", e))?;
    }

    // Clear existing data
    {
        let state = app_handle.state::<db::DbState>();
        let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
        db::delete_channels_by_provider(&conn, provider_id)
            .map_err(|e| format!("Failed to clear channels: {}", e))?;
        db::delete_categories_by_provider(&conn, provider_id)
            .map_err(|e| format!("Failed to clear categories: {}", e))?;
    }

    let mut categories_count = 0;
    let mut channels_count = 0;

    // Fetch and store live categories + streams
    let live_cats = get_live_categories(&server_url, &username, &password, &user_agent).await?;

    {
        let state = app_handle.state::<db::DbState>();
        let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;

        for (i, cat) in live_cats.iter().enumerate() {
            let cat_name = cat.category_name.as_deref().unwrap_or("Unknown");
            let remote_id = cat.category_id.as_deref();
            db::insert_category(&conn, provider_id, remote_id, cat_name, "live", i as i32)
                .map_err(|e| format!("Failed to insert category: {}", e))?;
            categories_count += 1;
        }
    }

    // Fetch all live streams
    let live_streams =
        get_live_streams(&server_url, &username, &password, &user_agent, None).await?;

    {
        let state = app_handle.state::<db::DbState>();
        let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;

        // Build category remote_id -> local_id map
        let cats = db::get_categories_by_provider(&conn, provider_id, "live")
            .map_err(|e| format!("Failed to get categories: {}", e))?;
        let cat_map: HashMap<String, i64> = cats
            .iter()
            .filter_map(|c| c.remote_id.as_ref().map(|rid| (rid.clone(), c.id)))
            .collect();

        conn.execute_batch("BEGIN TRANSACTION;")
            .map_err(|e| format!("Failed to begin transaction: {}", e))?;

        let mut channel_stmt = conn
            .prepare(
                "INSERT INTO channels (provider_id, category_id, remote_id, tvg_id, name, logo_url, stream_url, stream_type, container_extension, sort_order)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            )
            .map_err(|e| format!("Failed to prepare statement: {}", e))?;

        for (i, stream) in live_streams.iter().enumerate() {
            let stream_name = stream.name.as_deref().unwrap_or("Unknown");
            let stream_id_val = match &stream.stream_id {
                Some(serde_json::Value::Number(n)) => n.to_string(),
                Some(serde_json::Value::String(s)) => s.clone(),
                _ => continue,
            };

            let category_id = stream
                .category_id
                .as_ref()
                .and_then(|cid| cat_map.get(cid))
                .copied();

            let stream_url =
                build_live_stream_url(&server_url, &username, &password, &stream_id_val);

            channel_stmt
                .execute(rusqlite::params![
                    provider_id,
                    category_id,
                    Some(&stream_id_val),
                    stream.epg_channel_id.as_deref(),
                    stream_name,
                    stream.stream_icon.as_deref(),
                    &stream_url,
                    "live",
                    Some("ts"),
                    i as i32,
                ])
                .map_err(|e| format!("Failed to insert channel: {}", e))?;
            channels_count += 1;
        }

        drop(channel_stmt);
        conn.execute_batch("COMMIT;")
            .map_err(|e| format!("Failed to commit transaction: {}", e))?;
    }

    // Fetch and store VOD categories + streams
    if let Ok(vod_cats) =
        get_vod_categories(&server_url, &username, &password, &user_agent).await
    {
        let state = app_handle.state::<db::DbState>();
        let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;

        for (i, cat) in vod_cats.iter().enumerate() {
            let cat_name = cat.category_name.as_deref().unwrap_or("Unknown");
            let remote_id = cat.category_id.as_deref();
            db::insert_category(&conn, provider_id, remote_id, cat_name, "vod", i as i32)
                .map_err(|e| format!("Failed to insert VOD category: {}", e))?;
            categories_count += 1;
        }
    }

    if let Ok(vod_streams) =
        get_vod_streams(&server_url, &username, &password, &user_agent, None).await
    {
        let state = app_handle.state::<db::DbState>();
        let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;

        let cats = db::get_categories_by_provider(&conn, provider_id, "vod")
            .map_err(|e| format!("Failed to get VOD categories: {}", e))?;
        let cat_map: HashMap<String, i64> = cats
            .iter()
            .filter_map(|c| c.remote_id.as_ref().map(|rid| (rid.clone(), c.id)))
            .collect();

        conn.execute_batch("BEGIN TRANSACTION;")
            .map_err(|e| format!("Failed to begin transaction: {}", e))?;

        let mut channel_stmt = conn
            .prepare(
                "INSERT INTO channels (provider_id, category_id, remote_id, tvg_id, name, logo_url, stream_url, stream_type, container_extension, sort_order)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            )
            .map_err(|e| format!("Failed to prepare statement: {}", e))?;

        for (i, stream) in vod_streams.iter().enumerate() {
            let stream_name = stream.name.as_deref().unwrap_or("Unknown");
            let stream_id_val = match &stream.stream_id {
                Some(serde_json::Value::Number(n)) => n.to_string(),
                Some(serde_json::Value::String(s)) => s.clone(),
                _ => continue,
            };
            let ext = stream
                .container_extension
                .as_deref()
                .unwrap_or("mp4");
            let category_id = stream
                .category_id
                .as_ref()
                .and_then(|cid| cat_map.get(cid))
                .copied();
            let stream_url =
                build_stream_url(&server_url, &username, &password, &stream_id_val, ext);

            channel_stmt
                .execute(rusqlite::params![
                    provider_id,
                    category_id,
                    Some(&stream_id_val),
                    stream.epg_channel_id.as_deref(),
                    stream_name,
                    stream.stream_icon.as_deref(),
                    &stream_url,
                    "vod",
                    Some(ext),
                    i as i32,
                ])
                .map_err(|e| format!("Failed to insert VOD channel: {}", e))?;
            channels_count += 1;
        }

        drop(channel_stmt);
        conn.execute_batch("COMMIT;")
            .map_err(|e| format!("Failed to commit transaction: {}", e))?;
    }

    // Update synced timestamp
    {
        let state = app_handle.state::<db::DbState>();
        let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
        db::update_provider_synced(&conn, provider_id)
            .map_err(|e| format!("Failed to update sync time: {}", e))?;
    }

    Ok(SyncResult {
        categories_count,
        channels_count,
    })
}
