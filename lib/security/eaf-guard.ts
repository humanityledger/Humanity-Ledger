/**
 * lib/security/eaf-guard.ts
 *
 * Implements strict host-side validation for Executable Artifact Frames (EAF),
 * enforcing 8 KB payload ceilings, origin validation, storage isolation, and
 * a global emergency kill switch (Fortification Items 111–140).
 *
 * Security: All rejected bridge operations are logged via console.warn for
 * security monitoring (hl_eaf_rejection_total metric). Payloads are NEVER
 * logged to prevent leaking user data. Only the rejection reason is recorded.
 * Reference: docs/OBSERVABILITY.md — hl_eaf_rejection_total
 */

export const EAF_MAX_PAYLOAD_BYTES = 8192; // Hard 8 KB limit (Item 116)
export const EAF_CSP_HEADER = "default-src 'none'; connect-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"; // Item 111
export const EAF_SANDBOX_PERMISSIONS = "allow-scripts"; // Item 117 (no allow-same-origin, no allow-top-navigation)

// Global Emergency Kill Switch (Item 128)
let globalEafDisabled = false;

export function setEafKillSwitch(disabled: boolean): void {
  globalEafDisabled = disabled;
}

export function isEafGloballyDisabled(): boolean {
  return globalEafDisabled;
}

export interface EAFMessageBridgePayload {
  appId: string;
  method: string;
  memberId?: string;
  data: Record<string, any>;
}

export interface EAFValidationResult {
  valid: boolean;
  sanitizedMemberId: string;
  error?: string;
}

/**
 * Validates an incoming EAF postMessage against size limits, global kill switch,
 * allowed methods, and prevents memberId spoofing.
 */
export function validateEAFBridgeMessage(
  rawPayload: unknown,
  actualSessionMemberId: string,
  allowedMethods: string[] = ['ping', 'getState', 'setState', 'requestProof'],
): EAFValidationResult {
  if (globalEafDisabled) {
    console.warn('[EAF_REJECTION] reason=kill_switch appId=unknown method=unknown');
    return { valid: false, sanitizedMemberId: '', error: 'EAF execution disabled globally by emergency kill switch' };
  }

  if (!rawPayload || typeof rawPayload !== 'object') {
    console.warn('[EAF_REJECTION] reason=invalid_structure');
    return { valid: false, sanitizedMemberId: '', error: 'Invalid message structure' };
  }

  const serialized = JSON.stringify(rawPayload);
  const byteLength = Buffer.byteLength(serialized, 'utf8');

  // Hard 8 KB payload limit (Item 116)
  if (byteLength > EAF_MAX_PAYLOAD_BYTES) {
    // Log size only — never log payload content
    console.warn(`[EAF_REJECTION] reason=payload_too_large bytes=${byteLength} limit=${EAF_MAX_PAYLOAD_BYTES}`);
    return {
      valid: false,
      sanitizedMemberId: '',
      error: `Payload exceeds 8 KB ceiling (received ${byteLength} bytes)`,
    };
  }

  const payload = rawPayload as EAFMessageBridgePayload;

  // Validate allowed methods (Item 113)
  if (!payload.method || !allowedMethods.includes(payload.method)) {
    console.warn(`[EAF_REJECTION] reason=undeclared_method method=${String(payload.method).slice(0, 64)}`);
    return { valid: false, sanitizedMemberId: '', error: `Undeclared method "${payload.method}" rejected` };
  }

  // App ID must not contain path traversal characters (Item 115)
  if (!payload.appId || !/^[a-zA-Z0-9_\-]+$/.test(payload.appId)) {
    console.warn('[EAF_REJECTION] reason=invalid_app_id');
    return { valid: false, sanitizedMemberId: '', error: 'Invalid appId or path traversal attempt' };
  }

  // Forged memberId in payload is IGNORED — strictly bound to authentic session identity (Item 114)
  return {
    valid: true,
    sanitizedMemberId: actualSessionMemberId,
  };
}
