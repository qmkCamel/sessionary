mod analytics;
mod backup;
mod credentials;
mod db;
mod git;
mod ingest;
mod integrations;
mod models;
mod parsers;
mod release;
mod report;
mod util;

use models::{
    AppSettings, BackupResult, DayLedger, IntegrationDiagnosticsResult, IntegrationSyncResult,
    ReleaseReadinessResult, ReportResult, ScanResult, SessionPatch, SessionRecord, SessionStatus,
};

#[tauri::command]
async fn scan_sources() -> Result<ScanResult, String> {
    tauri::async_runtime::spawn_blocking(|| {
        ingest::scan_sources().map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| error.to_string())?
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
fn start_review(id: String) -> Result<SessionRecord, String> {
    db::start_review(&id)
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "session not found".to_string())
}

#[tauri::command]
fn finish_review(id: String, status: Option<SessionStatus>) -> Result<SessionRecord, String> {
    db::finish_review(&id, status)
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "session not found".to_string())
}

#[tauri::command]
fn start_repair(id: String) -> Result<SessionRecord, String> {
    db::start_repair(&id)
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "session not found".to_string())
}

#[tauri::command]
fn finish_repair(id: String, status: Option<SessionStatus>) -> Result<SessionRecord, String> {
    db::finish_repair(&id, status)
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "session not found".to_string())
}

#[tauri::command]
fn get_settings() -> Result<AppSettings, String> {
    db::get_settings().map_err(|error| error.to_string())
}

#[tauri::command]
fn save_settings(settings: AppSettings) -> Result<AppSettings, String> {
    db::save_settings(settings).map_err(|error| error.to_string())
}

#[tauri::command]
fn sync_integrations() -> Result<IntegrationSyncResult, String> {
    integrations::sync_integrations().map_err(|error| error.to_string())
}

#[tauri::command]
fn diagnose_integrations() -> Result<IntegrationDiagnosticsResult, String> {
    integrations::diagnose_integrations().map_err(|error| error.to_string())
}

#[tauri::command]
fn create_backup() -> Result<BackupResult, String> {
    backup::create_backup().map_err(|error| error.to_string())
}

#[tauri::command]
fn restore_backup(path: String) -> Result<BackupResult, String> {
    backup::restore_backup(&path).map_err(|error| error.to_string())
}

#[tauri::command]
fn get_release_readiness() -> Result<ReleaseReadinessResult, String> {
    release::get_release_readiness().map_err(|error| error.to_string())
}

#[tauri::command]
fn generate_report(date: String) -> Result<ReportResult, String> {
    report::build_report(&date).map_err(|error| error.to_string())
}

#[tauri::command]
fn export_report(date: String, markdown: String) -> Result<ReportResult, String> {
    report::export_report(&date, &markdown).map_err(|error| error.to_string())
}

#[tauri::command]
fn generate_weekly_report(date: String) -> Result<ReportResult, String> {
    report::build_weekly_report(&date).map_err(|error| error.to_string())
}

#[tauri::command]
fn export_weekly_report(date: String, markdown: String) -> Result<ReportResult, String> {
    report::export_weekly_report(&date, &markdown).map_err(|error| error.to_string())
}

fn main() {
    db::init().expect("failed to initialize Sessionary database");
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            scan_sources,
            get_day,
            latest_date,
            update_session,
            start_review,
            finish_review,
            start_repair,
            finish_repair,
            get_settings,
            save_settings,
            sync_integrations,
            diagnose_integrations,
            create_backup,
            restore_backup,
            get_release_readiness,
            generate_report,
            export_report,
            generate_weekly_report,
            export_weekly_report
        ])
        .run(tauri::generate_context!())
        .expect("error while running Sessionary");
}
