# Installation and build

## Requirements

- Computer: Windows 10/11 recommended. Startup/build scripts are PowerShell. Backend/companion can be run manually on other Node-supported systems; those platforms have not been tested here.
- Node.js **22.12+ LTS** and npm (includes `--env-file` support). This repository locks dependencies with npm lockfiles.
- TV: Android 5.0+ per manifest, Android 8.0 tested. Android TV remote recommended; an APK cannot install on non-Android TV operating systems.
- TV and PC on the same trusted LAN; permit TCP 8080/8090 and UDP 45831 on the private network as needed.
- For APK compilation only: **JDK 8**, Android SDK **platforms;android-30**, **build-tools;30.0.3**. SDK tools must be legally obtained separately. ADB is optional; no Android Studio or Gradle is required by this build script.

## 1. Obtain source

Clone the repository, enter its directory, or extract the source ZIP:

```powershell
git clone https://github.com/lcacvc210-alt/VelaNestTV.git
cd VelaNestTV
```

## 2. Install dependencies and configure

Run PowerShell from the repository root:

```powershell
cd backend
npm ci
Copy-Item .env.example .env.local
# Edit .env.local: set your PASSWORD and your own API/M3U sources
notepad .env.local
npm run build
cd ../companion
npm ci
Copy-Item .env.example .env
notepad .env
# Set the same PASSWORD; optionally set NAS_ROOT to your media folder
cd ..
```

See CONFIGURATION.md for all variables. No working provider list or media is bundled. Default NAS folder is repository/media and is created on first run.

## 3. Start the computer services

```powershell
powershell -ExecutionPolicy Bypass -File ./scripts/start.ps1
```

Run once; this script is not an automatic startup service and does not prevent duplicate launches. Logs/PIDs are in runtime/. Verify:

```powershell
Invoke-RestMethod http://localhost:8080/api/status
Invoke-RestMethod http://localhost:8090/health
```

The first reports configured sources; the second reports companion health/catalog count. Initial catalog enrichment may take time. Stop with `powershell -ExecutionPolicy Bypass -File ./scripts/stop.ps1`. This only targets recorded Node service PIDs; keep the source directory in place while services run.

Manual alternative: one terminal `cd backend; npm run start -- -H 0.0.0.0`; another terminal `cd companion; node --env-file=.env server.mjs`. Avoid running both this and the start script. PC must remain powered on and awake for TV access.

## 4. Build APK

Install the listed SDK packages through Android SDK Manager. Set environment variables in the current PowerShell session, replacing example paths:

```powershell
$env:JAVA_HOME='C:/Java/jdk8'
$env:ANDROID_SDK_ROOT='C:/Android/Sdk'
./android/build.ps1
```

The script locates aapt, javac, D8, zipalign and apksigner, then writes `android/dist/VelaNestTV-3.1.1.apk`. The first build generates a local signing key/password under android/private/. Back it up privately: a different signing key cannot overwrite an installed APK with the same package name. Public source contains no maintainer signing key. A self-built APK therefore cannot be assumed to overlay the maintainer-signed APK.

## 5. Install on TV

USB: copy APK to USB, open with the TV's file manager and allow installation from that app if requested. Device policies can restrict side-loading.

Optional ADB, after enabling network debugging on your own TV:

```powershell
adb connect YOUR_TV_IP:5555
adb -s YOUR_TV_IP:5555 install -r ./android/dist/VelaNestTV-3.1.1.apk
```

Use the actual debug port and accept the TV authorization prompt. On first launch enter `http://YOUR_PC_LAN_IP:8080` and the password. Same-signature updates should be installed over the previous version without uninstalling.

## Troubleshooting

- Cannot connect: check both services, LAN IP, PC sleep/firewall, guest Wi-Fi isolation. Test the PC address from another LAN device.
- Login fails: backend PASSWORD, companion PASSWORD and TV password must match. Restart after environment changes.
- Empty recommendations/search: supply compatible APIs; check companion logs and outbound access. External catalog/suggestion services may fail or rate-limit.
- Buffering: test another source; source/CDN, codec, Wi-Fi bandwidth and TV hardware all matter. The app does not guarantee every source or 4K seek is smooth.
- NAS missing files: verify NAS_ROOT, file permissions and supported extensions. It serves this folder, not all computer disks.
- Subtitles: only system-recognized embedded tracks are selectable. External subtitle files are not integrated.
- Install signature conflict: use an APK built with the original key. Uninstalling to change signer removes app data.
- Build fails: confirm JDK 8 and exact SDK packages, avoid mixing JDK/SDK locations; inspect the first tool error.
