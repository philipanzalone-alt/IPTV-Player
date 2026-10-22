mod db;
mod epg;
mod m3u;
mod proxy;
mod xtream;

use db::{
    AutoMatchResult, Channel, CustomGroup, DbState, EpgProgram, EpgSyncResult,
    Override as DbOverride, Provider, SyncResult,
};
use std::collections::HashMap;
use tauri::Manager;

// ─── Provider Commands ───

#[tauri::command]
async fn add_xtream_provider(
    app_handle: tauri::AppHandle,
    name: String,
    server_url: String,
    username: String,
    password: String,
    user_agent: Option<String>,
) -> Result<Provider, String> {
    let ua = user_agent.unwrap_or_else(|| "VLC/3.0.20".to_string());
    let state = app_handle.state::<DbState>();
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;

    let id = db::insert_provider(
        &conn,
        &name,
        "xtream",
        Some(&server_url),
        Some(&username),
        Some(&password),
        None,
        None,
        &ua,
        None,
    )
    .map_err(|e| format!("Failed to add provider: {}", e))?;

    db::get_provider_by_id(&conn, id).map_err(|e| format!("Failed to get provider: {}", e))
}

#[tauri::command]
async fn add_m3u_provider(
    app_handle: tauri::AppHandle,
    name: String,
    m3u_url: Option<String>,
    m3u_local_path: Option<String>,
    user_agent: Option<String>,
    epg_url: Option<String>,
) -> Result<Provider, String> {
    let ua = user_agent.unwrap_or_else(|| "VLC/3.0.20".to_string());
    let state = app_handle.state::<DbState>();
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;

    let id = db::insert_provider(
        &conn,
        &name,
        "m3u",
        None,
        None,
        None,
        m3u_url.as_deref(),
        m3u_local_path.as_deref(),
        &ua,
        epg_url.as_deref(),
    )
    .map_err(|e| format!("Failed to add provider: {}", e))?;

    db::get_provider_by_id(&conn, id).map_err(|e| format!("Failed to get provider: {}", e))
}

#[tauri::command]
async fn get_providers(app_handle: tauri::AppHandle) -> Result<Vec<Provider>, String> {
    let state = app_handle.state::<DbState>();
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
    db::get_all_providers(&conn).map_err(|e| format!("Failed to get providers: {}", e))
}

#[tauri::command]
async fn delete_provider(app_handle: tauri::AppHandle, provider_id: i64) -> Result<(), String> {
    let state = app_handle.state::<DbState>();
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
    db::delete_provider_by_id(&conn, provider_id)
        .map_err(|e| format!("Failed to delete provider: {}", e))
}

#[tauri::command]
async fn sync_provider(
    app_handle: tauri::AppHandle,
    provider_id: i64,
) -> Result<SyncResult, String> {
    let provider_type = {
        let state = app_handle.state::<DbState>();
        let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
        let provider = db::get_provider_by_id(&conn, provider_id)
            .map_err(|e| format!("Provider not found: {}", e))?;
        provider.provider_type.clone()
    };

    match provider_type.as_str() {
        "xtream" => xtream::sync_xtream_provider(app_handle, provider_id).await,
        "m3u" => m3u::sync_m3u_provider(app_handle, provider_id).await,
        _ => Err(format!("Unknown provider type: {}", provider_type)),
    }
}

// ─── Category Commands ───

#[tauri::command]
async fn get_categories(
    app_handle: tauri::AppHandle,
    provider_id: i64,
    content_type: String,
) -> Result<Vec<db::Category>, String> {
    let state = app_handle.state::<DbState>();
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
    db::get_categories_by_provider(&conn, provider_id, &content_type)
        .map_err(|e| format!("Failed to get categories: {}", e))
}

#[tauri::command]
async fn delete_category(
    app_handle: tauri::AppHandle,
    category_id: i64,
) -> Result<(), String> {
    let state = app_handle.state::<DbState>();
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
    db::delete_category_by_id(&conn, category_id)
        .map_err(|e| format!("Failed to delete category: {}", e))
}

#[tauri::command]
async fn reorder_categories(
    app_handle: tauri::AppHandle,
    provider_id: i64,
    category_ids: Vec<i64>,
) -> Result<(), String> {
    let state = app_handle.state::<DbState>();
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
    db::reorder_categories(&conn, provider_id, &category_ids)
        .map_err(|e| format!("Failed to reorder categories: {}", e))
}

