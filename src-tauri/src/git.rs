use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Clone)]
pub struct GitInfo {
    pub root: PathBuf,
    pub branch: Option<String>,
    pub dirty: bool,
}

fn run_git(cwd: &Path, args: &[&str]) -> Option<String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if value.is_empty() {
        None
    } else {
        Some(value)
    }
}

pub fn git_info(cwd: &Path) -> GitInfo {
    if !cwd.exists() {
        return GitInfo {
            root: cwd.to_path_buf(),
            branch: None,
            dirty: false,
        };
    }

    let root = run_git(cwd, &["rev-parse", "--show-toplevel"])
        .map(PathBuf::from)
        .unwrap_or_else(|| cwd.to_path_buf());
    let branch = run_git(cwd, &["branch", "--show-current"]);
    let dirty = run_git(cwd, &["status", "--porcelain"]).is_some();

    GitInfo {
        root,
        branch,
        dirty,
    }
}
