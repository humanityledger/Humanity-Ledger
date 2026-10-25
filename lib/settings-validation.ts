// @ts-nocheck
import { z } from 'zod';

export const ContactSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  memo: z.string().max(500).optional(),
});
export type ContactType = z.infer<typeof ContactSchema>;

export const NotificationsConfigSchema = z.object({
  governance: z.boolean(),
  transactional: z.boolean(),
  security: z.boolean(),
});
export type NotificationsConfig = z.infer<typeof NotificationsConfigSchema>;

export const AnalyticsConfigSchema = z.object({
  tacticalThreshold: z.coerce.number().min(0).max(10000000000).default(500000000),
  signalSensitivity: z.coerce.number().min(0).max(1).default(0.8),
  agentAutonomy: z.boolean().default(false),
  alphaAlerts: z.boolean().default(true),
  
  developerMode: z.boolean().optional(),
  showHexData: z.boolean().optional(),
});
export type AnalyticsConfig = z.infer<typeof AnalyticsConfigSchema>;

export const ExecutionConfigSchema = z.object({
  gaslessMode: z.boolean().default(true),
  bundlerRef: z.string().default('pimlico-mainnet'),
  sessionKeys: z.boolean().default(false),
  priorityFee: z.enum(['low', 'standard', 'dynamic']).default('dynamic'),
  
  rpcProvider: z.string().optional(),
  wssEnabled: z.boolean().optional(),
  autoSwitchNetwork: z.boolean().optional(),
  
  gasPreset: z.string().optional(),
  slippage: z.number().optional(),
  deadlineMinutes: z.number().optional(),
  mevProtection: z.boolean().optional(),
  gasLimitBuffer: z.string().optional(),
  
  verifyBeforeSend: z.boolean().optional(),
  expertMode: z.boolean().optional(),
  customNonce: z.boolean().optional(),
  wasmProving: z.boolean().optional(),
});
export type ExecutionConfig = z.infer<typeof ExecutionConfigSchema>;

export const UiConfigSchema = z.object({
  density: z.enum(['compact', 'standard', 'spacious']).default('standard'),
  animations: z.boolean().default(true),
  colorProfile: z.enum(['arctic', 'zenith', 'obsidian']).default('arctic'),
  glassIntensity: z.coerce.number().min(0).max(1).default(0.6),
  
  showPortfolioChart: z.boolean().optional(),
  showPnl: z.boolean().optional(),
  showGasTracker: z.boolean().optional(),
  hideZeroBalances: z.boolean().optional(),
  showNFTs: z.boolean().optional(),
  showTokenLogos: z.boolean().optional(),
  
  biometricEnabled: z.boolean().optional(),
  phishingDetection: z.boolean().optional(),
  useBlockscout: z.boolean().optional(),
  
  notifOutgoing: z.boolean().optional(),
  notifBridge: z.boolean().optional(),
  notifPriceAlerts: z.boolean().optional(),
  notifDeFiYield: z.boolean().optional(),
  notifSecurityAlerts: z.boolean().optional(),
  
  tokenSort: z.string().optional(),
  groupByNetwork: z.boolean().optional(),
  hideSpamTokens: z.boolean().optional(),
  showDeFiPositions: z.boolean().optional(),
  showStaking: z.boolean().optional(),
  portfolioRefresh: z.string().optional(),
});
export type UiConfig = z.infer<typeof UiConfigSchema>;

