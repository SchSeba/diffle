//! An agent's client of the diffle serving its repository. Review context and tour exports are
//! plain text; commands returning structured records print JSON.
mod comments;
mod server;
mod tour;

use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use serde::Serialize;

use super::args::{CommentsCommand, RepoOpts, TourCommand};
use crate::error::Error;
use crate::git::GitRepo;
use server::{Diffle, reach};

/// Prints the whole review and focused patch from the same snapshot, without changing the viewer.
pub async fn review_context(repo: RepoOpts, dir: Option<PathBuf>) -> anyhow::Result<()> {
    let diffle = connect(repo, dir).await?;
    let response = diffle.send(reqwest::Method::GET, "api/review-context", None::<&()>).await?;
    let mut response = Diffle::success(response).await?;
    while let Some(chunk) = response.chunk().await? {
        std::io::stdout().lock().write_all(&chunk)?;
    }
    Ok(())
}

/// Runs `command`; `dir` is a `-C` given before `comments`, which one after it overrides.
pub async fn comments(command: CommentsCommand, dir: Option<PathBuf>) -> anyhow::Result<()> {
    match command {
        CommentsCommand::List { state, path, repo } => {
            let diffle = connect(repo, dir).await?;
            print(&comments::list(&diffle, state.as_deref(), path.as_deref()).await?)
        }
        CommentsCommand::Pending { repo } => print(&comments::pending(&connect(repo, dir).await?).await?),
        CommentsCommand::Context { target, repo } => {
            print(&comments::context(&connect(repo, dir).await?, &target).await?)
        }
        CommentsCommand::Reply { target, body, repo } => {
            let body = if body == "-" { read_document(None)? } else { body };
            let diffle = connect(repo, dir).await?;
            print(&comments::reply(&diffle, &target, body).await?)
        }
    }
}

/// Runs `command`; `dir` is a `-C` given before `tour`, which one after it overrides.
pub async fn tour(command: TourCommand, dir: Option<PathBuf>) -> anyhow::Result<()> {
    match command {
        TourCommand::Push { file, repo } => {
            let html = read_document(file)?;
            let diffle = connect(repo, dir).await?;
            print(&tour::push(&diffle, html).await?)
        }
        TourCommand::Clear { repo } => tour::clear(&connect(repo, dir).await?).await,
        TourCommand::Export { file, repo } => {
            let html = tour::export(&connect(repo, dir).await?).await?;
            write_document(&file, &html)
        }
    }
}

/// Writes `text` to `file`, or to stdout for `-`.
fn write_document(file: &Path, text: &str) -> anyhow::Result<()> {
    if file.as_os_str() == "-" {
        std::io::stdout().lock().write_all(text.as_bytes())?;
        return Ok(());
    }
    std::fs::write(file, text).map_err(|e| Error::Invalid(format!("cannot write {}: {e}", file.display())).into())
}

/// The text in `file`, or on stdin for none or `-`.
fn read_document(file: Option<PathBuf>) -> anyhow::Result<String> {
    let mut html = String::new();
    match file.filter(|f| f.as_os_str() != "-") {
        Some(file) => {
            html = std::fs::read_to_string(&file)
                .map_err(|e| Error::Invalid(format!("cannot read {}: {e}", file.display())))?;
        }
        None => {
            std::io::stdin()
                .read_to_string(&mut html)
                .map_err(|e| Error::Invalid(format!("cannot read stdin: {e}")))?;
        }
    }
    Ok(html)
}

/// The diffle serving the repository `opts` (or `dir`, or the working directory) is in.
async fn connect(opts: RepoOpts, dir: Option<PathBuf>) -> anyhow::Result<Diffle> {
    let dir = match opts.dir.or(dir) {
        Some(dir) => dir,
        None => std::env::current_dir()?,
    };
    let repo = GitRepo::open(&dir).await?;
    Ok(reach(&repo.git_dir).await?)
}

fn print(value: &impl Serialize) -> anyhow::Result<()> {
    let mut out = std::io::stdout().lock();
    writeln!(out, "{}", serde_json::to_string(value)?)?;
    Ok(())
}
