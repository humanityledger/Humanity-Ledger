# Native Keychain & Keystore Secure Enclave Storage

On native iOS and Android clients:
- XMTP private keys and session tokens are stored in the OS Keychain (iOS) and Android Keystore via `@capacitor-community/secure-storage-plugin`.
- Hardware-backed encryption ensures keys are inaccessible even if the device filesystem is inspected.
