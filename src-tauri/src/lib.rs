use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, WindowEvent,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use tauri_plugin_positioner::{Position, WindowExt};
use tauri_plugin_sql::{Migration, MigrationKind};

// Windows tiene la barra abajo: el popover va arriba del icono. En macOS cuelga de la topbar.
#[cfg(target_os = "windows")]
const POPOVER_POSITION: Position = Position::TrayBottomCenter;
#[cfg(not(target_os = "windows"))]
const POPOVER_POSITION: Position = Position::TrayCenter;

#[derive(Default)]
struct PopoverState {
    // Al clickear el icono con el popover abierto, primero llega el blur (que lo oculta)
    // y despues el click; sin esto se volveria a abrir.
    last_blur_hide: Mutex<Option<Instant>>,
}

fn toggle_popover(app: &AppHandle) {
    let Some(win) = app.get_webview_window("popover") else {
        return;
    };
    if win.is_visible().unwrap_or(false) {
        let _ = win.hide();
        return;
    }
    let state = app.state::<PopoverState>();
    if let Some(t) = *state.last_blur_hide.lock().unwrap() {
        if t.elapsed() < Duration::from_millis(300) {
            return;
        }
    }
    let _ = win.move_window(POPOVER_POSITION);
    let _ = win.show();
    let _ = win.set_focus();
}

fn show_main(app: &AppHandle) {
    if let Some(p) = app.get_webview_window("popover") {
        let _ = p.hide();
    }
    #[cfg(target_os = "macos")]
    let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

const DEFAULT_QUICK_SHORTCUT: &str = "CommandOrControl+Shift+Space";

fn toggle_quick(app: &AppHandle) {
    let Some(win) = app.get_webview_window("quick") else {
        return;
    };
    if win.is_visible().unwrap_or(false) {
        let _ = win.hide();
        return;
    }
    if let Some(p) = app.get_webview_window("popover") {
        let _ = p.hide();
    }
    let _ = win.center();
    let _ = win.show();
    let _ = win.set_focus();
    let _ = app.emit_to("quick", "bitacora:quick-open", ());
}

// El atajo vive en un archivo propio porque se registra en Rust antes de que cargue ningún webview.
fn shortcut_file(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|d| d.join("quick-shortcut.txt"))
}

fn load_quick_shortcut(app: &AppHandle) -> String {
    shortcut_file(app)
        .and_then(|p| fs::read_to_string(p).ok())
        .map(|s| s.trim().to_string())
        .filter(|s| s.parse::<Shortcut>().is_ok())
        .unwrap_or_else(|| DEFAULT_QUICK_SHORTCUT.to_string())
}

#[tauri::command]
fn get_quick_shortcut(app: AppHandle) -> String {
    load_quick_shortcut(&app)
}

