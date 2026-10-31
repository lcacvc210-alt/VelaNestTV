# Contributing

Use small changes with reproducible steps and validation notes. Do not include passwords, signing keys, cookies, media, runtime caches or third-party provider credentials in issues or pull requests. Contributions are under AGPL-3.0-or-later.

Validate backend changes with `npm run typecheck` and relevant tests in backend. Validate companion JavaScript with `node --check server.mjs` and `node --check nas.mjs`, plus actual API behavior. Build Android with android/build.ps1; test remote focus/back behavior and playback on the supported platform. Preserve the package/signing identity when preparing upgrades. Playback changes require explicit playback validation; branding-only changes do not justify rewriting playback.

Maintenance and version suggestions: [lcacvc@163.com](mailto:lcacvc@163.com). Include version, device, reproduction steps and redacted logs.