export const UserSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'auto']).or(z.string()).default('auto'),
  language: z.enum(['en', 'es', 'fr', 'pt']).or(z.string()).default('en'),
  currency: z.enum(['USD', 'EUR', 'GBP', 'JPY', 'MXN']).or(z.string()).default('USD'),
  searchEngine: z.enum(['Google', 'DuckDuckGo', 'Brave']).or(z.string()).default('Google'),
  tier: z.enum(['basic', 'pro']).default('pro'),
  showProfile: z.boolean().default(true),
  hideBalances: z.boolean().default(false),
  privacyMode: z.boolean().default(true),
  strictMode: z.boolean().default(false),
  humanMetrics: z.boolean().default(false),
  walletStealthMode: z.boolean().default(false),
  requirePasswordForSigning: z.boolean().default(true),
  autoLockDuration: z.coerce.number().default(15),
  testNetsEnabled: z.boolean().default(false),
  ipfsGateway: z.string().default('https://ipfs.io/ipfs/'),
  customRPC: z.string().default(''),
  stateLogsEnabled: z.boolean().default(false),
  contacts: z.array(ContactSchema).default([{ id: '1', name: 'Main Vault', address: '0x7883a992648fbda8ff0bbdbdb10eb230f8d07b4a' }]),
  emailNotifications: z.boolean().default(true),
  pushNotifications: z.boolean().default(true),
  transactionAlerts: z.boolean().default(true),
  marketingEmails: z.boolean().default(false),
  backupFrequency: z.enum(['daily', 'weekly', 'monthly']).or(z.string()).default('weekly'),
  defaultSlippage: z.coerce.number().default(0.5),
  defaultGasPrice: z.string().default('medium'),
  analyticsConfig: AnalyticsConfigSchema.default(AnalyticsConfigSchema.parse({})),
  executionConfig: ExecutionConfigSchema.default(ExecutionConfigSchema.parse({})),
  uiConfig: UiConfigSchema.default(UiConfigSchema.parse({})),
}).passthrough();

export type UserSettings = z.infer<typeof UserSettingsSchema>;

export function getDefaultUserSettings(): UserSettings {
  return UserSettingsSchema.parse({});
}

// --- Validation helpers used by SettingsSyncService --------------------------

export type ValidationResult<T> =
  | { success: true; data: T; errors?: undefined; repaired?: string[] }
  | { success: false; data?: undefined; errors: string[] };

type Issue = { path: PropertyKey[]; message: string };

/** zod 4 exposes `issues`; zod 3 also had `errors`. Read whichever exists. */
function issuesOf(error: unknown): Issue[] {
  const e = error as { issues?: Issue[]; errors?: Issue[] } | undefined;
  return e?.issues ?? e?.errors ?? [];
}

function describe(issues: Issue[]): string[] {
  return issues.map((i) => `${(i.path ?? []).map(String).join('.') || '(root)'}: ${i.message}`);
}

const NESTED = new Set(['analyticsConfig', 'executionConfig', 'uiConfig']);

/**
 * Removes only the values that failed validation, so one stale or corrupt
 * field (from an older version of the app, for example) falls back to its
 * default instead of discarding every saved preference.
 */
function dropInvalid(raw: Record<string, unknown>, issues: Issue[]): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw };
  const badContacts = new Set<number>();
  for (const { path } of issues) {
    const [top, second] = path ?? [];
    if (typeof top !== 'string') continue;
    if (NESTED.has(top) && typeof second === 'string' && out[top] && typeof out[top] === 'object') {
      const nested = { ...(out[top] as Record<string, unknown>) };
      delete nested[second];
      out[top] = nested;
    } else if (top === 'contacts' && typeof second === 'number' && Array.isArray(out.contacts)) {
      badContacts.add(second);
    } else {
      delete out[top];
    }
  }
  if (badContacts.size && Array.isArray(out.contacts)) {
    out.contacts = (out.contacts as unknown[]).filter((_, i) => !badContacts.has(i));
  }
  return out;
}

/**
 * Validates a full UserSettings object against the schema.
 * Invalid fields are reset to their defaults; the result only fails when the
 * input is not an object at all. Never throws.
 */
export function validateUserSettings(raw: unknown): ValidationResult<UserSettings> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { success: false, errors: ['(root): settings must be an object'] };
  }
  const first = UserSettingsSchema.safeParse(raw);
  if (first.success) return { success: true, data: first.data };

  const issues = issuesOf(first.error);
  const second = UserSettingsSchema.safeParse(dropInvalid(raw as Record<string, unknown>, issues));
  if (second.success) return { success: true, data: second.data, repaired: describe(issues) };

  return { success: false, errors: describe(issuesOf(second.error)) };
}

/**
 * Validates a partial settings update (PATCH payload).
 * Any subset of UserSettings fields is accepted.
 */
export type PartialUserSettings = Partial<UserSettings>;

export function validatePartialSettings(raw: unknown): ValidationResult<PartialUserSettings> {
  const PartialSchema = UserSettingsSchema.partial();
  const result = PartialSchema.safeParse(raw);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: describe(issuesOf(result.error)),
  };
}