#[tauri::command]
fn set_quick_shortcut(app: AppHandle, accelerator: String) -> Result<(), String> {
    let new: Shortcut = accelerator.parse().map_err(|e| format!("{e}"))?;
    let old = load_quick_shortcut(&app);
    let gs = app.global_shortcut();
    gs.unregister_all().map_err(|e| e.to_string())?;
    if let Err(e) = gs.register(new) {
        let _ = gs.register(old.as_str());
        return Err(format!("probablemente ya lo usa otra app ({e})"));
    }
    if let Some(path) = shortcut_file(&app) {
        if let Some(dir) = path.parent() {
            let _ = fs::create_dir_all(dir);
        }
        fs::write(path, &accelerator).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn hide_quick(app: AppHandle) {
    if let Some(w) = app.get_webview_window("quick") {
        let _ = w.hide();
    }
}

#[tauri::command]
fn open_main(app: AppHandle) {
    show_main(&app);
}

#[tauri::command]
fn hide_popover(app: AppHandle) {
    if let Some(p) = app.get_webview_window("popover") {
        let _ = p.hide();
    }
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

fn migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "esquema inicial",
        sql: r#"
            CREATE TABLE companies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                color TEXT NOT NULL,
                position INTEGER NOT NULL DEFAULT 0,
                archived INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                day TEXT NOT NULL,
                section TEXT NOT NULL CHECK (section IN ('todo', 'progress', 'pending', 'notes')),
                text TEXT NOT NULL,
                done_on TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX idx_items_company_day ON items (company_id, day);
            CREATE INDEX idx_items_done_on ON items (done_on);
            INSERT INTO companies (name, color, position) VALUES
                ('Empresa 1', '#6366f1', 0),
                ('Empresa 2', '#10b981', 1),
                ('Empresa 3', '#f59e0b', 2);
        "#,
        kind: MigrationKind::Up,
    },
    // Secciones configurables. Se copia a "entries" en vez de reescribir "items" (que tenía
    // las 4 secciones fijas en un CHECK); "items" queda sin uso como respaldo.
    Migration {
        version: 2,
        description: "secciones configurables",
        sql: r#"
            CREATE TABLE sections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                color TEXT NOT NULL,
                checkable INTEGER NOT NULL DEFAULT 0,
                carry INTEGER NOT NULL DEFAULT 0,
                recap INTEGER NOT NULL DEFAULT 0,
                position INTEGER NOT NULL DEFAULT 0,
                archived INTEGER NOT NULL DEFAULT 0
            );
            INSERT INTO sections (id, name, color, checkable, carry, recap, position) VALUES
                (1, 'Por hacer', '#007aff', 1, 1, 0, 0),
                (2, 'En qué me quedé', '#ff9500', 0, 0, 1, 1),
                (3, 'Pendiente / esperando', '#ff3b30', 1, 1, 0, 2),
                (4, 'Notas e ideas', '#af52de', 0, 0, 0, 3);
            CREATE TABLE entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                day TEXT NOT NULL,
                section_id INTEGER NOT NULL REFERENCES sections(id),
                text TEXT NOT NULL,
                done_on TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            INSERT INTO entries (id, company_id, day, section_id, text, done_on, created_at, updated_at)
            SELECT id, company_id, day,
                   CASE section WHEN 'todo' THEN 1 WHEN 'progress' THEN 2 WHEN 'pending' THEN 3 ELSE 4 END,
                   text, done_on, created_at, updated_at
            FROM items;
            CREATE INDEX idx_entries_company_day ON entries (company_id, day);
            CREATE INDEX idx_entries_done_on ON entries (done_on);
            CREATE INDEX idx_entries_section ON entries (section_id);
        "#,
        kind: MigrationKind::Up,
    },
    Migration {
        version: 3,
        description: "notas por entrada",
        sql: r#"
            CREATE TABLE notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
                text TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX idx_notes_entry ON notes (entry_id);
        "#,
        kind: MigrationKind::Up,
    },
    // Orden manual (drag & drop). Las existentes arrancan con el orden que ya tenían.
    Migration {
        version: 4,
        description: "orden manual de entradas",
        sql: r#"
            ALTER TABLE entries ADD COLUMN position REAL NOT NULL DEFAULT 0;
            UPDATE entries SET position = id;
        "#,
        kind: MigrationKind::Up,
    }]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main(app);
        }))
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        toggle_quick(app);
                    }
                })
                .build(),
        )
        .plugin(tauri_plugin_positioner::init())
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations("sqlite:bitacora.db", migrations())
                .build(),
        )
        .manage(PopoverState::default())
        .invoke_handler(tauri::generate_handler![
            open_main,
            hide_popover,
            hide_quick,
            quit_app,
            get_quick_shortcut,
            set_quick_shortcut
        ])
        .setup(|app| {
            // App de menubar: sin icono en el Dock hasta que se abre la ventana grande.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let quick = load_quick_shortcut(app.handle());
            if let Err(e) = app.global_shortcut().register(quick.as_str()) {
                eprintln!("no se pudo registrar el atajo {quick}: {e}");
            }

            let quick_i = MenuItem::with_id(app, "quick", "Nueva tarea rápida…", true, None::<&str>)?;
            let open_i = MenuItem::with_id(app, "open", "Abrir Bitácora", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Salir", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let menu = Menu::with_items(app, &[&quick_i, &open_i, &sep, &quit_i])?;

            #[cfg(target_os = "macos")]
            let icon = Image::from_bytes(include_bytes!("../icons/tray.png"))?;
            #[cfg(not(target_os = "macos"))]
            let icon = app
                .default_window_icon()
                .cloned()
                .unwrap_or(Image::from_bytes(include_bytes!("../icons/32x32.png"))?);

            TrayIconBuilder::with_id("bitacora")
                .icon(icon)
                .tooltip("Bitácora")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quick" => toggle_quick(app),
                    "open" => show_main(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    tauri_plugin_positioner::on_tray_event(tray.app_handle(), &event);
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_popover(tray.app_handle());
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| match (window.label(), event) {
            ("quick", WindowEvent::Focused(false)) => {
                let _ = window.hide();
            }
            ("popover", WindowEvent::Focused(false)) => {
                let _ = window.hide();
                let state = window.app_handle().state::<PopoverState>();
                *state.last_blur_hide.lock().unwrap() = Some(Instant::now());
            }
            ("main", WindowEvent::CloseRequested { api, .. }) => {
                // Cerrar la ventana no cierra la app: sigue viviendo en la bandeja.
                api.prevent_close();
                let _ = window.hide();
                #[cfg(target_os = "macos")]
                let _ = window
                    .app_handle()
                    .set_activation_policy(tauri::ActivationPolicy::Accessory);
            }
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
