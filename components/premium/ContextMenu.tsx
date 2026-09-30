"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, Copy, LineChart, ShieldAlert, Cpu } from "lucide-react";

import { useToastStore } from './ToastManager';
import { useGodView } from '@/hooks/useGodView';

interface ContextMenuProps {
  onAction?: (action: string) => void;
  children?: React.ReactNode;
}

export default function ContextMenu({ onAction, children }: ContextMenuProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  const { addToast } = useToastStore();
  const { playOrderSound } = useGodView();

  const handleAction = (label: string) => {
    setIsVisible(false);
    playOrderSound();
    addToast({ title: "System Action", message: `Initiating ${label}...`, type: "success" });
  };

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      
      // Calculate adjusted position to prevent menu escaping beyond screen bounds
      const x = Math.min(e.clientX, window.innerWidth - 220);
      const y = Math.min(e.clientY, window.innerHeight - 300);
      
      setPosition({ x, y });
      setIsVisible(true);
    };

    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsVisible(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsVisible(false);
      }
    };

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const menuItems = [
    { id: "terminal", label: "Open Terminal", icon: Terminal, hotkey: "T" },
    { id: "attest", label: "Execute Order", icon: LineChart, hotkey: "E" },
    { id: "copy", label: "Copy Address", icon: Copy, hotkey: "C", separator: true },
    { id: "alert", label: "Set Humanity Ledger", icon: ShieldAlert, hotkey: "A" },
    { id: "ai", label: "AI Analysis", icon: Cpu, hotkey: "I" },
  ];

  return (
    <>
      {children}
      <AnimatePresence>
      {isVisible && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.9, y: 5 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 5 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          style={{ top: position.y, left: position.x }}
          className="fixed z-[9999] min-w-[240px] rounded-sm bg-white/95 backdrop-blur-2xl border border-white/10 p-2 shadow-[0_0_40px_rgba(0,0,0,0.9)] focus:outline-none ring-1 ring-white/10"
        >
          {/* Header */}
          <div className="px-3 py-2 mb-1 border-b border-white/10 flex items-center justify-between">
            <span className="text-[9px] font-black text-white/80 uppercase tracking-widest flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse" />
                Quick actions
            </span>
            <span className="text-[8px] font-mono text-white/30 tracking-widest">v9.9.9</span>
          </div>
          
          <div className="flex flex-col gap-1 mt-2">
            {menuItems.map((item) => (
              <div key={item.id}>
                {item.separator && <div className="h-[1px] bg-white/10 my-1" />}
                <button
                  onClick={() => {
                    handleAction(item.label);
                    if (onAction) onAction(item.id);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-sm hover:bg-[#e0ff00]/10 text-white/50 hover:text-[#e0ff00] transition-all group text-xs uppercase tracking-widest font-black"
                >
                  <div className="flex items-center gap-3">
                    <item.icon size={14} className="text-white/40 group-hover:text-[#e0ff00] transition-colors" />
                    <span>{item.label}</span>
                  </div>
                  {item.hotkey && (
                    <span className="text-[9px] font-mono opacity-20 group-hover:opacity-100 bg-white/5 px-2 py-0.5 rounded-sm border border-white/10 group-hover:border-[#e0ff00]/30 transition-all group-hover:text-[#e0ff00]">
                      [{item.hotkey}]
                    </span>
                  )}
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}
