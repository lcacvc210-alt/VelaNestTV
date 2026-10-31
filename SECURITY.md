# Security

Do not post passwords, cookies, signed NAS links or private media paths in public issues. Report security concerns privately to lcacvc@163.com, or use a private GitHub vulnerability report if enabled.

This release targets a trusted home LAN. Backend/companion bind on all interfaces and local HTTP is supported. Do not port-forward 8080/8090 or expose UDP discovery to the internet. NAS URLs are bearer links valid up to 12 hours; treat them as secrets. NAS is read-only and scoped to NAS_ROOT, but the operator remains responsible for network access controls. The app stores connection credentials in Android app-private preferences, not an encrypted credential vault.

