use std::process::Command;

const SERVICE: &str = "Sessionary";

pub fn account(provider: &str) -> String {
    format!("{}-token", provider.trim().to_ascii_lowercase())
}

pub fn set_token(provider: &str, token: &str) -> anyhow::Result<()> {
    set_secret(&account(provider), token)
}

pub fn get_token(provider: &str) -> anyhow::Result<Option<String>> {
    get_secret(&account(provider))
}

pub fn delete_token(provider: &str) -> anyhow::Result<()> {
    delete_secret(&account(provider))
}

pub fn has_token(provider: &str) -> bool {
    secret_exists(&account(provider))
}

#[cfg(target_os = "macos")]
fn set_secret(account: &str, token: &str) -> anyhow::Result<()> {
    let output = Command::new("security")
        .args([
            "add-generic-password",
            "-a",
            account,
            "-s",
            SERVICE,
            "-w",
            token,
            "-U",
        ])
        .output()?;
    if output.status.success() {
        return Ok(());
    }
    anyhow::bail!(
        "Keychain write failed: {}",
        String::from_utf8_lossy(&output.stderr).trim()
    )
}

#[cfg(not(target_os = "macos"))]
fn set_secret(_account: &str, _token: &str) -> anyhow::Result<()> {
    anyhow::bail!("secure credential storage is only implemented for macOS Keychain")
}

#[cfg(target_os = "macos")]
fn get_secret(account: &str) -> anyhow::Result<Option<String>> {
    let output = Command::new("security")
        .args(["find-generic-password", "-a", account, "-s", SERVICE, "-w"])
        .output()?;
    if output.status.success() {
        let token = String::from_utf8_lossy(&output.stdout).trim().to_string();
        return Ok((!token.is_empty()).then_some(token));
    }
    let stderr = String::from_utf8_lossy(&output.stderr);
    if stderr.contains("could not be found") || output.status.code() == Some(44) {
        return Ok(None);
    }
    anyhow::bail!("Keychain read failed: {}", stderr.trim())
}

#[cfg(not(target_os = "macos"))]
fn get_secret(_account: &str) -> anyhow::Result<Option<String>> {
    Ok(None)
}

#[cfg(target_os = "macos")]
fn secret_exists(account: &str) -> bool {
    let output = Command::new("security")
        .args(["find-generic-password", "-a", account, "-s", SERVICE])
        .output();
    output.is_ok_and(|output| output.status.success())
}

#[cfg(not(target_os = "macos"))]
fn secret_exists(_account: &str) -> bool {
    false
}

#[cfg(target_os = "macos")]
fn delete_secret(account: &str) -> anyhow::Result<()> {
    let output = Command::new("security")
        .args(["delete-generic-password", "-a", account, "-s", SERVICE])
        .output()?;
    if output.status.success() {
        return Ok(());
    }
    let stderr = String::from_utf8_lossy(&output.stderr);
    if stderr.contains("could not be found") || output.status.code() == Some(44) {
        return Ok(());
    }
    anyhow::bail!("Keychain delete failed: {}", stderr.trim())
}

#[cfg(not(target_os = "macos"))]
fn delete_secret(_account: &str) -> anyhow::Result<()> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn account_names_are_stable() {
        assert_eq!(account("github"), "github-token");
        assert_eq!(account("Linear"), "linear-token");
    }
}
