# Native key storage (planned, not built)

Status on 3 Nov 2026: **not implemented.** There is no iOS or Android project in
this repository yet (no `capacitor.config.*`, no `ios/` or `android/`), and no
code imports `@capacitor/*`. The plugin named below is not a dependency.

The plan for the native apps:

- Keep XMTP database keys and session tokens in the iOS Keychain and the
  Android Keystore, through a maintained secure-storage plugin for Capacitor,
  never in WebView `localStorage`.
- Prefer hardware-backed keys (Secure Enclave / StrongBox) where the device has
  them, and say in the interface when it does not.

Until the native apps exist, the web app keeps these values in the browser
(IndexedDB and the encrypted vault in `lib/core/SecureVault.ts`), which a
compromised device or browser extension can read.
