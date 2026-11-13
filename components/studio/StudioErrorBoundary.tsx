'use client';

/**
 * Keeps a Studio failure inside Studio: the route and Ledger Chat stay usable.
 * Retry remounts Studio; after a second failure the person may also reset
 * this wallet's Studio data on this device (local chats only, never the
 * wallet or Ledger Chat), which clears anything an older build left corrupted.
 */
import React from 'react';

interface Props {
  wallet: string;
  onExit: () => void;
  children: React.ReactNode;
}

interface State {
  error: Error | null;
  failures: number;
  attempt: number;
  resetting: boolean;
}

export class StudioErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, failures: 0, attempt: 0, resetting: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[Ledger Studio] crashed:', error);
    this.setState((s) => ({ failures: s.failures + 1 }));
  }

  private retry = () => this.setState((s) => ({ error: null, attempt: s.attempt + 1 }));

  private reset = async () => {
    this.setState({ resetting: true });
    try {
      const { createStudioStore } = await import('@/lib/studio/store');
      await createStudioStore(this.props.wallet).wipe();
    } catch { /* nothing more to clear */ }
    this.setState((s) => ({ error: null, failures: 0, attempt: s.attempt + 1, resetting: false }));
  };

  render() {
    const { error, failures, attempt, resetting } = this.state;
    if (!error) return <React.Fragment key={attempt}>{this.props.children}</React.Fragment>;
    return (
      <div role="alert" className="h-full min-h-[100dvh] flex items-center justify-center bg-white px-6">
        <div className="max-w-[420px] w-full text-center">
          <p className="text-[17px] font-semibold text-[#15171c]">Ledger Studio could not open</p>
          <p className="mt-2 text-[14px] text-[#4a505c] leading-relaxed">Something went wrong while loading Studio. Your chats in Ledger Chat are not affected.</p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <button type="button" onClick={this.retry} className="h-10 px-4 rounded-xl bg-[#15171c] text-white text-[14px] font-semibold">Retry</button>
            <button type="button" onClick={this.props.onExit} className="h-10 px-4 rounded-xl bg-[#eff1f4] text-[#15171c] text-[14px] font-semibold">Back to chat</button>
          </div>
          {failures >= 2 && (
            <div className="mt-6 rounded-xl border border-[#f3d4d0] bg-[#fdf3f2] p-4 text-left">
              <p className="text-[13px] text-[#7a2d24] leading-relaxed">Still failing? Reset Studio on this device. This deletes the Studio chats, files and settings saved in this browser for this wallet. Ledger Chat and your wallet are not touched.</p>
              <button type="button" disabled={resetting} onClick={this.reset} className="mt-3 h-9 px-3 rounded-lg bg-[#c0392b] text-white text-[13px] font-semibold disabled:opacity-50">
                {resetting ? 'Resetting…' : 'Reset Studio on this device'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }
}
