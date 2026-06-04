#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::net::TcpStream;
#[cfg(debug_assertions)]
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{Manager, RunEvent};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

struct BackendProcess(Mutex<Option<Child>>);

fn port_is_open(port: u16) -> bool {
    TcpStream::connect_timeout(
        &std::net::SocketAddr::from(([127, 0, 0, 1], port)),
        Duration::from_millis(200),
    )
    .is_ok()
}

#[cfg(debug_assertions)]
fn start_backend(_app: &tauri::App) -> Option<Child> {
    if port_is_open(8000) {
        return None; // reuse already-running backend
    }
    let backend_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("project root")
        .join("backend");
    let venv_py = backend_dir.join(".venv").join("Scripts").join("python.exe");
    let python = if venv_py.exists() { venv_py } else { PathBuf::from("py") };
    let mut cmd = Command::new(python);
    cmd.args(["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"])
        .current_dir(&backend_dir);

    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    cmd.spawn().ok()
}

#[cfg(not(debug_assertions))]
fn start_backend(app: &tauri::App) -> Option<Child> {
    if port_is_open(8000) {
        return None;
    }
    // app_data_dir resolves to %APPDATA%\com.trsat.mission-control — the same
    // location the Inno Setup installer writes the .env credentials file to.
    let data_dir = app.path().app_data_dir().ok()?;
    std::fs::create_dir_all(&data_dir).ok();

    // Inno Setup installs the onedir backend folder into {app}\backend\.
    // The main exe is the Tauri app, so current_exe().parent() == {app}.
    let app_dir = std::env::current_exe().ok()?
        .parent()?.to_path_buf();

    let candidates = [
        // Primary: Inno Setup onedir layout
        app_dir.join("backend").join("trsat-backend.exe"),
        // Fallback: flat layout (legacy single-exe installs)
        app_dir.join("trsat-backend.exe"),
    ];
    let backend_exe = candidates.iter().find(|p| p.exists())?;

    // Set working directory to the backend folder so _internal/ is found
    let backend_dir = backend_exe.parent()?;

    // Create a log file for backend stderr in the data directory
    let log_path = data_dir.join("backend-stderr.log");
    let stderr_file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .ok()?;

    let mut cmd = Command::new(backend_exe);
    cmd.current_dir(backend_dir)
        .env("TRSAT_DATA_DIR", data_dir.to_string_lossy().to_string())
        .stderr(std::process::Stdio::from(stderr_file));

    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    cmd.spawn().ok()
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(BackendProcess(Mutex::new(None)))
        .setup(|app| {
            let child = start_backend(app);
            *app.state::<BackendProcess>().0.lock().unwrap() = child;

            // Wait up to 15 s for the backend to start listening.
            let deadline = std::time::Instant::now() + Duration::from_secs(15);
            while std::time::Instant::now() < deadline {
                if port_is_open(8000) {
                    break;
                }
                std::thread::sleep(Duration::from_millis(300));
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let RunEvent::ExitRequested { .. } = event {
                if let Some(mut child) = app_handle
                    .state::<BackendProcess>()
                    .0
                    .lock()
                    .unwrap()
                    .take()
                {
                    let _ = child.kill();
                }
            }
        });
}
