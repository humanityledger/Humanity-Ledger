// Retired (CON-08, 26 Nov 2026). The global <AztecProvider> tried to import
// '@aztec/aztec.js' and take a Web Lock on every page load, and its only
// consumer was a placeholder. The private wallet lives in
// lib/aztec/wallet/client.ts. This file is kept empty until it can be deleted.
export {};
