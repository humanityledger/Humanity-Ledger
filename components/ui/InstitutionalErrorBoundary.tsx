"use client";

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  moduleName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * InstitutionalErrorBoundary
 * 
 * A robust, high-fidelity error boundary designed for the System Terminal.
 * Prevents local module failures from crashing the entire session.
 * Features an "Aztec Brutalist" fallback UI with a localized reset trigger.
 */
export class InstitutionalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[Term-Error-Node]: ${this.props.moduleName || 'Global'} Failure`, error, errorInfo);

    //  ChunkLoadError Recovery 
    // Stale Next.js chunks (after a new deployment) cause 404s on old chunk
    // hashes. The only fix is a hard reload to get the fresh HTML + manifest.
    const isChunkError =
      error?.name === 'ChunkLoadError' ||
      error?.message?.includes('Loading chunk') ||
      error?.message?.includes('Failed to fetch dynamically imported module') ||
      error?.message?.includes('Importing a module script failed');

    if (isChunkError) {
      const reloadKey = 'inst_chunk_reload_attempted';
      try {
        if (!sessionStorage.getItem(reloadKey)) {
          sessionStorage.setItem(reloadKey, '1');
          console.warn('[InstitutionalErrorBoundary] ChunkLoadError  reloading to fetch fresh chunks.');
          window.location.reload();
        } else {
          sessionStorage.removeItem(reloadKey);
        }
      } catch {}
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full min-h-0 overflow-hidden flex flex-col items-center justify-center p-8 bg-[#FFFFFF] border-2 border-dashed border-black/10 rounded-2xl">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-[#FF3B30]/10 blur-2xl rounded-full" />
            <div className="relative p-4 bg-white border border-[#FF3B30]/30 rounded-full">
              <ShieldAlert size={32} className="text-[#FF3B30]" />
            </div>
          </div>
          
          <h2 className="text-[14px] font-black uppercase tracking-[0.2em] text-[#050505] mb-2 text-center">
            Something went wrong
          </h2>
          <p className="text-[10px] font-mono text-[#888888] uppercase tracking-widest mb-2 text-center max-w-sm leading-relaxed">
            {this.props.moduleName
              ? `The "${this.props.moduleName}" module failed to load.`
              : 'This module failed to load.'} Please try again.
          </p>
          
          <div className="w-full max-w-lg mb-6 p-4 bg-[#FF3B30]/5 border border-[#FF3B30]/20 rounded-xl overflow-auto max-h-[200px] text-left">
            <p className="text-[#FF3B30] font-mono text-[11px] font-bold mb-2">Error Message:</p>
            <p className="text-[#FF3B30]/80 font-mono text-[10px] whitespace-pre-wrap">
              {this.state.error?.message || 'Unknown Error'}
            </p>
            {this.state.error?.stack && (
              <>
                <p className="text-[#FF3B30] font-mono text-[11px] font-bold mt-4 mb-2">Stack Trace:</p>
                <p className="text-[#FF3B30]/60 font-mono text-[9px] whitespace-pre-wrap break-all">
                  {this.state.error.stack}
                </p>
              </>
            )}
          </div>
          
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2.5 px-6 py-3 bg-white text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl hover:scale-105 active:scale-95 transition-all shadow-xl shadow-black/10"
          >
            <RefreshCw size={14} /> Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
