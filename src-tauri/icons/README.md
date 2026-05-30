# İkonlar

Tauri bundler bu klasördeki dosyaları arar:

- `32x32.png`
- `128x128.png`
- `128x128@2x.png` (256x256)
- `icon.ico` (Windows installer)
- `icon.icns` (macOS — opsiyonel)

Tek bir 1024x1024 PNG'den hepsini üretmek için:

```powershell
npx @tauri-apps/cli icon path\to\source-icon.png
```

Bu komut tüm boyutları ve formatları otomatik üretir.