#[tauri::command]
async fn keep_only_sweden_categories(
    app_handle: tauri::AppHandle,
    provider_id: i64,
) -> Result<usize, String> {
    let state = app_handle.state::<DbState>();
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
    db::keep_only_sweden_categories(&conn, provider_id)
        .map_err(|e| format!("Failed to filter Sweden categories: {}", e))
}

#[tauri::command]
async fn delete_channel(
    app_handle: tauri::AppHandle,
    channel_id: i64,
) -> Result<(), String> {
    let state = app_handle.state::<DbState>();
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
    db::delete_channel_by_id(&conn, channel_id)
        .map_err(|e| format!("Failed to delete channel: {}", e))
}

#[tauri::command]
async fn reorder_channels(
    app_handle: tauri::AppHandle,
    provider_id: i64,
    channel_ids: Vec<i64>,
) -> Result<(), String> {
    let state = app_handle.state::<DbState>();
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
    db::reorder_channels(&conn, provider_id, &channel_ids)
        .map_err(|e| format!("Failed to reorder channels: {}", e))
}

// ─── Channel Commands ───

#[tauri::command]
async fn get_channels(
    app_handle: tauri::AppHandle,
    provider_id: i64,
    category_id: Option<i64>,
) -> Result<Vec<Channel>, String> {
    let state = app_handle.state::<DbState>();
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
    db::get_channels_by_category(&conn, provider_id, category_id)
        .map_err(|e| format!("Failed to get channels: {}", e))
}

#[tauri::command]
async fn search_channels(
    app_handle: tauri::AppHandle,
    provider_id: i64,
    query: String,
) -> Result<Vec<Channel>, String> {
    let state = app_handle.state::<DbState>();
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
    db::search_channels_by_name(&conn, provider_id, &query)
        .map_err(|e| format!("Failed to search channels: {}", e))
}

#[tauri::command]
async fn get_channel_stream_url(
    app_handle: tauri::AppHandle,
    channel_id: i64,
) -> Result<String, String> {
    let state = app_handle.state::<DbState>();
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
    let channel = db::get_channel_by_id(&conn, channel_id)
        .map_err(|e| format!("Channel not found: {}", e))?;
    Ok(channel.stream_url)
}

// ─── EPG Commands ───

#[tauri::command]
async fn sync_epg(
    app_handle: tauri::AppHandle,
    provider_id: i64,
) -> Result<EpgSyncResult, String> {
    epg::sync_xtream_epg(app_handle, provider_id).await
}

#[tauri::command]
async fn get_channel_epg(
    app_handle: tauri::AppHandle,
    channel_tvg_id: String,
    provider_id: i64,
) -> Result<Vec<EpgProgram>, String> {
    let state = app_handle.state::<DbState>();
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
    db::get_channel_epg_programs(&conn, &channel_tvg_id, provider_id)
        .map_err(|e| format!("Failed to get EPG: {}", e))
}

#[tauri::command]
async fn get_now_playing(
    app_handle: tauri::AppHandle,
    channel_ids: Vec<i64>,
    provider_id: Option<i64>,
) -> Result<HashMap<String, EpgProgram>, String> {
    let state = app_handle.state::<DbState>();
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;

    let mut map: HashMap<String, EpgProgram> = HashMap::new();
    if channel_ids.is_empty() {
        return Ok(map);
    }

    let channel_mappings = db::get_channel_epg_keys_batch(&conn, &channel_ids)
        .map_err(|e| format!("Error getting channel keys: {}", e))?;

    let mut lookup_keys: Vec<String> = Vec::new();
    for (_, keys) in &channel_mappings {
        for k in keys {
            if !lookup_keys.contains(k) {
                lookup_keys.push(k.clone());
            }
        }
    }

    if lookup_keys.is_empty() {
        return Ok(map);
    }

    let pid = provider_id.unwrap_or(0);
    if let Ok(results) = db::get_now_playing_for_channels(&conn, pid, &lookup_keys) {
        let mut results_lower: HashMap<String, EpgProgram> = HashMap::new();
        for (tvg_id, program) in results {
            // First entry per tvg_id is preferred because query is ordered with is_current DESC
            results_lower.entry(tvg_id.to_lowercase()).or_insert(program);
        }

        for (ch_id, keys) in channel_mappings {
            for key in keys {
                let lower = key.to_lowercase();
                if let Some(prog) = results_lower.get(&lower) {
                    map.insert(ch_id.to_string(), prog.clone());
                    map.insert(key.clone(), prog.clone());
                    map.insert(lower, prog.clone());
                    break;
                }
            }
        }
    }

    Ok(map)
}

