'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { X, Shield, Camera, Upload, Loader2, CheckCircle } from 'lucide-react';
import jsQR from 'jsqr';
import { useSecureCamera } from '@/hooks/useSecureCamera';
import { useSystemAccount } from '@/hooks/useSystemAccount';
import { useAppKit } from '@reown/appkit/react';
import { ATOM_PNGTREE } from '@/lib/constants/systemAssets';
import { parseScanPayload } from '@/lib/scan/parseScanPayload';
import { completeSessionHandshake } from '@/lib/scan/sessionHandshake';
import { useSignMessage, useAccount } from 'wagmi';

const VIEWFINDER_SIZE = 240;

async function scanFileForQR(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('No context'));
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });
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

function ScanLine({ active }: { active: boolean }) {
  if (!active) return null;
  const path = `M 0 0 L ${VIEWFINDER_SIZE} 0 L ${VIEWFINDER_SIZE} ${VIEWFINDER_SIZE} L 0 ${VIEWFINDER_SIZE} Z`;
  const PERIMETER = VIEWFINDER_SIZE * 4;
  return (
    <svg
      className="absolute pointer-events-none"
      style={{
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: VIEWFINDER_SIZE,
        height: VIEWFINDER_SIZE,
        zIndex: 20,
      }}
      viewBox={`0 0 ${VIEWFINDER_SIZE} ${VIEWFINDER_SIZE}`}
    >
      <path d={path} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={3} />
      <path
        d={path}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={3}
        strokeDasharray={`${PERIMETER * 0.22} ${PERIMETER * 0.78}`}
        style={{ animation: `qr-perimeter-scan 1.8s linear infinite` }}
      />
      <style>{`@keyframes qr-perimeter-scan { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -${PERIMETER}; } }`}</style>
    </svg>
  );
}

export type UniversalScanMode = 'universal' | 'session-only';

interface UniversalScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  address?: string;
  mode?: UniversalScanMode;
  initialScanData?: string | null;
  onScan?: (data: string) => void;
}

