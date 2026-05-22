use rusqlite::Connection;
use std::fs;
use std::path::{Path, PathBuf};

use crate::db;
use crate::models::BackupResult;

pub fn create_backup() -> anyhow::Result<BackupResult> {
    db::init()?;
    let source = db::db_path()?;
    let backup_dir = db::backups_dir()?;
    fs::create_dir_all(&backup_dir)?;
    let created_at = now_utc();
    let path = backup_dir.join(backup_filename("sessionary", &created_at));
    fs::copy(&source, &path)?;
    let bytes = fs::metadata(&path)?.len();
    Ok(BackupResult {
        path: path.display().to_string(),
        bytes,
        created_at,
        message: "Backup created. Keychain tokens are not included.".to_string(),
    })
}

pub fn restore_backup(path: &str) -> anyhow::Result<BackupResult> {
    let source = PathBuf::from(path);
    if !source.exists() {
        anyhow::bail!("backup file does not exist: {path}");
    }
    ensure_sqlite_integrity(&source)?;
    let safety = create_pre_restore_backup()?;
    let target = db::db_path()?;
    fs::copy(&source, &target)?;
    db::init()?;
    let bytes = fs::metadata(&target)?.len();
    Ok(BackupResult {
        path: target.display().to_string(),
        bytes,
        created_at: now_utc(),
        message: format!(
            "Backup restored. Previous database safety copy: {}",
            safety.display()
        ),
    })
}

fn create_pre_restore_backup() -> anyhow::Result<PathBuf> {
    db::init()?;
    let source = db::db_path()?;
    let backup_dir = db::backups_dir()?;
    fs::create_dir_all(&backup_dir)?;
    let path = backup_dir.join(backup_filename("pre-restore", &now_utc()));
    fs::copy(&source, &path)?;
    Ok(path)
}

fn ensure_sqlite_integrity(path: &Path) -> anyhow::Result<()> {
    let conn = Connection::open(path)?;
    let result: String = conn.query_row("PRAGMA integrity_check", [], |row| row.get(0))?;
    if result == "ok" {
        Ok(())
    } else {
        anyhow::bail!("backup integrity check failed: {result}")
    }
}

fn backup_filename(prefix: &str, timestamp: &str) -> String {
    let safe = timestamp
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
                character
            } else {
                '-'
            }
        })
        .collect::<String>();
    format!("{prefix}-{safe}.sqlite")
}

fn now_utc() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn backup_filename_is_filesystem_safe() {
        assert_eq!(
            backup_filename("sessionary", "2026-05-22T01:02:03.004Z"),
            "sessionary-2026-05-22T01-02-03-004Z.sqlite"
        );
    }
}
