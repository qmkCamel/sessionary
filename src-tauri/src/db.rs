use anyhow::Context;
use rusqlite::{params, Connection, OptionalExtension, Row};
use std::fs;
use std::path::PathBuf;

use crate::models::{
    AppSettings, DeliveryLink, IntegrationSettings, LanguageSetting, SessionPatch, SessionRecord,
    SessionSource, SessionStatus, SessionValue, SourceConfig, SourceStatus, TimeFieldState,
};
use crate::util::local_date;

const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  source_session_id TEXT NOT NULL,
  project_name TEXT NOT NULL,
  project_path TEXT NOT NULL,
  cwd TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  duration_seconds INTEGER NOT NULL,
  user_message_count INTEGER NOT NULL DEFAULT 0,
  assistant_message_count INTEGER NOT NULL DEFAULT 0,
  tool_call_count INTEGER NOT NULL DEFAULT 0,
  token_count INTEGER,
  cost_amount REAL,
  status TEXT NOT NULL DEFAULT 'unknown',
  status_updated_at TEXT,
  note TEXT NOT NULL DEFAULT '',
  confidence REAL NOT NULL DEFAULT 0.75,
  changed_files_json TEXT NOT NULL DEFAULT '[]',
  prompting_seconds INTEGER NOT NULL DEFAULT 0,
  waiting_seconds INTEGER NOT NULL DEFAULT 0,
  review_seconds INTEGER NOT NULL DEFAULT 0,
  repair_seconds INTEGER NOT NULL DEFAULT 0,
  review_started_at TEXT,
  repair_started_at TEXT,
  time_fields_json TEXT NOT NULL DEFAULT '{"prompting":"estimated","waiting":"estimated","review":"estimated","repair":"estimated"}',
  summary TEXT NOT NULL DEFAULT '',
  source_file TEXT NOT NULL DEFAULT '',
  git_branch TEXT,
  git_dirty INTEGER NOT NULL DEFAULT 0,
  delivery_json TEXT NOT NULL DEFAULT '{"diffSummary":"","changedFiles":[],"commits":[],"committedAfterSession":false,"dirtyAfterSession":false,"absorbed":false,"testCommands":[],"confidence":0.0,"integration":{"pullRequest":null,"issues":[],"ci":{"status":"not_recorded","source":"none","command":null},"reviewCommentCount":null,"attributionConfidence":0.0}}',
  delivery_absorbed_manual INTEGER NOT NULL DEFAULT 0,
  inserted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_source_session ON sessions(source, source_session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_sessions_project_path ON sessions(project_path);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);