// ─── Override Commands ───

#[tauri::command]
async fn set_override(
    app_handle: tauri::AppHandle,
    provider_id: i64,
    target_type: String,
    target_id: i64,
    key: String,
    value: String,
) -> Result<(), String> {
    let state = app_handle.state::<DbState>();
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
    db::set_override_value(&conn, provider_id, &target_type, target_id, &key, &value)
        .map_err(|e| format!("Failed to set override: {}", e))
}

#[tauri::command]
async fn remove_override(
    app_handle: tauri::AppHandle,
    provider_id: i64,
    target_type: String,
    target_id: i64,
    key: String,
) -> Result<(), String> {
    let state = app_handle.state::<DbState>();
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
    db::remove_override_value(&conn, provider_id, &target_type, target_id, &key)
        .map_err(|e| format!("Failed to remove override: {}", e))
}

#[tauri::command]
async fn get_overrides(
    app_handle: tauri::AppHandle,
    provider_id: i64,
) -> Result<Vec<DbOverride>, String> {
    let state = app_handle.state::<DbState>();
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
    db::get_overrides_by_provider(&conn, provider_id)
        .map_err(|e| format!("Failed to get overrides: {}", e))
}

// ─── Custom Group Commands ───

#[tauri::command]
async fn create_custom_group(
    app_handle: tauri::AppHandle,
    name: String,
) -> Result<CustomGroup, String> {
    let state = app_handle.state::<DbState>();
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
    db::create_custom_group_record(&conn, &name)
        .map_err(|e| format!("Failed to create group: {}", e))
}

#[tauri::command]
async fn delete_custom_group(
    app_handle: tauri::AppHandle,
    group_id: i64,
) -> Result<(), String> {
    let state = app_handle.state::<DbState>();
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
    db::delete_custom_group_record(&conn, group_id)
        .map_err(|e| format!("Failed to delete group: {}", e))
}

#[tauri::command]
async fn get_custom_groups(app_handle: tauri::AppHandle) -> Result<Vec<CustomGroup>, String> {
    let state = app_handle.state::<DbState>();
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
    db::get_all_custom_groups(&conn).map_err(|e| format!("Failed to get groups: {}", e))
}

#[tauri::command]
async fn add_channel_to_group(
    app_handle: tauri::AppHandle,
    group_id: i64,
    channel_id: i64,
) -> Result<(), String> {
    let state = app_handle.state::<DbState>();
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
    db::add_channel_to_custom_group(&conn, group_id, channel_id)
        .map_err(|e| format!("Failed to add to group: {}", e))
}

#[tauri::command]
async fn remove_channel_from_group(
    app_handle: tauri::AppHandle,
    group_id: i64,
    channel_id: i64,
) -> Result<(), String> {
    let state = app_handle.state::<DbState>();
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
    db::remove_channel_from_custom_group(&conn, group_id, channel_id)
        .map_err(|e| format!("Failed to remove from group: {}", e))
}

#[tauri::command]
async fn reorder_group_channels(
    app_handle: tauri::AppHandle,
    group_id: i64,
    channel_ids: Vec<i64>,
) -> Result<(), String> {
    let state = app_handle.state::<DbState>();
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
    db::reorder_group_channel_entries(&conn, group_id, &channel_ids)
        .map_err(|e| format!("Failed to reorder: {}", e))
}

// ─── Favorite Commands ───

#[tauri::command]
async fn toggle_favorite(
    app_handle: tauri::AppHandle,
    channel_id: i64,
) -> Result<bool, String> {
    let state = app_handle.state::<DbState>();
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
    db::toggle_favorite_channel(&conn, channel_id)
        .map_err(|e| format!("Failed to toggle favorite: {}", e))
}

