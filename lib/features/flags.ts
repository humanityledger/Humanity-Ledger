// lib/features/flags.ts
export const FEATURE_FLAGS = {
  TERMINAL_ENABLED: process.env.NEXT_PUBLIC_ENABLE_TERMINAL === 'true',
  OMNI_MATRIX_ENABLED: process.env.NEXT_PUBLIC_ENABLE_OMNI === 'true',
  FORGE_ENABLED: process.env.NEXT_PUBLIC_ENABLE_FORGE === 'true',
  ACADEMIA_ENABLED: process.env.NEXT_PUBLIC_ENABLE_ACADEMIA === 'true',
  ZK_ENABLED: process.env.NEXT_PUBLIC_ZK_MODE === 'testnet',
} as const;

export function isFeatureEnabled(flag: keyof typeof FEATURE_FLAGS): boolean {
  return !!FEATURE_FLAGS[flag];
}