CREATE TABLE IF NOT EXISTS scan_runs (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL,
  files_scanned INTEGER NOT NULL DEFAULT 0,
  sessions_found INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  cursor TEXT NOT NULL DEFAULT '',
  error_message TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS source_configs (
  source TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  paths_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"#;

pub fn app_dir() -> anyhow::Result<PathBuf> {
    let base = dirs::data_dir()
        .or_else(dirs::home_dir)
        .context("cannot resolve application data directory")?;
    Ok(base.join("Sessionary"))
}

pub fn db_path() -> anyhow::Result<PathBuf> {
    Ok(app_dir()?.join("sessionary.sqlite"))
}

pub fn exports_dir() -> anyhow::Result<PathBuf> {
    Ok(app_dir()?.join("exports"))
}

pub fn connection() -> anyhow::Result<Connection> {
    init()?;
    Ok(Connection::open(db_path()?)?)
}

pub fn init() -> anyhow::Result<()> {
    fs::create_dir_all(app_dir()?)?;
    let conn = Connection::open(db_path()?)?;
    conn.execute_batch(SCHEMA)?;
    ensure_column(&conn, "sessions", "review_started_at", "TEXT")?;
    ensure_column(&conn, "sessions", "repair_started_at", "TEXT")?;
    ensure_column(
        &conn,
        "sessions",
        "delivery_json",
        "TEXT NOT NULL DEFAULT '{\"diffSummary\":\"\",\"changedFiles\":[],\"commits\":[],\"committedAfterSession\":false,\"dirtyAfterSession\":false,\"absorbed\":false,\"testCommands\":[],\"confidence\":0.0,\"integration\":{\"pullRequest\":null,\"issues\":[],\"ci\":{\"status\":\"not_recorded\",\"source\":\"none\",\"command\":null},\"reviewCommentCount\":null,\"attributionConfidence\":0.0}}'",
    )?;
    ensure_column(
        &conn,
        "sessions",
        "delivery_absorbed_manual",
        "INTEGER NOT NULL DEFAULT 0",
    )?;
    ensure_default_source_configs(&conn)?;
    Ok(())
}

fn ensure_column(
    conn: &Connection,
    table: &str,
    column: &str,
    definition: &str,
) -> anyhow::Result<()> {
    let mut statement = conn.prepare(&format!("PRAGMA table_info({table})"))?;
    let columns = statement
        .query_map([], |row| row.get::<_, String>(1))?
        .collect::<Result<Vec<_>, _>>()?;
    if !columns.iter().any(|existing| existing == column) {
        conn.execute_batch(&format!(
            "ALTER TABLE {table} ADD COLUMN {column} {definition}"
        ))?;
    }
    Ok(())
}

fn default_source_paths(source: SessionSource) -> Vec<String> {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("/"));
    match source {
        SessionSource::Codex => vec![
            home.join(".codex").join("sessions").display().to_string(),
            home.join(".codex")
                .join("archived_sessions")
                .display()
                .to_string(),
        ],
        SessionSource::Claude => vec![
            home.join(".claude").join("projects").display().to_string(),
            home.join(".claude").display().to_string(),
        ],
    }
}

fn ensure_default_source_configs(conn: &Connection) -> anyhow::Result<()> {
    for source in [SessionSource::Codex, SessionSource::Claude] {
        conn.execute(
            "INSERT OR IGNORE INTO source_configs (source, enabled, paths_json) VALUES (?1, 1, ?2)",
            params![
                source.as_str(),
                serde_json::to_string(&default_source_paths(source))?
            ],
        )?;
    }
    conn.execute(
        "INSERT OR IGNORE INTO app_settings (key, value) VALUES ('onboarding_completed', 'false')",
        [],
    )?;
    conn.execute(
        "INSERT OR IGNORE INTO app_settings (key, value) VALUES ('project_roots', '[]')",
        [],
    )?;
    conn.execute(
        "INSERT OR IGNORE INTO app_settings (key, value) VALUES ('language', 'system')",
        [],
    )?;
    conn.execute(
        "INSERT OR IGNORE INTO app_settings (key, value) VALUES ('integration_settings', '{\"github\":{\"enabled\":false,\"token\":\"\"},\"linear\":{\"enabled\":false,\"token\":\"\"}}')",
        [],
    )?;
    Ok(())
}

fn parse_json<T: serde::de::DeserializeOwned + Default>(value: String) -> T {
    serde_json::from_str(&value).unwrap_or_default()
}

fn session_from_row(row: &Row<'_>) -> rusqlite::Result<SessionRecord> {
    let source_text: String = row.get("source")?;
    let status_text: String = row.get("status")?;
    let changed_files_json: String = row.get("changed_files_json")?;
    let time_fields_json: String = row.get("time_fields_json")?;
    let delivery_json: String = row.get("delivery_json")?;

    let mut session = SessionRecord {
        id: row.get("id")?,
        source: SessionSource::try_from(source_text.as_str()).unwrap_or(SessionSource::Codex),
        source_session_id: row.get("source_session_id")?,
        project_name: row.get("project_name")?,
        project_path: row.get("project_path")?,
        cwd: row.get("cwd")?,
        started_at: row.get("started_at")?,
        ended_at: row.get("ended_at")?,
        duration_seconds: row.get("duration_seconds")?,
        user_message_count: row.get("user_message_count")?,
        assistant_message_count: row.get("assistant_message_count")?,
        tool_call_count: row.get("tool_call_count")?,
        token_count: row.get("token_count")?,
        cost_amount: row.get("cost_amount")?,
        status: SessionStatus::try_from(status_text.as_str()).unwrap_or(SessionStatus::Unknown),
        status_updated_at: row.get("status_updated_at")?,
        note: row.get("note")?,
        confidence: row.get("confidence")?,
        changed_files: parse_json(changed_files_json),
        prompting_seconds: row.get("prompting_seconds")?,
        waiting_seconds: row.get("waiting_seconds")?,
        review_seconds: row.get("review_seconds")?,
        repair_seconds: row.get("repair_seconds")?,
        review_started_at: row.get("review_started_at")?,
        repair_started_at: row.get("repair_started_at")?,
        time_fields: parse_json(time_fields_json),
        value: SessionValue::default(),
        summary: row.get("summary")?,
        source_file: row.get("source_file")?,
        git_branch: row.get("git_branch")?,
        git_dirty: row.get::<_, i64>("git_dirty")? == 1,
        delivery: parse_json(delivery_json),
    };
    session.value = SessionValue::for_session(&session);
    Ok(session)
}

fn existing_absorbed_by_id(
    conn: &Connection,
    sessions: &[SessionRecord],
) -> anyhow::Result<std::collections::BTreeMap<String, bool>> {
    let mut absorbed = std::collections::BTreeMap::new();
    let mut statement =
        conn.prepare("SELECT delivery_json, delivery_absorbed_manual FROM sessions WHERE id=?1")?;
    for session in sessions {
        let value: Option<(String, i64)> = statement
            .query_row([session.id.as_str()], |row| Ok((row.get(0)?, row.get(1)?)))
            .optional()?;
        if let Some((value, _)) = value.filter(|(_, manual)| *manual == 1) {
            absorbed.insert(
                session.id.clone(),
                parse_json::<DeliveryLink>(value).absorbed,
            );
        }
    }
    Ok(absorbed)
}

pub fn upsert_sessions(sessions: &[SessionRecord]) -> anyhow::Result<()> {
    if sessions.is_empty() {
        return Ok(());
    }

    let mut conn = connection()?;
    let tx = conn.transaction()?;
    let absorbed_by_id = existing_absorbed_by_id(&tx, sessions)?;
    {
        let mut statement = tx.prepare(
            r#"
            INSERT INTO sessions (
              id, source, source_session_id, project_name, project_path, cwd, started_at, ended_at,
              duration_seconds, user_message_count, assistant_message_count, tool_call_count,
              token_count, cost_amount, status, status_updated_at, note, confidence, changed_files_json,
              prompting_seconds, waiting_seconds, review_seconds, repair_seconds, review_started_at, repair_started_at, time_fields_json,
              summary, source_file, git_branch, git_dirty, delivery_json
            ) VALUES (
              ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17,
              ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29, ?30, ?31
            )
            ON CONFLICT(id) DO UPDATE SET
              source=excluded.source,
              source_session_id=excluded.source_session_id,
              project_name=excluded.project_name,
              project_path=excluded.project_path,
              cwd=excluded.cwd,
              started_at=excluded.started_at,
              ended_at=excluded.ended_at,
              duration_seconds=excluded.duration_seconds,
              user_message_count=excluded.user_message_count,
              assistant_message_count=excluded.assistant_message_count,
              tool_call_count=excluded.tool_call_count,
              token_count=excluded.token_count,
              cost_amount=excluded.cost_amount,
              confidence=excluded.confidence,
              changed_files_json=excluded.changed_files_json,
              prompting_seconds=CASE WHEN json_extract(sessions.time_fields_json, '$.prompting')='manual' THEN sessions.prompting_seconds ELSE excluded.prompting_seconds END,
              waiting_seconds=CASE WHEN json_extract(sessions.time_fields_json, '$.waiting')='manual' THEN sessions.waiting_seconds ELSE excluded.waiting_seconds END,
              review_seconds=CASE WHEN json_extract(sessions.time_fields_json, '$.review')='manual' THEN sessions.review_seconds ELSE excluded.review_seconds END,
              repair_seconds=CASE WHEN json_extract(sessions.time_fields_json, '$.repair')='manual' THEN sessions.repair_seconds ELSE excluded.repair_seconds END,
              summary=excluded.summary,
              source_file=excluded.source_file,
              git_branch=excluded.git_branch,
              git_dirty=excluded.git_dirty,
              delivery_json=excluded.delivery_json,
              updated_at=CURRENT_TIMESTAMP
            "#,
        )?;

        for session in sessions {
            let mut delivery = session.delivery.clone();
            if let Some(existing_absorbed) = absorbed_by_id.get(&session.id) {
                delivery.absorbed = *existing_absorbed;
            }
            statement.execute(params![
                session.id,
                session.source.as_str(),
                session.source_session_id,
                session.project_name,
                session.project_path,
                session.cwd,
                session.started_at,
                session.ended_at,
                session.duration_seconds,
                session.user_message_count,
                session.assistant_message_count,
                session.tool_call_count,
                session.token_count,
                session.cost_amount,
                session.status.as_str(),
                session.status_updated_at,
                session.note,
                session.confidence,
                serde_json::to_string(&session.changed_files)?,
                session.prompting_seconds,
                session.waiting_seconds,
                session.review_seconds,
                session.repair_seconds,
                session.review_started_at,
                session.repair_started_at,
                serde_json::to_string(&session.time_fields)?,
                session.summary,
                session.source_file,
                session.git_branch,
                if session.git_dirty { 1 } else { 0 },
                serde_json::to_string(&delivery)?
            ])?;
        }
    }
    tx.commit()?;
    Ok(())
}

pub fn sessions_between(start_iso: &str, end_iso: &str) -> anyhow::Result<Vec<SessionRecord>> {
    let conn = connection()?;
    let mut statement = conn.prepare(
        "SELECT * FROM sessions WHERE started_at < ?1 AND COALESCE(ended_at, started_at) >= ?2 ORDER BY started_at ASC",
    )?;
    let rows = statement.query_map(params![end_iso, start_iso], session_from_row)?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

pub fn all_sessions() -> anyhow::Result<Vec<SessionRecord>> {
    let conn = connection()?;
    let mut statement = conn.prepare("SELECT * FROM sessions ORDER BY started_at DESC")?;
    let rows = statement.query_map([], session_from_row)?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

pub fn latest_session_date() -> anyhow::Result<Option<String>> {
    let conn = connection()?;
    let value: Option<String> = conn
        .query_row(
            "SELECT started_at FROM sessions ORDER BY started_at DESC LIMIT 1",
            [],
            |row| row.get(0),
        )
        .optional()?;
    Ok(value.and_then(|started_at| local_date(&started_at)))
}

pub fn get_session(id: &str) -> anyhow::Result<Option<SessionRecord>> {
    let conn = connection()?;
    conn.query_row("SELECT * FROM sessions WHERE id=?1", [id], session_from_row)
        .optional()
        .map_err(Into::into)
}

pub fn update_session(id: &str, patch: SessionPatch) -> anyhow::Result<Option<SessionRecord>> {
    let Some(current) = get_session(id)? else {
        return Ok(None);
    };

    let status = patch.status.unwrap_or(current.status);
    let status_updated_at = if patch.status.is_some() {
        Some(chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true))
    } else {
        current.status_updated_at
    };
    let note = patch.note.unwrap_or(current.note);
    let mut time_fields = current.time_fields;
    let prompting_seconds = patch.prompting_seconds.unwrap_or(current.prompting_seconds);
    let waiting_seconds = patch.waiting_seconds.unwrap_or(current.waiting_seconds);
    let review_seconds = patch.review_seconds.unwrap_or(current.review_seconds);
    let repair_seconds = patch.repair_seconds.unwrap_or(current.repair_seconds);
    let mut delivery = current.delivery;
    if let Some(absorbed) = patch.absorbed {
        delivery.absorbed = absorbed;
    }

    if patch.prompting_seconds.is_some() {
        time_fields.prompting = TimeFieldState::Manual;
    }
    if patch.waiting_seconds.is_some() {
        time_fields.waiting = TimeFieldState::Manual;
    }
    if patch.review_seconds.is_some() {
        time_fields.review = TimeFieldState::Manual;
    }
    if patch.repair_seconds.is_some() {
        time_fields.repair = TimeFieldState::Manual;
    }

    let conn = connection()?;
    conn.execute(
        r#"
        UPDATE sessions SET
          status=?1, status_updated_at=?2, note=?3,
          prompting_seconds=?4, waiting_seconds=?5, review_seconds=?6, repair_seconds=?7,
          time_fields_json=?8, delivery_json=?9,
          delivery_absorbed_manual=CASE WHEN ?10=1 THEN 1 ELSE delivery_absorbed_manual END,
          updated_at=CURRENT_TIMESTAMP
        WHERE id=?11
        "#,
        params![
            status.as_str(),
            status_updated_at,
            note,
            prompting_seconds,
            waiting_seconds,
            review_seconds,
            repair_seconds,
            serde_json::to_string(&time_fields)?,
            serde_json::to_string(&delivery)?,
            if patch.absorbed.is_some() { 1 } else { 0 },
            id
        ],
    )?;
    get_session(id)
}

pub fn update_session_delivery(id: &str, delivery: &DeliveryLink) -> anyhow::Result<()> {
    let conn = connection()?;
    conn.execute(
        r#"
        UPDATE sessions
        SET delivery_json=?1, updated_at=CURRENT_TIMESTAMP
        WHERE id=?2
        "#,
        params![serde_json::to_string(delivery)?, id],
    )?;
    Ok(())
}

pub fn start_review(id: &str) -> anyhow::Result<Option<SessionRecord>> {
    let Some(current) = get_session(id)? else {
        return Ok(None);
    };
    let started_at = chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
    let status = if current.status == SessionStatus::Unknown {
        SessionStatus::NeedsReview
    } else {
        current.status
    };
    let conn = connection()?;
    conn.execute(
        r#"
        UPDATE sessions
        SET review_started_at=?1, status=?2, status_updated_at=?1, updated_at=CURRENT_TIMESTAMP
        WHERE id=?3
        "#,
        params![started_at, status.as_str(), id],
    )?;
    get_session(id)
}

pub fn finish_review(
    id: &str,
    status: Option<SessionStatus>,
) -> anyhow::Result<Option<SessionRecord>> {
    let Some(current) = get_session(id)? else {
        return Ok(None);
    };
    let finished_at = chrono::Utc::now();
    let mut review_seconds = current.review_seconds;
    if let Some(started_at) = current.review_started_at.as_deref() {
        if let Ok(started) = chrono::DateTime::parse_from_rfc3339(started_at) {
            let elapsed = (finished_at - started.with_timezone(&chrono::Utc))
                .num_seconds()
                .max(0);
            review_seconds = review_seconds.saturating_add(elapsed);
        }
    }
    let mut time_fields = current.time_fields;
    time_fields.review = TimeFieldState::Manual;
    let next_status = status.unwrap_or(SessionStatus::Useful);
    let conn = connection()?;
    conn.execute(
        r#"
        UPDATE sessions
        SET review_started_at=NULL,
            review_seconds=?1,
            time_fields_json=?2,
            status=?3,
            status_updated_at=?4,
            updated_at=CURRENT_TIMESTAMP
        WHERE id=?5
        "#,
        params![
            review_seconds,
            serde_json::to_string(&time_fields)?,
            next_status.as_str(),
            finished_at.to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
            id
        ],
    )?;
    get_session(id)
}

pub fn start_repair(id: &str) -> anyhow::Result<Option<SessionRecord>> {
    let Some(_current) = get_session(id)? else {
        return Ok(None);
    };
    let started_at = chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
    let conn = connection()?;
    conn.execute(
        r#"
        UPDATE sessions
        SET repair_started_at=?1,
            status=?2,
            status_updated_at=?1,
            updated_at=CURRENT_TIMESTAMP
        WHERE id=?3
        "#,
        params![started_at, SessionStatus::NeedsRepair.as_str(), id],
    )?;
    get_session(id)
}

pub fn finish_repair(
    id: &str,
    status: Option<SessionStatus>,
) -> anyhow::Result<Option<SessionRecord>> {
    let Some(current) = get_session(id)? else {
        return Ok(None);
    };
    let finished_at = chrono::Utc::now();
    let mut repair_seconds = current.repair_seconds;
    if let Some(started_at) = current.repair_started_at.as_deref() {
        if let Ok(started) = chrono::DateTime::parse_from_rfc3339(started_at) {
            let elapsed = (finished_at - started.with_timezone(&chrono::Utc))
                .num_seconds()
                .max(0);
            repair_seconds = repair_seconds.saturating_add(elapsed);
        }
    }
    let mut time_fields = current.time_fields;
    time_fields.repair = TimeFieldState::Manual;
    let next_status = status.unwrap_or(SessionStatus::Repaired);
    let conn = connection()?;
    conn.execute(
        r#"
        UPDATE sessions
        SET repair_started_at=NULL,
            repair_seconds=?1,
            time_fields_json=?2,
            status=?3,
            status_updated_at=?4,
            updated_at=CURRENT_TIMESTAMP
        WHERE id=?5
        "#,
        params![
            repair_seconds,
            serde_json::to_string(&time_fields)?,
            next_status.as_str(),
            finished_at.to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
            id
        ],
    )?;
    get_session(id)
}

pub fn record_scan_run(
    id: &str,
    source: SessionSource,
    started_at: &str,
    finished_at: &str,
    files_scanned: usize,
    sessions_found: usize,
    errors: usize,
    error_message: &str,
) -> anyhow::Result<()> {
    let conn = connection()?;
    conn.execute(
        r#"
        INSERT INTO scan_runs (id, source, started_at, finished_at, status, files_scanned, sessions_found, error_count, error_message)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
        "#,
        params![
            id,
            source.as_str(),
            started_at,
            finished_at,
            if errors == 0 { "ok" } else { "partial" },
            files_scanned as i64,
            sessions_found as i64,
            errors as i64,
            error_message
        ],
    )?;
    Ok(())
}

pub fn get_settings() -> anyhow::Result<AppSettings> {
    let conn = connection()?;
    let onboarding_completed = conn
        .query_row(
            "SELECT value FROM app_settings WHERE key='onboarding_completed'",
            [],
            |row| row.get::<_, String>(0),
        )
        .optional()?
        .map(|value| value == "true")
        .unwrap_or(false);
    let project_roots = conn
        .query_row(
            "SELECT value FROM app_settings WHERE key='project_roots'",
            [],
            |row| row.get::<_, String>(0),
        )
        .optional()?
        .map(parse_json::<Vec<String>>)
        .unwrap_or_default();
    let language = conn
        .query_row(
            "SELECT value FROM app_settings WHERE key='language'",
            [],
            |row| row.get::<_, String>(0),
        )
        .optional()?
        .and_then(|value| LanguageSetting::try_from(value.as_str()).ok())
        .unwrap_or_default();
    let integration_settings = conn
        .query_row(
            "SELECT value FROM app_settings WHERE key='integration_settings'",
            [],
            |row| row.get::<_, String>(0),
        )
        .optional()?
        .map(parse_json::<IntegrationSettings>)
        .unwrap_or_default();
    let mut statement =
        conn.prepare("SELECT source, enabled, paths_json FROM source_configs ORDER BY source")?;
    let configs = statement
        .query_map([], |row| {
            let source_text: String = row.get(0)?;
            let paths_json: String = row.get(2)?;
            Ok(SourceConfig {
                source: SessionSource::try_from(source_text.as_str())
                    .unwrap_or(SessionSource::Codex),
                enabled: row.get::<_, i64>(1)? == 1,
                paths: parse_json(paths_json),
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(AppSettings {
        onboarding_completed,
        source_configs: configs,
        project_roots,
        language,
        integration_settings,
    })
}

pub fn save_settings(settings: AppSettings) -> anyhow::Result<AppSettings> {
    let mut conn = connection()?;
    let tx = conn.transaction()?;
    tx.execute(
        "INSERT INTO app_settings (key, value) VALUES ('onboarding_completed', ?1)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        [if settings.onboarding_completed {
            "true"
        } else {
            "false"
        }],
    )?;
    tx.execute(
        "INSERT INTO app_settings (key, value) VALUES ('project_roots', ?1)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        [serde_json::to_string(&settings.project_roots)?],
    )?;
    tx.execute(
        "INSERT INTO app_settings (key, value) VALUES ('language', ?1)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        [settings.language.as_str()],
    )?;
    tx.execute(
        "INSERT INTO app_settings (key, value) VALUES ('integration_settings', ?1)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        [serde_json::to_string(&settings.integration_settings)?],
    )?;
    for config in &settings.source_configs {
        tx.execute(
            "INSERT INTO source_configs (source, enabled, paths_json, updated_at) VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP)
             ON CONFLICT(source) DO UPDATE SET enabled=excluded.enabled, paths_json=excluded.paths_json, updated_at=CURRENT_TIMESTAMP",
            params![
                config.source.as_str(),
                if config.enabled { 1 } else { 0 },
                serde_json::to_string(&config.paths)?
            ],
        )?;
    }
    tx.commit()?;
    get_settings()
}

pub fn source_status(paths: &[(SessionSource, bool, String)]) -> anyhow::Result<Vec<SourceStatus>> {
    let conn = connection()?;
    paths
        .iter()
        .map(|(source, enabled, path)| {
            let row = conn
                .query_row(
                    r#"
                    SELECT finished_at, files_scanned, sessions_found, error_count
                    FROM scan_runs WHERE source=?1 ORDER BY started_at DESC LIMIT 1
                    "#,
                    [source.as_str()],
                    |row| {
                        Ok((
                            row.get::<_, Option<String>>(0)?,
                            row.get::<_, i64>(1)?,
                            row.get::<_, i64>(2)?,
                            row.get::<_, i64>(3)?,
                        ))
                    },
                )
                .optional()?;
            Ok(SourceStatus {
                source: *source,
                enabled: *enabled,
                path: path.clone(),
                files_scanned: row.as_ref().map(|item| item.1 as usize).unwrap_or(0),
                sessions_found: row.as_ref().map(|item| item.2 as usize).unwrap_or(0),
                errors: row.as_ref().map(|item| item.3 as usize).unwrap_or(0),
                last_scan_at: row.and_then(|item| item.0),
            })
        })
        .collect()
}
