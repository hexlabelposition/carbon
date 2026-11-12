/// Moves a file or folder to the system trash. No official Tauri plugin does
/// this (ARCHITECTURE.md, ADR-019).
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

/// Copies a file the user dropped on the app into the vault. The `fs` plugin
/// cannot do it: the file lies outside the folders the app may read. The
/// target must be a new file inside a folder the user opened, so the command
/// can only ever add to a vault (ARCHITECTURE.md, ADR-020).
#[tauri::command]
async fn import_file(app: tauri::AppHandle, source: String, target: String) -> Result<(), String> {
    use tauri_plugin_fs::FsExt;

    // The core uses `/` on every platform, Windows wants `\`.
    #[cfg(windows)]
    let (source, target) = (source.replace('/', "\\"), target.replace('/', "\\"));

    if !app.fs_scope().is_allowed(&target) {
        return Err(format!("Not inside an opened folder: {target}"));
    }
    tauri::async_runtime::spawn_blocking(move || {
        // `create_new` fails if the target exists: nothing is overwritten.
        let mut from = std::fs::File::open(&source)?;
        let mut to = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&target)?;
        std::io::copy(&mut from, &mut to).map(|_| ())
    })
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
        .invoke_handler(tauri::generate_handler![move_to_trash, import_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
