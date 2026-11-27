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

/// A note found by `list_notes`: its path below the folder listed, `/`
/// separated, its size in bytes, its last change and when it was made, in
/// milliseconds since the Unix epoch, as the `fs` plugin gives them. The
/// time it was made is left out where the file system does not keep it.
#[derive(serde::Serialize)]
struct NoteStat {
    path: String,
    size: u64,
    mtime: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    birthtime: Option<u64>,
}

/// Every note under `dir`, with its size and time, in one call: the startup
/// scan needs them for every note, and the `fs` plugin has one call per file
/// for them, 1.5 s for 10,000 notes (ARCHITECTURE.md, ADR-028). A note is a
/// `.md` file; names that start with "." are skipped, folders and all, and so
/// are symlinks, as the vault tree does. `dir` must be inside a folder the
/// user opened.
#[tauri::command]
async fn list_notes(app: tauri::AppHandle, dir: String) -> Result<Vec<NoteStat>, String> {
    use tauri_plugin_fs::FsExt;

    #[cfg(windows)]
    let dir = dir.replace('/', "\\");
    if !app.fs_scope().is_allowed(&dir) {
        return Err(format!("Not inside an opened folder: {dir}"));
    }
    tauri::async_runtime::spawn_blocking(move || {
        let root = std::path::PathBuf::from(&dir);
        let mut notes = Vec::new();
        let mut folders = vec![(root, String::new())];
        while let Some((folder, prefix)) = folders.pop() {
            for entry in std::fs::read_dir(&folder)? {
                let entry = entry?;
                let name = entry.file_name().to_string_lossy().into_owned();
                if name.starts_with('.') {
                    continue;
                }
                let path = if prefix.is_empty() {
                    name.clone()
                } else {
                    format!("{prefix}/{name}")
                };
                // Not followed: a link cannot lead outside the vault or loop.
                let kind = entry.file_type()?;
                if kind.is_dir() {
                    folders.push((entry.path(), path));
                } else if kind.is_file() && name.to_lowercase().ends_with(".md") {
                    let meta = entry.metadata()?;
                    let millis = |time: std::io::Result<std::time::SystemTime>| {
                        time.ok()
                            .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
                            .map(|since| since.as_millis() as u64)
                    };
                    notes.push(NoteStat {
                        path,
                        size: meta.len(),
                        mtime: millis(meta.modified()).unwrap_or(0),
                        birthtime: millis(meta.created()),
                    });
                }
            }
        }
        Ok::<_, std::io::Error>(notes)
    })
    .await
    .map_err(|error| error.to_string())?
    .map_err(|error| error.to_string())
}

/// One statement of `sql_batch`: `?` takes `params` in order.
#[derive(serde::Deserialize)]
struct SqlStatement {
    sql: String,
    params: Vec<serde_json::Value>,
}

