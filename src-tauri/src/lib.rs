mod commands;
mod picocas;

#[cfg(test)]
mod picocas_tests;

use commands::KernelRegistry;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(KernelRegistry::new())
        .invoke_handler(tauri::generate_handler![
            commands::evaluate,
            commands::reset_kernel,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
