use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Clone)]
pub struct GitInfo {
    pub root: PathBuf,
    pub branch: Option<String>,
    pub dirty: bool,
    pub changed_files: Vec<String>,
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
            changed_files: Vec::new(),
        };
    }

    let root = run_git(cwd, &["rev-parse", "--show-toplevel"])
        .map(PathBuf::from)
        .unwrap_or_else(|| cwd.to_path_buf());
    let branch = run_git(cwd, &["branch", "--show-current"]);
    let status = run_git(cwd, &["status", "--porcelain"]);
    let dirty = status.is_some();
    let changed_files = status
        .map(|status| {
            status
                .lines()
                .filter_map(|line| line.get(3..).map(str::trim))
                .filter(|file| !file.is_empty())
                .map(ToString::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    GitInfo {
        root,
        branch,
        dirty,
        changed_files,
    }
}
