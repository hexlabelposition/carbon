/// Moves a file or folder to the system trash. The only custom command of
/// the app: no official Tauri plugin does this (ARCHITECTURE.md, ADR-019).
#[tauri::command]
async fn move_to_trash(path: String) -> Result<(), String> {
    // The core uses `/` on every platform, the Windows shell wants `\`.
    #[cfg(windows)]
    let path = path.replace('/', "\\");
    // Moving to the trash can take long, for a big folder or a slow drive.
    tauri::async_runtime::spawn_blocking(move || trash::delete(&path))
        .await
        .map_err(|error| error.to_string())?
        .map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        // Picking a vault folder grants access to it for one run of the app.
        // This keeps the grant, so a recent vault opens after a restart.
        // It must come after the `fs` plugin.
        .plugin(tauri_plugin_persisted_scope::init())
        .invoke_handler(tauri::generate_handler![move_to_trash])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
