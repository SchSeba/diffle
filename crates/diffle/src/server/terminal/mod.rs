//! Local browser terminals. Each socket owns one PTY and its lifetime.
mod pty;

use std::net::IpAddr;
use std::path::PathBuf;
use std::sync::Arc;

use axum::Router;
use axum::extract::ws::{Message, WebSocket};
use axum::extract::{Query, State, WebSocketUpgrade};
use axum::http::{HeaderMap, StatusCode, header, uri::Authority};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use serde::Deserialize;
use tokio::sync::{Semaphore, watch};

use crate::protocol::{TerminalResize, TerminalStatus};

const FRAME_LIMIT: usize = 64 * 1024;

struct Terminals {
    port: u16,
    dir: PathBuf,
    token: String,
    slots: Arc<Semaphore>,
    shutdown: watch::Receiver<bool>,
}

pub(super) fn router(dir: PathBuf, port: u16, shutdown: watch::Receiver<bool>) -> Router {
    let state = Arc::new(Terminals {
        port,
        dir,
        token: uuid::Uuid::new_v4().to_string(),
        slots: Arc::new(Semaphore::new(12)),
        shutdown,
    });
    Router::new()
        .route("/api/terminal/access", post(access))
        .route("/api/terminal/socket", get(connect))
        .with_state(state)
}

fn same_origin(headers: &HeaderMap, port: u16) -> bool {
    let Some(host) = headers.get(header::HOST).and_then(|value| value.to_str().ok()) else { return false };
    let Ok(authority) = host.parse::<Authority>() else { return false };
    let name = authority.host().trim_matches(['[', ']']);
    let loopback = name == "localhost" || name.parse::<IpAddr>().is_ok_and(|ip| ip.is_loopback());
    loopback
        && authority.port_u16().unwrap_or(80) == port
        && headers.get(header::ORIGIN).is_some_and(|value| value == format!("http://{host}").as_str())
}

async fn access(State(state): State<Arc<Terminals>>, headers: HeaderMap) -> Response {
    if !same_origin(&headers, state.port) {
        return StatusCode::FORBIDDEN.into_response();
    }
    ([(header::CACHE_CONTROL, "no-store")], state.token.clone()).into_response()
}

#[derive(Deserialize)]
struct Capability {
    token: String,
}

async fn connect(
    State(state): State<Arc<Terminals>>,
    Query(capability): Query<Capability>,
    headers: HeaderMap,
    upgrade: WebSocketUpgrade,
) -> Response {
    if !same_origin(&headers, state.port) || capability.token != state.token {
        return StatusCode::FORBIDDEN.into_response();
    }
    let Ok(slot) = state.slots.clone().try_acquire_owned() else {
        return StatusCode::TOO_MANY_REQUESTS.into_response();
    };
    upgrade.max_frame_size(FRAME_LIMIT).max_message_size(FRAME_LIMIT).on_upgrade(move |socket| async move {
        let _slot = slot;
        serve(socket, state).await;
    })
}

async fn serve(mut socket: WebSocket, state: Arc<Terminals>) {
    let mut shutdown = state.shutdown.clone();
    let first = tokio::select! {
        _ = async { let _ = shutdown.wait_for(|stopped| *stopped).await; } => return,
        first = tokio::time::timeout(std::time::Duration::from_secs(5), socket.recv()) => first,
    };
    let Ok(Some(Ok(Message::Text(first)))) = first else { return };
    let Some(size) = resize(&first) else { return };
    let dir = state.dir.clone();
    let opened = tokio::task::spawn_blocking(move || pty::Terminal::open(&dir, size)).await;
    let mut terminal = match opened {
        Ok(Ok(terminal)) => terminal,
        Ok(Err(error)) => {
            let _ = status(&mut socket, Some(error.to_string()), None).await;
            return;
        }
        Err(_) => return,
    };
    loop {
        tokio::select! {
            _ = async { let _ = shutdown.wait_for(|stopped| *stopped).await; } => break,
            output = terminal.output.recv() => {
                let Some(output) = output else {
                    let exit = tokio::time::timeout(std::time::Duration::from_secs(1), terminal.wait()).await.ok().flatten();
                    let _ = status(&mut socket, None, exit).await;
                    break;
                };
                if !matches!(tokio::time::timeout(std::time::Duration::from_secs(1), socket.send(Message::Binary(output.into()))).await, Ok(Ok(()))) {
                    break;
                }
            }
            input = socket.recv() => match input {
                Some(Ok(Message::Binary(bytes))) => {
                    if terminal.input.try_send(bytes).is_err() { break }
                }
                Some(Ok(Message::Text(text))) => {
                    let Some(size) = resize(&text) else { break };
                    if terminal.master.resize(size).is_err() { break }
                }
                Some(Ok(Message::Ping(_) | Message::Pong(_))) => {}
                _ => break,
            },
        }
    }
}

async fn status(socket: &mut WebSocket, error: Option<String>, exit_code: Option<i64>) -> Result<(), axum::Error> {
    let text = serde_json::to_string(&TerminalStatus { error, exit_code }).expect("terminal status serializes");
    socket.send(Message::Text(text.into())).await
}

fn resize(text: &str) -> Option<portable_pty::PtySize> {
    let req: TerminalResize = serde_json::from_str(text).ok()?;
    if req.cols.get() > 500 || req.rows.get() > 300 {
        return None;
    }
    Some(portable_pty::PtySize {
        cols: req.cols.get() as u16,
        rows: req.rows.get() as u16,
        pixel_width: 0,
        pixel_height: 0,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn terminal_requires_an_explicit_loopback_origin_for_the_bound_port() {
        let mut headers = HeaderMap::new();
        headers.insert(header::HOST, "localhost:4000".parse().unwrap());
        assert!(!same_origin(&headers, 4000));
        headers.insert(header::ORIGIN, "http://localhost:4000".parse().unwrap());
        assert!(same_origin(&headers, 4000));
        assert!(!same_origin(&headers, 4001));
        headers.insert(header::ORIGIN, "http://other.example".parse().unwrap());
        assert!(!same_origin(&headers, 4000));
        headers.insert(header::HOST, "other.example:4000".parse().unwrap());
        headers.insert(header::ORIGIN, "http://other.example:4000".parse().unwrap());
        assert!(!same_origin(&headers, 4000));
    }
}
