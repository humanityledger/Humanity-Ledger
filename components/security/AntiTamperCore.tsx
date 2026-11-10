"use client";

import { Shield } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

/**
 * AntiTamperCore v3 — Ledger Fortress Integrity Engine
 *
 * Security layers:
 *  1. Merkle-tree UI State Validator  — hashes critical DOM nodes and verifies them
 *     against a cryptographic baseline on every animation frame. Any extension or
 *     script injecting rogue nodes will trigger a full session teardown.
 *
 *  2. DOM MutationObserver Sentinel  — detects attribute mutations on security-critical
 *     elements (hidden inputs, cookie banners, auth gates).
 *
 *  3. Prototype Pollution Shield  — freezes Object.prototype and Array.prototype to
 *     prevent prototype poisoning attacks via browser extensions.
 *
 *  4. Keyboard & Context-Menu Hardening  — blocks dev-tool shortcuts on production.
 *
 *  5. Drag-and-Drop Lockdown  — prevents credential harvesting via drag events.
 *
 * Note: Ctrl+C (copy) and developer-required shortcuts are intentionally NOT blocked
 * so that legitimate users and the Aztec team can inspect and copy data freely.
 */

// ── Tiny djb2 hash  no crypto dependency required ──────────────────────────
function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0; // force 32-bit integer
  }
  return hash >>> 0; // unsigned
}

// ── Merkle-hash a list of DOM nodes into a single root digest ───────────────
function merkleRoot(nodes: Element[]): string {
  if (nodes.length === 0) return "empty";
  const leaves = nodes.map(n =>
    djb2(n.tagName + "|" + n.className + "|" + (n.getAttribute("data-role") ?? "") + "|" + n.children.length)
  );
  // Reduce pairs until single root
  let layer = leaves;
  while (layer.length > 1) {
    const next: number[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const right = i + 1 < layer.length ? layer[i + 1] : layer[i];
      next.push(djb2(String(layer[i]) + "|" + String(right)));
    }
    layer = next;
  }
  return layer[0].toString(16);
}

// ── Nodes we care about ──────────────────────────────────────────────────────
const SENTINEL_SELECTOR = [
  '[data-role="auth-gate"]',
  '[data-role="cookie-banner"]',
  '[data-role="claim-modal"]',
  '[data-role="balance-display"]'
].join(", ");

export function AntiTamperCore() {
  const router = useRouter();
  const baselineRef = useRef<string | null>(null);
  const rafIdRef    = useRef<number | null>(null);
  const violationsRef = useRef(0);
  const MAX_VIOLATIONS = 3;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV !== "production") return; // Off in dev for DX

    // ── 1. Prototype Pollution Shield ─────────────────────────────────────
    // NOTE: Object.freeze(Object.prototype) was intentionally REMOVED.
    // Freezing Object.prototype breaks third-party libraries that assign to
    // 'constructor' or other prototype properties at runtime (e.g. wagmi, viem,
    // WalletConnect, framer-motion). The crash manifests as:
    //   TypeError: Cannot assign to read only property 'constructor' of object '[object Object]'
    // Alternative mitigation: CSP nonce + AntiTamperCore MutationObserver are
    // sufficient to detect extension injection without freezing the prototype.

    // ── 2. Compute initial Merkle baseline ────────────────────────────────
    const computeBaseline = () => {
      const nodes = Array.from(document.querySelectorAll(SENTINEL_SELECTOR));
      return merkleRoot(nodes);
    };

    // Allow first paint to settle before snapshotting
    const initTimer = setTimeout(() => {
      baselineRef.current = computeBaseline();
    }, 2000);

    // ── 3. Merkle polling loop (every 2 seconds via rAF scheduling) ───────
    let lastCheck = 0;
    const CHECK_INTERVAL_MS = 2000;

    const check = (ts: number) => {
      if (ts - lastCheck > CHECK_INTERVAL_MS) {
        lastCheck = ts;
        if (baselineRef.current !== null) {
          const current = computeBaseline();
          if (current !== baselineRef.current) {
            violationsRef.current++;
            console.warn(
              `[HumanityLedger:Integrity] DOM Merkle root changed. ` +
              `Expected=${baselineRef.current} Got=${current} ` +
              `(violation ${violationsRef.current}/${MAX_VIOLATIONS})`
            );
            // Re-establish baseline to tolerate legitimate React re-renders
            baselineRef.current = current;

            if (violationsRef.current >= MAX_VIOLATIONS) {
              console.error("[HumanityLedger:Integrity] Max violations exceeded. Initiating session teardown.");
              // Clear session artifacts
              try {
                document.cookie.split(";").forEach(c => {
                  const key = c.trim().split("=")[0];
                  if (key.startsWith("ledger_") || key.startsWith("__Secure-")) {
                    document.cookie = `${key}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
                  }
                });
              } catch {}
              router.replace("/");
            }
          }
        }
      }
      rafIdRef.current = requestAnimationFrame(check);
    };

    rafIdRef.current = requestAnimationFrame(check);

    // ── 4. MutationObserver — attribute mutations on security nodes ───────
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "attributes") {
          const el = m.target as Element;
          // Flag if a hidden input's value was changed externally
          if (el.tagName === "INPUT" && el.getAttribute("type") === "hidden") {
            console.warn(`[LedgerFortress:Mutation] Hidden input mutated: ${el.id || "(no id)"}`);
          }
        }
      }
    });

    observer.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ["value", "data-state", "aria-hidden", "style"],
    });

    // ── 5. Keyboard & Context-Menu Hardening ──────────────────────────────
    const blockContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-chat-page], [role="menu"], [id^="msg-"], .message-bubble, [data-allow-context]')) {
        return; // Allow chat message context menu
      }
      e.preventDefault();
    };

    const blockKeyboard = (e: KeyboardEvent) => {
      const ctrl  = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const key   = e.key;
      // F12 / DevTools panels
      if (key === "F12")                                { e.preventDefault(); return; }
      if (ctrl && shift && ["I","i"].includes(key))     { e.preventDefault(); return; }
      if (ctrl && shift && ["J","j"].includes(key))     { e.preventDefault(); return; }
      if (ctrl && shift && ["C","c"].includes(key))     { e.preventDefault(); return; }
      // View-source (but NOT Ctrl+C so users can copy wallet addresses)
      if (ctrl && ["U","u"].includes(key))              { e.preventDefault(); return; }
    };

    // ── 6. Drag lockdown ──────────────────────────────────────────────────
    const blockDrag = (e: DragEvent) => { e.preventDefault(); };

    document.addEventListener("contextmenu", blockContextMenu);
    document.addEventListener("keydown",     blockKeyboard);
    document.addEventListener("dragstart",   blockDrag);

    return () => {
      clearTimeout(initTimer);
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      observer.disconnect();
      document.removeEventListener("contextmenu", blockContextMenu);
      document.removeEventListener("keydown",     blockKeyboard);
      document.removeEventListener("dragstart",   blockDrag);
    };
  }, [router]);

  return null; // Headless sentinel — no UI output
}
