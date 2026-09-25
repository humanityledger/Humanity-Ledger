import { vault } from '@/lib/core/SecureVault';

/**
 * ══════════════════════════════════════════════════════════════════════════════════
 *  Ledger Settings Engine
 *
 *  Architecture:
 *    1. LedgerProtocolSettings — The complete typed settings interface
 *    2. SettingsEnginePXE     — Singleton class with encrypted vault backing
 *    3. pxeEngine             — Singleton instance (import this into React components)
 *
 *  Every field in LedgerProtocolSettings maps to:
 *    a) A UI toggle/selector in LedgerChatSettings.tsx
 *    b) A runtime behaviour gate in LedgerChat.tsx
 *    c) An encrypted blob in the secure vault (key: pxe_settings_<address>)
 *
 *  Data flow:
 *    UI mutate -> pxeEngine.mutate() -> optimistic cache update -> broadcast() ->
 *    React re-render -> async re-encryption -> vault.setItem()
 * ══════════════════════════════════════════════════════════════════════════════════
 */

// ───────────────────────────────────────────────────────────────────────────
//  SECTION 1: COMPLETE SETTINGS INTERFACE
// ───────────────────────────────────────────────────────────────────────────

export interface LedgerProtocolSettings {
  securityNotifs: boolean;
  twoStep: boolean;
  passkeys: boolean;
  lastSeenPublic: boolean;
  profilePublic: boolean;
  aboutPublic: boolean;
  groupsPublic: boolean;
  statusPublic: boolean;
  allowCameraEffects: boolean;
  appLock: boolean;
  silenceUnknown: boolean;
  protectIP: boolean;
  disableLinkPreviews: boolean;
  saveToPhotos: boolean;
  stickerSuggestions: boolean;
  voiceTranscripts: boolean;
  archiveKeep: boolean;
  animations: boolean;
  inAppNotifs: boolean;
  showPreview: boolean;
  msgNotifs: boolean;
  groupNotifs: boolean;
  useLessData: boolean;
  e2eBackup: boolean;
  // ─────────────────────────────────────────────────────
  //  ALERTS & SOUNDS
  // ─────────────────────────────────────────────────────
  /** Enable notifications for direct encrypted channels */
  notifications_private: boolean;
  /** Enable notifications for encrypted group channels */
  notifications_groups: boolean;
  /** Enable notifications for workspace channels */
  notifications_workspaces: boolean;
  /** Show unread badge count on app icon */
  badge_count: boolean;
  /** Play a sound when a message is received */
  notification_sound: boolean;
  /** Sound pack for message/call events */
  sound_pack: 'minimal' | 'arcade' | 'ledger' | 'asmr';
  /** Mechanical keyboard typing sound while composing */
  mechanical_keyboard: boolean;
  /** Haptic intensity: 0=off, 1=light, 2=medium, 3=strong */
  haptics_intensity: 0 | 1 | 2 | 3;

  // ─────────────────────────────────────────────────────
  //  PRIVACY ENGINE
  // ─────────────────────────────────────────────────────
  /** Require a 6-digit passcode to open the application */
  passcode_enabled: boolean;
  /** Who can see your "last seen" timestamp */
  privacy_last_seen: 'nobody' | 'everybody' | 'contacts';
  /** Who can see your profile photo */
  privacy_profile_photo: 'nobody' | 'everybody' | 'contacts';
  /** Who can see your biography */
  privacy_bio: 'nobody' | 'everybody' | 'contacts';
  /** Who can add you to groups */
  privacy_group_invites: 'nobody' | 'everybody' | 'contacts';
  /** Mask your real IP address during P2P WebRTC calls */
  webrtc_ip_masking: boolean;
  /** Show read receipts to the sender */
  show_read_receipts: boolean;
  /** Require WebAuthn biometric to unlock the chat view */
  biometric_lock: boolean;
  /** Number of Tor onion routing hops (1=direct, 3=standard, 5=max) */
  onion_hops: 1 | 3 | 5;

  // ─────────────────────────────────────────────────────
  //  SELF-DESTRUCT PROTOCOL
  // ─────────────────────────────────────────────────────
  /** Auto-delete received+sent messages after this time */
  auto_delete_timer: 'off' | '24 hours' | '1 week' | '1 month';
  /** Burn-on-Read: destroy messages N seconds after recipient opens them */
  burn_on_read: boolean;
  /** Seconds before a read message self-destructs */
  burn_on_read_seconds: 3 | 10 | 30 | 60;

