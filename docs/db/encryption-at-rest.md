# Encryption at Rest Verification

- All PostgreSQL database volumes are hosted on Railway Enterprise infrastructure utilizing AES-256 block-level encryption (LUKS / AWS EBS encrypted volumes).
- Redis persistence volumes use encrypted EBS volumes with KMS key rotation.
- Automated database backups are encrypted with GPG/AES-256 prior to cloud storage upload.
