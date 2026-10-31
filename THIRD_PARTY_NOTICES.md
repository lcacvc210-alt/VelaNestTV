# Third-party notices

- `backend/` derives from [LibreSpark/LibreTV](https://github.com/LibreSpark/LibreTV), upstream commit `a24ad336a3f7c8a16ca93d1f1198e08ac6b7e943`, package version 2.16.12. Its original license and README are retained. Local package and lockfile updates are included.
- This combined distribution is provided under **AGPL-3.0-or-later**; see LICENSE. Preserve upstream copyright and license notices when redistributing.
- Companion uses `pinyin-pro` 3.27.0; dependency metadata and lockfile are retained. Backend dependencies are enumerated in backend/package.json and backend/package-lock.json, each retaining its respective license.
- Android SDK, JDK, Node.js, npm packages, signing tools and system images are installed separately; they are not redistributed here.
- The new VelaNestTV icon SVG and PNG assets are included under the project license. They contain no imported player logo.
- Film posters, remote suggestion/catalog responses, M3U lists and videos are not project-owned assets. No media library, authenticated provider credentials or curated third-party playback source list is shipped in this repository.

Public packaging changes: configurable companion paths and isolated-test ports, sanitized provider test fixtures, startup preflight and diagnostics, Next.js 15.5.28 / PostCSS dependency patches, Vitest 5 test tooling and explicit backend tracing root. These are local modifications to the recorded upstream snapshot.