  // ─────────────────────────────────────────────────────
  //  DATA & STORAGE
  // ─────────────────────────────────────────────────────
  /** Automatically download media when connected to WiFi */
  auto_download_wifi: boolean;
  /** Automatically download media when on cellular data */
  auto_download_cellular: boolean;
  /** Auto-save incoming photos to device gallery */
  save_photos: boolean;
  /** Reduce WebRTC video resolution to save bandwidth */
  data_saver_calls: boolean;
  /** Allow anonymous telemetry to help improve the network */
  allow_analytics: boolean;

  // ─────────────────────────────────────────────────────
  //  AESTHETICS
  // ─────────────────────────────────────────────────────
  /** Visual theme for the entire application */
  theme: 'brutalist' | 'monochrome' | 'neon_void' | 'terminal';
  /** UI density */
  ui_density: 'relaxed' | 'compact' | 'dense';
  /** Text size scale (1–7) */
  text_size: number;
  /** Message bubble visual style */
  bubble_style: 'default' | 'brutalist' | 'glass' | 'minimal';
  /** Primary accent color (hex) */
  accent_color: string;
  /** Chat background type */
  chat_background: 'default' | 'amoled' | 'holographic' | 'matrix' | 'gradient';
  /** Enable glowing NFT border on avatars */
  nft_border_enabled: boolean;
  /** Overlay recipient address as watermark to deter leaks */
  watermark_enabled: boolean;

  // ─────────────────────────────────────────────────────
  //  LANGUAGE & LOCALE
  // ─────────────────────────────────────────────────────
  /** UI language code */
  language: 'en' | 'es' | 'fr' | 'de' | 'jp' | 'cn';
  /** Time display format */
  time_format: '12h' | '24h';
  /** Date display format */
  date_format: 'DD/MM/YYYY' | 'MM/DD/YYYY';

  // ─────────────────────────────────────────────────────
  //  IDENTITY (MY PROFILE)
  // ─────────────────────────────────────────────────────
  /** User's display name */
  displayName: string;
  /** Username handle (without @) */
  username: string;
  /** Biography / status text */
  bio: string;
  /** Avatar stored as base64 data URL */
  avatar_url: string;

  // ─────────────────────────────────────────────────────
  //  AI GHOST MODE
  // ─────────────────────────────────────────────────────
  /** Enable AI tone translator before sending hostile messages */
  tone_translator: boolean;
  /** Automatically reply when away */
  ghost_auto_reply: boolean;
  /** Text the Ghost will reply with when away */
  ghost_auto_reply_text: string;

  // ─────────────────────────────────────────────────────
  //  DEFI & LEDGER INTELLIGENCE TOOLS
  // ─────────────────────────────────────────────────────
  /** Recognize $TICKER cashtags and render as price widgets */
  ticker_widgets: boolean;
  /** Scan 0x... addresses for contract verification/honeypot risk */
  contract_scanner: boolean;
  /** Smart macros (e.g. /add sends wallet address + QR) */
  smart_macros: boolean;
  /** Show on-chain attestation score badge on messages */
  show_attestation_badge: boolean;

  // ─────────────────────────────────────────────────────
  //  NETWORK & PROTOCOL
  // ─────────────────────────────────────────────────────
  /** Gas fee preset for on-chain transactions */
  gas_preset: 'ECONOMY' | 'STANDARD' | 'FAST' | 'INSTANT';
  /** MEV protection for transactions */
  mev_protection: boolean;
  /** Custom RPC URL (empty = default) */
  custom_rpc_url: string;

  // ─────────────────────────────────────────────────────
  //  WORKSPACES (SAVED CHANNEL FOLDERS)
  // ─────────────────────────────────────────────────────
  /** JSON-serialized list of workspace folder names */
  workspaces_json: string;

  // ─────────────────────────────────────────────────────
  //  METADATA
  // ─────────────────────────────────────────────────────
  /** Epoch ms of last full settings sync to Aztec network */
  last_synced_at: number;
  /** Schema version for migration compatibility */
  schema_version: number;
}

