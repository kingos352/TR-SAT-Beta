# TR-SAT Mission Control V4 — Geliştirici Kurulum Kılavuzu

Tauri ile sistem WebView2 (Edge engine) üzerinde **native pencere** olarak çalışır. Tarayıcı yok, tab yok, ayrı sunucu yok — tek bir `.exe`.

## Bir Defalık Kurulum (Geliştirici Makinesi)

### 1. Rust Toolchain
[https://rustup.rs/](https://rustup.rs/) adresinden `rustup-init.exe`'yi indir ve çalıştır. Varsayılan seçimler yeterli.

Doğrula:
```powershell
rustc --version
cargo --version
```

### 2. Microsoft C++ Build Tools
Visual Studio Build Tools 2022 — sadece **"Desktop development with C++"** workload yeterli.

### 3. WebView2 Runtime
Windows 11'de zaten yüklü gelir. Windows 10'da yoksa [Evergreen Bootstrapper](https://developer.microsoft.com/microsoft-edge/webview2/)'ı indir.

### 4. Node.js ve npm bağımlılıkları
```powershell
cd frontend
npm install
```

### 5. Python sanal ortamı (backend geliştirme için)
```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 6. Uygulama ikonu (opsiyonel)
1024×1024 PNG kaynaktan tüm boyutları üret:
```powershell
cd frontend
npx @tauri-apps/cli icon ..\path\to\icon-1024.png --output ..\src-tauri\icons
```

---

## Geliştirme Modu (Hot-Reload)

```powershell
.\scripts\windows\TR-SAT-Start.ps1
```

İçinde olan: Vite dev server (5173) + FastAPI sidecar (8000) + native Tauri penceresi. React'ta her dosya değişikliği anında pencereye yansır.

## Production Build

```powershell
.\scripts\windows\TR-SAT-Build.ps1
```

Sırasıyla yapar:
1. `backend\trsat_backend.spec` → `backend\dist\trsat-backend\trsat-backend.exe` (PyInstaller, ~40 MB)
2. Sidecar'ı `src-tauri\binaries\trsat-backend-x86_64-pc-windows-msvc.exe` olarak kopyalar
3. `npm run build` → frontend statik dosyaları
4. `cargo build --release` + Tauri bundler → çalıştırılabilir uygulama

## Tam Installer Oluşturma (Inno Setup)

```powershell
.\scripts\build-full-installer.ps1
```

Çıktı: `installer\output\TR-SAT-Setup-v4.0.0.exe`

---

## Çalışma Zamanı Veri Konumu

```
%APPDATA%\com.trsat.mission-control\
├── trsat_v4.sqlite     # Yerel katalog veritabanı
├── trsat-backend.log   # Backend log dosyası
└── .env                # Cesium / Space-Track kimlik bilgileri
```

`.env` dosyasını manuel oluşturup AppData'ya koy — örnek için `frontend/.env.example`'a bak.

---

## Mimari

```
┌──────────────────────────────────────────────┐
│       TR-SAT Mission Control V4.exe          │  ← Tauri (Rust, ~10 MB)
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │  WebView2 (sistemden, Edge engine)     │  │  ← React + CesiumJS
│  │  - React 18 + TypeScript               │  │
│  │  - Native pencere                      │  │
│  └────────────────┬───────────────────────┘  │
│                   │ HTTP + WebSocket          │
│  ┌────────────────▼───────────────────────┐  │
│  │  trsat-backend.exe (sidecar, ~40 MB)   │  │  ← FastAPI + SGP4
│  │  127.0.0.1:8000                        │  │
│  └────────────────┬───────────────────────┘  │
│                   │                          │
│           SQLite (%APPDATA%)                 │
└──────────────────────────────────────────────┘
```

Pencere kapatılınca Tauri main process, sidecar'a `kill()` gönderir — process kalıntısı kalmaz.

---

## Sorun Giderme

| Belirti | Sebep / Çözüm |
|---------|--------------|
| `cargo: command not found` | Rust kurulmadı — Adım 1'e dön |
| `link.exe not found` | C++ Build Tools eksik — Adım 2'ye dön |
| `trsat-backend sidecar missing` | Önce `build-backend-sidecar.ps1`'i çalıştır |
| Pencere açılıyor ama "Connection refused" | Backend sidecar 8000'e bağlanamadı — `%APPDATA%\com.trsat.mission-control\trsat-backend.log` dosyasını kontrol et |
