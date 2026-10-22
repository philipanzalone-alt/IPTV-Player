use crate::db::{self, EpgSyncResult};
use flate2::read::GzDecoder;
use quick_xml::events::Event;
use quick_xml::Reader;
use std::io::{BufRead, BufReader};
use tauri::Manager;

/// Parse XMLTV content using SAX streaming parser.
/// Handles both plain XML and .gz compressed files.
pub fn parse_xmltv_content(
    conn: &rusqlite::Connection,
    provider_id: i64,
    content: &[u8],
    is_gzipped: bool,
) -> Result<EpgSyncResult, String> {
    // Clean up expired EPG data older than 2 days
    let _ = conn.execute(
        "DELETE FROM epg_programs WHERE datetime(end_time) < datetime('now', '-2 days')",
        rusqlite::params![],
    );

    let programs_count = if is_gzipped {
        let decoder = GzDecoder::new(content);
        let reader = BufReader::new(decoder);
        parse_xmltv_reader(conn, provider_id, reader)?
    } else {
        let reader = BufReader::new(content);
        parse_xmltv_reader(conn, provider_id, reader)?
    };

    Ok(EpgSyncResult { programs_count })
}

fn parse_xmltv_reader<R: BufRead>(
    conn: &rusqlite::Connection,
    provider_id: i64,
    reader: R,
) -> Result<i32, String> {
    let mut xml_reader = Reader::from_reader(reader);
    xml_reader.config_mut().trim_text(true);

    let mut buf = Vec::new();
    let mut programs_count = 0;

    // Current programme being parsed
    let mut in_programme = false;
    let mut current_channel_id = String::new();
    let mut current_start = String::new();
    let mut current_stop = String::new();
    let mut current_title = String::new();
    let mut current_desc = String::new();
    let mut current_category = String::new();

    // Track which element we're inside
    let mut current_element = String::new();

    // Use a transaction for bulk inserts
    conn.execute_batch("BEGIN TRANSACTION")
        .map_err(|e| format!("Failed to begin transaction: {}", e))?;

    loop {
        match xml_reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let tag_name = String::from_utf8_lossy(e.name().as_ref()).to_string();

                if tag_name == "programme" {
                    in_programme = true;
                    current_channel_id.clear();
                    current_start.clear();
                    current_stop.clear();
                    current_title.clear();
                    current_desc.clear();
                    current_category.clear();

                    // Parse attributes
                    for attr in e.attributes().flatten() {
                        let key = String::from_utf8_lossy(attr.key.as_ref()).to_string();
                        let value = String::from_utf8_lossy(&attr.value).to_string();
                        match key.as_str() {
                            "start" => current_start = parse_xmltv_time(&value),
                            "stop" => current_stop = parse_xmltv_time(&value),
                            "channel" => current_channel_id = value,
                            _ => {}
                        }
                    }
                } else if in_programme {
                    current_element = tag_name;
                }
            }
            Ok(Event::Text(ref e)) => {
                if in_programme {
                    let text = e.unescape().unwrap_or_default().to_string();
                    match current_element.as_str() {
                        "title" => current_title = text,
                        "desc" => current_desc = text,
                        "category" => current_category = text,
                        _ => {}
                    }
                }
            }
            Ok(Event::End(ref e)) => {
                let tag_name = String::from_utf8_lossy(e.name().as_ref()).to_string();

                if tag_name == "programme" && in_programme {
                    in_programme = false;

                    if !current_channel_id.is_empty()
                        && !current_title.is_empty()
                        && !current_start.is_empty()
                        && !current_stop.is_empty()
                    {
                        let desc = if current_desc.is_empty() {
                            None
                        } else {
                            Some(current_desc.as_str())
                        };
                        let cat = if current_category.is_empty() {
                            None
                        } else {
                            Some(current_category.as_str())
                        };

                        if db::insert_epg_program(
                            conn,
                            provider_id,
                            &current_channel_id,
                            &current_title,
                            desc,
                            &current_start,
                            &current_stop,
                            cat,
                        )
                        .is_ok()
                        {
                            programs_count += 1;
                        }
                    }
                }

                if current_element == tag_name {
                    current_element.clear();
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => {
                // Log error but continue parsing
                log::warn!("XML parse error: {}", e);
            }
            _ => {}
        }
        buf.clear();
    }

    conn.execute_batch("COMMIT")
        .map_err(|e| format!("Failed to commit transaction: {}", e))?;

    Ok(programs_count)
}

/// Parse XMLTV time format: "20240101120000 +0000" -> ISO 8601
fn parse_xmltv_time(time_str: &str) -> String {
    // XMLTV format: YYYYMMDDHHmmss [+/-HHMM]
    let parts: Vec<&str> = time_str.trim().splitn(2, ' ').collect();
    let datetime_part = parts[0];

    if datetime_part.len() < 14 {
        return time_str.to_string();
    }

    let year = &datetime_part[0..4];
    let month = &datetime_part[4..6];
    let day = &datetime_part[6..8];
    let hour = &datetime_part[8..10];
    let minute = &datetime_part[10..12];
    let second = &datetime_part[12..14];

    let tz = if parts.len() > 1 {
        let tz_str = parts[1].trim();
        if tz_str.len() >= 5 {
            format!(
                "{}:{}",
                &tz_str[..3],
                &tz_str[3..5]
            )
        } else {
            "+00:00".to_string()
        }
    } else {
        "+00:00".to_string()
    };

    format!(
        "{}-{}-{}T{}:{}:{}{}",
        year, month, day, hour, minute, second, tz
    )
}

/// Fetch and parse EPG from a URL (supports both .xml and .xml.gz)
pub async fn sync_epg_from_url(
    app_handle: tauri::AppHandle,
    provider_id: i64,
    url: &str,
    user_agent: &str,
) -> Result<EpgSyncResult, String> {
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let response = client
        .get(url)
        .header("User-Agent", user_agent)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch EPG: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP error fetching EPG: {}", response.status()));
    }

    let is_gzipped = url.ends_with(".gz")
        || response
            .headers()
            .get("content-type")
            .map(|v| v.to_str().unwrap_or("").contains("gzip"))
            .unwrap_or(false);

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read EPG response: {}", e))?;

    let state = app_handle.state::<db::DbState>();
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;

    parse_xmltv_content(&conn, provider_id, &bytes, is_gzipped)
}

/// Sync EPG for an Xtream provider using its XMLTV endpoint
pub async fn sync_xtream_epg(
    app_handle: tauri::AppHandle,
    provider_id: i64,
) -> Result<EpgSyncResult, String> {
    let (url, user_agent) = {
        let state = app_handle.state::<db::DbState>();
        let conn = state.0.lock().map_err(|e| format!("DB lock error: {}", e))?;
        let provider = db::get_provider_by_id(&conn, provider_id)
            .map_err(|e| format!("Provider not found: {}", e))?;

        if provider.provider_type == "xtream" {
            let server = provider
                .server_url
                .as_ref()
                .ok_or("No server URL")?;
            let user = provider.username.as_ref().ok_or("No username")?;
            let pass = provider.password.as_ref().ok_or("No password")?;
            let url = format!(
                "{}/xmltv.php?username={}&password={}",
                server.trim_end_matches('/'),
                user,
                pass
            );
            (url, provider.user_agent.clone())
        } else if let Some(ref epg_url) = provider.epg_url {
            (epg_url.clone(), provider.user_agent.clone())
        } else {
            return Err("No EPG URL configured for this provider".to_string());
        }
    };

    sync_epg_from_url(app_handle, provider_id, &url, &user_agent).await
}
