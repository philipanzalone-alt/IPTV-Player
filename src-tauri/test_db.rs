use rusqlite::Connection;

fn main() {
    let appdata = std::env::var("APPDATA").unwrap();
    let db_path = std::path::PathBuf::from(appdata).join("com.iptv-player.app").join("iptv_player.db");
    println!("Testing DB at: {:?}", db_path);
    let conn = Connection::open(&db_path).unwrap();
    let res = conn.execute_batch("
        CREATE TABLE IF NOT EXISTS epg_sources (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            url TEXT NOT NULL,
            provider_id INTEGER,
            last_synced_at TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_epg_unique ON epg_programs(channel_tvg_id, start_time);
    ");
    match res {
        Ok(_) => println!("DB migration succeeded!"),
        Err(e) => println!("DB migration FAILED: {}", e),
    }
}
