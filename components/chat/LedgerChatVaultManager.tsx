"use client";
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, Download, Trash2, Folder, Image as ImageIcon, FileText, Music, FileArchive } from 'lucide-react';
import { vault } from '@/lib/core/SecureVault';

interface VaultFile {
  id: string;
  name: string;
  type: string;
  size: number;
  createdAt: number;
  encrypted: boolean;
}

interface VaultManagerProps {
  onClose: () => void;
}

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function getFileIcon(type: string) {
  if (type.startsWith('image/')) return <ImageIcon size={24} className="text-[#25D366]" />;
  if (type.startsWith('audio/')) return <Music size={24} className="text-[#30d158]" />;
  if (type.includes('pdf') || type.includes('document')) return <FileText size={24} className="text-[#ff9500]" />;
  if (type.includes('zip') || type.includes('compressed')) return <FileArchive size={24} className="text-[#ff3b30]" />;
  return <Folder size={24} className="text-black/40" />;
}

export function LedgerChatVaultManager({ onClose }: VaultManagerProps) {
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'images' | 'documents'>('all');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const stored = await vault.getItem('ledger_vault_files');
        if (stored) {
          setFiles(JSON.parse(stored));
        } else {
          setFiles([]);
        }
      } catch {
        setFiles([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredFiles = files.filter(f => {
    if (activeTab === 'all') return true;
    if (activeTab === 'images') return f.type.startsWith('image/');
    if (activeTab === 'documents') return !f.type.startsWith('image/') && !f.type.startsWith('audio/');
    return true;
  });

  const toggleSelect = (id: string) => {
    const next = new Set(selectedFiles);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedFiles(next);
  };

  const handleDownloadSelected = async () => {
    for (const id of Array.from(selectedFiles)) {
      try {
        const fileData = await vault.getItem(`ledger_vault_data_${id}`);
        const fileMeta = files.find(f => f.id === id);
        if (fileData && fileMeta) {
          // fileData is expected to be a base64 or DataURL string
          const a = document.createElement('a');
          a.href = fileData;
          a.download = fileMeta.name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      } catch (e) {
        console.error('Download failed for', id, e);
      }
    }
    setSelectedFiles(new Set());
  };

  const handleDeleteSelected = async () => {
    const toDelete = Array.from(selectedFiles);
    for (const id of toDelete) {
      await vault.removeItem(`ledger_vault_data_${id}`);
    }
    const nextFiles = files.filter(f => !selectedFiles.has(f.id));
    await vault.setItem('ledger_vault_files', JSON.stringify(nextFiles));
    setFiles(nextFiles);
    setSelectedFiles(new Set());
  };

  const totalSize = files.reduce((acc, f) => acc + f.size, 0);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 50, scale: 0.95 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 50, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-black/5 bg-[#f5f5f7]">
          <div>
            <h2 className="text-[20px] font-black text-black flex items-center gap-2">
              <Lock size={20} className="text-[#25D366]" />
              Secure Vault
            </h2>
            <p className="text-[13px] font-medium text-black/50 mt-1">
              {files.length} encrypted files • {formatBytes(totalSize)} total
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-black/5 hover:bg-black/5 transition-colors"
          >
            <X size={20} className="text-black" />
          </button>
        </div>

        {/* Tabs & Actions */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-black/5">
          <div className="flex items-center gap-2">
            {(['all', 'images', 'documents'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-full text-[12px] font-bold capitalize transition-colors ${
                  activeTab === tab ? 'bg-black text-white' : 'bg-black/5 text-black/60 hover:bg-black/10'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <AnimatePresence>
            {selectedFiles.size > 0 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-center gap-2"
              >
                <span className="text-[12px] font-bold text-[#25D366] mr-2">
                  {selectedFiles.size} selected
                </span>
                <button
                  onClick={handleDownloadSelected}
                  className="w-8 h-8 rounded-full bg-[#25D366]/10 flex items-center justify-center text-[#25D366] hover:bg-[#25D366]/20 transition-colors"
                >
                  <Download size={14} />
                </button>
                <button
                  onClick={handleDeleteSelected}
                  className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* File List */}
        <div className="flex-1 overflow-y-auto p-4 bg-white min-h-[300px]">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-4 border-[#25D366]/30 border-t-[#25D366] rounded-full animate-spin" />
              <p className="text-[13px] font-mono text-black/40">Decrypting vault manifest...</p>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-4 text-black/30">
              <Folder size={48} className="opacity-50" />
              <p className="text-[15px] font-medium text-center">No files found in this category.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredFiles.map(file => {
                const isSelected = selectedFiles.has(file.id);
                return (
                  <div
                    key={file.id}
                    onClick={() => toggleSelect(file.id)}
                    className={`flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all border ${
                      isSelected ? 'bg-[#25D366]/5 border-[#25D366]/30' : 'bg-white border-transparent hover:bg-black/5'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-xl bg-[#f5f5f7] flex items-center justify-center shrink-0">
                      {getFileIcon(file.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[14px] font-bold text-black truncate">{file.name}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[12px] font-mono text-black/50">{formatBytes(file.size)}</span>
                        <span className="w-1 h-1 rounded-full bg-black/20" />
                        <span className="text-[12px] text-black/50">
                          {new Date(file.createdAt).toLocaleDateString()}
                        </span>
                        {file.encrypted && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-black/20" />
                            <Lock size={10} className="text-[#30d158]" />
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${
                      isSelected ? 'border-[#25D366] bg-[#25D366]' : 'border-black/20 bg-transparent'
                    }`}>
                      {isSelected && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-2.5 h-2.5 bg-white rounded-full" />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Footer info */}
        <div className="p-4 bg-[#f5f5f7] border-t border-black/5 flex items-center justify-center gap-2">
            <Lock size={12} className="text-black/40" />
            <span className="text-[11px] font-mono font-bold text-black/40 uppercase tracking-widest">AES-256-GCM Encrypted Storage</span>
        </div>
      </motion.div>
    </motion.div>
  );
}