export default function UniversalScanModal({
  isOpen,
  onClose,
  address: externalAddress,
  mode = 'universal',
  initialScanData,
  onScan,
}: UniversalScanModalProps) {
  const router = useRouter();
  const { address } = useSystemAccount();
  const { open: openAppKit } = useAppKit();
  const { signMessageAsync } = useSignMessage();
  const { connector } = useAccount();
  const [status, setStatus] = useState<'idle' | 'scanning' | 'pin_required' | 'verifying_pin' | 'success' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState('');
  const [needsWallet, setNeedsWallet] = useState(false);
  const [successLabel, setSuccessLabel] = useState('Done');
  const [tab, setTab] = useState<'camera' | 'file'>('camera');
  const [fileLoading, setFileLoading] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinScanData, setPinScanData] = useState<string | null>(null);
  const pinInputRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  const addressRef = useRef(address || externalAddress);
  const onCloseRef = useRef(onClose);
  const onScanRef = useRef(onScan);
  const hasScannedRef = useRef(false);
  const firstFrameRef = useRef(false); // transitions idle → scanning on first camera frame
  const handleRouteRef = useRef<(text: string) => Promise<void>>(async () => {});
  // Stores the raw QR data so we can auto-retry the handshake after wallet connect
  const lastScanDataRef = useRef<string | null>(null);

  useEffect(() => {
    addressRef.current = address || externalAddress;
  }, [address, externalAddress]);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const getAddress = useCallback(() => {
    if (addressRef.current) return addressRef.current;
    if (typeof document !== 'undefined') {
      const m = document.cookie.match(/system_handshake=(0x[a-fA-F0-9]{40})/i);
      return m?.[1] ?? null;
    }
    return null;
  }, []);

  const stopCameraRef = useRef<() => void>(() => {});

  const destroyScanner = useCallback(async () => {
    hasScannedRef.current = false;
    firstFrameRef.current = false;
    stopCameraRef.current();
  }, []);

  const handleDecoded = useCallback(
    async (decodedText: string) => {
      if (hasScannedRef.current) return;
      hasScannedRef.current = true;
      await destroyScanner();
      setStatus('scanning');

      // Store raw data so we can retry after wallet connect
      lastScanDataRef.current = decodedText;

      const route =
        mode === 'session-only'
          ? parseScanPayload(decodedText).type === 'session'
            ? { type: 'session' as const, raw: decodedText }
            : { type: 'unknown' as const, raw: decodedText }
          : parseScanPayload(decodedText);

      try {
        if (route.type === 'session') {
          // [VISUAL PIN] For QR session handshakes, require PIN before completing
          setPinScanData(decodedText);
          setPinInput('');
          setStatus('pin_required');
          return; // don't call completeSessionHandshake yet — wait for PIN
        } else if (mode === 'session-only') {
          setErrMsg(
            'This code is not a desktop session QR. On the mobile home screen use “Scan label” for product URLs, wallet codes, or GS1 links.'
          );
          setStatus('error');
          hasScannedRef.current = false;
          return;
        } else if (route.type === 'wallet' && route.walletAddress) {
          setSuccessLabel('Opening chat');
          sessionStorage.setItem('ledger_scan_peer', route.walletAddress.toLowerCase());
          onScanRef.current?.(decodedText);
          setStatus('success');
          setTimeout(() => {
            onCloseRef.current();
            router.push('/chat');
          }, 900);
          return;
        } else if (route.type === 'passport' && route.slug) {
          setSuccessLabel('Opening passport');
          setStatus('success');
          setTimeout(() => {
            onCloseRef.current();
            router.push(`/passport/${route.slug}`);
          }, 700);
          return;
        } else if (route.type === 'gs1' && route.gtin) {
          const res = await fetch(`/api/passport/resolve?url=${encodeURIComponent(decodedText)}`);
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            setErrMsg((body as { error?: string }).error || 'No product passport is mapped to this GS1 code yet.');
            setStatus('error');
            hasScannedRef.current = false;
            return;
          }
          const data = await res.json();
          setSuccessLabel('Opening passport');
          setStatus('success');
          setTimeout(() => {
            onCloseRef.current();
            router.push(`/passport/${data.slug}`);
          }, 700);
          return;
        } else {
          setErrMsg(
            'This code is not supported yet. Try a desktop session QR, wallet address, product label URL, or GS1 Digital Link.'
          );
          setStatus('error');
          hasScannedRef.current = false;
          return;
        }

        setStatus('success');
        onScanRef.current?.(decodedText);
        setTimeout(() => onCloseRef.current(), 1400);
      } catch {
        setErrMsg('Something went wrong. Please try again.');
        setStatus('error');
        hasScannedRef.current = false;
      }
    },
    [destroyScanner, getAddress, mode, router]
  );

  useEffect(() => {
    handleRouteRef.current = handleDecoded;
  }, [handleDecoded]);

  const { videoRef, canvasRef, error: camError, startCamera, stopCamera } = useSecureCamera({
    facingMode: 'environment',
    onFrame: useCallback((canvas: HTMLCanvasElement) => {
      if (hasScannedRef.current) return;
      // Transition idle → scanning on first frame so the overlay shows camera is active
      if (!firstFrameRef.current) {
        firstFrameRef.current = true;
        setStatus(prev => prev === 'idle' ? 'scanning' : prev);
      }
      if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        const BarcodeDetectorCtor = (window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => { detect: (c: HTMLCanvasElement) => Promise<Array<{ rawValue?: string }>> } }).BarcodeDetector;
        const barcodeDetector = new BarcodeDetectorCtor({ formats: ['qr_code'] });
        barcodeDetector
          .detect(canvas)
          .then((barcodes) => {
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
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });
        if (code?.data && !hasScannedRef.current) {
          handleRouteRef.current(code.data);
        }
      } catch {
        /* frame */
      }
    }, []),
  });

  stopCameraRef.current = stopCamera;

  const initScanner = useCallback(async () => {
    setStatus('idle'); // Keep 'idle' while camera is starting
    await startCamera();
    // Status will move to 'scanning' once the frame loop fires
    // This prevents the overlay from disappearing before camera is ready
  }, [startCamera]);

  useEffect(() => {
    if (!isOpen) {
      destroyScanner();
      setStatus('idle');
      setErrMsg('');
      setNeedsWallet(false);
      setTab('camera');
      setPinInput('');
      setPinScanData(null);
      return;
    }
    if (initialScanData) {
      handleDecoded(initialScanData);
      return;
    }
    const t = setTimeout(() => initScanner(), 350);
    return () => {
      clearTimeout(t);
      destroyScanner();
    };
  }, [isOpen, initialScanData, destroyScanner, initScanner, handleDecoded]);

  const handshakeCleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => { return () => { handshakeCleanupRef.current?.(); }; }, []);

  // Handle PIN submission after QR scan
  const handlePinConfirm = useCallback(async () => {
    if (pinInput.length !== 4 || !pinScanData) return;
    setStatus('verifying_pin');
    try {
      setSuccessLabel('Session linked');
      const result = await completeSessionHandshake(pinScanData, getAddress, signMessageAsync, connector, pinInput);
      if (!result.ok) {
        setErrMsg(result.message);
        if ('needsWallet' in result && result.needsWallet) {
          setNeedsWallet(true);
        }
        setStatus('error');
        hasScannedRef.current = false;
        return;
      }
      if (result.ok && result.cleanup) handshakeCleanupRef.current = result.cleanup;
      setStatus('success');
      onScanRef.current?.(pinScanData);
      setTimeout(() => onCloseRef.current(), 1400);
    } catch {
      setErrMsg('PIN verification failed. Please check the code and try again.');
      setStatus('error');
      hasScannedRef.current = false;
    }
  }, [pinInput, pinScanData, getAddress, signMessageAsync, connector]);

  useEffect(() => {
    if (!isOpen) return;
    if (tab === 'file') {
      stopCamera();
      setStatus('idle');
    } else {
      const t = setTimeout(() => initScanner(), 300);
      return () => clearTimeout(t);
    }
  }, [tab, isOpen, initScanner, stopCamera]);

  useEffect(() => {
    if (camError && tab === 'camera') {
      setErrMsg(camError);
      setStatus('error');
    }
  }, [camError, tab]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // [SECURITY] Reject oversized images to prevent OOM
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
    if (file.size > MAX_FILE_SIZE) {
      setErrMsg('Image too large. Please use a file smaller than 10 MB.');
      setStatus('error');
      e.target.value = '';
      return;
    }

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

  const title = mode === 'session-only' ? 'Link session' : 'Scan';
  const hint =
    mode === 'session-only'
      ? 'Point at the desktop session QR to link your phone.'
      : 'Scan a session QR, wallet code, product label, or GS1 link.';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-[#FFFFFF] overflow-y-auto py-[calc(2.5rem+env(safe-area-inset-top))] pb-[calc(2.5rem+env(safe-area-inset-bottom))]"
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute top-[calc(1.5rem+env(safe-area-inset-top))] right-6 p-3 rounded-full bg-black/5 text-black/60 z-50 border border-black/10"
            aria-label="Close"
          >
            <X size={22} />
          </button>

          <div className="w-full max-w-sm flex flex-col items-center px-6">
            <div className="flex flex-col items-center gap-3 mb-6">

              <h2 className="text-xl font-black uppercase tracking-tighter">{title}</h2>
            </div>

            <div className="w-full flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setTab('camera')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                  tab === 'camera' ? 'bg-white text-white' : 'bg-white text-black/40 border-black/10'
                }`}
              >
                <Camera size={13} /> Camera
              </button>
              <button
                type="button"
                onClick={() => setTab('file')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                  tab === 'file' ? 'bg-white text-white' : 'bg-white text-black/40 border-black/10'
                }`}
              >
                <Upload size={13} /> Gallery
              </button>
            </div>

            <div className="relative w-full min-h-[320px] bg-white border border-black/8 rounded-[28px] overflow-hidden shadow-2xl flex flex-col">
              
              {status === 'pin_required' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-30 p-6 gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-black flex items-center justify-center mb-1 flex-shrink-0">
                    <Shield className="text-white" size={26} />
                  </div>
                  <p className="text-[13px] font-black uppercase tracking-widest text-black text-center leading-tight">
                    Visual PIN
                  </p>
                  <p className="text-[10px] text-black/50 text-center max-w-[220px] leading-relaxed">
                    Enter the 4-digit code displayed on your desktop screen
                  </p>
                  {/* 4-box PIN input */}
                  <div className="flex gap-3 mt-1">
                    {[0,1,2,3].map((i) => (
                      <input
                        key={i}
                        ref={pinInputRefs[i]}
                        id={`pin-digit-${i}`}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={pinInput[i] || ''}
                        className="w-12 h-14 text-center text-xl font-black bg-black/5 border-2 border-black/10 rounded-xl focus:outline-none focus:border-black transition-all"
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          const next = (pinInput.split(''));
                          next[i] = val.slice(-1);
                          const newPin = next.join('');
                          setPinInput(newPin);
                          if (val && i < 3) pinInputRefs[i + 1].current?.focus();
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Backspace' && !pinInput[i] && i > 0) {
                            pinInputRefs[i - 1].current?.focus();
                          }
                        }}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={handlePinConfirm}
                    disabled={pinInput.length < 4}
                    className="mt-2 px-8 py-3 bg-black text-white text-[10px] font-black uppercase tracking-widest rounded-full disabled:opacity-30 transition-opacity"
                  >
                    Confirm & Link
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      hasScannedRef.current = false;
                      setPinInput('');
                      setPinScanData(null);
                      setStatus('idle');
                      initScanner();
                    }}
                    className="text-[9px] text-black/40 underline"
                  >
                    Cancel, re-scan
                  </button>
                </div>
              )}
              {status === 'verifying_pin' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 z-30 gap-3">
                  <Loader2 className="animate-spin text-black" size={28} />
                  <p className="text-[10px] font-black uppercase tracking-widest text-black/60">
                    Verifying PIN…
                  </p>
                </div>
              )}
              {status === 'success' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 z-30 gap-2">
                  <CheckCircle className="text-[#050505]" size={40} />
                  <p className="text-[11px] font-black uppercase tracking-widest text-[#050505]">{successLabel}</p>
                </div>
              )}
              {status === 'error' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-30 p-6 text-center gap-3">
                  <Shield className="text-red-500 mx-auto" size={28} />
                  <p className="text-[11px] font-black uppercase tracking-widest text-red-600 leading-relaxed">{errMsg}</p>
                  {needsWallet ? (
                    <>
                      <button
                        type="button"
                        onClick={async () => {
                          // Open wallet selector — once connected, auto-retry the handshake
                          openAppKit();
                          // Poll briefly for a wallet address to appear after connecting
                          let attempts = 0;
                          const poll = setInterval(async () => {
                            attempts++;
                            const currentAddr = addressRef.current;
                            if (currentAddr && lastScanDataRef.current) {
                              clearInterval(poll);
                              setErrMsg('');
                              setNeedsWallet(false);
                              hasScannedRef.current = false;
                              await handleRouteRef.current(lastScanDataRef.current);
                            } else if (attempts > 60) {
                              clearInterval(poll);
                            }
                          }, 1000);
                        }}
                        className="text-[9px] font-black uppercase px-6 py-2.5 bg-black text-white rounded-full mt-1"
                      >
                        Connect Wallet
                      </button>
                      <p className="text-[9px] text-black/40">Connect your wallet to link the session.</p>
                    </>
                  ) : (
                    <>
                      <a href="/privacy#qr-sync" className="text-[10px] underline text-black/50">
                        What codes are supported?
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          hasScannedRef.current = false;
                          firstFrameRef.current = false;
                          setErrMsg('');
                          setNeedsWallet(false);
                          initScanner();
                        }}
                        className="text-[9px] font-black uppercase px-6 py-2 bg-black text-white rounded-full mt-2"
                      >
                        Retry
                      </button>
                    </>
                  )}
                </div>
              )}

              {tab === 'camera' && (
                <div className="relative w-full flex-1 min-h-[300px] bg-black">
                  <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" autoPlay playsInline muted />
                  {/* Canvas must NOT be display:none — hidden prevents pixel reads in some browsers */}
                  <canvas ref={canvasRef} className="absolute opacity-0 pointer-events-none" style={{ width: 1, height: 1, top: 0, left: 0 }} />
                  <ScanLine active={status === 'scanning'} />
                  {status === 'idle' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10">
                      <Loader2 className="animate-spin text-white mb-2" size={28} />
                      <span className="text-[10px] font-black uppercase tracking-widest text-white/90">
                        Starting camera…
                      </span>
                    </div>
                  )}
                </div>
              )}
              {tab === 'file' && (
                <div className="flex flex-col items-center justify-center flex-1 p-6 gap-4">
                  <label className="cursor-pointer flex items-center gap-2 px-6 py-3 bg-white text-white text-[10px] font-black uppercase rounded-xl">
                    {fileLoading ? <Loader2 className="animate-spin" size={13} /> : <Upload size={13} />}
                    Select image
                    <input type="file" accept="image/*" className="sr-only" onChange={handleFileChange} disabled={fileLoading} />
                  </label>
                </div>
              )}
            </div>

            <p className="mt-5 text-[11px] text-center text-black/50 font-medium max-w-[280px] leading-relaxed">{hint}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