#[tauri::command]
async fn get_favorites(app_handle: tauri::AppHandle) -> Result<Vec<Channel>, String> {
    let state = app_handle.state::<DbState>();
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
    db::get_favorite_channels(&conn).map_err(|e| format!("Failed to get favorites: {}", e))
}

#[tauri::command]
async fn reorder_favorites(
    app_handle: tauri::AppHandle,
    channel_ids: Vec<i64>,
) -> Result<(), String> {
    let state = app_handle.state::<DbState>();
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
    db::reorder_favorite_entries(&conn, &channel_ids)
        .map_err(|e| format!("Failed to reorder favorites: {}", e))
}

// ─── Proxy Command ───

#[tauri::command]
async fn proxy_request(
    url: String,
    user_agent: Option<String>,
    headers: Option<HashMap<String, String>>,
) -> Result<proxy::ProxyResponse, String> {
    let ua = user_agent.unwrap_or_else(|| "VLC/3.0.20".to_string());
    proxy::proxy_get(&url, &ua, headers).await
}

// ─── Export Command ───

#[tauri::command]
async fn export_playlist(
    app_handle: tauri::AppHandle,
    provider_id: i64,
) -> Result<String, String> {
    let state = app_handle.state::<DbState>();
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
    m3u::export_m3u(&conn, provider_id)
}

// ─── Custom Playlist Commands (Consisting of Categories) ───

#[tauri::command]
async fn create_custom_playlist(
    app_handle: tauri::AppHandle,
    name: String,
) -> Result<db::CustomPlaylist, String> {
    let state = app_handle.state::<DbState>();
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
    db::create_custom_playlist_record(&conn, &name)
        .map_err(|e| format!("Failed to create playlist: {}", e))
}

#[tauri::command]
async fn delete_custom_playlist(
    app_handle: tauri::AppHandle,
    playlist_id: i64,
) -> Result<(), String> {
    let state = app_handle.state::<DbState>();
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
    db::delete_custom_playlist_record(&conn, playlist_id)
        .map_err(|e| format!("Failed to delete playlist: {}", e))
}

#[tauri::command]
async fn get_custom_playlists(
    app_handle: tauri::AppHandle,
) -> Result<Vec<db::CustomPlaylist>, String> {
    let state = app_handle.state::<DbState>();
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
    db::get_all_custom_playlists(&conn)
        .map_err(|e| format!("Failed to get playlists: {}", e))
}

#[tauri::command]
async fn set_custom_playlist_categories(
    app_handle: tauri::AppHandle,
    playlist_id: i64,
    category_ids: Vec<i64>,
) -> Result<(), String> {
    let state = app_handle.state::<DbState>();
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
    db::set_custom_playlist_categories(&conn, playlist_id, &category_ids)
        .map_err(|e| format!("Failed to set playlist categories: {}", e))
}

#[tauri::command]
async fn get_channels_by_custom_playlist(
    app_handle: tauri::AppHandle,
    playlist_id: i64,
    provider_id: i64,
) -> Result<Vec<Channel>, String> {
    let state = app_handle.state::<DbState>();
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
    db::get_channels_by_custom_playlist(&conn, playlist_id, provider_id)
        .map_err(|e| format!("Failed to get playlist channels: {}", e))
}

// ─── Video Clip Saver ───

#[tauri::command]
async fn save_video_clip(
    app_handle: tauri::AppHandle,
    filename: String,
    base64_data: String,
) -> Result<String, String> {
    use std::io::Write;
    let videos_dir = app_handle
        .path()
        .video_dir()
        .or_else(|_| app_handle.path().download_dir())
        .map_err(|e| format!("Failed to resolve save directory: {}", e))?;

    let clips_dir = videos_dir.join("IPTV_Clips");
    std::fs::create_dir_all(&clips_dir)
        .map_err(|e| format!("Failed to create clips directory: {}", e))?;

    let safe_filename = if filename.is_empty() {
        format!("IPTV_Clip_{}.webm", chrono::Local::now().format("%Y%m%d_%H%M%S"))
    } else {
        filename
    };

    let target_path = clips_dir.join(&safe_filename);

    let clean_base64 = if let Some(idx) = base64_data.find(',') {
        &base64_data[idx + 1..]
    } else {
        &base64_data
    };

    use base64::Engine;
    let decoded = base64::engine::general_purpose::STANDARD
        .decode(clean_base64)
        .map_err(|e| format!("Failed to decode base64 clip data: {}", e))?;

    let mut file = std::fs::File::create(&target_path)
        .map_err(|e| format!("Failed to create clip file: {}", e))?;
    file.write_all(&decoded)
        .map_err(|e| format!("Failed to write clip data: {}", e))?;

    Ok(target_path.to_string_lossy().to_string())
}