// ───────────────────────────────────────────────────────────────────────────
//  SECTION 2: DEFAULT SETTINGS MATRIX
// ───────────────────────────────────────────────────────────────────────────

export const DEFAULT_PXE_SETTINGS: LedgerProtocolSettings = {
  securityNotifs: true,
  twoStep: false,
  passkeys: false,
  lastSeenPublic: true,
  profilePublic: true,
  aboutPublic: true,
  groupsPublic: true,
  statusPublic: true,
  allowCameraEffects: true,
  appLock: false,
  silenceUnknown: false,
  protectIP: true,
  disableLinkPreviews: false,
  saveToPhotos: false,
  stickerSuggestions: true,
  voiceTranscripts: false,
  archiveKeep: false,
  animations: true,
  inAppNotifs: true,
  showPreview: true,
  msgNotifs: true,
  groupNotifs: true,
  useLessData: false,
  e2eBackup: false,
  // Alerts & Sounds
  notifications_private: true,
  notifications_groups: true,
  notifications_workspaces: false,
  badge_count: true,
  notification_sound: true,
  sound_pack: 'minimal',
  mechanical_keyboard: false,
  haptics_intensity: 1,

  // Privacy Engine
  passcode_enabled: false,
  privacy_last_seen: 'nobody',
  privacy_profile_photo: 'contacts',
  privacy_bio: 'everybody',
  privacy_group_invites: 'contacts',
  webrtc_ip_masking: true,
  show_read_receipts: true,
  biometric_lock: false,
  onion_hops: 3,

  // Self-Destruct Protocol
  auto_delete_timer: 'off',
  burn_on_read: false,
  burn_on_read_seconds: 10,

  // Data & Storage
  auto_download_wifi: true,
  auto_download_cellular: false,
  save_photos: true,
  data_saver_calls: false,
  allow_analytics: false,

  // Aesthetics
  theme: 'brutalist',
  ui_density: 'compact',
  text_size: 3,
  bubble_style: 'default',
  accent_color: '#1c7aff',
  chat_background: 'default',
  nft_border_enabled: false,
  watermark_enabled: false,

  // Language & Locale
  language: 'en',
  time_format: '24h',
  date_format: 'DD/MM/YYYY',

  // Identity
  displayName: '',
  username: '',
  bio: 'Building the Sovereign Network. Cryptography, Privacy, and Decentralization.',
  avatar_url: '',

  // AI Ghost Mode
  tone_translator: false,
  ghost_auto_reply: false,
  ghost_auto_reply_text: 'I am currently away. I will reply as soon as possible.',

  // DeFi Tools
  ticker_widgets: true,
  contract_scanner: true,
  smart_macros: true,
  show_attestation_badge: true,

  // Network
  gas_preset: 'STANDARD',
  mev_protection: false,
  custom_rpc_url: '',

  // Workspaces
  workspaces_json: JSON.stringify(['Main Operations']),

  // Metadata
  last_synced_at: 0,
  schema_version: 3,
};

// ───────────────────────────────────────────────────────────────────────────
//  SECTION 3: REACTIVE SUBSCRIPTION TYPE
// ───────────────────────────────────────────────────────────────────────────

type PXESubscriber = (settings: LedgerProtocolSettings) => void;

// ───────────────────────────────────────────────────────────────────────────
//  SECTION 4: SETTINGS ENGINE CLASS
// ───────────────────────────────────────────────────────────────────────────

class SettingsEnginePXE {
  /** Per-address in-memory cache for instant synchronous access */
  private cache: Record<string, LedgerProtocolSettings> = {};
  /** Per-address React subscriber callbacks for reactive UI updates */
  private subscribers: Record<string, Set<PXESubscriber>> = {};
  /** Throttle async vault writes to prevent encryption storms */
  private writeDebounce: Record<string, ReturnType<typeof setTimeout>> = {};
  /** Track schema version to perform automatic field migrations */
  private readonly CURRENT_SCHEMA = 3;

  // ─────────────────────────────────────────────────────────────────────
  //  PUBLIC: mountNode — async boot for a user wallet address
  // ─────────────────────────────────────────────────────────────────────

