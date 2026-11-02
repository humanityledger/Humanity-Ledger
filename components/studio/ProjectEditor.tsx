'use client';

/** Create or edit a Studio project: instructions, knowledge files and skills. */

import React, { useEffect, useRef, useState } from 'react';
import { FileText, Plus, Trash2, X } from 'lucide-react';
import type { StudioApi } from './useStudio';
import { uid, type Project, type ProjectFile } from '@/lib/studio/store';
import { attachmentKind, MAX_TEXT_CHARS } from '@/lib/studio/history';
import { skillsById } from '@/lib/studio/skills';

const MAX_PROJECT_FILES = 30;

export function ProjectEditor({ api, project, onClose, onSaved }: { api: StudioApi; project: Project | null; onClose: () => void; onSaved: (p: Project) => void }) {
  const { t, store, prefs, saveProject, deleteProject } = api;
  const [name, setName] = useState(project?.name ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [instructions, setInstructions] = useState(project?.instructions ?? '');
  const [skillIds, setSkillIds] = useState<string[]>(project?.skillIds ?? []);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [pending, setPending] = useState<ProjectFile[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const id = useRef(project?.id ?? uid('p_')).current;
  const skills = Array.from(skillsById(prefs.customSkills).values());

  useEffect(() => { if (project) store.listFiles(project.id).then(setFiles).catch(() => setFiles([])); }, [project, store]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const visible = [...files.filter(f => !removed.includes(f.id)), ...pending];

  const addFiles = async (list: FileList | null) => {
    if (!list) return;
    setError('');
    const out: ProjectFile[] = [];
    for (const f of Array.from(list)) {
      if (visible.length + out.length >= MAX_PROJECT_FILES) break;
      if (attachmentKind(f.name, f.type || '') !== 'text') { setError(`${f.name}: ${t.fileUnsupported}`); continue; }
      if (f.size > 2 * 1024 * 1024) { setError(`${f.name}: ${t.fileTooLarge} (2 MB)`); continue; }
      const text = (await f.text()).slice(0, MAX_TEXT_CHARS);
      out.push({ id: uid('pf_'), projectId: id, name: f.name.slice(0, 200), mime: f.type || 'text/plain', size: f.size, text, createdAt: Date.now() });
    }
    setPending(prev => [...prev, ...out]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const save = async () => {
    if (!name.trim()) return;
    const now = Date.now();
    const p: Project = {
      id, name: name.trim().slice(0, 120), description: description.trim().slice(0, 500), instructions: instructions.slice(0, 20_000),
      skillIds: skillIds.slice(0, 12), createdAt: project?.createdAt ?? now, updatedAt: now,
    };
    await saveProject(p);
    for (const f of pending) await store.putFile(f);
    for (const fid of removed) await store.deleteFile(fid);
    onSaved(p);
  };

  const input = 'w-full h-10 px-3 rounded-xl border border-[#e4e7ec] bg-white text-[14px] text-[#15171c] outline-none focus:border-[#98a2b3]';
  const label = 'block text-[13px] font-medium text-[#15171c] mb-1.5';

  return (
    <div className="fixed inset-0 z-[320] bg-[#15171c]/30 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={project ? project.name : t.newProject}
        className="w-full sm:max-w-xl max-h-[92dvh] bg-white rounded-t-3xl sm:rounded-3xl shadow-[0_24px_60px_-20px_rgba(16,24,40,0.35)] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 h-14 border-b border-[#eceef2] shrink-0">
          <h2 className="text-[16px] font-semibold text-[#15171c]">{project ? project.name : t.newProject}</h2>
          <button type="button" onClick={onClose} aria-label={t.close} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#eff1f4]"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className={label} htmlFor="pj-name">{t.projectName}</label>
            <input id="pj-name" className={input} value={name} maxLength={120} onChange={e => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className={label} htmlFor="pj-desc">{t.projectDescription}</label>
            <input id="pj-desc" className={input} value={description} maxLength={500} onChange={e => setDescription(e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="pj-instr">{t.projectInstructions}</label>
            <textarea id="pj-instr" rows={6} maxLength={20_000} className="w-full px-3 py-2 rounded-xl border border-[#e4e7ec] text-[14px] outline-none focus:border-[#98a2b3] resize-y" value={instructions} onChange={e => setInstructions(e.target.value)} />
            <p className="text-[12.5px] text-[#727a88] mt-1">{t.projectInstructionsHint}</p>
          </div>
          <div>
            <span className={label}>{t.projectFiles}</span>
            <p className="text-[12.5px] text-[#727a88] mb-2">{t.projectFilesHint}</p>
            <ul className="space-y-1.5 mb-2">
              {visible.map(f => (
                <li key={f.id} className="flex items-center gap-2 px-3 h-10 rounded-xl border border-[#e4e7ec]">
                  <FileText size={15} className="text-[#4a505c] shrink-0" />
                  <span className="flex-1 truncate text-[13.5px] text-[#15171c]">{f.name}</span>
                  <span className="text-[12px] text-[#727a88] tabular-nums">{Math.max(1, Math.round(f.size / 1024))} KB</span>
                  <button type="button" aria-label={t.delete} className="text-[#d93036]" onClick={() => {
                    if (pending.some(x => x.id === f.id)) setPending(prev => prev.filter(x => x.id !== f.id));
                    else setRemoved(prev => [...prev, f.id]);
                  }}><Trash2 size={14} /></button>
                </li>
              ))}
            </ul>
            <input ref={fileRef} type="file" multiple className="hidden" onChange={e => addFiles(e.target.files)} />
            <button type="button" disabled={visible.length >= MAX_PROJECT_FILES} onClick={() => fileRef.current?.click()} className="h-9 px-3 rounded-lg border border-[#e4e7ec] text-[13px] flex items-center gap-1.5 hover:bg-[#f2f4f7] disabled:opacity-40">
              <Plus size={14} /> {t.addFiles}
            </button>
            {error && <p className="text-[12.5px] text-[#d93036] mt-2">{error}</p>}
          </div>
          <div>
            <span className={label}>{t.skills}</span>
            <div className="flex flex-wrap gap-1.5">
              {skills.map(s => {
                const on = skillIds.includes(s.id);
                return (
                  <button key={s.id} type="button" aria-pressed={on} onClick={() => setSkillIds(on ? skillIds.filter(x => x !== s.id) : [...skillIds, s.id])}
                    className={`h-8 px-3 rounded-full text-[12.5px] border ${on ? 'bg-[#15171c] text-white border-[#15171c]' : 'border-[#e4e7ec] text-[#4a505c] hover:bg-[#f2f4f7]'}`}>
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 px-5 py-3 border-t border-[#eceef2] shrink-0">
          {project && (
            <button type="button" className="h-10 px-3 rounded-xl text-[13.5px] text-[#d93036] hover:bg-[#fdf2f2] mr-auto" onClick={async () => {
              if (!window.confirm(t.deleteProjectConfirm)) return;
              await deleteProject(project.id); onClose();
            }}>{t.delete}</button>
          )}
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onClose} className="h-10 px-4 rounded-xl border border-[#e4e7ec] text-[13.5px] hover:bg-[#f2f4f7]">{t.cancel}</button>
            <button type="button" onClick={save} disabled={!name.trim()} className="h-10 px-4 rounded-xl bg-[#15171c] text-white text-[13.5px] font-medium disabled:opacity-40">{t.save}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
