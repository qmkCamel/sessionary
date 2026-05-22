use serde_json::Value;
use std::fs;
use std::path::PathBuf;

use crate::models::{ReleaseCheck, ReleaseCheckStatus, ReleaseReadinessResult};

pub fn get_release_readiness() -> anyhow::Result<ReleaseReadinessResult> {
    let root = repo_root();
    let package_json = read_json(root.join("package.json"))?;
    let tauri_conf = read_json(root.join("src-tauri").join("tauri.conf.json"))?;
    let package_version = package_json
        .get("version")
        .and_then(Value::as_str)
        .unwrap_or("unknown");
    let tauri_version = tauri_conf
        .get("version")
        .and_then(Value::as_str)
        .unwrap_or("unknown");
    let mut checks = Vec::new();

    checks.push(check(
        "version",
        "Package and Tauri versions match",
        package_version == tauri_version && package_version != "unknown",
        format!("package.json={package_version}, tauri.conf.json={tauri_version}"),
    ));
    checks.push(check(
        "bundle-active",
        "Tauri bundle is active",
        tauri_conf
            .pointer("/bundle/active")
            .and_then(Value::as_bool)
            == Some(true),
        "Required for npm run tauri:build".to_string(),
    ));
    let targets = tauri_conf
        .pointer("/bundle/targets")
        .and_then(Value::as_array)
        .map(Vec::len)
        .unwrap_or(0);
    checks.push(check(
        "bundle-targets",
        "Bundle targets configured",
        targets > 0,
        format!("{targets} target(s)"),
    ));
    let icon_count = tauri_conf
        .pointer("/bundle/icon")
        .and_then(Value::as_array)
        .map(Vec::len)
        .unwrap_or(0);
    checks.push(ReleaseCheck {
        id: "icons".to_string(),
        label: "Bundle icons configured".to_string(),
        status: if icon_count > 0 {
            ReleaseCheckStatus::Pass
        } else {
            ReleaseCheckStatus::Warning
        },
        detail: if icon_count > 0 {
            format!("{icon_count} icon(s)")
        } else {
            "No icon path configured in tauri.conf.json".to_string()
        },
    });
    checks.push(check(
        "before-build",
        "Frontend build command configured",
        tauri_conf
            .pointer("/build/beforeBuildCommand")
            .and_then(Value::as_str)
            .is_some_and(|value| !value.trim().is_empty()),
        tauri_conf
            .pointer("/build/beforeBuildCommand")
            .and_then(Value::as_str)
            .unwrap_or("missing")
            .to_string(),
    ));
    checks.push(check(
        "frontend-dist",
        "Frontend dist configured",
        tauri_conf
            .pointer("/build/frontendDist")
            .and_then(Value::as_str)
            .is_some_and(|value| !value.trim().is_empty()),
        tauri_conf
            .pointer("/build/frontendDist")
            .and_then(Value::as_str)
            .unwrap_or("missing")
            .to_string(),
    ));
    checks.push(ReleaseCheck {
        id: "signing".to_string(),
        label: "Apple signing identity configured".to_string(),
        status: if std::env::var("APPLE_SIGNING_IDENTITY")
            .ok()
            .is_some_and(|value| !value.trim().is_empty())
        {
            ReleaseCheckStatus::Pass
        } else {
            ReleaseCheckStatus::Warning
        },
        detail: "Set APPLE_SIGNING_IDENTITY for distributable signed builds".to_string(),
    });

    Ok(ReleaseReadinessResult {
        checked_at: chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
        version: package_version.to_string(),
        build_command: "npm run tauri:build".to_string(),
        checks,
    })
}

fn check(id: &str, label: &str, ok: bool, detail: String) -> ReleaseCheck {
    ReleaseCheck {
        id: id.to_string(),
        label: label.to_string(),
        status: if ok {
            ReleaseCheckStatus::Pass
        } else {
            ReleaseCheckStatus::Fail
        },
        detail,
    }
}

fn read_json(path: PathBuf) -> anyhow::Result<Value> {
    Ok(serde_json::from_str(&fs::read_to_string(path)?)?)
}

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn check_status_maps_to_fail_or_pass() {
        assert_eq!(
            check("x", "X", true, "ok".to_string()).status,
            ReleaseCheckStatus::Pass
        );
        assert_eq!(
            check("x", "X", false, "bad".to_string()).status,
            ReleaseCheckStatus::Fail
        );
    }
}