  async mountNode(address: string): Promise<LedgerProtocolSettings> {
    if (this.cache[address]) return this.cache[address];

    try {
      const rawData = await vault.getItem(`pxe_settings_${address}`);

      if (!rawData) {
        // First run — initialize defaults and persist
        const fresh = { ...DEFAULT_PXE_SETTINGS, last_synced_at: Date.now() };
        this.cache[address] = fresh;
        await this.syncToPXE(address, fresh);
        this.broadcast(address, fresh);
        return fresh;
      }

      // Vault already decrypts it for us, so rawData is the JSON string
      let parsed: LedgerProtocolSettings;
      try {
        parsed = JSON.parse(rawData) as LedgerProtocolSettings;
      } catch {
        console.warn('[PXE ENGINE] Parse failed, resetting to defaults');
        const fresh = { ...DEFAULT_PXE_SETTINGS, last_synced_at: Date.now() };
        this.cache[address] = fresh;
        await this.syncToPXE(address, fresh);
        this.broadcast(address, fresh);
        return fresh;
      }

      // Schema migration: merge any new fields from DEFAULT_PXE_SETTINGS
      const migrated = this.migrateSchema(parsed);
      this.cache[address] = migrated;
      this.broadcast(address, migrated);

      return migrated;
    } catch (error) {
      console.error('[PXE ENGINE] Fatal mount error:', error);
      const fallback = { ...DEFAULT_PXE_SETTINGS };
      this.cache[address] = fallback;
      return fallback;
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  //  PUBLIC: mutate — update a single setting field
  // ─────────────────────────────────────────────────────────────────────

  async mutate<K extends keyof LedgerProtocolSettings>(
    address: string,
    key: K,
    value: LedgerProtocolSettings[K]
  ): Promise<void> {
    if (!this.cache[address]) {
      await this.mountNode(address);
    }

    // 1. Optimistic in-memory update (zero latency for UI)
    this.cache[address] = { ...this.cache[address], [key]: value };
    this.broadcast(address, this.cache[address]);

    // 2. DOM side-effects for critical settings
    this.applyDOMSideEffects(key, value);

    // 3. Debounced vault write (50ms window coalesces rapid mutations)
    clearTimeout(this.writeDebounce[address]);
    this.writeDebounce[address] = setTimeout(() => {
      this.syncToPXE(address, this.cache[address]);
    }, 50);
  }

  // ─────────────────────────────────────────────────────────────────────
  //  PUBLIC: mutateBatch — update multiple settings in one vault write
  // ─────────────────────────────────────────────────────────────────────

  async mutateBatch(
    address: string,
    mutations: Partial<LedgerProtocolSettings>
  ): Promise<void> {
    if (!this.cache[address]) {
      await this.mountNode(address);
    }

    this.cache[address] = { ...this.cache[address], ...mutations };
    this.broadcast(address, this.cache[address]);

    for (const [key, value] of Object.entries(mutations)) {
      this.applyDOMSideEffects(key as keyof LedgerProtocolSettings, value);
    }

    await this.syncToPXE(address, this.cache[address]);
  }

  // ─────────────────────────────────────────────────────────────────────
  //  PUBLIC: subscribe — wire a React component to live PXE updates
  // ─────────────────────────────────────────────────────────────────────

  subscribe(address: string, callback: PXESubscriber): () => void {
    if (!this.subscribers[address]) {
      this.subscribers[address] = new Set();
    }
    this.subscribers[address].add(callback);

    // Immediately fire with current state
    if (this.cache[address]) {
      callback(this.cache[address]);
    } else {
      this.mountNode(address).then(s => callback(s));
    }

    return () => {
      this.subscribers[address]?.delete(callback);
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  //  PUBLIC: get — synchronous read (call mountNode first in useEffect)
  // ─────────────────────────────────────────────────────────────────────

  get(address: string): LedgerProtocolSettings {
    return this.cache[address] ?? { ...DEFAULT_PXE_SETTINGS };
  }

  // ─────────────────────────────────────────────────────────────────────
  //  PUBLIC: purgeNode — wipe all settings for an address (nuclear option)
  // ─────────────────────────────────────────────────────────────────────

  async purgeNode(address: string): Promise<void> {
    delete this.cache[address];
    clearTimeout(this.writeDebounce[address]);
    await vault.setItem(`pxe_settings_${address}`, '');
    const fresh = { ...DEFAULT_PXE_SETTINGS, last_synced_at: Date.now() };
    this.cache[address] = fresh;
    this.broadcast(address, fresh);
  }

  // ─────────────────────────────────────────────────────────────────────
  //  PUBLIC: exportSettings — plain JSON dump for backup purposes
  // ─────────────────────────────────────────────────────────────────────

  exportSettings(address: string): string {
    const s = this.cache[address] ?? DEFAULT_PXE_SETTINGS;
    return JSON.stringify(s, null, 2);
  }

  // ─────────────────────────────────────────────────────────────────────
  //  PRIVATE: syncToPXE — AES-256-GCM encrypt + vault write
  // ─────────────────────────────────────────────────────────────────────

  private async syncToPXE(address: string, settings: LedgerProtocolSettings): Promise<void> {
    try {
      const updated = { ...settings, last_synced_at: Date.now() };
      const payload = JSON.stringify(updated);
      await vault.setItem(`pxe_settings_${address}`, payload);
    } catch (error) {
      console.error('[PXE ENGINE] Vault sync error:', error);
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  //  PRIVATE: broadcast — notify all React subscribers
  // ─────────────────────────────────────────────────────────────────────

  private broadcast(address: string, settings: LedgerProtocolSettings): void {
    this.subscribers[address]?.forEach(cb => {
      try { cb(settings); } catch (e) { console.error('[PXE ENGINE] Subscriber error:', e); }
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  //  PRIVATE: applyDOMSideEffects — instant DOM mutations for critical keys
  // ─────────────────────────────────────────────────────────────────────

  private applyDOMSideEffects(key: keyof LedgerProtocolSettings, value: any): void {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;

    switch (key) {
      case 'theme':
        html.setAttribute('data-ledger-theme', value);
        html.setAttribute('data-theme', value === 'neon_void' ? 'dark' : 'light');
        break;
      case 'accent_color':
        html.style.setProperty('--ledger-accent', value);
        break;
      case 'text_size':
        html.style.setProperty('--ledger-text-size', `${value * 2 + 10}px`);
        break;
      case 'ui_density':
        html.classList.remove('ui-relaxed', 'ui-compact', 'ui-dense');
        html.classList.add(`ui-${value}`);
        break;
      case 'watermark_enabled':
        if (value) html.classList.add('watermark-active');
        else html.classList.remove('watermark-active');
        break;
      case 'bubble_style':
        html.setAttribute('data-bubble-style', value);
        break;
      case 'chat_background':
        html.setAttribute('data-chat-bg', value);
        break;
      case 'biometric_lock':
        if (value) html.classList.add('biometric-required');
        else html.classList.remove('biometric-required');
        break;
      case 'show_read_receipts':
        if (!value) html.classList.add('hide-receipts');
        else html.classList.remove('hide-receipts');
        break;
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  //  PRIVATE: migrateSchema — forward-compatible schema upgrades
  // ─────────────────────────────────────────────────────────────────────

  private migrateSchema(parsed: Partial<LedgerProtocolSettings>): LedgerProtocolSettings {
    // Merge with defaults so any new fields added in schema v3 are populated
    const migrated: LedgerProtocolSettings = { ...DEFAULT_PXE_SETTINGS, ...parsed };

    // Schema v1 → v2: rename privacy_last_seen legacy values
    if ((migrated as any).privacy_last_seen === 'all') {
      migrated.privacy_last_seen = 'everybody';
    }

    // Schema v2 → v3: populate new AI Ghost Mode defaults if missing
    if (!migrated.ghost_auto_reply_text) {
      migrated.ghost_auto_reply_text = DEFAULT_PXE_SETTINGS.ghost_auto_reply_text;
    }

    // Stamp current schema version
    migrated.schema_version = this.CURRENT_SCHEMA;

    return migrated;
  }
}

// ───────────────────────────────────────────────────────────────────────────
//  SECTION 5: SINGLETON EXPORT
// ───────────────────────────────────────────────────────────────────────────

/**
 * The global PXE Settings Engine singleton.
 * Import this anywhere in the application for zero-latency settings access.
 *
 * Usage:
 *   const s = pxeEngine.get(address);
 *   await pxeEngine.mutate(address, 'theme', 'neon_void');
 *   const unsub = pxeEngine.subscribe(address, callback);
 */
export const pxeEngine = new SettingsEnginePXE();



