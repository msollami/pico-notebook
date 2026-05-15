use anyhow::{bail, Context, Result};
use serde::Serialize;
use std::path::PathBuf;
use std::process::Stdio;
use std::time::Instant;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, ChildStdout, Command};
use tokio::sync::{mpsc, oneshot};
use tracing::{debug, info, warn};

const BANNER_SENTINEL: &str = "Exit by evaluating Quit[] or CONTROL-C.";
const MAX_INPUT_BYTES: usize = 10_000;
const EVAL_TIMEOUT_SECS: u64 = 30;

// ── Public types ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct EvalResult {
    pub line_number: u32,
    pub output: String,
    pub is_null: bool,
    pub is_error: bool,
    pub elapsed_ms: u64,
}

#[derive(Debug, thiserror::Error, Serialize)]
pub enum KernelError {
    #[error("kernel is dead — call reset_kernel")]
    Dead,
    #[error("expression exceeds {MAX_INPUT_BYTES} bytes")]
    TooLong,
    #[error("eval timed out after {EVAL_TIMEOUT_SECS}s")]
    Timeout,
    #[error("kernel io error: {0}")]
    Io(String),
}

// ── Internal channel types ────────────────────────────────────────────────────

struct EvalRequest {
    expr: String,
    reply: oneshot::Sender<Result<EvalResult, KernelError>>,
}

// ── PicocasKernel ─────────────────────────────────────────────────────────────

/// A handle to a single picocas subprocess. Cheap to clone; backed by an mpsc channel.
/// Requests are serialized: only one evaluation is in-flight at a time, matching picocas's
/// single-threaded, stateful nature.
#[derive(Clone)]
pub struct PicocasKernel {
    tx: mpsc::Sender<EvalRequest>,
}

impl PicocasKernel {
    /// Spawn a picocas subprocess, drain its startup banner, and return a ready handle.
    pub async fn spawn(binary: &PathBuf, cwd: &PathBuf) -> Result<Self> {
        anyhow::ensure!(
            binary.exists(),
            "picocas binary not found at {}",
            binary.display()
        );

        let mut child = Command::new(binary)
            .current_dir(cwd)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            // TERM=dumb: prevents readline from trying to init terminal control
            // sequences when stdin/stdout are pipes, which can cause it to hang
            // trying to open /dev/tty.
            .env("TERM", "dumb")
            .env("INPUTRC", "/dev/null")
            .kill_on_drop(true)
            .spawn()
            .with_context(|| format!("failed to spawn picocas at {}", binary.display()))?;

        let stdin = child.stdin.take().context("no stdin handle")?;
        let stdout = child.stdout.take().context("no stdout handle")?;
        let mut stdout_buf = BufReader::new(stdout);

        tokio::time::timeout(
            std::time::Duration::from_secs(10),
            Self::drain_banner(&mut stdout_buf),
        )
        .await
        .context("picocas banner drain timed out after 10 s — binary may be hanging")?
        .context("picocas banner drain failed")?;

        info!("picocas kernel ready (cwd={})", cwd.display());

        let (tx, rx) = mpsc::channel::<EvalRequest>(32);
        tokio::spawn(Self::run_loop(child, stdin, stdout_buf, rx));

        Ok(Self { tx })
    }

    /// Read lines from stdout until we've seen the banner sentinel line followed by a blank line.
    ///
    /// Banner ends with:
    ///   "Exit by evaluating Quit[] or CONTROL-C.\n\n"
    async fn drain_banner(stdout: &mut BufReader<ChildStdout>) -> Result<()> {
        let mut saw_sentinel = false;
        loop {
            let mut line = String::new();
            let n = stdout.read_line(&mut line).await?;
            if n == 0 {
                bail!("picocas exited before banner completed");
            }
            let trimmed = line.trim_end();
            debug!("banner line: {:?}", trimmed);
            if trimmed.contains(BANNER_SENTINEL) {
                saw_sentinel = true;
                continue;
            }
            if saw_sentinel && trimmed.is_empty() {
                // Blank line after sentinel = REPL is ready for input
                return Ok(());
            }
        }
    }

    /// Background task: pulls EvalRequests and runs them one at a time against the subprocess.
    async fn run_loop(
        mut child: Child,
        mut stdin: ChildStdin,
        mut stdout: BufReader<ChildStdout>,
        mut rx: mpsc::Receiver<EvalRequest>,
    ) {
        // Pre-allocate buffers outside the request loop to avoid per-eval allocation.
        let mut lines: Vec<String> = Vec::with_capacity(4);
        let mut raw = String::with_capacity(256);

        while let Some(req) = rx.recv().await {
            let started = Instant::now();

            let payload = encode_multiline(&req.expr);

            if stdin.write_all(payload.as_bytes()).await.is_err() || stdin.flush().await.is_err() {
                let _ = req.reply.send(Err(KernelError::Dead));
                break;
            }

            // Read stdout until blank line (result terminator).
            lines.clear();
            let mut got_output = false;
            loop {
                raw.clear();
                match stdout.read_line(&mut raw).await {
                    Ok(0) => {
                        // EOF — subprocess died.
                        let _ = req.reply.send(Err(KernelError::Dead));
                        let _ = child.kill().await;
                        return;
                    }
                    Ok(_) => {
                        let trimmed = raw.trim_end().to_string();
                        if trimmed.is_empty() {
                            if got_output {
                                break; // blank line after content = end of result
                            }
                            // blank line before any output = ignore (e.g. extra newlines)
                        } else {
                            got_output = true;
                            lines.push(trimmed);
                        }
                    }
                    Err(e) => {
                        warn!("stdout read error: {}", e);
                        let _ = req.reply.send(Err(KernelError::Io(e.to_string())));
                        let _ = child.kill().await;
                        return;
                    }
                }
            }

            let result = parse_result(&lines, started.elapsed().as_millis() as u64);
            let _ = req.reply.send(Ok(result));
        }

        // Channel closed — shut down the subprocess cleanly.
        let _ = child.kill().await;
    }

