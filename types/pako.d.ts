// Minimal typing for the one pako call used as a fallback where the native
// DecompressionStream is missing (lib/aztec/prover/gunzip.ts).
declare module 'pako' {
  export function ungzip(data: Uint8Array): Uint8Array;
}
