'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Upload, Loader2, CheckCircle, Shield, RotateCcw, ArrowLeft } from 'lucide-react';
import jsQR from 'jsqr';
import { useSecureCamera } from '@/hooks/useSecureCamera';
import { useSystemAccount } from '@/hooks/useSystemAccount';
import { useAppKit } from '@reown/appkit/react';
import { parseScanPayload } from '@/lib/scan/parseScanPayload';
import { completeSessionHandshake } from '@/lib/scan/sessionHandshake';
import { useSignMessage, useAccount } from 'wagmi';

const VIEWFINDER_SIZE = 240;

async function scanFileForQR(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('No context'));
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
        if (code) resolve(code.data);
        else reject(new Error('No QR code found'));
      };
      img.onerror = () => reject(new Error('Image load error'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsDataURL(file);
  });
}

function ViewfinderOverlay({ active }: { active: boolean }) {
  if (!active) return null;
  const PERIMETER = VIEWFINDER_SIZE * 4;
  const cornerLen = 28;
  return (
    <svg
      className="absolute pointer-events-none"
      style={{
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: VIEWFINDER_SIZE, height: VIEWFINDER_SIZE,
        zIndex: 20,
        filter: 'drop-shadow(0 0 6px rgba(0,0,0,0.18))',
      }}
      viewBox={`0 0 ${VIEWFINDER_SIZE} ${VIEWFINDER_SIZE}`}
    >
      {/* Corner marks — black on white camera feed */}
      {[
        `M 0 ${cornerLen} L 0 0 L ${cornerLen} 0`,
        `M ${VIEWFINDER_SIZE - cornerLen} 0 L ${VIEWFINDER_SIZE} 0 L ${VIEWFINDER_SIZE} ${cornerLen}`,
        `M 0 ${VIEWFINDER_SIZE - cornerLen} L 0 ${VIEWFINDER_SIZE} L ${cornerLen} ${VIEWFINDER_SIZE}`,
        `M ${VIEWFINDER_SIZE - cornerLen} ${VIEWFINDER_SIZE} L ${VIEWFINDER_SIZE} ${VIEWFINDER_SIZE} L ${VIEWFINDER_SIZE} ${VIEWFINDER_SIZE - cornerLen}`,
      ].map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#050505" strokeWidth={3} strokeLinecap="round" />
      ))}
      {/* Animated scanning beam */}
      <rect
        x="0" y="0"
        width={VIEWFINDER_SIZE}
        height={2}
        fill="rgba(0,0,0,0.35)"
        style={{ animation: `scan-beam 1.8s ease-in-out infinite` }}
      />
      <style>{`
        @keyframes scan-beam {
          0%   { transform: translateY(0px); opacity: 1; }
          48%  { transform: translateY(${VIEWFINDER_SIZE}px); opacity: 0.6; }
          50%  { transform: translateY(${VIEWFINDER_SIZE}px); opacity: 0; }
          52%  { transform: translateY(0px); opacity: 0; }
          54%  { opacity: 1; }
          100% { transform: translateY(${VIEWFINDER_SIZE}px); opacity: 0.6; }
        }
      `}</style>
    </svg>
  );
}

