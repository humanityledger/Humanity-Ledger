"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertOctagon, RotateCcw, Wifi } from "lucide-react";

interface Props {
  children?: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  online: boolean;
}

export class DashboardErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
  };

  //  Network recovery listeners 
  private handleOnline = () => {
    this.setState({ online: true });
    // If we were in an error state due to network, auto-reset so the
    // child component remounts and retries its data fetch.
    if (this.state.hasError) {
      console.log("[DashboardErrorBoundary] Network restored  auto-recovering panel");
      this.setState({ hasError: false, error: null });
    }
  };
  private handleOffline = () => this.setState({ online: false });

  public componentDidMount() {
    window.addEventListener("online",  this.handleOnline);
    window.addEventListener("offline", this.handleOffline);
  }

  public componentWillUnmount() {
    window.removeEventListener("online",  this.handleOnline);
    window.removeEventListener("offline", this.handleOffline);
  }

  //  Reset when parent gives us a new key (tab switch) 
  public componentDidUpdate(prevProps: Props) {
    // If children changed identity (parent used key= trick), clear the error
    if (prevProps.children !== this.props.children && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[DashboardErrorBoundary] Panel fault:", error.message, errorInfo.componentStack?.slice(0, 300));

    //  ChunkLoadError Recovery 
    // When Next.js deploys a new build, old chunk hashes become 404s. The only
    // correct fix is a hard reload to fetch the current HTML + chunk manifest.
    // We guard with sessionStorage to avoid infinite reload loops.
    const isChunkError =
      error?.name === 'ChunkLoadError' ||
      error?.message?.includes('Loading chunk') ||
      error?.message?.includes('Failed to fetch dynamically imported module') ||
      error?.message?.includes('Importing a module script failed');

    if (isChunkError) {
      const reloadKey = 'chunk_reload_attempted';
      try {
        if (!sessionStorage.getItem(reloadKey)) {
          sessionStorage.setItem(reloadKey, '1');
          console.warn('[DashboardErrorBoundary] ChunkLoadError detected  reloading page to fetch fresh chunks.');
          window.location.reload();
        } else {
          // Second failure after reload  clear flag so next session tries again
          sessionStorage.removeItem(reloadKey);
        }
      } catch {}
    }
  }

  public render() {
    const { hasError, error, online } = this.state;

    if (!online && !hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-[#FFFFFF] border border-[#E5E5E5] rounded-[2rem]">
          <div className="flex bg-[#F7931A]/10 p-4 rounded-full mb-4">
            <Wifi size={32} className="text-[#F7931A]" />
          </div>
          <h2 className="text-sm font-black text-[#050505] tracking-tight mb-2">Node Operational · Waiting</h2>
          <p className="text-[10px] font-bold text-[#888888] uppercase tracking-widest text-center max-w-sm leading-relaxed">
            Network connection lost. Module will auto-recover when connectivity is restored.
          </p>
        </div>
      );
    }

    if (hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-[#FFFFFF] border border-[#E5E5E5] rounded-[2rem]">
          <div className="flex bg-[#FF3B30]/10 p-4 rounded-full mb-4">
            <AlertOctagon size={32} className="text-[#FF3B30]" />
          </div>
          <h2 className="text-sm font-black text-[#050505] tracking-tight mb-2">Module Execution Failure</h2>
          <p className="text-[10px] font-bold text-[#888888] uppercase tracking-widest text-center max-w-sm mb-6 leading-relaxed">
            {this.props.fallbackMessage ||
              "A critical fault occurred within this terminal module. The integrity of the application ring-fenced this failure to prevent system-wide collapse."}
          </p>

          {error && (
            <div className="w-full max-w-lg bg-white border border-[#E5E5E5] rounded-xl p-4 mb-6 overflow-x-auto">
              <pre className="text-[9px] font-mono font-bold text-[#FF3B30] whitespace-pre-wrap">
                {error.toString()}
              </pre>
            </div>
          )}

          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-white text-white text-[10px] font-black uppercase tracking-widest hover:bg-[#333] transition-all"
          >
            <RotateCcw size={14} />
            Reboot Interface
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