// ─── EPG Sources Commands ───

#[tauri::command]
async fn get_epg_sources(
    app_handle: tauri::AppHandle,
    provider_id: Option<i64>,
) -> Result<Vec<db::EpgSource>, String> {
    let state = app_handle.state::<DbState>();
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
    db::get_all_epg_sources(&conn, provider_id)
        .map_err(|e| format!("Failed to get EPG sources: {}", e))
}

#[tauri::command]
async fn add_epg_source(
    app_handle: tauri::AppHandle,
    name: String,
    url: String,
    provider_id: Option<i64>,
) -> Result<db::EpgSource, String> {
    let state = app_handle.state::<DbState>();
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
    db::create_epg_source_record(&conn, &name, &url, provider_id)
        .map_err(|e| format!("Failed to create EPG source: {}", e))
}

#[tauri::command]
async fn delete_epg_source(
    app_handle: tauri::AppHandle,
    source_id: i64,
) -> Result<(), String> {
    let state = app_handle.state::<DbState>();
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
    db::delete_epg_source_record(&conn, source_id)
        .map_err(|e| format!("Failed to delete EPG source: {}", e))
}

#[tauri::command]
async fn sync_epg_source(
    app_handle: tauri::AppHandle,
    source_id: i64,
) -> Result<EpgSyncResult, String> {
    let (url, provider_id) = {
        let state = app_handle.state::<DbState>();
        let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
        let src = db::get_epg_source_by_id(&conn, source_id)
            .map_err(|e| format!("EPG source not found: {}", e))?;
        (src.url, src.provider_id.unwrap_or(1))
    };

    let result = epg::sync_epg_from_url(app_handle.clone(), provider_id, &url, "VLC/3.0.20").await?;

    {
        let state = app_handle.state::<DbState>();
        let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
        let _ = db::update_epg_source_synced_at(&conn, source_id);
    }

    Ok(result)
}

#[tauri::command]
async fn sync_all_epg_sources(
    app_handle: tauri::AppHandle,
    provider_id: Option<i64>,
) -> Result<EpgSyncResult, String> {
    let sources = {
        let state = app_handle.state::<DbState>();
        let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
        db::get_all_epg_sources(&conn, provider_id)
            .map_err(|e| format!("Failed to get sources: {}", e))?
    };

    let mut total_programs = 0;
    for src in sources {
        let pid = src.provider_id.or(provider_id).unwrap_or(1);
        if let Ok(res) = epg::sync_epg_from_url(app_handle.clone(), pid, &src.url, "VLC/3.0.20").await {
            total_programs += res.programs_count;
            if let Ok(conn) = app_handle.state::<DbState>().0.lock() {
                let _ = db::update_epg_source_synced_at(&conn, src.id);
            }
        }
    }

    Ok(EpgSyncResult {
        programs_count: total_programs,
    })
}

// ─── EPG Auto-Matching & Maintenance Commands ───

#[tauri::command]
async fn auto_match_epg(
    app_handle: tauri::AppHandle,
    provider_id: i64,
    overwrite_existing: Option<bool>,
) -> Result<AutoMatchResult, String> {
    let state = app_handle.state::<DbState>();
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
    db::auto_match_epg_for_provider(&conn, provider_id, overwrite_existing.unwrap_or(false))
        .map_err(|e| format!("Auto match EPG error: {}", e))
}

#[tauri::command]
async fn auto_match_channel_epg(
    app_handle: tauri::AppHandle,
    channel_id: i64,
) -> Result<Option<String>, String> {
    let state = app_handle.state::<DbState>();
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
    db::auto_match_epg_for_channel(&conn, channel_id)
        .map_err(|e| format!("Auto match channel EPG error: {}", e))
}

#[tauri::command]
async fn clear_auto_matched_epg(
    app_handle: tauri::AppHandle,
    provider_id: Option<i64>,
) -> Result<usize, String> {
    let state = app_handle.state::<DbState>();
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
    db::clear_provider_epg_overrides(&conn, provider_id)
        .map_err(|e| format!("Failed to clear EPG overrides: {}", e))
}