    /// Evaluate one expression and wait for the result.
    /// Returns Err(KernelError::Dead) if the subprocess has crashed.
    pub async fn evaluate(&self, expr: String) -> Result<EvalResult, KernelError> {
        if expr.len() > MAX_INPUT_BYTES {
            return Err(KernelError::TooLong);
        }
        let (reply_tx, reply_rx) = oneshot::channel();
        self.tx
            .send(EvalRequest {
                expr,
                reply: reply_tx,
            })
            .await
            .map_err(|_| KernelError::Dead)?;

        tokio::time::timeout(std::time::Duration::from_secs(EVAL_TIMEOUT_SECS), reply_rx)
            .await
            .map_err(|_| KernelError::Timeout)?
            .map_err(|_| KernelError::Dead)?
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Encode a multi-line expression using picocas's backslash continuation syntax.
/// Single-line expressions are passed through unchanged + newline.
/// Multi-line: each non-last line gets " \" appended; last line gets just "\n".
fn encode_multiline(expr: &str) -> String {
    let lines: Vec<&str> = expr.lines().collect();
    match lines.len() {
        0 => "\n".to_string(),
        1 => format!("{}\n", lines[0]),
        _ => {
            let mut out = String::with_capacity(expr.len() + lines.len() * 2);
            for (i, line) in lines.iter().enumerate() {
                out.push_str(line);
                if i + 1 < lines.len() {
                    out.push_str(" \\");
                }
                out.push('\n');
            }
            out
        }
    }
}

/// Parse the collected stdout lines from one evaluation into an EvalResult.
///
/// Protocol (verified via od -c byte inspection of real picocas output):
///   Success:    "Out[N]= <result>"    (single line, always)
///   Parse fail: "Parse error"         (single line)
///   Warning:    any other text        (e.g. "Get::noopen: ...")
fn parse_result(lines: &[String], elapsed_ms: u64) -> EvalResult {
    for line in lines {
        // Match "Out[N]= result"
        if let Some(after_out) = line.strip_prefix("Out[") {
            if let Some(bracket_pos) = after_out.find(']') {
                let line_number: u32 = after_out[..bracket_pos].parse().unwrap_or(0);
                let output = after_out.get(bracket_pos + 3..).unwrap_or("").to_string();
                let is_null = output == "Null";
                return EvalResult {
                    line_number,
                    output,
                    is_null,
                    is_error: false,
                    elapsed_ms,
                };
            }
        }
        // Match parse error
        if line.starts_with("Parse error") {
            return EvalResult {
                line_number: 0,
                output: line.clone(),
                is_null: false,
                is_error: true,
                elapsed_ms,
            };
        }
    }
    // Fallback: non-standard output (warnings only, no Out[N])
    EvalResult {
        line_number: 0,
        output: lines.join("\n"),
        is_null: lines.is_empty(),
        is_error: false,
        elapsed_ms,
    }
}

// ── Test helpers ──────────────────────────────────────────────────────────────

#[cfg(test)]
pub fn dev_paths() -> (PathBuf, PathBuf) {
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let binary = manifest.join("../../picocas/picocas");
    let cwd = manifest.join("../../picocas");
    (binary, cwd)
}

#[cfg(test)]
mod unit_tests {
    use super::*;

    #[test]
    fn encode_single_line() {
        assert_eq!(encode_multiline("2+2"), "2+2\n");
    }

    #[test]
    fn encode_multi_line() {
        let result = encode_multiline("1 +\n2 +\n3");
        assert_eq!(result, "1 + \\\n2 + \\\n3\n");
    }

    #[test]
    fn encode_empty() {
        assert_eq!(encode_multiline(""), "\n");
    }

    #[test]
    fn parse_success() {
        let lines = vec!["Out[1]= 5".to_string()];
        let r = parse_result(&lines, 10);
        assert_eq!(r.line_number, 1);
        assert_eq!(r.output, "5");
        assert!(!r.is_null);
        assert!(!r.is_error);
    }

    #[test]
    fn parse_null() {
        let lines = vec!["Out[2]= Null".to_string()];
        let r = parse_result(&lines, 5);
        assert!(r.is_null);
        assert!(!r.is_error);
    }

    #[test]
    fn parse_error() {
        let lines = vec!["Parse error".to_string()];
        let r = parse_result(&lines, 1);
        assert!(r.is_error);
        assert_eq!(r.line_number, 0);
    }

    #[test]
    fn parse_with_warning_prefix() {
        let lines = vec![
            "Get::noopen: Cannot open foo.m.".to_string(),
            "Out[3]= 42".to_string(),
        ];
        let r = parse_result(&lines, 20);
        assert_eq!(r.output, "42");
        assert!(!r.is_error);
    }
}
