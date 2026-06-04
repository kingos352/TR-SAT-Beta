; ============================================================================
; TR-SAT Mission Control V4 — Inno Setup installer script
; Version: 4.0.0
; Inno Setup 6.3+  (https://jrsoftware.org/isinfo.php)
;
; This installer:
;   1. Installs the Tauri app executable + PyInstaller backend sidecar
;   2. Installs the Microsoft WebView2 runtime if absent
;   3. Collects Space-Track.org credentials (required)
;   4. Collects optional API keys (Gemini, CesiumJS Ion)
;   5. Writes all credentials to %APPDATA%\com.trsat.mission-control\.env
;      so the backend reads them on first launch
;   6. Creates desktop + Start-Menu shortcuts
; ============================================================================

#define AppName        "TR-SAT Mission Control V4"
#define AppPublisher   "TR-SAT"
#define AppVersion     "4.0.0"
#define AppExeName     "tr-sat-mission-control.exe"
#define BackendExe     "trsat-backend.exe"
#define AppURL         "https://github.com/trsat-dev/tr-sat-desktop"
#define AppIdentifier  "com.trsat.mission-control"
; Relative paths from this script:  installer/ → project root = ..
#define SrcRoot        ".."
#define TauriRelease   "..\src-tauri\target\release"
#define BackendDist    "..\backend\dist"

[Setup]
AppId={{A3F2D8C1-4B7E-4F9A-8D2E-6C1B3A5F7E9D}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}/issues
AppUpdatesURL={#AppURL}/releases
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
AllowNoIcons=no
LicenseFile=
; Use a custom info page instead of a licence RTF
InfoBeforeFile=
OutputDir=output
OutputBaseFilename=TR-SAT-Setup-v{#AppVersion}
SetupIconFile=assets\icon.ico
Compression=lzma2/ultra64
SolidCompression=yes
InternalCompressLevel=ultra64
WizardStyle=modern
WizardImageFile=assets\wizard_side.bmp
WizardSmallImageFile=assets\wizard_header.bmp
; Minimum Windows 10 (10.0.17763 = 1809, WebView2 auto-updates from there)
MinVersion=10.0.17763
; admin required for Program Files install; per-user appdata writes go to
; the current user's %APPDATA% which is correct even in admin mode.
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=dialog
UsedUserAreasWarning=no
ShowLanguageDialog=auto
DisableDirPage=no
DisableProgramGroupPage=no
UninstallDisplayIcon={app}\{#AppExeName}
UninstallDisplayName={#AppName}
; Display a friendly name in Programs list even though exe has a technical name
AppMutex=TRSATMissionControlV4Running
VersionInfoVersion={#AppVersion}
VersionInfoCompany={#AppPublisher}
VersionInfoDescription={#AppName} Setup
VersionInfoProductName={#AppName}
VersionInfoProductVersion={#AppVersion}

[Languages]
Name: "turkish";  MessagesFile: "compiler:Languages\Turkish.isl"
Name: "english";  MessagesFile: "compiler:Default.isl"

[CustomMessages]
; ─── Turkish ──────────────────────────────────────────────────────────────
turkish.PageST_Title=Space-Track.org Kimlik Bilgileri
turkish.PageST_Desc=Uydu verilerine erişmek için Space-Track.org hesabınızı girin.
turkish.PageST_SubDesc=Space-Track.org, ABD Uzay Kuvvetleri'nin (USSPACECOM) resmi katalog hizmetidir. %nÜcretsiz kayıt için: https://www.space-track.org/auth/createAccount%n%nBu bilgiler yalnızca cihazınızda saklanır; hiçbir sunucuya iletilmez.
turkish.PageST_User=E-posta Adresi (Space-Track kullanıcı adı):
turkish.PageST_Pass=Parola:
turkish.ErrST_User=Lütfen Space-Track.org e-posta adresinizi girin.
turkish.ErrST_Pass=Lütfen Space-Track.org parolanızı girin.
turkish.PageOpt_Title=İsteğe Bağlı: API Anahtarları
turkish.PageOpt_Desc=Bu adım isteğe bağlıdır. İstediğinizde de yapılandırabilirsiniz.
turkish.PageOpt_SubDesc=3D harita için CesiumJS Ion hesabı ve yapay zeka asistanı için Google Gemini API anahtarı. %nİkisi de isteğe bağlıdır — boş bırakırsanız uygulama yine de çalışır.
turkish.PageOpt_Cesium=CesiumJS Ion Token (isteğe bağlı — https://cesium.com/ion):
turkish.PageOpt_Gemini=Google Gemini API Anahtarı (isteğe bağlı — https://aistudio.google.com):
turkish.PageInfo_Title=TR-SAT Hakkında
turkish.PageInfo_Desc=Kuruluma başlamadan önce önemli bilgileri okuyun.
turkish.WebView2Msg=Microsoft WebView2 çalışma zamanı kuruluyor... Lütfen bekleyin.
turkish.DoneTitle=Kurulum Tamamlandı
turkish.DoneDesc=TR-SAT Mission Control V4 başarıyla kuruldu.%n%nBaşlatmak için Bitir'e tıklayın veya kısayollardan çalıştırın.
turkish.LaunchNow=TR-SAT Mission Control V4'ü şimdi başlat
; ─── English ──────────────────────────────────────────────────────────────
english.PageST_Title=Space-Track.org Credentials
english.PageST_Desc=Enter your Space-Track.org account to enable real-time satellite data sync.
english.PageST_SubDesc=Space-Track.org is the official catalog service of US Space Command (USSPACECOM). %nFree registration at: https://www.space-track.org/auth/createAccount%n%nCredentials are stored locally on this device only — never transmitted externally.
english.PageST_User=E-mail Address (Space-Track username):
english.PageST_Pass=Password:
english.ErrST_User=Please enter your Space-Track.org e-mail address.
english.ErrST_Pass=Please enter your Space-Track.org password.
english.PageOpt_Title=Optional: API Keys
english.PageOpt_Desc=This step is optional. You can configure these at any time inside the app.
english.PageOpt_SubDesc=CesiumJS Ion enables high-resolution 3D map tiles. Google Gemini powers the AI orbital assistant. %nLeave blank to use offline / local-fallback modes.
english.PageOpt_Cesium=CesiumJS Ion Token (optional — https://cesium.com/ion):
english.PageOpt_Gemini=Google Gemini API Key (optional — https://aistudio.google.com):
english.PageInfo_Title=About TR-SAT
english.PageInfo_Desc=Please read important information before installation.
english.WebView2Msg=Installing Microsoft WebView2 runtime... Please wait.
english.DoneTitle=Installation Complete
english.DoneDesc=TR-SAT Mission Control V4 has been installed successfully.%n%nClick Finish to launch the application.
english.LaunchNow=Launch TR-SAT Mission Control V4 now

[Tasks]
Name: "desktopicon";    Description: "{cm:CreateDesktopIcon}";     GroupDescription: "{cm:AdditionalIcons}";
Name: "startmenuicon";  Description: "{cm:CreateQuickLaunchIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; Main Tauri application executable
Source: "{#TauriRelease}\{#AppExeName}"; DestDir: "{app}"; Flags: ignoreversion

; PyInstaller-compiled FastAPI backend sidecar (onedir — entire folder)
Source: "{#BackendDist}\trsat-backend\*"; DestDir: "{app}\backend"; Flags: ignoreversion recursesubdirs createallsubdirs

; WebView2 bootstrapper (auto-downloads + installs the right runtime for the OS)
Source: "redist\MicrosoftEdgeWebview2Setup.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall; Check: WebView2Needed

[Icons]
Name: "{group}\{#AppName}";            Filename: "{app}\{#AppExeName}"; IconFilename: "{app}\{#AppExeName}"; Comment: "SGP4 Orbital Intelligence Platform"
Name: "{group}\Uninstall {#AppName}";  Filename: "{uninstallexe}"
Name: "{commondesktop}\{#AppName}";    Filename: "{app}\{#AppExeName}"; IconFilename: "{app}\{#AppExeName}"; Tasks: desktopicon

[Run]
; Launch app after install (optional)
Filename: "{app}\{#AppExeName}"; Description: "{cm:LaunchNow}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Remove the data/.env config written by this installer on uninstall
Type: filesandordirs; Name: "{userappdata}\{#AppIdentifier}"

; ─────────────────────────────────────────────────────────────────────────────
; Pascal Script — custom wizard pages + post-install .env writer
; ─────────────────────────────────────────────────────────────────────────────
[Code]

// ── Page handles ─────────────────────────────────────────────────────────────
var
  SpaceTrackPage : TInputQueryWizardPage;
  OptionalPage   : TInputQueryWizardPage;
  InfoPage       : TOutputMsgWizardPage;

// ── Helpers ───────────────────────────────────────────────────────────────────

function IsLangTR: Boolean;
begin
  Result := (ActiveLanguage = 'turkish');
end;

function CM(TRKey, ENKey: String): String;
begin
  if IsLangTR then
    Result := CustomMessage(TRKey)
  else
    Result := CustomMessage(ENKey);
end;

// Check whether WebView2 is already installed (per-machine or per-user key)
function WebView2Needed: Boolean;
var
  Version: String;
begin
  Result := True;
  // Machine-wide (Edge / WebView2 Evergreen)
  if RegQueryStringValue(HKLM, 'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', Version) then
    if Version <> '' then begin Result := False; Exit; end;
  // Per-user install
  if RegQueryStringValue(HKCU, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', Version) then
    if Version <> '' then begin Result := False; Exit; end;
end;

// ── Wizard page initialisation ────────────────────────────────────────────────

procedure InitializeWizard;
var
  InfoText: String;
begin

  // ── About / Disclaimer page (first, just after Welcome) ─────────────────
  InfoText :=
    '═══════════════════════════════════════════════════════' + #13#10 +
    '  TR-SAT MISSION CONTROL V4 — BİLİMSEL SORUMLULUK REDDİ / DISCLAIMER' + #13#10 +
    '═══════════════════════════════════════════════════════' + #13#10 + #13#10 +
    '▸ YÖRÜNGE MODELİ / PROPAGATION MODEL' + #13#10 +
    '  TR-SAT, SGP4 analitik modeli kullanır. Tüm konum vektörleri' + #13#10 +
    '  hesaplanmış tahmindir; gerçek zamanlı telemetri alınmaz.' + #13#10 + #13#10 +
    '▸ YAKLAŞMA ANALİZİ / CONJUNCTION ANALYSIS' + #13#10 +
    '  Çarpışma olasılığı (Pc) değerleri sezgiseldir. CDM sınıfı' + #13#10 +
    '  ürün değildir; operasyonel çarpışma korunması için kullanılamaz.' + #13#10 + #13#10 +
    '▸ VERİ KAYNAKLARI / DATA SOURCES' + #13#10 +
    '  CelesTrak (celestrak.org) · Space-Track (space-track.org)' + #13#10 +
    '  Open-Meteo (open-meteo.com) · Tüm veriler kamuya açık API'' lerden alınır.' + #13#10 + #13#10 +
    '▸ GİZLİLİK / PRIVACY' + #13#10 +
    '  TR-SAT yerel-öncelikli bir uygulamadır. Hiçbir kullanım verisi,' + #13#10 +
    '  analiz sonucu veya kişisel veri dış sunuculara iletilmez.' + #13#10 + #13#10 +
    '═══════════════════════════════════════════════════════';

  InfoPage := CreateOutputMsgPage(
    wpWelcome,
    CM('PageInfo_Title', 'PageInfo_Title'),
    CM('PageInfo_Desc',  'PageInfo_Desc'),
    InfoText
  );

  // ── Space-Track credentials page (required) ───────────────────────────────
  SpaceTrackPage := CreateInputQueryPage(
    InfoPage.ID,
    CM('PageST_Title',   'PageST_Title'),
    CM('PageST_Desc',    'PageST_Desc'),
    CM('PageST_SubDesc', 'PageST_SubDesc')
  );
  SpaceTrackPage.Add(CM('PageST_User', 'PageST_User'), False);
  SpaceTrackPage.Add(CM('PageST_Pass', 'PageST_Pass'), True);  // password mask

  // Pre-fill from env in case user is re-installing
  SpaceTrackPage.Values[0] := '';
  SpaceTrackPage.Values[1] := '';

  // ── Optional API keys page ────────────────────────────────────────────────
  OptionalPage := CreateInputQueryPage(
    SpaceTrackPage.ID,
    CM('PageOpt_Title',   'PageOpt_Title'),
    CM('PageOpt_Desc',    'PageOpt_Desc'),
    CM('PageOpt_SubDesc', 'PageOpt_SubDesc')
  );
  OptionalPage.Add(CM('PageOpt_Cesium', 'PageOpt_Cesium'), False);
  OptionalPage.Add(CM('PageOpt_Gemini', 'PageOpt_Gemini'), False);
end;

// ── Input validation ──────────────────────────────────────────────────────────

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;

  if CurPageID = SpaceTrackPage.ID then begin
    if Trim(SpaceTrackPage.Values[0]) = '' then begin
      MsgBox(CM('ErrST_User', 'ErrST_User'), mbError, MB_OK);
      Result := False;
      Exit;
    end;
    if Trim(SpaceTrackPage.Values[1]) = '' then begin
      MsgBox(CM('ErrST_Pass', 'ErrST_Pass'), mbError, MB_OK);
      Result := False;
      Exit;
    end;
  end;
end;

// ── Write .env after all files are installed ──────────────────────────────────

procedure WriteEnvFile;
var
  Lines     : TArrayOfString;
  DataDir   : String;
  EnvPath   : String;
  AIProvider: String;
  GeminiKey : String;
  CesiumKey : String;
begin
  // Tauri's app_data_dir for identifier "com.trsat.mission-control"
  DataDir := ExpandConstant('{userappdata}\{#AppIdentifier}');
  EnvPath := DataDir + '\.env';

  // Create directory if not present
  if not ForceDirectories(DataDir) then
    MsgBox('Warning: could not create data directory: ' + DataDir, mbInformation, MB_OK);

  GeminiKey  := Trim(OptionalPage.Values[1]);
  CesiumKey  := Trim(OptionalPage.Values[0]);
  AIProvider := 'local';
  if GeminiKey <> '' then
    AIProvider := 'gemini';

  SetLength(Lines, 9);
  Lines[0] := '# TR-SAT Mission Control V4 - Runtime Configuration';
  Lines[1] := '# Generated by installer v{#AppVersion}. Do not edit while the app is running.';
  Lines[2] := '';
  Lines[3] := 'SPACETRACK_USERNAME=' + Trim(SpaceTrackPage.Values[0]);
  Lines[4] := 'SPACETRACK_PASSWORD=' + Trim(SpaceTrackPage.Values[1]);
  Lines[5] := '';
  Lines[6] := 'CESIUM_ION_TOKEN=' + CesiumKey;
  Lines[7] := 'GEMINI_API_KEY='   + GeminiKey;
  Lines[8] := 'AI_PROVIDER='      + AIProvider;

  if not SaveStringsToFile(EnvPath, Lines, False) then
    MsgBox('Warning: could not write config to ' + EnvPath + #13#10 +
           'You can enter credentials in the app Settings after launch.',
           mbInformation, MB_OK);
end;

// Install WebView2 if needed (silently)
procedure InstallWebView2;
var
  ResultCode: Integer;
begin
  if not WebView2Needed then Exit;
  ExtractTemporaryFile('MicrosoftEdgeWebview2Setup.exe');
  Exec(ExpandConstant('{tmp}\MicrosoftEdgeWebview2Setup.exe'),
       '/silent /install', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

// ── Step hooks ────────────────────────────────────────────────────────────────

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssInstall then begin
    InstallWebView2;
  end;

  if CurStep = ssPostInstall then begin
    WriteEnvFile;
  end;
end;

// ── Uninstall: offer to remove user data ─────────────────────────────────────
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  DataDir: String;
  MsgTxt: String;
begin
  if CurUninstallStep = usUninstall then begin
    DataDir := ExpandConstant('{userappdata}\{#AppIdentifier}');
    if DirExists(DataDir) then begin
      if IsLangTR then
        MsgTxt := 'TR-SAT uygulama verileri (veritabanı, yapılandırma) silinsin mi?' + #13#10 + DataDir
      else
        MsgTxt := 'Remove TR-SAT application data (database, configuration)?' + #13#10 + DataDir;
      if MsgBox(MsgTxt, mbConfirmation, MB_YESNO) = IDYES then
        DelTree(DataDir, True, True, True);
    end;
  end;
end;
