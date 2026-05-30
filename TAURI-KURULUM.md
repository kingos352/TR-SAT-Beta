# TR-SAT Mission Control V3 — Tauri Desktop

Tauri ile sistem WebView2 (Edge engine) üzerinde **native pencere** olarak çalışır. Tarayıcı yok, tab yok, ayrı sunucu yok — tek bir `.exe`.

## Bir Defalık Kurulum (Geliştirici Makinesi)

### 1. Rust toolchain
[https://rustup.rs/](https://rustup.rs/) adresinden `rustup-init.exe`'yi indir ve çalıştır. Varsayılan seçimler yeterli.

Doğrula:
```powershell
rustc --version
cargo --version
```

### 2. Microsoft C++ Build Tools
Visual Studio Build Tools 2022 — sadece **"Desktop development with C++"** workload yeterli.
[https://visualstudio.microsoft.com/visual-cpp-build-tools/](https://visualstudio.microsoft.com/visual-cpp-build-tools/)

### 3. WebView2 Runtime
Windows 11'de zaten var. Windows 10'da yoksa: [Evergreen Bootstrapper](https://developer.microsoft.com/microsoft-edge/webview2/).

### 4. PyInstaller (backend'i `.exe`'ye derler)
İlk `build-backend-sidecar.ps1` çalıştırmasında otomatik kurulur — manuel adım yok.

### 5. Tauri CLI ve npm bağımlılıkları
```powershell
cd frontend
npm install
```

### 6. Uygulama ikonu (opsiyonel ama önerilir)
1024×1024 PNG kaynaktan tüm boyutları üret:
```powershell
cd frontend
npx @tauri-apps/cli icon ..\path\to\trsat-icon-1024.png --output ..\src-tauri\icons
```

## Geliştirme Modu (Hot-Reload)

```powershell
.\TR-SAT-Desktop.bat
```

İçinde olan: Vite dev server (5173) + FastAPI sidecar (8000) + native Tauri penceresi. React'ta her dosya değişikliği anında pencereye yansır.

## Production Build

```powershell
.\TR-SAT-Desktop-Build.bat
```

Sırasıyla yapar:
1. `backend\trsat-backend.spec` → `backend\dist\trsat-backend.exe` (PyInstaller, ~40 MB)
2. Sidecar'ı `src-tauri\binaries\trsat-backend-x86_64-pc-windows-msvc.exe` olarak kopyalar
3. `npm run build` → frontend statik dosyaları
4. `cargo build --release` + Tauri bundler → installer + MSI

Çıktı:
```
src-tauri\target\release\bundle\
├── nsis\TR-SAT Mission Control V3_3.0.0_x64-setup.exe   (~50 MB installer)
└── msi\TR-SAT Mission Control V3_3.0.0_x64_en-US.msi    (~50 MB MSI)
```

## Çalışma Zamanı Veri Konumu

Tauri build edilmiş uygulamada:
```
%APPDATA%\com.trsat.mission-control\
├── trsat_v3.sqlite     # Local catalog DB
└── .env                # Cesium / Space-Track / AI sağlayıcı anahtarları
```

`.env` dosyasını manuel oluşturup AppData'ya koy — örnek için repo kökündeki `.env.example`'a bak.

## Mimari

```
┌──────────────────────────────────────────────┐
│         TR-SAT Mission Control V3.exe         │  ← Tauri (Rust, ~10 MB)
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │  WebView2 (sistemden, Edge engine)     │  │  ← React + CesiumJS
│  │  - React UI                            │  │
│  │  - Native window decorations            │  │
│  └────────────────┬───────────────────────┘  │
│                   │ HTTP + WebSocket          │
│  ┌────────────────▼───────────────────────┐  │
│  │  trsat-backend.exe (sidecar, ~40 MB)   │  │  ← FastAPI + SGP4
│  │  127.0.0.1:8000                        │  │
│  └────────────────┬───────────────────────┘  │
│                   │                          │
│              SQLite (AppData)                │
└──────────────────────────────────────────────┘
```

Pencere kapatılınca Tauri main process, `BackendProcess` state'inde tuttuğu child handle ile sidecar'a `kill()` gönderir — process kalıntısı kalmaz.

## Sorun Giderme

| Belirti | Sebep / Çözüm |
|---------|--------------|
| `cargo: command not found` | Adım 1, Rust kurulmadı |
| `link.exe not found` | Adım 2, C++ Build Tools eksik |
| `trsat-backend sidecar missing` | Önce `build-backend-sidecar.ps1`'i çalıştır |
| Pencere açılıyor ama "Connection refused" | Backend sidecar 8000'e bağlanamadı — `%APPDATA%\com.trsat.mission-control\` izinleri kontrol et |
| Conjunction taraması yavaş | RTX 4060 için `pip install cupy-cuda12x` (backend venv'inde) |

## Mevcut `--app` Modu

Eski `TR-SAT.bat`, `TR-SAT-Start.bat`, `TR-SAT-App.bat` çalışmaya devam eder. Tauri yapısı bunlara dokunmaz — sadece yeni bir çalıştırma yolu ekler.
