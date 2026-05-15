use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Manager, State};
use tokio::sync::Mutex;

use crate::picocas::{EvalResult, KernelError, PicocasKernel};

// ── Registry ──────────────────────────────────────────────────────────────────

pub type NotebookId = String;

/// One kernel per notebook. Wrapped in Arc so we can release the registry lock
/// before calling evaluate (which may block for up to 30 s).
pub struct KernelRegistry(pub Mutex<HashMap<NotebookId, Arc<PicocasKernel>>>);

impl KernelRegistry {
    pub fn new() -> Self {
        Self(Mutex::new(HashMap::new()))
    }
}

// ── Path resolution ───────────────────────────────────────────────────────────

fn resolve_paths(app: &AppHandle) -> anyhow::Result<(PathBuf, PathBuf)> {
    if cfg!(debug_assertions) {
        // Dev mode: use the picocas source tree directly.
        let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let binary = manifest.join("../../picocas/picocas");
        let cwd = manifest.join("../../picocas");
        Ok((binary, cwd))
    } else {
        // Release/bundled: sidecar binary + resources bundled with the app.
        let resource_dir = app.path().resource_dir()?;
        // Sidecar lives next to the main binary in the .app bundle.
        let binary = std::env::current_exe()?
            .parent()
            .ok_or_else(|| anyhow::anyhow!("no parent dir for exe"))?
            .join("picocas");
        // resource_dir contains src/internal/init.m (see tauri.conf.json resources config).
        let cwd = resource_dir;
        Ok((binary, cwd))
    }
}

// ── Tauri commands ────────────────────────────────────────────────────────────

/// Evaluate a PicoCAS expression in the kernel for the given notebook.
/// Spawns the kernel on first call for a given notebook_id.
#[tauri::command]
pub async fn evaluate(
    notebook_id: NotebookId,
    expr: String,
    registry: State<'_, KernelRegistry>,
    app: AppHandle,
) -> Result<EvalResult, KernelError> {
    // Get or spawn the kernel, then release the lock before evaluating.
    let kernel = {
        let mut map = registry.0.lock().await;
        if let Some(k) = map.get(&notebook_id) {
            k.clone()
        } else {
            let (binary, cwd) = resolve_paths(&app).map_err(|e| KernelError::Io(e.to_string()))?;
            let k = PicocasKernel::spawn(&binary, &cwd)
                .await
                .map_err(|e| KernelError::Io(e.to_string()))?;
            let arc = Arc::new(k);
            map.insert(notebook_id.clone(), arc.clone());
            arc
        }
    }; // mutex released here

    kernel.evaluate(expr).await
}

/// Kill and remove the kernel for a given notebook (e.g. "Reset Kernel" button).
/// Next evaluate call will respawn it fresh.
#[tauri::command]
pub async fn reset_kernel(
    notebook_id: NotebookId,
    registry: State<'_, KernelRegistry>,
) -> Result<(), KernelError> {
    let mut map = registry.0.lock().await;
    map.remove(&notebook_id);
    // The Arc'd kernel's run_loop shuts down when the channel sender is dropped here.
    Ok(())
}