/// Runs statements on a database the `sql` plugin opened, in one
/// transaction: all of them or none. The plugin has no transactions, so each
/// of its statements is a commit of its own, and each commit waits for the
/// disk: about 1,000 for a first index of 10,000 notes, 9 s of its 14
/// (ARCHITECTURE.md, ADR-029). `db` is the connection string the database was
/// loaded with; values are bound as the plugin binds them.
#[tauri::command]
async fn sql_batch(
    instances: tauri::State<'_, tauri_plugin_sql::DbInstances>,
    db: String,
    statements: Vec<SqlStatement>,
) -> Result<(), String> {
    let instances = instances.0.read().await;
    let Some(tauri_plugin_sql::DbPool::Sqlite(pool)) = instances.get(&db) else {
        return Err(format!("Database not loaded: {db}"));
    };
    let mut transaction = pool.begin().await.map_err(|error| error.to_string())?;
    for statement in statements {
        let mut query = sqlx::query(&statement.sql);
        for value in statement.params {
            query = match value {
                serde_json::Value::Null => query.bind(None::<String>),
                serde_json::Value::String(text) => query.bind(text),
                serde_json::Value::Number(number) => match number.as_i64() {
                    Some(integer) => query.bind(integer),
                    None => query.bind(number.as_f64().unwrap_or_default()),
                },
                other => query.bind(other.to_string()),
            };
        }
        query
            .execute(&mut *transaction)
            .await
            .map_err(|error| error.to_string())?;
    }
    // Dropped without a commit on an error above: rolled back.
    transaction
        .commit()
        .await
        .map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
/// Tells the page when the pointer leaves the window, as the event
/// `pointer-left-window`. WebKitGTK does not on Wayland: the button under
/// the pointer as it leaves by the edge of the window, as those in its top
/// right corner, would stay hovered, with its tooltip, until it comes back.
#[cfg(target_os = "linux")]
fn tell_when_pointer_leaves(app: &tauri::App) {
    use gtk::prelude::*;
    use tauri::{Emitter, Manager};
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let Ok(gtk_window) = window.gtk_window() else {
        return;
    };
    let handle = app.handle().clone();
    gtk_window.connect_leave_notify_event(move |_, event| {
        // Into a part of the window itself is not out of it.
        if event.detail() != gtk::gdk::NotifyType::Inferior {
            let _ = handle.emit("pointer-left-window", ());
        }
        gtk::glib::Propagation::Proceed
    });
}

/// A font family installed on the system, found by `list_fonts`.
#[derive(serde::Serialize)]
struct SystemFont {
    family: String,
    /// Whether a face of it is monospace, for the monospace font setting.
    monospace: bool,
}

/// The font families installed on the system, sorted by name, each once,
/// for the font settings: the WebView cannot list them. Reading every font
/// file takes a moment, so it is done off the main thread.
#[tauri::command]
async fn list_fonts() -> Result<Vec<SystemFont>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let mut db = fontdb::Database::new();
        db.load_system_fonts();
        let mut fonts: Vec<SystemFont> = Vec::new();
        let mut seen = std::collections::HashMap::<String, usize>::new();
        for face in db.faces() {
            // The first name is the English one, which CSS finds it by.
            let Some((family, _)) = face.families.first() else {
                continue;
            };
            if family.is_empty() || family.starts_with('.') {
                continue;
            }
            match seen.get(family) {
                Some(&at) => fonts[at].monospace |= face.monospaced,
                None => {
                    seen.insert(family.clone(), fonts.len());
                    fonts.push(SystemFont {
                        family: family.clone(),
                        monospace: face.monospaced,
                    });
                }
            }
        }
        fonts.sort_by_key(|font| font.family.to_lowercase());
        fonts
    })
    .await
    .map_err(|error| error.to_string())
}

pub fn run() {
    use tauri_plugin_log::{RotationStrategy, Target, TargetKind, TimezoneStrategy};

    tauri::Builder::default()
        // The log file of the app, in its log folder (C-606): what went
        // wrong, for the user to send and the developer to read. Two files
        // of 1 MB at most, the older one renamed with its date.
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    Target::new(TargetKind::LogDir {
                        file_name: Some("carbon".into()),
                    }),
                    Target::new(TargetKind::Stdout),
                ])
                .level(tauri_plugin_log::log::LevelFilter::Info)
                .max_file_size(1_000_000)
                .rotation_strategy(RotationStrategy::KeepSome(2))
                .timezone_strategy(TimezoneStrategy::UseLocal)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        // Updates from the GitHub releases (C-607, ADR-034); `process`
        // starts the app again once one is installed.
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        // Cut, copy and paste from the context menu of a note.
        .plugin(tauri_plugin_clipboard_manager::init())
        // Picking a vault folder grants access to it for one run of the app.
        // This keeps the grant, so a recent vault opens after a restart.
        // It must come after the `fs` plugin.
        .plugin(tauri_plugin_persisted_scope::init())
        // The sandbox is made in the app cache, not picked in a dialog, and
        // so is the test vault of the end-to-end tests in a debug build: the
        // commands that check the scope of the `fs` plugin (`list_notes`,
        // `import_file`) must take them as opened too.
        .setup(|app| {
            use tauri::Manager;
            use tauri_plugin_fs::FsExt;
            if let Ok(cache) = app.path().app_cache_dir() {
                let scope = app.fs_scope();
                let _ = scope.allow_directory(cache.join("sandbox"), true);
                #[cfg(debug_assertions)]
                let _ = scope.allow_directory(cache.join("test-vault"), true);
            }
            #[cfg(target_os = "linux")]
            tell_when_pointer_leaves(app);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            move_to_trash,
            import_file,
            list_notes,
            sql_batch,
            list_fonts
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
