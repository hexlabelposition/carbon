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
/// separated, its size in bytes and its last change in milliseconds since
/// the Unix epoch, as the `fs` plugin gives them.
#[derive(serde::Serialize)]
struct NoteStat {
    path: String,
    size: u64,
    mtime: u64,
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
                    let mtime = meta
                        .modified()
                        .ok()
                        .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
                        .map_or(0, |since| since.as_millis() as u64);
                    notes.push(NoteStat {
                        path,
                        size: meta.len(),
                        mtime,
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

/// Turns spell checking on in the WebView of Linux, for English and Russian,
/// the languages of the interface. WebKitGTK checks nothing until its web
/// context allows it, and Tauri leaves it off; the `spellcheck` attribute of
/// the editor, which the settings set, then decides (ADR-027). A language
/// without a dictionary installed is left out by WebKitGTK.
#[cfg(target_os = "linux")]
fn enable_spell_checking(app: &tauri::App) {
    use tauri::Manager;
    use webkit2gtk::{WebContextExt, WebViewExt};

    for window in app.webview_windows().values() {
        let _ = window.with_webview(|webview| {
            if let Some(context) = webview.inner().context() {
                context.set_spell_checking_enabled(true);
                context.set_spell_checking_languages(&["en_US", "ru_RU"]);
            }
        });
    }
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
        .setup(|app| {
            #[cfg(target_os = "linux")]
            enable_spell_checking(app);
            #[cfg(not(target_os = "linux"))]
            let _ = app;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            import_file,
            list_notes,
            sql_batch
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
