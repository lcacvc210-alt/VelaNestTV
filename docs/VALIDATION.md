# Public source package validation

Checked on 2026-10-31 before initial GitHub publication:

- Portable Android build and APK signature verification passed using JDK 8 and Android API 30 tooling, from a path containing spaces and Chinese characters. PlayerActivity is unchanged by public packaging.
- Backend typecheck passed; 26 test files / 311 tests passed; Next.js 15.5.28 production build passed.
- Two standalone Node integration tests passed: built backend login/status/unauthorized requests/empty-source rejection; actual backend-to-companion authentication plus doctor; isolated NAS GET/HEAD/Range, invalid ranges/signatures/path traversal, empty catalog and UDP discovery.
- Companion syntax checks and Windows startup/stop PowerShell parsing passed. Startup now checks default-port conflicts, configuration and readiness.
- npm production dependency audit: 0 vulnerabilities at check time. The complete development dependency audit still reports 14 moderate advisories; this is not a claim of a vulnerability-free project. Do not expose development/test servers. Recheck npm audit as advisories evolve.
- Actual source-site URLs in inherited test fixtures were replaced with reserved example domains. Source configuration defaults are empty.
- Local secret-value and documentation link checks passed before packaging. No personal password, signing key, env file, media or runtime cache is intended for publication.

The public portable package has not been installed onto the physical TV. Prior private builds were tested on Android 8.0; automated HTTP tests do not prove video codec compatibility or 4K playback performance. See TESTING.md and SOURCES.md for repeatable checks and source configuration rules.
