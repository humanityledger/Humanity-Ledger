"use client";

import { motion, AnimatePresence } from 'framer-motion';
import { create } from 'zustand';
import { ShieldAlert, Zap } from 'lucide-react';

export type Toast = {
  id: string;
  title: string;
  message: string;
  type?: 'success' | 'alert' | 'error';
};

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 5000);
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export function PremiumToasts() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className={`pointer-events-auto flex items-center gap-4 px-6 py-4 rounded-sm border shadow-[0_0_30px_rgba(0,0,0,0.8)] backdrop-blur-xl ${
              toast.type === 'alert'
                ? 'bg-rose-500/10 border-rose-500/50 text-rose-500'
                : 'bg-white/95 border-[#e0ff00]/20 text-[#e0ff00] ring-1 ring-[#e0ff00]/10'
            }`}
            onClick={() => removeToast(toast.id)}
          >
            {toast.type === 'alert' ? <ShieldAlert size={18} /> : <Zap size={18} />}
            <div className="flex flex-col">
                <span className="text-[10px] font-black tracking-widest uppercase flex items-center gap-2">
                  {toast.type !== 'alert' && <div className="w-1.5 h-1.5 rounded-full bg-[#e0ff00] animate-pulse" />}
                  {toast.title}
                </span>
                <span className="text-xs font-mono font-medium text-white/60 mt-0.5">{toast.message}</span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
