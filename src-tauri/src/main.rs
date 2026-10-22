#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs::OpenOptions;
use std::io::Write;

fn log(msg: &str) {
    let log_path = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.join("app_lifecycle.log")))
        .unwrap_or_else(|| std::path::PathBuf::from("app_lifecycle.log"));
    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(log_path) {
        let _ = writeln!(f, "[{}] {}", chrono::Local::now().format("%H:%M:%S%.3f"), msg);
    }
}

fn main() {
    log("App main started");
    std::panic::set_hook(Box::new(|info| {
        let payload = if let Some(s) = info.payload().downcast_ref::<&str>() {
            (*s).to_string()
        } else if let Some(s) = info.payload().downcast_ref::<String>() {
            s.clone()
        } else {
            "non-string panic payload".to_string()
        };
        let loc = info.location().map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column())).unwrap_or_default();
        let msg = format!("PANIC: {} at {}\n", payload, loc);
        let _ = std::fs::write("crash.log", &msg);
        log(&msg);
        eprintln!("{}", msg);
    }));

    #[cfg(target_os = "windows")]
    {
        log("Configuring WebView2 background flags");
        let existing = std::env::var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS").unwrap_or_default();
        let background_flags = [
            "--disable-background-timer-throttling",
            "--disable-backgrounding-occluded-windows",
            "--disable-renderer-backgrounding",
            "--disable-background-media-suspend",
            "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection,CalculateNativeWinOcclusion,IntensiveWakeUpThrottling,UseEcoQoSForBackgroundProcess",
        ].join(" ");

        let combined = if existing.is_empty() {
            background_flags
        } else {
            format!("{} {}", existing, background_flags)
        };
        std::env::set_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", &combined);
        log(&format!("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS set to: {}", combined));
    }

    log("Calling iptv_player_lib::run()");
    iptv_player_lib::run();

    log("App main finished cleanly");
}

