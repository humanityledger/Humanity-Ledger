'use client';

/**
 * Runs one community app and answers its bridge (lib/community-apps/sdk.ts).
 *
 * The iframe is sandboxed to an opaque origin, so messages from it arrive
 * with origin "null"; they are trusted only when they come from this
 * iframe's own window. The frame never talks to our API itself: every read
 * and write goes through this component, with the member's session.
 *
 * Sync: a delta poll every 4 s while the page is visible, plus an immediate
 * one after each write. Writes are applied locally first so other polls do
 * not flicker them away; a failed write triggers a full reload of the data.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { APP_FRAME_SANDBOX } from '@/lib/community-apps/framePolicy';

interface Identity { id: string; label: string }
interface Entry {
  scope: 'shared' | 'member';
  key: string;
  value: unknown;
  at: string;
  by: Identity;
  member?: Identity;
  me?: boolean;
}
interface Context {
  me: Identity & { isAdmin: boolean; isCreator: boolean; isMember: boolean };
  community: { name: string };
  app: { id: string; title: string; version: number };
  preview: boolean;
}

export interface AppFrameProps {
  communityId: string;
  appId: string;
  version: number;
  title: string;
  onRuntimeError?: (message: string) => void;
  onWriteRejected?: (message: string) => void;
  onVersionChange?: (version: number) => void;
}

const POLL_MS = 4000;

function entryId(e: { scope: string; key: string; member?: Identity }) {
  return `${e.scope}|${e.member?.id ?? ''}|${e.key}`;
}

export function AppFrame({ communityId, appId, version, title, onRuntimeError, onWriteRejected, onVersionChange }: AppFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const store = useRef(new Map<string, Entry>());
  const ctxRef = useRef<Context | null>(null);
  const cursorRef = useRef<string | null>(null);
  const firstSync = useRef<Promise<void> | null>(null);
  const callbacks = useRef({ onRuntimeError, onWriteRejected, onVersionChange });
  callbacks.current = { onRuntimeError, onWriteRejected, onVersionChange };
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const base = `/api/chat/communities/${encodeURIComponent(communityId)}/apps/${encodeURIComponent(appId)}`;

  const view = useCallback(() => {
    const shared: Record<string, unknown> = {};
    const mine: Record<string, unknown> = {};
    const members: Record<string, unknown[]> = {};
    for (const e of store.current.values()) {
      if (e.value === null || e.value === undefined) continue;
      if (e.scope === 'shared') {
        shared[e.key] = { value: e.value, by: e.by, at: e.at };
      } else if (e.member) {
        (members[e.key] ||= []).push({ id: e.member.id, label: e.member.label, value: e.value, at: e.at, me: !!e.me });
        if (e.me) mine[e.key] = e.value;
      }
    }
    return { shared, mine, members };
  }, []);

  const push = useCallback(() => {
    frameRef.current?.contentWindow?.postMessage({ hl: 1, op: 'state', state: view() }, '*');
  }, [view]);

  const sync = useCallback(async (full = false) => {
    const since = full ? null : cursorRef.current;
    const res = await fetch(`${base}/state${since ? `?since=${encodeURIComponent(since)}` : ''}`, { cache: 'no-store' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `The app data could not be loaded (${res.status}).`);
    }
    const data = await res.json();
    const prevVersion = ctxRef.current?.app.version;
    ctxRef.current = data.context;
    if (full || data.full) store.current.clear();
    let changed = full || data.full;
    for (const e of data.entries as Entry[]) {
      const id = entryId(e);
      const prev = store.current.get(id);
      if (!prev || prev.at !== e.at || JSON.stringify(prev.value) !== JSON.stringify(e.value)) {
        store.current.set(id, e);
        changed = true;
      }
    }
    if (data.cursor) cursorRef.current = data.cursor;
    if (prevVersion !== undefined && data.context.app.version !== prevVersion) {
      callbacks.current.onVersionChange?.(data.context.app.version);
    }
    if (changed) push();
  }, [base, push]);

  // Reset when the app changes.
  useEffect(() => {
    store.current.clear();
    ctxRef.current = null;
    cursorRef.current = null;
    setLoaded(false);
    setFailed(null);
    firstSync.current = sync(true).catch(e => setFailed(e.message));
  }, [sync, appId, version]);

  // Delta poll while visible.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const tick = () => { if (document.visibilityState === 'visible') sync().catch(() => {}); };
    timer = setInterval(tick, POLL_MS);
    const onVisible = () => tick();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [sync]);

  // The bridge.
  useEffect(() => {
    const reply = (id: number, ok: boolean, result?: unknown, error?: string) => {
      frameRef.current?.contentWindow?.postMessage({ hl: 1, id, ok, result, error }, '*');
    };

    const onMessage = async (event: MessageEvent) => {
      if (!frameRef.current || event.source !== frameRef.current.contentWindow) return;
      const m = event.data;
      if (!m || m.hl !== 1 || typeof m.op !== 'string') return;

      if (m.op === 'error') {
        const message = String(m.data?.message || 'Unknown error').slice(0, 500);
        callbacks.current.onRuntimeError?.(message);
        return;
      }

      if (m.op === 'hello') {
        try {
          await firstSync.current;
          const c = ctxRef.current;
          if (!c) throw new Error('The app data could not be loaded.');
          reply(m.id, true, {
            context: {
              me: { id: c.me.id, label: c.me.label, isAdmin: c.me.isAdmin, isCreator: c.me.isCreator },
              community: { name: c.community.name },
              app: { id: c.app.id, title: c.app.title },
              preview: c.preview,
            },
            state: view(),
          });
        } catch (e: any) {
          reply(m.id, false, undefined, e.message);
        }
        return;
      }

      if (m.op === 'set') {
        const c = ctxRef.current;
        const d = m.data || {};
        if (!c || (d.scope !== 'shared' && d.scope !== 'mine') || typeof d.key !== 'string') {
          reply(m.id, false, undefined, 'Invalid request.');
          return;
        }
        // Apply locally first.
        const me = { id: c.me.id, label: c.me.label };
        const local: Entry = d.scope === 'shared'
          ? { scope: 'shared', key: d.key, value: d.value ?? null, at: new Date().toISOString(), by: me }
          : { scope: 'member', key: d.key, value: d.value ?? null, at: new Date().toISOString(), by: me, member: me, me: true };
        store.current.set(entryId(local), local);

        try {
          const res = await fetch(`${base}/state`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scope: d.scope, key: d.key, value: d.value ?? null }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(body.error || `Could not save (${res.status}).`);
          reply(m.id, true, { at: body.at });
          sync().catch(() => {});
        } catch (e: any) {
          reply(m.id, false, undefined, e.message);
          callbacks.current.onWriteRejected?.(e.message);
          sync(true).catch(() => {});
        }
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [base, sync, view]);

  return (
    <div className="relative flex-1 min-h-0 w-full bg-[var(--hl-bg)]">
      {failed ? (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
          <p className="text-[13.5px] text-[var(--hl-ink-3)] max-w-sm">{failed}</p>
        </div>
      ) : (
        <>
          <iframe
            ref={frameRef}
            key={`${appId}:${version}`}
            src={`${base}/frame?v=${version}`}
            title={title}
            sandbox={APP_FRAME_SANDBOX}
            referrerPolicy="no-referrer"
            allow=""
            onLoad={() => setLoaded(true)}
            className="absolute inset-0 w-full h-full border-0 bg-[var(--hl-bg)]"
          />
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-[var(--hl-bg)]" aria-hidden>
              <div className="w-5 h-5 rounded-full border-2 border-[var(--hl-border)] border-t-[var(--hl-ink)] animate-spin motion-reduce:animate-none" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
