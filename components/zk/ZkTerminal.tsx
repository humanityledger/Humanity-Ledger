'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Terminal,  RefreshCw, X, Play, Cpu, Check, AlertTriangle } from 'lucide-react';
import { executeAztecTerminalCommand, CommandOutput } from '@/lib/zk/zkDevtools';

interface ZkTerminalProps {
  userAddress: string;
  onClose?: () => void;
  className?: string;
}

export function ZkTerminal({ userAddress, onClose, className = '' }: ZkTerminalProps) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<CommandOutput[]>([
    {
      command: 'init',
      output: 'Aztec PXE DevTools CLI v2.4.0-nightly\nConnected to Aztec Mainnet Rollup (Block #14820)\nType "help" to list available commands.',
      timestamp: Date.now(),
    },
  ]);
  const [isExecuting, setIsExecuting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  const handleCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isExecuting) return;

    const cmd = input.trim();
    setInput('');
    setIsExecuting(true);

    if (cmd === 'clear') {
      setHistory([]);
      setIsExecuting(false);
      return;
    }

    try {
      const res = await executeAztecTerminalCommand(cmd, userAddress);
      setHistory(prev => [...prev, res]);
    } catch (err: any) {
      setHistory(prev => [
        ...prev,
        { command: cmd, output: err.message || 'Execution failed', isError: true, timestamp: Date.now() },
      ]);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleQuickCommand = (cmd: string) => {
    setInput(cmd);
  };

  return (
    <div className={`bg-white rounded-3xl border border-black/[0.08] shadow-2xl flex flex-col overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-[#f0f2f5] px-6 py-4 flex items-center justify-between border-b border-black/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gray-900 text-[#1C1C1E] flex items-center justify-center font-mono text-[14px]">
            &gt;_
          </div>
          <div>
            <h2 className="text-[14px] font-bold text-gray-900 leading-tight">Aztec PXE Runtime Console</h2>
            <p className="text-[10px] text-gray-500 font-mono">Private Execution Environment & Prover Inspector</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#1C1C1E] bg-[#1C1C1E]/10 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1C1C1E] " /> PXE Online
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-black/5 text-gray-400"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Quick Command Toolbar */}
      <div className="px-6 py-2 bg-[#FAFAFA] border-b border-black/[0.04] flex items-center gap-2 overflow-x-auto text-[11px]">
        <span className="text-gray-400 font-semibold flex items-center gap-1 flex-shrink-0">
          <Terminal size={12} /> Quick:
        </span>
        {['status', 'keys', 'notes', 'bench', 'audit', 'nullifiers'].map(cmd => (
          <button
            key={cmd}
            onClick={() => handleQuickCommand(cmd)}
            className="px-2.5 py-1 rounded-lg bg-white border border-black/[0.06] text-gray-700 font-mono hover:border-[#1C1C1E] hover:text-[#1C1C1E] transition flex-shrink-0"
          >
            {cmd}
          </button>
        ))}
      </div>

      {/* Output Screen (Clean Light Monospace) */}
      <div
        ref={scrollRef}
        className="flex-1 p-6 font-mono text-[12px] bg-[#FAFAFA] overflow-y-auto space-y-4 max-h-[380px] min-h-[260px]"
      >
        {history.map((h, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center gap-2 text-gray-400">
              <span className="text-[#1C1C1E] font-bold">aztec-pxe$</span>
              <span className="text-gray-800 font-bold">{h.command}</span>
              <span className="text-[10px] ml-auto">
                {new Date(h.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div
              className={`p-3 rounded-xl border whitespace-pre-wrap leading-relaxed ${
                h.isError
                  ? 'bg-red-50/60 border-red-200 text-red-700'
                  : 'bg-white border-black/[0.06] text-gray-800 shadow-2xs'
              }`}
            >
              {typeof h.output === 'string' ? h.output : JSON.stringify(h.output, null, 2)}
            </div>
          </div>
        ))}
        {isExecuting && (
          <div className="flex items-center gap-2 text-gray-400">
            <RefreshCw size={12} className="animate-spin text-[#1C1C1E]" />
            <span>Evaluating constraints & proof transcript...</span>
          </div>
        )}
      </div>

      {/* Command Input Bar */}
      <form onSubmit={handleCommand} className="p-4 bg-white border-t border-black/[0.06] flex items-center gap-2">
        <span className="text-[#1C1C1E] font-mono font-bold pl-2">&gt;</span>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Enter command (e.g. status, bench, notes, keys)..."
          className="flex-1 font-mono text-[13px] text-gray-900 bg-transparent outline-none"
          autoFocus
        />
        <button
          type="submit"
          disabled={isExecuting || !input.trim()}
          className={`px-4 py-2 rounded-xl text-[12px] font-bold font-mono transition ${
            isExecuting || !input.trim()
              ? 'bg-gray-100 text-gray-400'
              : 'bg-[#1C1C1E] text-white hover:bg-[#000000]'
          }`}
        >
          Execute
        </button>
      </form>
    </div>
  );
}
