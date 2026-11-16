// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(target_os = "linux")]
    follow_system_theme_in_appimage();
    carbon_lib::run()
}

/// The AppImage starts the app through a hook of linuxdeploy-plugin-gtk,
/// which sets `GTK_THEME` to `Adwaita:dark` or `Adwaita:light` after the
/// colour scheme of the system at launch. WebKit takes a theme name ending
/// in `:dark` (or `-dark`) for a dark appearance whatever the system says
/// later, so an app launched in a dark system stayed dark when the system
/// turned light. The hook's theme cannot simply be dropped either: GTK then
/// falls back to the system theme name (such as `adw-gtk3-dark`), which
/// inside the AppImage does not follow the system and so traps the app the
/// same way.
///
/// `Adwaita` without a variant leaves one signal: the
/// `gtk-application-prefer-dark-theme` setting, which tao keeps in step with
/// the colour scheme of the desktop portal, at launch and on every change.
/// A theme the user asked for through `APPIMAGE_GTK_THEME` is kept (the hook
/// does not export that variable, so it is in the environment only when the
/// user set it).
#[cfg(target_os = "linux")]
fn follow_system_theme_in_appimage() {
    if std::env::var_os("APPIMAGE").is_some() && std::env::var_os("APPIMAGE_GTK_THEME").is_none() {
        // SAFETY: the very start of `main`, before any other thread exists.
        unsafe { std::env::set_var("GTK_THEME", "Adwaita") };
    }
}
