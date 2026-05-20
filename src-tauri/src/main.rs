mod analytics;
mod db;
mod git;
mod ingest;
mod models;
mod parsers;
mod report;
mod util;

use models::{DayLedger, ReportResult, ScanResult, SessionPatch, SessionRecord};

#[tauri::command]
fn scan_sources() -> Result<ScanResult, String> {
    ingest::scan_sources().map_err(|error| error.to_string())
}

#[tauri::command]
fn get_day(date: Option<String>) -> Result<DayLedger, String> {
    let selected_date = match date {
        Some(value) => value,
        None => db::latest_session_date()
            .map_err(|error| error.to_string())?
            .unwrap_or_else(util::today_local),
    };
    analytics::build_day_ledger(&selected_date).map_err(|error| error.to_string())
}

#[tauri::command]
fn latest_date() -> Result<String, String> {
    db::latest_session_date()
        .map_err(|error| error.to_string())
        .map(|date| date.unwrap_or_else(util::today_local))
}

#[tauri::command]
fn update_session(id: String, patch: SessionPatch) -> Result<SessionRecord, String> {
    db::update_session(&id, patch)
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "session not found".to_string())
}

#[tauri::command]
fn generate_report(date: String) -> Result<ReportResult, String> {
    report::build_report(&date).map_err(|error| error.to_string())
}

#[tauri::command]
fn export_report(date: String, markdown: String) -> Result<ReportResult, String> {
    report::export_report(&date, &markdown).map_err(|error| error.to_string())
}

fn main() {
    db::init().expect("failed to initialize Sessionary database");
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            scan_sources,
            get_day,
            latest_date,
            update_session,
            generate_report,
            export_report
        ])
        .run(tauri::generate_context!())
        .expect("error while running Sessionary");
}