#[tauri::command]
async fn get_available_epg_channels(
    app_handle: tauri::AppHandle,
) -> Result<Vec<String>, String> {
    let state = app_handle.state::<DbState>();
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
    db::get_distinct_epg_channel_ids(&conn)
        .map_err(|e| format!("Failed to get EPG channel IDs: {}", e))
}

#[tauri::command]
async fn clear_epg_cache(
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let state = app_handle.state::<DbState>();
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
    db::clear_all_epg_programs(&conn)
        .map_err(|e| format!("Failed to clear EPG cache: {}", e))
}

#[tauri::command]
async fn set_always_on_top(app_handle: tauri::AppHandle, enabled: bool) -> Result<bool, String> {
    if let Some(window) = app_handle.get_webview_window("main") {
        window.set_always_on_top(enabled).map_err(|e| e.to_string())?;
        return Ok(enabled);
    }
    for (_, window) in app_handle.webview_windows() {
        let _ = window.set_always_on_top(enabled);
    }
    Ok(enabled)
}

#[tauri::command]
async fn is_always_on_top(app_handle: tauri::AppHandle) -> Result<bool, String> {
    if let Some(window) = app_handle.get_webview_window("main") {
        return window.is_always_on_top().map_err(|e| e.to_string());
    }
    Ok(false)
}

fn append_log(msg: &str) {
    use std::io::Write;
    let log_path = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.join("app_lifecycle.log")))
        .unwrap_or_else(|| std::path::PathBuf::from("app_lifecycle.log"));
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(log_path) {
        let _ = writeln!(f, "[{}] [lib] {}", chrono::Local::now().format("%H:%M:%S%.3f"), msg);
    }
}

// ─── App Entry Point ───

pub fn run() {
    append_log("Starting tauri::Builder");
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            append_log("Inside setup hook - initializing DB");
            let conn = match db::init_db(&app.handle()) {
                Ok(c) => c,
                Err(e) => {
                    append_log(&format!("Database initialization warning: {}", e));
                    eprintln!("Database initialization warning: {}", e);
                    rusqlite::Connection::open_in_memory().expect("in-memory db fallback")
                }
            };
            app.manage(DbState(std::sync::Mutex::new(conn)));
            append_log("Setup hook completed successfully");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Providers
            add_xtream_provider,
            add_m3u_provider,
            get_providers,
            delete_provider,
            sync_provider,
            // Categories
            get_categories,
            delete_category,
            reorder_categories,
            keep_only_sweden_categories,
            // Channels
            get_channels,
            search_channels,
            get_channel_stream_url,
            delete_channel,
            reorder_channels,
            // EPG
            sync_epg,
            get_channel_epg,
            get_now_playing,
            get_epg_sources,
            add_epg_source,
            delete_epg_source,
            sync_epg_source,
            sync_all_epg_sources,
            auto_match_epg,
            auto_match_channel_epg,
            clear_auto_matched_epg,
            get_available_epg_channels,
            clear_epg_cache,
            // Overrides
            set_override,
            remove_override,
            get_overrides,
            // Custom Groups
            create_custom_group,
            delete_custom_group,
            get_custom_groups,
            add_channel_to_group,
            remove_channel_from_group,
            reorder_group_channels,
            // Favorites
            toggle_favorite,
            get_favorites,
            reorder_favorites,
            // Proxy
            proxy_request,
            // Export
            export_playlist,
            // Custom Playlists (Categories)
            create_custom_playlist,
            delete_custom_playlist,
            get_custom_playlists,
            set_custom_playlist_categories,
            get_channels_by_custom_playlist,
            // Video Clipping
            save_video_clip,
            // Window Management
            set_always_on_top,
            is_always_on_top,
        ]);

    let app = builder
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    append_log("App built successfully, starting event loop");
    app.run(|_app_handle, event| {
        if let tauri::RunEvent::ExitRequested { .. } = &event {
            append_log("RunEvent::ExitRequested received");
        }
        if let tauri::RunEvent::Exit = &event {
            append_log("RunEvent::Exit received");
        }
    });
    append_log("Event loop finished");
}
