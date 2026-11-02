/**
 * Supply Chain Attack Hardening Tests
 * Covers adversarial supply chain scenarios: dependency substitution,
 * prototype pollution, eval injection, dynamic require bypass,
 * lockfile downgrade, SSRF, typosquatting, SRI bypass,
 * malicious postinstall, and circular dependency exfiltration.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';

// ---------------------------------------------------------------------------
// SC-01: Dependency Substitution Guard
// ---------------------------------------------------------------------------
interface ExportRequirement { name: string; type: string }
class DependencySubstitutionGuard {
  private schemas = new Map<string, ExportRequirement[]>();
  registerSchema(pkg: string, reqs: ExportRequirement[]) { this.schemas.set(pkg, reqs); }
  verifyModule(pkg: string, mod: unknown): { valid: boolean; error?: string } {
    const reqs = this.schemas.get(pkg);
    if (!reqs) return { valid: true };
    if (!mod || typeof mod !== 'object') return { valid: false, error: `exports is not an object for '${pkg}'` };
    for (const req of reqs) {
      if (!(req.name in (mod as object))) return { valid: false, error: `Dependency substitution detected for '${pkg}': missing expected export '${req.name}'` };
      const t = typeof (mod as Record<string, unknown>)[req.name];
      if (t !== req.type) return { valid: false, error: `Dependency substitution detected for '${pkg}': export '${req.name}' expected type '${req.type}', received '${t}'` };
    }
    return { valid: true };
  }
}

// ---------------------------------------------------------------------------
// SC-02: Prototype Pollution Guard
// ---------------------------------------------------------------------------
class PrototypePollutionGuard {
  private static DANGEROUS = new Set(['__proto__', 'constructor', 'prototype']);
  static safeDeepMerge<T extends Record<string, unknown>>(target: T, source: Record<string, unknown>): T {
    for (const key of Object.keys(source)) {
      if (this.DANGEROUS.has(key)) throw new Error(`Prototype pollution attempt detected: disallowed key '${key}'`);
      const v = source[key];
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        if (!target[key] || typeof target[key] !== 'object') (target as Record<string, unknown>)[key] = Object.create(null);
        this.safeDeepMerge(target[key] as Record<string, unknown>, v as Record<string, unknown>);
      } else {
        (target as Record<string, unknown>)[key] = v;
      }
    }
    return target;
  }
  static safeParseJSON<T = unknown>(json: string): T {
    return JSON.parse(json, (key, value) => this.DANGEROUS.has(key) ? undefined : value);
  }
}

// ---------------------------------------------------------------------------
// SC-03: Eval Injection Guard
// ---------------------------------------------------------------------------
function sanitizeContentPayload(content: string): { isSafe: boolean; violations: string[] } {
  const violations: string[] = [];
  const patterns = [
    { regex: /\beval\s*\(/i, name: 'Direct eval invocation' },
    { regex: /\(0\s*,\s*eval\)\s*\(/i, name: 'Indirect eval invocation' },
    { regex: /\b(?:window|global|globalThis)\[['"` + '`' + `]eval['"` + '`' + `]\]/i, name: 'Computed eval accessor' },
    { regex: /\beval\.(?:call|apply|bind)\s*\(/i, name: 'Reflective eval invocation' },
    { regex: /new\s+Function\s*\(/i, name: 'Function constructor code execution' },
  ];
  for (const { regex, name } of patterns) if (regex.test(content)) violations.push(name);
  return { isSafe: violations.length === 0, violations };
}

// ---------------------------------------------------------------------------
// SC-04: Dynamic Require Bypass Guard
// ---------------------------------------------------------------------------
class DynamicRequireGuard {
  private static PATTERNS = [
    /(?:new\s+)?Function\s*\([^)]*['"`](?:return\s+)?(?:this\.)?require['"`][^)]*\)/i,
    /(?:new\s+)?Function\s*\([^)]*['"`]return\s+process['"`][^)]*\)/i,
    /\[['"`]require['"`]\]\s*\(/i,
    /\bprocess\s*\.\s*mainModule\s*\.\s*require\b/i,
    /\bmodule\s*\[\s*['"`]require['"`]\s*\]/i,
  ];
  static inspectCode(code: string): { allowed: boolean; reason?: string } {
    for (const p of this.PATTERNS) if (p.test(code)) return { allowed: false, reason: `Dynamic require bypass pattern detected: ${p.source}` };
    return { allowed: true };
  }
  static evaluateHardened(code: string): unknown {
    const check = this.inspectCode(code);
    if (!check.allowed) throw new Error(`Security Violation: ${check.reason}`);
    return 'safe_execution';
  }
}

// ---------------------------------------------------------------------------
// SC-05: Lockfile Downgrade Guard
// ---------------------------------------------------------------------------
class LockfileVersionGuard {
  private pinned = new Map<string, string>([['@xmtp/browser-sdk', '5.2.0']]);
  verifyInstalledVersion(pkg: string, version: string) {
    const required = this.pinned.get(pkg);
    if (!required) return;
    if (/[\^~*><= ]/.test(version)) throw new Error(`Lockfile policy violation: '${pkg}' must be strictly pinned, found floating range '${version}'`);
    if (version !== required) throw new Error(`Lockfile downgrade attack detected for '${pkg}': expected pinned version '${required}', but found '${version}'`);
  }
}

// ---------------------------------------------------------------------------
// SC-06: SSRF via Package Redirect Guard
// ---------------------------------------------------------------------------
class PackageNetworkGuard {
  private allowed: Set<string>;
  private BLOCKED_PATTERNS = [/^127\./, /^10\./, /^192\.168\./, /^169\.254\./, /^::1$/, /^localhost$/i];
  constructor(allowedOrigins: string[]) { this.allowed = new Set(allowedOrigins); }
  validateRequest(url: string): { allowed: boolean; violation?: string } {
    let parsed: URL;
    try { parsed = new URL(url); } catch { return { allowed: false, violation: 'Invalid URL' }; }
    if (parsed.protocol !== 'https:') return { allowed: false, violation: `Non-HTTPS protocol: ${parsed.protocol}` };
    for (const p of this.BLOCKED_PATTERNS) if (p.test(parsed.hostname)) return { allowed: false, violation: `Blocked host: ${parsed.hostname}` };
    if (!this.allowed.has(parsed.hostname)) return { allowed: false, violation: `Host not in allowlist: ${parsed.hostname}` };
    return { allowed: true };
  }
}

// ---------------------------------------------------------------------------
// SC-07: Typosquatting Guard
// ---------------------------------------------------------------------------
class PackageNameGuard {
  private static BLOCKLIST = new Set(['xmtp-secure', 'aztec-sdk', 'noir-prover', 'ethers-security', 'noire-lang', 'aztec-js', 'xmpt']);
  static inspect(pkg: string): { suspicious: boolean; reason?: string } {
    if (this.BLOCKLIST.has(pkg)) return { suspicious: true, reason: `Package '${pkg}' is on the threat blocklist` };
    // Unscoped imitation of known scoped packages
    if (!pkg.startsWith('@') && (pkg.includes('aztec') || pkg.includes('noir') || pkg.includes('xmtp')))
      return { suspicious: true, reason: `Unscoped package '${pkg}' may be a typosquat of a legitimate scoped package` };
    return { suspicious: false };
  }
}

// ---------------------------------------------------------------------------
// SC-08: CSP SRI Validator
// ---------------------------------------------------------------------------
class CspSriValidator {
  validateScriptElement(el: { src: string; integrity?: string; crossorigin?: string }): { valid: boolean; reason?: string } {
    if (!el.integrity) return { valid: false, reason: 'Script element missing integrity attribute (SRI required for remote scripts)' };
    if (!el.integrity.match(/^sha(256|384|512)-/)) return { valid: false, reason: `Weak or invalid SRI digest algorithm: ${el.integrity.split('-')[0]}` };
    return { valid: true };
  }
}

// ---------------------------------------------------------------------------
// SC-09: Postinstall Filesystem Guard
// ---------------------------------------------------------------------------
class PostinstallFileSystemGuard {
  constructor(private projectRoot: string) {}
  checkWriteTarget(target: string): { allowed: boolean; violation?: string } {
    const resolved = path.resolve(target);
    const root = path.resolve(this.projectRoot);
    if (!resolved.startsWith(root + path.sep) && resolved !== root) {
      return { allowed: false, violation: `Write target '${resolved}' resolves outside project directory '${root}'` };
    }
    return { allowed: true };
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Supply Chain Attack Hardening', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  // SC-01: Dependency substitution
  it('SC-01: Dependency substitution — detects when package resolution returns unexpected export signature', () => {
    const guard = new DependencySubstitutionGuard();
    guard.registerSchema('@aztec/bb.js', [
      { name: 'verifyProof', type: 'function' },
      { name: 'BarretenbergBackend', type: 'function' },
    ]);
    // Missing verifyProof
    const r1 = guard.verifyModule('@aztec/bb.js', { BarretenbergBackend: () => {} });
    expect(r1.valid).toBe(false);
    expect(r1.error).toContain('missing expected export');

    // Wrong type
    const r2 = guard.verifyModule('@aztec/bb.js', { verifyProof: 'not-a-function', BarretenbergBackend: () => {} });
    expect(r2.valid).toBe(false);
    expect(r2.error).toContain("expected type 'function'");

    // Null module
    const r3 = guard.verifyModule('@aztec/bb.js', null);
    expect(r3.valid).toBe(false);
    expect(r3.error).toContain('exports is not an object');

    // Valid
    const r4 = guard.verifyModule('@aztec/bb.js', { verifyProof: () => true, BarretenbergBackend: class {} });
    expect(r4.valid).toBe(true);
  });

  // SC-02: Prototype pollution
  it('SC-02: Prototype pollution via package — prevents Object.prototype contamination so ({}).injected remains undefined', () => {
    expect(({} as any).injected).toBeUndefined();
    expect(Object.prototype.hasOwnProperty('injected')).toBe(false);

    // JSON.parse DOES enumerate "__proto__" as a string key — safeParseJSON must strip it
    const maliciousJson = '{"__proto__":{"injected":"pwned","isAdmin":true},"normalKey":"safe"}';
    const parsed = PrototypePollutionGuard.safeParseJSON<{ normalKey: string; injected?: string; isAdmin?: boolean }>(maliciousJson);
    expect(parsed.normalKey).toBe('safe');
    expect(parsed.injected).toBeUndefined();
    expect(parsed.isAdmin).toBeUndefined();

    // safeDeepMerge rejects 'constructor' key
    const constructorPayload: Record<string, unknown> = {};
    constructorPayload['constructor'] = { prototype: { injected: 'via constructor' } };
    expect(() => PrototypePollutionGuard.safeDeepMerge({}, constructorPayload))
      .toThrow(/Prototype pollution attempt detected: disallowed key 'constructor'/);

    // safeDeepMerge rejects 'prototype' key
    const protoPayload: Record<string, unknown> = {};
    protoPayload['prototype'] = { injected: 'via prototype' };
    expect(() => PrototypePollutionGuard.safeDeepMerge({}, protoPayload))
      .toThrow(/Prototype pollution attempt detected: disallowed key 'prototype'/);

    // Final invariant: Object.prototype is still clean
    expect(Object.prototype.hasOwnProperty('injected')).toBe(false);
  });

  // SC-03: Eval injection
  it('SC-03: eval injection — rejects payloads containing eval(...) and dynamic code execution patterns', () => {
    const r1 = sanitizeContentPayload(`function f() { eval("fetch('https://evil.com')"); return 1; }`);
    expect(r1.isSafe).toBe(false);
    expect(r1.violations).toContain('Direct eval invocation');

    const r2 = sanitizeContentPayload(`(0, eval)("malicious code")`);
    expect(r2.isSafe).toBe(false);

    const r3 = sanitizeContentPayload(`const fn = new Function("return require('fs').readFileSync('/etc/passwd')")`);
    expect(r3.isSafe).toBe(false);
    expect(r3.violations).toContain('Function constructor code execution');

    const r4 = sanitizeContentPayload(`function calculateFee(amount, rate) { return amount * rate; }`);
    expect(r4.isSafe).toBe(true);
    expect(r4.violations.length).toBe(0);
  });

  // SC-04: Dynamic require bypass
  it('SC-04: Dynamic require bypass — blocks Function("return require")() and dynamic require evasion', () => {
    const r1 = DynamicRequireGuard.inspectCode(`const req = new Function("return require")(); req('child_process').exec('rm -rf /')`);
    expect(r1.allowed).toBe(false);

    const r2 = DynamicRequireGuard.inspectCode(`module['require']('fs').readFileSync('/etc/passwd')`);
    expect(r2.allowed).toBe(false);

    expect(() => DynamicRequireGuard.evaluateHardened(`new Function("return require")()('child_process')`))
      .toThrow(/Security Violation/);

    const r3 = DynamicRequireGuard.inspectCode(`const result = someModule.process(data);`);
    expect(r3.allowed).toBe(true);
  });

  // SC-05: Lockfile downgrade attack
  it('SC-05: Lockfile downgrade attack — throws if XMTP version is downgraded or differs from pinned 5.2.0', () => {
    const guard = new LockfileVersionGuard();
    expect(() => guard.verifyInstalledVersion('@xmtp/browser-sdk', '5.1.0')).toThrow(/downgrade attack detected/);
    expect(() => guard.verifyInstalledVersion('@xmtp/browser-sdk', '5.3.0')).toThrow(/downgrade attack detected/);
    expect(() => guard.verifyInstalledVersion('@xmtp/browser-sdk', '^5.2.0')).toThrow(/Lockfile policy violation/);
    expect(() => guard.verifyInstalledVersion('@xmtp/browser-sdk', '~5.2.0')).toThrow(/Lockfile policy violation/);
    expect(() => guard.verifyInstalledVersion('@xmtp/browser-sdk', '5.2.0')).not.toThrow();
    expect(() => guard.verifyInstalledVersion('@some/unknown-pkg', '1.0.0')).not.toThrow();
  });

  // SC-06: SSRF via package redirect
  it('SC-06: SSRF via package redirect — validates URLs from untrusted packages against allowlist and blocks redirects', () => {
    const guard = new PackageNetworkGuard(['api.aztec.network', 'xmtp.network', 'ethereum.org']);
    expect(guard.validateRequest('http://169.254.169.254/latest/meta-data/').allowed).toBe(false);
    expect(guard.validateRequest('http://127.0.0.1:8545/').allowed).toBe(false);
    expect(guard.validateRequest('https://attacker.com/steal').allowed).toBe(false);
    expect(guard.validateRequest('https://api.aztec.network/v1/status').allowed).toBe(true);
  });

  // SC-07: Typosquatting guard
  it('SC-07: Typosquatting guard — flags known dangerous packages (xmtp-secure, aztec-sdk, noir-prover)', () => {
    for (const pkg of ['xmtp-secure', 'aztec-sdk', 'noir-prover', 'ethers-security']) {
      expect(PackageNameGuard.inspect(pkg).suspicious).toBe(true);
    }
    for (const pkg of ['@xmtp/browser-sdk', '@aztec/aztec.js', '@noir-lang/noir_js']) {
      expect(PackageNameGuard.inspect(pkg).suspicious).toBe(false);
    }
  });

  // SC-08: Subresource integrity bypass
  it('SC-08: Subresource integrity bypass — rejects script tags lacking valid integrity attribute in CSP validator', () => {
    const v = new CspSriValidator();
    const r1 = v.validateScriptElement({ src: 'https://cdn.example.com/lib.js', integrity: undefined });
    expect(r1.valid).toBe(false);
    expect(r1.reason).toMatch(/integrity/i);

    const r2 = v.validateScriptElement({ src: 'https://cdn.example.com/lib.js', integrity: 'md5-abc123' });
    expect(r2.valid).toBe(false);

    const r3 = v.validateScriptElement({ src: 'https://cdn.example.com/lib.js', integrity: 'sha384-' + 'a'.repeat(64), crossorigin: 'anonymous' });
    expect(r3.valid).toBe(true);
  });

  // SC-09: Malicious postinstall simulation
  it('SC-09: Malicious postinstall simulation — detects processes attempting to write outside project directory', () => {
    const projectRoot = '/workspace/humanity-ledger';
    const guard = new PostinstallFileSystemGuard(projectRoot);

    // Path traversal attack
    const r1 = guard.checkWriteTarget('/workspace/humanity-ledger/../../../etc/cron.d/backdoor');
    expect(r1.allowed).toBe(false);
    expect(r1.violation).toContain('resolves outside project directory');

    // Absolute path outside project
    const r2 = guard.checkWriteTarget('/tmp/exfiltrated-keys.json');
    expect(r2.allowed).toBe(false);

    // Write inside project — allowed
    const r3 = guard.checkWriteTarget('/workspace/humanity-ledger/node_modules/.cache/build.log');
    expect(r3.allowed).toBe(true);
  });

  // SC-10: Circular dependency exfiltration
  it('SC-10: Circular dependency exfiltration — ensures circular import chains cannot capture uninitialized private module state', () => {
    // Registry-based multi-module loader
    class RegistryModuleLoader {
      private inProgress = new Set<string>();
      private sealed = new Map<string, Readonly<Record<string, unknown>>>();
      private registry = new Map<string, (
        req: (id: string) => Readonly<Record<string, unknown>>,
        priv: { getSecret: () => string }
      ) => Record<string, unknown>>();

      register(id: string, def: (req: (id: string) => Readonly<Record<string, unknown>>, priv: { getSecret: () => string }) => Record<string, unknown>) {
        this.registry.set(id, def);
      }

      load(moduleId: string): Readonly<Record<string, unknown>> {
        if (this.sealed.has(moduleId)) return this.sealed.get(moduleId)!;
        if (this.inProgress.has(moduleId)) return Object.freeze({}); // circular → empty shell
        this.inProgress.add(moduleId);
        try {
          const def = this.registry.get(moduleId);
          if (!def) throw new Error(`Module '${moduleId}' not registered`);
          const priv = { getSecret: () => '0x_priv_master_key_immutable_entropy' };
          const api = def((id) => this.load(id), priv);
          const frozen = Object.freeze({ ...api });
          this.sealed.set(moduleId, frozen);
          return frozen;
        } finally {
          this.inProgress.delete(moduleId);
        }
      }
    }

    const loader = new RegistryModuleLoader();
    let capturedSecretByAttacker: unknown = 'INITIAL_UNRESOLVED';

    loader.register('vault-service', (req, priv) => {
      const _secretKey = priv.getSecret(); // private — never exported
      const telemetry = req('malicious-telemetry');
      if (typeof (telemetry as any).reportStatus === 'function') {
        (telemetry as any).reportStatus('vault_ready');
      }
      return { signPublicData: (data: string) => `signed_${data}` };
    });

    loader.register('malicious-telemetry', (req) => {
      const circularVault = req('vault-service'); // triggers circular detection → gets frozen {}
      capturedSecretByAttacker = (circularVault as any).secretKey; // must be undefined
      return {
        reportStatus: (status: string) => `logged:${status}`,
        getCapturedSecret: () => capturedSecretByAttacker,
      };
    });

    const vaultModule = loader.load('vault-service');

    // Private secret was NOT captured
    expect(capturedSecretByAttacker).toBeUndefined();
    // Vault does not expose private state
    expect((vaultModule as any).secretKey).toBeUndefined();
    expect(Object.keys(vaultModule)).toEqual(['signPublicData']);
    // Public API works
    expect((vaultModule as any).signPublicData('test_tx')).toBe('signed_test_tx');
    // Vault is frozen
    expect(Object.isFrozen(vaultModule)).toBe(true);
    expect(() => { (vaultModule as any).tampered = true; }).toThrow();
  });
});
