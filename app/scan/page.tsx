'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Upload, Loader2, CheckCircle, Shield, RotateCcw, ArrowLeft, QrCode } from 'lucide-react';
import jsQR from 'jsqr';
import { useSecureCamera } from '@/hooks/useSecureCamera';
import { useSystemAccount } from '@/hooks/useSystemAccount';
import { useAppKit } from '@reown/appkit/react';
import { parseScanPayload } from '@/lib/scan/parseScanPayload';
import { completeSessionHandshake, previewLink } from '@/lib/scan/sessionHandshake';
import { useSignMessage, useAccount } from 'wagmi';

const VIEWFINDER_SIZE = 260;

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
  const cornerLen = 32;
  return (
    <svg
      className="absolute pointer-events-none"
      style={{
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: VIEWFINDER_SIZE, height: VIEWFINDER_SIZE,
        zIndex: 20,
      }}
      viewBox={`0 0 ${VIEWFINDER_SIZE} ${VIEWFINDER_SIZE}`}
    >
      {/* Corner marks — green when active, white otherwise */}
      {[
        `M 0 ${cornerLen} L 0 0 L ${cornerLen} 0`,
        `M ${VIEWFINDER_SIZE - cornerLen} 0 L ${VIEWFINDER_SIZE} 0 L ${VIEWFINDER_SIZE} ${cornerLen}`,
        `M 0 ${VIEWFINDER_SIZE - cornerLen} L 0 ${VIEWFINDER_SIZE} L ${cornerLen} ${VIEWFINDER_SIZE}`,
        `M ${VIEWFINDER_SIZE - cornerLen} ${VIEWFINDER_SIZE} L ${VIEWFINDER_SIZE} ${VIEWFINDER_SIZE} L ${VIEWFINDER_SIZE} ${VIEWFINDER_SIZE - cornerLen}`,
      ].map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#22c55e" strokeWidth={4} strokeLinecap="square" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
      ))}
      
      {/* Animated scanning beam */}
      <rect
        x="10" y="0"
        width={VIEWFINDER_SIZE - 20}
        height={3}
        fill="#22c55e"
        style={{ animation: `scan-beam 2s ease-in-out infinite`, filter: 'drop-shadow(0 0 8px #22c55e)' }}
      />
      <style>{`
        @keyframes scan-beam {
          0%   { transform: translateY(10px); opacity: 1; }
          48%  { transform: translateY(${VIEWFINDER_SIZE - 10}px); opacity: 0.8; }
          50%  { transform: translateY(${VIEWFINDER_SIZE - 10}px); opacity: 0; }
          52%  { transform: translateY(10px); opacity: 0; }
          54%  { opacity: 1; }
          100% { transform: translateY(${VIEWFINDER_SIZE - 10}px); opacity: 0.8; }
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
  const [pinScanData, setPinScanData] = useState<string | null>(null);
  /** The computer asking to be linked, shown before anything happens. */
  const [linkLabel, setLinkLabel] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const hasScannedRef    = useRef(false);
  const firstFrameRef    = useRef(false);
  const addressRef       = useRef(address);
  const lastScanDataRef  = useRef<string | null>(null);
  const handleRouteRef   = useRef<(text: string) => Promise<void>>(async () => {});
  const stopCameraRef    = useRef<() => void>(() => {});

  useEffect(() => { addressRef.current = address; }, [address]);
  useEffect(() => { setMounted(true); }, []);

  // When wallet connects while waiting to authorize desktop session, auto-resume
  useEffect(() => {
    if (address && needsWallet && pinScanData) {
      setNeedsWallet(false);
      setErrMsg('');
      handleRouteRef.current(pinScanData);
    }
  }, [address, needsWallet, pinScanData]);

  // Auto-detect payload from URL query (when scanned with phone's native camera)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const search = new URLSearchParams(window.location.search);
    const pParam = search.get('payload');
    if (pParam) {
      setTimeout(() => handleRouteRef.current(decodeURIComponent(pParam)), 200);
      return;
    }
    if (search.has('s') && search.has('p')) {
      setTimeout(() => handleRouteRef.current(window.location.href), 200);
      return;
    }
  }, []);

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
        // If wallet is not yet connected on mobile browser, prompt wallet connect
        const currentAddr = getAddress();
        if (!currentAddr) {
          setPinScanData(decodedText);
          setNeedsWallet(true);
          setErrMsg('Sign in on this phone with your wallet first. Then the computer can be linked.');
          setStatus('error');
          hasScannedRef.current = false;
          setTimeout(() => openAppKit(), 400);
          return;
        }

        // Never link on scan alone (a code can come from a link someone sent): show which
        // computer is asking and wait for an explicit "Link this computer".
        const preview = await previewLink(decodedText);
        if (!preview.ok) {
          setPinScanData(decodedText);
          if (preview.needsWallet) { setNeedsWallet(true); setTimeout(() => openAppKit(), 400); }
          setErrMsg(preview.message);
          setStatus('error');
          hasScannedRef.current = false;
          return;
        }
        setPinScanData(decodedText);
        setLinkLabel(preview.label);
        setStatus('pin_required');
        return;
      } else if (route.type === 'wallet' && route.walletAddress) {
        setSuccessLabel('Opening Chat');
        sessionStorage.setItem('ledger_scan_peer', route.walletAddress.toLowerCase());
        setStatus('success');
        setTimeout(() => router.push('/chat'), 900);
        return;
      } else {
        setErrMsg('QR code not recognized. Try a session QR or a wallet address.');
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
    if (!pinScanData) return;
    setStatus('verifying_pin');
    try {
      const result = await completeSessionHandshake(pinScanData, getAddress, signMessageAsync, connector);
      if (!result.ok) {
        const needsWalletConnect = 'needsWallet' in result && result.needsWallet;
        if (needsWalletConnect) {
          setNeedsWallet(true);
          setErrMsg('Connect your wallet first, then tap "Retry" to complete the QR link.');
          setStatus('error');
          hasScannedRef.current = false;
          setTimeout(() => openAppKit(), 600);
        } else {
          setErrMsg(result.message);
          setStatus('error');
          hasScannedRef.current = false;
        }
        return;
      }
      setSuccessLabel('Computer linked');
      setStatus('success');
      setTimeout(() => router.push('/chat'), 1400);
    } catch {
      setErrMsg('The computer could not be linked. Refresh the code on the computer and scan it again.');
      setStatus('error');
      hasScannedRef.current = false;
    }
  }, [pinScanData, getAddress, signMessageAsync, connector, router, openAppKit]);

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
    setLinkLabel(null);
    setPinScanData(null);
    setTab('camera');
    initScanner();
  };

  const showCameraFeed = tab === 'camera' && !['pin_required','verifying_pin','success','error','denied'].includes(status);

  return (
    <div
      className="fixed inset-0 bg-[#0A0A0A] flex flex-col overflow-hidden w-full h-[100dvh]"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* ── CAMERA FEED (Background) ── */}
      {tab === 'camera' && (
        <div className="absolute inset-0 z-0">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay playsInline muted
          />
          <canvas
            ref={canvasRef}
            className="absolute opacity-0 pointer-events-none"
            style={{ width: 1, height: 1, top: 0, left: 0 }}
          />
          {/* Signal/WhatsApp style dark overlay mask with transparent center square */}
          {showCameraFeed && (
            <div className="absolute inset-0 pointer-events-none">
               <svg width="100%" height="100%">
                 <defs>
                   <mask id="viewfinder-mask">
                     <rect width="100%" height="100%" fill="white" />
                     <rect 
                       x="50%" y="50%" 
                       width={VIEWFINDER_SIZE} height={VIEWFINDER_SIZE} 
                       rx="16" ry="16"
                       transform={`translate(-${VIEWFINDER_SIZE/2}, -${VIEWFINDER_SIZE/2})`} 
                       fill="black" 
                     />
                   </mask>
                 </defs>
                 <rect width="100%" height="100%" fill="rgba(0,0,0,0.6)" mask="url(#viewfinder-mask)" />
               </svg>
            </div>
          )}
        </div>
      )}

      {/* ── HEADER (Glassmorphic) ── */}
      <header className="relative z-30 flex items-center justify-between px-5 py-4 bg-black/40 backdrop-blur-md text-white border-b border-white/10">
        <button onClick={() => router.back()} className="flex items-center gap-2 py-1">
          <ArrowLeft size={20} strokeWidth={2.5} />
          <span className="font-semibold text-[15px]">Back</span>
        </button>
        <div className="absolute left-1/2 -translate-x-1/2 font-semibold text-[15px]">
          Link Device
        </div>
        <div className="w-8 h-8 flex items-center justify-center">
          <QrCode size={20} />
        </div>
      </header>

      {/* ── MAIN AREA ── */}
      <div className="flex-1 relative z-20 flex flex-col items-center justify-center w-full">

        {/* STARTING */}
        {status === 'starting' && tab === 'camera' && (
          <div className="flex flex-col items-center gap-4 bg-black/60 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl">
            <Loader2 className="animate-spin text-white" size={36} />
            <span className="text-white font-medium text-sm">Accessing camera...</span>
          </div>
        )}

        {/* SCANNING */}
        {status === 'scanning' && tab === 'camera' && (
          <div className="w-full flex flex-col items-center h-full justify-between pb-12">
            <div className="flex-1 w-full flex items-center justify-center">
              <ViewfinderOverlay active />
            </div>
            {/* WhatsApp/Signal style instructions */}
            <div className="px-8 py-5 bg-black/50 backdrop-blur-md rounded-2xl border border-white/10 text-center max-w-[85%] mx-auto shadow-xl">
              <p className="text-white font-medium text-[15px] leading-relaxed">
                Go to <span className="font-bold text-green-400">ledgerchat.org/connect</span> on your computer and point your phone at the screen to capture the code.
              </p>
            </div>
          </div>
        )}

        {/* ── CAMERA DENIED MODAL ── */}
        {status === 'denied' && (
          <div className="bg-[#1A1A1A] p-8 rounded-[32px] border border-white/10 flex flex-col items-center text-center max-w-[85%] shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
              <Camera size={30} className="text-red-400" />
            </div>
            <h2 className="text-white font-bold text-xl mb-2">Camera Access Required</h2>
            <p className="text-white/60 text-[15px] leading-relaxed mb-8">
              To link your device by scanning a QR code, please allow camera access in your browser settings.
            </p>
            <div className="w-full flex flex-col gap-3">
              <button onClick={reset} className="w-full py-4 bg-white text-black font-bold text-[15px] rounded-xl shadow-lg">
                I've allowed it, Retry
              </button>
              <button onClick={() => setTab('file')} className="w-full py-4 bg-transparent border border-white/20 text-white font-semibold text-[15px] rounded-xl">
                Upload from Gallery
              </button>
            </div>
          </div>
        )}

        {/* ── ERROR MODAL ── */}
        {status === 'error' && (
          <div className="bg-[#1A1A1A] p-8 rounded-[32px] border border-white/10 flex flex-col items-center text-center max-w-[85%] shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
              <Shield size={30} className="text-red-400" />
            </div>
            <h2 className="text-white font-bold text-xl mb-2">
              {needsWallet ? 'Wallet Required' : 'Link Failed'}
            </h2>
            <p className="text-white/60 text-[15px] leading-relaxed mb-8">{errMsg}</p>
            
            {needsWallet ? (
              <div className="flex flex-col gap-3 w-full">
                <button onClick={() => openAppKit()} className="w-full py-4 bg-[#25D366] text-white font-bold text-[15px] rounded-xl shadow-lg">
                  Connect Wallet
                </button>
                {pinScanData && (
                  <button onClick={() => { setNeedsWallet(false); setErrMsg(''); if (pinScanData) { hasScannedRef.current = false; handleRouteRef.current(pinScanData); } }} className="w-full py-4 border border-white/20 text-white font-semibold text-[15px] rounded-xl">
                    Retry with PIN
                  </button>
                )}
              </div>
            ) : (
              <button onClick={reset} className="w-full py-4 bg-white text-black font-bold text-[15px] rounded-xl shadow-lg">
                Try Again
              </button>
            )}
          </div>
        )}

        {/* ── CONFIRM THE COMPUTER ── */}
        {status === 'pin_required' && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-2xl z-50 flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-sm flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mb-6">
                <Shield size={28} className="text-white" />
              </div>
              <h2 className="text-white font-bold text-2xl mb-2 text-center">Link this computer?</h2>
              <p className="text-white/80 text-[15px] text-center mb-4 leading-relaxed px-4">
                <strong>{linkLabel ?? 'A computer'}</strong> wants to use your Ledger Chat account.
              </p>
              <p role="note" className="text-[13px] text-center mb-3 leading-relaxed px-4 py-3 rounded-2xl bg-[#ff2a85]/10 text-[#ffb3cf] border border-[#ff2a85]/25">
                It will be able to read and send your messages. Only link it if you opened ledgerchat.org yourself on a computer in front of you. Never scan a code someone sent you.
              </p>
              <p className="text-white/50 text-[13px] text-center mb-8 leading-relaxed px-4">
                Your wallet stays on this phone. Unlink the computer any time in Settings → Linked devices.
              </p>
              <div className="w-full flex flex-col gap-3">
                <button onClick={handlePinConfirm} className="w-full py-4 bg-white text-black font-bold text-[15px] rounded-2xl">
                  Link this computer
                </button>
                <button onClick={reset} className="w-full py-4 text-white/50 font-medium text-[15px] hover:text-white transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── VERIFYING & SUCCESS ── */}
        {(status === 'verifying_pin' || status === 'success') && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-2xl z-50 flex flex-col items-center justify-center p-6">
             <div className="flex flex-col items-center gap-6">
               {status === 'verifying_pin' ? (
                 <Loader2 className="animate-spin text-[#25D366]" size={48} />
               ) : (
                 <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center border border-green-500/30">
                   <CheckCircle size={40} className="text-green-400" />
                 </div>
               )}
               <h2 className="text-white font-bold text-xl">
                 {status === 'verifying_pin' ? 'Linking the computer…' : successLabel}
               </h2>
             </div>
          </div>
        )}

        {/* ── FILE / GALLERY TAB ── */}
        {tab === 'file' && !['pin_required','verifying_pin','success','error','denied'].includes(status) && (
          <div className="bg-[#1A1A1A] p-8 rounded-[32px] border border-white/10 flex flex-col items-center text-center max-w-[85%] shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
              <Upload size={30} className="text-white/60" />
            </div>
            <h2 className="text-white font-bold text-xl mb-2">Upload QR Code</h2>
            <p className="text-white/60 text-[15px] leading-relaxed mb-8">
              Select an image from your device's photo gallery that contains a valid QR code.
            </p>
            <label className="w-full cursor-pointer flex items-center justify-center gap-2 py-4 bg-white text-black font-bold text-[15px] rounded-2xl shadow-lg">
              {fileLoading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
              {fileLoading ? 'Scanning image...' : 'Choose from Gallery'}
              <input type="file" accept="image/*" className="sr-only" onChange={handleFileChange} disabled={fileLoading} />
            </label>
            <button onClick={() => setTab('camera')} className="mt-4 text-white/50 text-[15px] font-medium hover:text-white">
              Back to Camera
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
