'use client';

/**
 * GitHub in the workspace: connect (token or sign-in), import a repository
 * into the workspace, and push the workspace's changes as a commit on a new
 * branch with a pull request. Calls go from the browser to api.github.com.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ExternalLink, GitPullRequest, Github, Loader2, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import type { StudioApi } from '../useStudio';
import { diffWorkspace, getViewer, GitHubError, importRepo, isValidBranch, parseRepo, pushWorkspace, type GitLink } from '@/lib/studio/github';

export function GitHubPanel({ api, onDone }: { api: StudioApi; onDone: () => void }) {
  const { t, store, wsId, wsFiles, streaming } = api;
  const [token, setToken] = useState<string | null>(null);
  const [login, setLogin] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [oauth, setOauth] = useState(false);
  const [link, setLink] = useState<GitLink | null>(null);
  const [repoInput, setRepoInput] = useState('');
  const [branchInput, setBranchInput] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [changes, setChanges] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [newBranch, setNewBranch] = useState('');
  const [prBody, setPrBody] = useState('');

  const errText = useCallback((e: unknown) => {
    const s = e instanceof GitHubError ? e.status : 0;
    if (s === 401 || s === 403) return t.ghErrorAuth;
    if (s === 404) return t.ghErrorNotFound;
    if (s === 429) return t.ghErrorRate;
    return `${t.ghError}${e instanceof GitHubError && e.message ? ` (${e.message.slice(0, 160)})` : ''}`;
  }, [t]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [tk, l] = await Promise.all([store.getGitHubToken(), store.getGitLink(wsId)]);
      if (!alive) return;
      setToken(tk); setLink(l);
      if (tk) getViewer(tk).then(v => alive && setLogin(v.login)).catch(() => alive && setLogin(null));
    })();
    fetch('/api/studio/github', { credentials: 'include', cache: 'no-store' }).then(r => r.json()).then(j => alive && setOauth(!!j?.oauth)).catch(() => {});
    return () => { alive = false; };
  }, [store, wsId]);

  // How many files differ from the linked branch.
  useEffect(() => {
    if (!link) { setChanges(null); return; }
    let alive = true;
    diffWorkspace(wsFiles, link).then(d => alive && setChanges(d.added.length + d.changed.length + d.deleted.length)).catch(() => {});
    return () => { alive = false; };
  }, [link, wsFiles]);

  const connect = async (tk: string) => {
    setBusy('connect');
    try {
      const v = await getViewer(tk);
      await store.putGitHubToken(tk);
      setToken(tk); setLogin(v.login); setTokenInput('');
    } catch (e) { toast.error(errText(e)); } finally { setBusy(null); }
  };

  const signIn = async () => {
    setBusy('connect');
    try {
      const r = await fetch('/api/studio/github', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'start' }) });
      const j = await r.json();
      const url = String(j?.url ?? '');
      if (!r.ok || !url.startsWith('https://github.com/login/oauth/authorize')) throw new Error('start');
      const popup = window.open(url, 'studio-github', 'width=720,height=780');
      const started = Date.now();
      let closedAt = 0;
      // Poll until the popup has finished (the token is kept two minutes, once).
      for (;;) {
        await new Promise(res => setTimeout(res, 1500));
        const c = await fetch('/api/studio/github', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'claim', state: j.state }) });
        if (c.ok) { const { token: tk } = await c.json(); await connect(String(tk)); try { popup?.close(); } catch { /* ignore */ } return; }
        if (popup?.closed && !closedAt) closedAt = Date.now();
        // Give a closed popup a few seconds (it may close right after finishing).
        if (Date.now() - started > 5 * 60_000 || (closedAt && Date.now() - closedAt > 6_000)) break;
      }
      toast.error(t.ghError);
    } catch { toast.error(t.ghError); } finally { setBusy(null); }
  };

  const disconnect = async () => { await store.putGitHubToken(null); setToken(null); setLogin(null); };

  const doImport = async () => {
    if (!token) return;
    const p = parseRepo(repoInput);
    if (!p) { toast.error(t.ghErrorNotFound); return; }
    const branch = branchInput.trim() || p.branch;
    if (branch && !isValidBranch(branch)) { toast.error(t.ghErrorNotFound); return; }
    setBusy('import');
    const id = toast.loading(t.ghImporting);
    try {
      const r = await importRepo(token, p.owner, p.repo, branch, (d, n) => toast.loading(`${t.ghImporting} ${d}/${n}`, { id }));
      const added = await api.wsAddFiles(r.files, r.skipped);
      if (!added.added && r.files.length) throw new Error('size');
      await store.putGitLink(wsId, r.link);
      setLink(r.link);
      toast.success(`${t.ghImported}: ${added.added}${added.skipped ? ` · ${added.skipped} ${t.wsSkipped}` : ''}`, { id });
      if (r.truncated) toast.warning(t.ghTruncated);
    } catch (e) { toast.error(e instanceof Error && e.message === 'size' ? t.wsTooLarge : errText(e), { id }); } finally { setBusy(null); }
  };

  const doPush = async () => {
    if (!token || !link) return;
    if (!message.trim()) return;
    if (newBranch.trim() && !isValidBranch(newBranch.trim())) { toast.error(t.ghErrorNotFound); return; }
    setBusy('push');
    try {
      const r = await pushWorkspace(token, wsFiles, link, { message: message.trim(), newBranch: newBranch.trim() || undefined, prTitle: message.trim().split('\n')[0], prBody });
      await store.putGitLink(wsId, r.link);
      setLink(r.link); setMessage(''); setPrBody('');
      toast.success(t.ghPrOpened);
    } catch (e) {
      toast.error(e instanceof GitHubError && e.message === 'NO_CHANGES' ? t.ghNoChanges : errText(e));
    } finally { setBusy(null); }
  };

  const unlink = async () => { await store.putGitLink(wsId, null); setLink(null); };
  const prUrl = link?.pr?.url && /^https:\/\/github\.com\//.test(link.pr.url) ? link.pr.url : null;
  const input = 'w-full h-9 px-3 rounded-lg border border-[#e4e7ec] text-[13px] outline-none focus:border-[#98a2b3] bg-white';
  const primary = 'h-9 px-3 rounded-lg bg-[#15171c] text-white text-[13px] font-medium disabled:opacity-40 flex items-center gap-1.5';

  return (
    <div className="border-b border-[#eceef2] bg-[#fbfbfc] p-3 space-y-3 text-[13px] max-h-[55vh] overflow-y-auto shrink-0">
      {!token ? (
        <div className="space-y-2">
          <p className="font-medium flex items-center gap-1.5"><Github size={15} /> {t.ghConnect}</p>
          {oauth && <button type="button" disabled={!!busy} onClick={signIn} className={primary}>{busy === 'connect' ? <Loader2 size={14} className="animate-spin" /> : <Github size={14} />} {t.ghSignIn}</button>}
          <label className="block text-[12px] text-[#4a505c]">{t.ghTokenLabel}</label>
          <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (tokenInput.trim()) connect(tokenInput.trim()); }}>
            <input type="password" autoComplete="off" spellCheck={false} value={tokenInput} onChange={e => setTokenInput(e.target.value)} placeholder="github_pat_…" className={input} aria-label={t.ghTokenLabel} />
            <button type="submit" disabled={!tokenInput.trim() || !!busy} className={primary}>{t.ghConnect}</button>
          </form>
          <p className="text-[11.5px] text-[#727a88] leading-[1.5]">{t.ghTokenHint}</p>
          <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12px] text-[#2456d6] hover:underline">{t.ghCreateToken} <ExternalLink size={12} /></a>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Github size={15} />
            <span className="text-[12.5px] text-[#4a505c]">{t.ghConnectedAs} <b className="text-[#15171c]">{login ?? '…'}</b></span>
            <button type="button" onClick={disconnect} className="ml-auto h-7 px-2 rounded-md text-[12px] text-[#4a505c] hover:bg-[#eef0f3] flex items-center gap-1"><LogOut size={12} /> {t.ghDisconnect}</button>
          </div>

          {!link ? (
            <div className="space-y-2">
              <p className="font-medium">{t.ghImport}</p>
              <input value={repoInput} onChange={e => setRepoInput(e.target.value)} placeholder={t.ghRepoPlaceholder} className={input} aria-label={t.ghImport} />
              <div className="flex gap-2">
                <input value={branchInput} onChange={e => setBranchInput(e.target.value)} placeholder={`${t.ghBranch} (main)`} className={input} aria-label={t.ghBranch} />
                <button type="button" disabled={!repoInput.trim() || !!busy || streaming} onClick={doImport} className={primary}>{busy === 'import' ? <Loader2 size={14} className="animate-spin" /> : null}{t.ghImport}</button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[12.5px] text-[#4a505c]">{t.ghLinked}</span>
                <a href={`https://github.com/${encodeURIComponent(link.owner)}/${encodeURIComponent(link.repo)}/tree/${link.branch.split('/').map(encodeURIComponent).join('/')}`} target="_blank" rel="noopener noreferrer" className="font-mono text-[12.5px] text-[#2456d6] hover:underline">{link.owner}/{link.repo}@{link.branch}</a>
                {changes !== null && <span className="text-[12px] text-[#727a88]">· {changes} {t.ghChanges}</span>}
                <button type="button" onClick={unlink} className="ml-auto h-7 px-2 rounded-md text-[12px] text-[#4a505c] hover:bg-[#eef0f3]">{t.ghDisconnect}</button>
              </div>
              {prUrl && <a href={prUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12.5px] text-[#2456d6] hover:underline"><GitPullRequest size={13} /> #{link.pr!.number} <ExternalLink size={11} /></a>}
              <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder={t.ghCommitMessage} rows={2} maxLength={5000} className="w-full px-3 py-2 rounded-lg border border-[#e4e7ec] text-[13px] outline-none focus:border-[#98a2b3] bg-white resize-y" />
              {!link.pr && (
                <>
                  <input value={newBranch} onChange={e => setNewBranch(e.target.value)} placeholder={`${t.ghNewBranch} (studio/…)`} className={input} aria-label={t.ghNewBranch} />
                  <textarea value={prBody} onChange={e => setPrBody(e.target.value)} placeholder={t.ghPrBody} rows={2} maxLength={60000} className="w-full px-3 py-2 rounded-lg border border-[#e4e7ec] text-[13px] outline-none focus:border-[#98a2b3] bg-white resize-y" />
                </>
              )}
              <div className="flex gap-2 flex-wrap">
                <button type="button" disabled={!message.trim() || !!busy || streaming || changes === 0} onClick={doPush} className={primary}>
                  {busy === 'push' ? <Loader2 size={14} className="animate-spin" /> : <GitPullRequest size={14} />} {busy === 'push' ? t.ghCommitting : link.pr ? `${t.ghPush} ${link.branch}` : t.ghCommit}
                </button>
                <button type="button" onClick={onDone} className="h-9 px-3 rounded-lg text-[13px] text-[#4a505c] hover:bg-[#eef0f3]">{t.close}</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
