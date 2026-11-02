# Dependency Pinning Policy

Security-critical dependencies (e.g. `@aztec/*`, `@xmtp/*`, `viem`, `jose`) must be pinned to exact versions (without caret `^` or tilde `~`) in `package.json` to prevent supply-chain attacks.