export default function ScanPage() {
  const router = useRouter();
  const { address } = useSystemAccount();
  const { open: openAppKit } = useAppKit();
  const { signMessageAsync } = useSignMessage();
  const { connector } = useAccount();

  type ScanStatus = 'starting' | 'scanning' | 'pin_required' | 'verifying_pin' | 'success' | 'error' | 'denied';
  const [status, setStatus] = useState<ScanStatus>('starting');
  const [tab, setTab] = useState<'camera' | 'file'>('camera');
  const [errMsg, setErrMsg] = useState('');
  const [needsWallet, setNeedsWallet] = useState(false);
  const [successLabel, setSuccessLabel] = useState('Done');
  const [fileLoading, setFileLoading] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinScanData, setPinScanData] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const pinInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];
  const hasScannedRef    = useRef(false);
  const firstFrameRef    = useRef(false);
  const addressRef       = useRef(address);
  const lastScanDataRef  = useRef<string | null>(null);
  const handleRouteRef   = useRef<(text: string) => Promise<void>>(async () => {});
  const stopCameraRef    = useRef<() => void>(() => {});

  useEffect(() => { addressRef.current = address; }, [address]);
  useEffect(() => { setMounted(true); }, []);

  const getAddress = useCallback(() => {
    if (addressRef.current) return addressRef.current;
    if (typeof document !== 'undefined') {
      const m = document.cookie.match(/system_handshake=(0x[a-fA-F0-9]{40})/i);
      return m?.[1] ?? null;
    }
    return null;
  }, []);

  const handleDecoded = useCallback(async (decodedText: string) => {
    if (hasScannedRef.current) return;
    hasScannedRef.current = true;
    stopCameraRef.current();
    setStatus('scanning');
    lastScanDataRef.current = decodedText;

    const route = parseScanPayload(decodedText);
    try {
      if (route.type === 'session') {
        setPinScanData(decodedText);
        setPinInput('');
        setStatus('pin_required');
        return;
      } else if (route.type === 'wallet' && route.walletAddress) {
        setSuccessLabel('Opening Chat');
        sessionStorage.setItem('ledger_scan_peer', route.walletAddress.toLowerCase());
        setStatus('success');
        setTimeout(() => router.push('/chat'), 900);
        return;
      } else if (route.type === 'passport' && route.slug) {
        setSuccessLabel('Opening Passport');
        setStatus('success');
        setTimeout(() => router.push(`/passport/${route.slug}`), 700);
        return;
      } else if (route.type === 'gs1' && route.gtin) {
        const res = await fetch(`/api/passport/resolve?url=${encodeURIComponent(decodedText)}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setErrMsg((body as { error?: string }).error || 'No product passport mapped to this GS1 code.');
          setStatus('error');
          hasScannedRef.current = false;
          return;
        }
        const data = await res.json();
        setSuccessLabel('Opening Passport');
        setStatus('success');
        setTimeout(() => router.push(`/passport/${data.slug}`), 700);
        return;
      } else {
        setErrMsg('QR code not recognized. Try a session QR, wallet address, product label, or GS1 link.');
        setStatus('error');
        hasScannedRef.current = false;
      }
    } catch {
      setErrMsg('Something went wrong. Please try again.');
      setStatus('error');
      hasScannedRef.current = false;
    }
  }, [router]);

  useEffect(() => { handleRouteRef.current = handleDecoded; }, [handleDecoded]);

  const { videoRef, canvasRef, error: camError, startCamera, stopCamera } = useSecureCamera({
    facingMode: 'environment',
    onFrame: useCallback((canvas: HTMLCanvasElement) => {
      if (hasScannedRef.current) return;
      if (!firstFrameRef.current) {
        firstFrameRef.current = true;
        setStatus(prev => prev === 'starting' ? 'scanning' : prev);
      }
      if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        const BD = (window as any).BarcodeDetector;
        new BD({ formats: ['qr_code'] })
          .detect(canvas)
          .then((barcodes: Array<{ rawValue?: string }>) => {
            if (barcodes.length > 0 && barcodes[0].rawValue && !hasScannedRef.current) {
              handleRouteRef.current(barcodes[0].rawValue);
            }
          })
          .catch(() => {});
      }
      try {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
        if (code?.data && !hasScannedRef.current) handleRouteRef.current(code.data);
      } catch { /* frame */ }
    }, []),
  });

  stopCameraRef.current = stopCamera;

  const initScanner = useCallback(async () => {
    hasScannedRef.current = false;
    firstFrameRef.current = false;
    setStatus('starting');
    setErrMsg('');
    await startCamera();
  }, [startCamera]);

  useEffect(() => {
    if (camError && tab === 'camera') {
      const isDenied = /denied|permission|not allowed/i.test(camError);
      setStatus(isDenied ? 'denied' : 'error');
      if (!isDenied) setErrMsg(camError);
    }
  }, [camError, tab]);

  useEffect(() => {
    if (!mounted) return;
    const t = setTimeout(() => initScanner(), 300);
    return () => { clearTimeout(t); stopCamera(); };
  }, [mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mounted) return;
    if (tab === 'file') { stopCamera(); setStatus('starting'); }
    else { initScanner(); }
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePinConfirm = useCallback(async () => {
    if (pinInput.length !== 4 || !pinScanData) return;
    setStatus('verifying_pin');
    try {
      const result = await completeSessionHandshake(pinScanData, getAddress, signMessageAsync, connector, pinInput);
      if (!result.ok) {
        const needsWalletConnect = 'needsWallet' in result && result.needsWallet;
        if (needsWalletConnect) {
          // In incognito/fresh tab: user needs to connect their wallet first.
          // Open AppKit modal automatically so they can sign-in without leaving the page.
          setNeedsWallet(true);
          setErrMsg('Connect your wallet first, then tap "Retry" to complete the QR link.');
          setStatus('error');
          hasScannedRef.current = false;
          // Auto-open wallet connect modal after short delay
          setTimeout(() => openAppKit(), 600);
        } else {
          setErrMsg(result.message);
          setStatus('error');
          hasScannedRef.current = false;
        }
        return;
      }
      setSuccessLabel('Session Linked');
      setStatus('success');
      setTimeout(() => router.push('/chat'), 1400);
    } catch {
      setErrMsg('PIN verification failed. Please check the code shown on the desktop screen and try again.');
      setStatus('error');
      hasScannedRef.current = false;
    }
  }, [pinInput, pinScanData, getAddress, signMessageAsync, connector, router, openAppKit]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileLoading(true);
    try {
      const decoded = await scanFileForQR(file);
      await handleDecoded(decoded);
    } catch {
      setErrMsg('No valid QR code detected in the image.');
      setStatus('error');
      hasScannedRef.current = false;
    } finally {
      setFileLoading(false);
      e.target.value = '';
    }
  };

  const reset = () => {
    hasScannedRef.current = false;
    firstFrameRef.current = false;
    setErrMsg('');
    setNeedsWallet(false);
    setPinInput('');
    setPinScanData(null);
    setTab('camera');
    initScanner();
  };

  const showCameraFeed = tab === 'camera' && !['pin_required','verifying_pin','success','error','denied'].includes(status);

  return (
    <div
      className="fixed inset-0 bg-white flex flex-col overflow-hidden w-full h-[100dvh]"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >

      {/* ── HEADER ── */}
      <header
        className="relative z-30 flex items-center justify-between px-5 bg-white border-b border-black/[0.07]"
        style={{
          minHeight: '56px',
          paddingTop: 'max(env(safe-area-inset-top), 0px)',
        }}
      >
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-[#050505] py-3"
        >
          <ArrowLeft size={18} strokeWidth={2.5} />
          <span className="font-mono text-[10px] font-black uppercase tracking-widest">Back</span>
        </button>

        <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center leading-none py-3">
          <span className="font-mono text-[11px] font-black uppercase tracking-[0.22em] text-[#050505]">Scan QR</span>
          <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-black/30 mt-0.5">Aztec Identity Portal</span>
        </div>

        {/* Logo mark */}
        <div className="w-8 h-8 rounded-lg border border-black/10 bg-black/[0.03] flex items-center justify-center overflow-hidden">
          <img
            src="/logo-mark.png"
            alt="HL"
            className="w-6 h-6 object-contain opacity-70 mix-blend-multiply"
          />
        </div>
      </header>

      {/* ── TAB SWITCHER ── */}
      <div className="relative z-20 flex gap-1.5 px-4 py-3 bg-white border-b border-black/[0.06]">
        {(['camera', 'file'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
              tab === t
                ? 'bg-[#050505] text-white border-[#050505]'
                : 'bg-transparent text-black/40 border-black/10 hover:bg-black/[0.03]'
            }`}
          >
            {t === 'camera' ? <Camera size={12} /> : <Upload size={12} />}
            {t === 'camera' ? 'Camera' : 'Gallery'}
          </button>
        ))}
      </div>

      {/* ── MAIN AREA ── */}
      <div className="flex-1 relative overflow-hidden bg-white flex flex-col items-center justify-center">

        {/* ── CAMERA FEED ── */}
        {tab === 'camera' && (
          <>
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              autoPlay playsInline muted
            />
            <canvas
              ref={canvasRef}
              className="absolute opacity-0 pointer-events-none"
              style={{ width: 1, height: 1, top: 0, left: 0 }}
            />
            {/* Frosted vignette to frame the viewfinder */}
            {showCameraFeed && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `radial-gradient(${VIEWFINDER_SIZE + 20}px ${VIEWFINDER_SIZE + 20}px at 50% 50%, transparent 50%, rgba(255,255,255,0.88) 70%)`,
                }}
              />
            )}
          </>
        )}

        {/* STARTING */}
        {status === 'starting' && tab === 'camera' && (
          <div className="relative z-20 flex flex-col items-center gap-3">
            <Loader2 className="animate-spin text-black/30" size={30} />
            <span className="text-black/40 text-[10px] font-mono uppercase tracking-widest">Starting camera…</span>
          </div>
        )}

        {/* SCANNING — viewfinder with clean white surround */}
        {status === 'scanning' && tab === 'camera' && (
          <div className="relative z-20 flex flex-col items-center gap-6 pointer-events-none">
            <div
              className="relative bg-transparent"
              style={{ width: VIEWFINDER_SIZE, height: VIEWFINDER_SIZE }}
            >
              <ViewfinderOverlay active />
            </div>
            <p className="text-[11px] font-mono text-black/40 uppercase tracking-widest font-bold">
              Point at a QR code
            </p>
          </div>
        )}

        {/* ── CAMERA DENIED ── */}
        {status === 'denied' && (
          <div className="relative z-20 flex flex-col items-center gap-5 px-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#F5F5F5] border border-black/[0.07] flex items-center justify-center">
              <Camera size={28} className="text-black/30" />
            </div>
            <div>
              <p className="text-[#050505] font-black text-[16px] mb-1.5 tracking-tight">Camera Access Denied</p>
              <p className="text-black/40 text-[12px] leading-relaxed max-w-[240px]">
                Allow camera access in your browser settings, then tap Retry.
              </p>
            </div>
            <button
              onClick={reset}
              className="flex items-center gap-2 px-7 py-3 bg-[#050505] text-white text-[10px] font-black uppercase tracking-widest rounded-xl"
            >
              <RotateCcw size={13} /> Retry
            </button>
            <button
              onClick={() => setTab('file')}
              className="text-black/30 text-[10px] font-mono underline"
            >
              Upload a QR image instead
            </button>
          </div>
        )}

        {/* ── ERROR ── */}
        {status === 'error' && (
          <div className="relative z-20 flex flex-col items-center gap-5 px-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
              <Shield size={26} className="text-red-500" />
            </div>
            <div>
              <p className="text-[#050505] font-black text-[15px] mb-1.5 tracking-tight">
                {needsWallet ? 'Wallet Required' : 'Scan Failed'}
              </p>
              <p className="text-black/40 text-[12px] leading-relaxed max-w-[260px]">{errMsg}</p>
            </div>
            {needsWallet ? (
              <div className="flex flex-col gap-3 w-full max-w-[240px]">
                <button
                  onClick={() => openAppKit()}
                  className="w-full px-7 py-3.5 bg-[#050505] text-white text-[10px] font-black uppercase tracking-widest rounded-xl"
                >
                  Connect Wallet
                </button>
                {/* After connecting wallet, allow retrying the PIN without rescanning */}
                {pinScanData && (
                  <button
                    onClick={() => {
                      setNeedsWallet(false);
                      setErrMsg('');
                      setStatus('pin_required');
                      hasScannedRef.current = true; // keep scan data, just re-enter PIN
                    }}
                    className="w-full px-7 py-3 border border-black/15 bg-white text-black/60 text-[10px] font-black uppercase tracking-widest rounded-xl"
                  >
                    Retry with PIN
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={reset}
                className="flex items-center gap-2 px-7 py-3 bg-[#050505] text-white text-[10px] font-black uppercase tracking-widest rounded-xl"
              >
                <RotateCcw size={13} /> Try Again
              </button>
            )}
          </div>
        )}


        {/* ── PIN REQUIRED ── */}
        {status === 'pin_required' && (
          <div className="relative z-20 flex flex-col items-center gap-5 px-8 text-center w-full max-w-sm">
            <div className="w-14 h-14 rounded-2xl bg-[#050505] flex items-center justify-center">
              <Shield size={24} className="text-white" />
            </div>
            <div>
              <p className="text-[#050505] font-black text-[16px] mb-1 tracking-tight">Visual PIN</p>
              <p className="text-black/40 text-[11px] leading-relaxed max-w-[220px]">
                Enter the 4-digit code shown on your desktop screen
              </p>
            </div>
            <div className="flex gap-3">
              {[0,1,2,3].map((i) => (
                <input
                  key={i}
                  ref={pinInputRefs[i]}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={pinInput[i] || ''}
                  className="w-12 h-14 text-center text-xl font-black bg-[#F8F8F8] border-2 border-black/10 rounded-xl focus:outline-none focus:border-[#050505] transition-all text-[#050505] caret-black"
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    const next = pinInput.split('');
                    next[i] = val.slice(-1);
                    setPinInput(next.join(''));
                    if (val && i < 3) pinInputRefs[i + 1].current?.focus();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !pinInput[i] && i > 0) pinInputRefs[i - 1].current?.focus();
                  }}
                />
              ))}
            </div>
            <button
              onClick={handlePinConfirm}
              disabled={pinInput.length < 4}
              className="w-full py-3.5 bg-[#050505] text-white text-[10px] font-black uppercase tracking-widest rounded-xl disabled:opacity-30 transition-opacity"
            >
              Confirm & Link
            </button>
            <button onClick={reset} className="text-black/30 text-[9px] font-mono underline">
              Cancel, re-scan
            </button>
          </div>
        )}

        {/* ── VERIFYING PIN ── */}
        {status === 'verifying_pin' && (
          <div className="relative z-20 flex flex-col items-center gap-4">
            <Loader2 className="animate-spin text-black/40" size={32} />
            <p className="text-black/40 text-[10px] font-mono uppercase tracking-widest">Verifying PIN…</p>
          </div>
        )}

        {/* ── SUCCESS ── */}
        {status === 'success' && (
          <div className="relative z-20 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#F0FDF4] border border-green-200 flex items-center justify-center">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            <p className="text-[#050505] font-black text-[15px] tracking-tight">{successLabel}</p>
          </div>
        )}

        {/* ── FILE / GALLERY TAB ── */}
        {tab === 'file' && !['pin_required','verifying_pin','success','error'].includes(status) && (
          <div className="relative z-20 flex flex-col items-center gap-6 px-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#F5F5F5] border border-black/[0.07] flex items-center justify-center">
              <Upload size={28} className="text-black/30" />
            </div>
            <div>
              <p className="text-[#050505] font-black text-[16px] mb-1 tracking-tight">Upload QR Image</p>
              <p className="text-black/40 text-[12px] leading-relaxed">Select an image containing a QR code</p>
            </div>
            <label className="cursor-pointer flex items-center gap-2 px-8 py-3.5 bg-[#050505] text-white text-[10px] font-black uppercase tracking-widest rounded-xl">
              {fileLoading ? <Loader2 className="animate-spin" size={13} /> : <Upload size={13} />}
              {fileLoading ? 'Scanning…' : 'Choose Image'}
              <input type="file" accept="image/*" className="sr-only" onChange={handleFileChange} disabled={fileLoading} />
            </label>
          </div>
        )}
      </div>

      {/* ── FOOTER ── */}
      <div
        className="relative z-20 bg-white border-t border-black/[0.06] px-6 py-4 flex flex-col items-center gap-1"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
      >
        <p className="text-[9px] font-mono text-black/25 uppercase tracking-[0.25em]">
          humanidfi.com • Aztec Integration Planned
        </p>
      </div>
    </div>
  );
}
