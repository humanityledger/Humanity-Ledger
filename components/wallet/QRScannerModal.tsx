"use client";
import { Loader2 } from 'lucide-react';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSystemAccount } from '@/hooks/useSystemAccount';
import { ATOM_PNGTREE } from '@/lib/constants/systemAssets';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan?: (data: string) => void;
  address?: string;
  initialScanData?: string | null;
}

import jsQR from 'jsqr';
import { useSecureCamera } from '@/hooks/useSecureCamera';
import { completeSessionHandshake } from '@/lib/scan/sessionHandshake';
import { useSignMessage, useAccount } from 'wagmi';

//  File/gallery scanner (fallback for restricted camera environments) 
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
          inversionAttempts: "attemptBoth",
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

//  Perimeter scan-line animation 
// The line travels: right  down  left  up (full perimeter), once per cycle.
// SIZE: the pixel side length of the viewfinder square.
const VIEWFINDER_SIZE = 240;
const STROKE = 3;
const PERIMETER = VIEWFINDER_SIZE * 4;

function ScanLine({ active }: { active: boolean }) {
  if (!active) return null;

  // SVG path of the perimeter square (clockwise starting from top-left)
  const path = `
    M 0 0
    L ${VIEWFINDER_SIZE} 0
    L ${VIEWFINDER_SIZE} ${VIEWFINDER_SIZE}
    L 0 ${VIEWFINDER_SIZE}
    Z
  `.trim();

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
        overflow: 'visible',
      }}
      viewBox={`0 0 ${VIEWFINDER_SIZE} ${VIEWFINDER_SIZE}`}
    >
      {/* Dim border  always visible when scanning */}
      <path
        d={path}
        fill="none"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />

      {/* Animated scan line  travels the full perimeter */}
      <path
        d={path}
        fill="none"
        stroke="#ffffff"
        strokeWidth={STROKE}
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeDasharray={`${PERIMETER * 0.22} ${PERIMETER * 0.78}`}
        style={{
          animation: `qr-perimeter-scan 1.8s linear infinite`,
        }}
      />

      {/* Corner accents */}
      {[
        // top-left
        `M 0 20 L 0 0 L 20 0`,
        // top-right
        `M ${VIEWFINDER_SIZE - 20} 0 L ${VIEWFINDER_SIZE} 0 L ${VIEWFINDER_SIZE} 20`,
        // bottom-right
        `M ${VIEWFINDER_SIZE} ${VIEWFINDER_SIZE - 20} L ${VIEWFINDER_SIZE} ${VIEWFINDER_SIZE} L ${VIEWFINDER_SIZE - 20} ${VIEWFINDER_SIZE}`,
        // bottom-left
        `M 20 ${VIEWFINDER_SIZE} L 0 ${VIEWFINDER_SIZE} L 0 ${VIEWFINDER_SIZE - 20}`,
      ].map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={STROKE + 0.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}

      <style>{`
        @keyframes qr-perimeter-scan {
          from { stroke-dashoffset: 0; }
          to   { stroke-dashoffset: -${PERIMETER}; }
        }
      `}</style>
    </svg>
  );
}

//  Elegant "Scanned!" success overlay 
function ScannedOverlay() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="absolute inset-0 flex items-center justify-center z-30"
      style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(12px)' }}
    >
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.05 }}
        className="flex flex-col items-center gap-4"
      >
        {/* Minimal check indicator */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25, delay: 0.1 }}
          className="border border-black/15 px-8 py-4"
        >
          <span className="text-[11px] font-black uppercase tracking-[0.3em] text-[#050505]">[OK]</span>
        </motion.div>

        {/* Label */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="text-center space-y-0.5"
        >
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[#050505]">
            Scanned!
          </p>
          <p className="text-[9px] font-black uppercase tracking-widest text-black/50">
            Syncing session
          </p>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

//  Main component 
export default function QRScannerModal({ isOpen, onClose, onScan, address: externalAddress, initialScanData }: QRScannerModalProps) {
  const { address } = useSystemAccount();
  const { signMessageAsync } = useSignMessage();
  const { connector } = useAccount();

  const [status, setStatus]   = useState<'idle' | 'scanning' | 'success' | 'error' | 'signing'>('idle');
  const [errMsg, setErrMsg]   = useState('');
  const [tab, setTab]         = useState<'camera' | 'file'>('camera');
  const [fileLoading, setFileLoading] = useState(false);

  //  Stable refs for callbacks  NEVER go into useEffect dep array 
  const addressRef  = useRef(address || externalAddress);
  const extAddrRef  = useRef(externalAddress);
  const onCloseRef  = useRef(onClose);
  const onScanRef   = useRef(onScan);
  useEffect(() => { addressRef.current = address || externalAddress; },  [address, externalAddress]);
  useEffect(() => { extAddrRef.current = externalAddress; }, [externalAddress]);
  useEffect(() => { onCloseRef.current = onClose; },  [onClose]);
  useEffect(() => { onScanRef.current  = onScan;  },  [onScan]);

  const initTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitingRef  = useRef(false);
  const hasScannedRef = useRef(false);
  const handleSuccessRef = useRef<any>(null);

  //  useSecureCamera Integration 
  const { videoRef, canvasRef, hasPermission, isInitializing, error: camError, startCamera, stopCamera } = useSecureCamera({
    facingMode: 'environment',
    onFrame: useCallback((canvas: HTMLCanvasElement) => {
      if (hasScannedRef.current || !handleSuccessRef.current) return;
      
      // Native BarcodeDetector (Modern Android/iOS Safari 17+) - high-performance
      if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        const barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        barcodeDetector.detect(canvas)
          .then((barcodes: any[]) => {
            if (barcodes.length > 0 && barcodes[0].rawValue && !hasScannedRef.current) {
              handleSuccessRef.current(barcodes[0].rawValue);
            }
          })
          .catch(() => {});
      }

      // Fallback: jsQR (highly compatible)
      try {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "attemptBoth",
        });
        if (code && code.data && !hasScannedRef.current) {
          handleSuccessRef.current(code.data);
        }
      } catch (e) {
        // ignore frame errors
      }
    }, [])
  });

  //  Core cleanup 
  const destroyScanner = useCallback(async () => {
    isInitingRef.current = false;
    hasScannedRef.current = false;
    if (initTimerRef.current) {
      clearTimeout(initTimerRef.current);
      initTimerRef.current = null;
    }
    stopCamera();
  }, [stopCamera]);

  //  Successful scan handler  session QR only  delegates to shared handshake
  const handleSuccess = useCallback(async (decodedText: string) => {
    if (hasScannedRef.current) return;
    hasScannedRef.current = true;

    await destroyScanner();

    const getAddress = () =>
      addressRef.current ||
      extAddrRef.current ||
      (() => {
        if (typeof document !== 'undefined') {
          const m = document.cookie.match(/system_handshake=(0x[a-fA-F0-9]{40})/i);
          return m?.[1] ?? null;
        }
        return null;
      })();

    const result = await completeSessionHandshake(decodedText, getAddress, signMessageAsync, connector);

    if (!result.ok) {
      setErrMsg(result.message);
      setStatus('error');
      hasScannedRef.current = false;
      return;
    }

    setStatus('success');
    onScanRef.current?.(decodedText);
    setTimeout(() => onCloseRef.current(), 1400);
  }, [destroyScanner]);

  //  Initialize camera scanner 
  const initScanner = useCallback(async () => {
    if (isInitingRef.current) return;
    isInitingRef.current = true;
    try {
      await startCamera();
      setStatus('scanning');
    } catch (e) {
      // handled by useEffect watching camError
    } finally {
      isInitingRef.current = false;
    }
  }, [startCamera]);

  useEffect(() => {
    if (camError && tab === 'camera') {
      setErrMsg(camError);
      setStatus('error');
    }
  }, [camError, tab]);

  useEffect(() => {
    handleSuccessRef.current = handleSuccess;
  }, [handleSuccess]);

  //  Effect: reacts to isOpen only 
  useEffect(() => {

    if (!isOpen) {
      destroyScanner();
      setStatus('idle');
      setErrMsg('');
      setTab('camera');
      return;
    }

    if (initialScanData) {
      setStatus('scanning');
      hasScannedRef.current = false;
      handleSuccess(initialScanData);
      return;
    }

    setStatus('idle');
    initTimerRef.current = setTimeout(() => { initScanner(); }, 350);

    return () => { destroyScanner(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialScanData]);

  //  Tab switch effect 
  useEffect(() => {
    if (!isOpen) return;
    if (tab === 'file') {
      destroyScanner();
      setStatus('idle');
    } else if (tab === 'camera') {
      setStatus('idle');
      initTimerRef.current = setTimeout(() => { initScanner(); }, 300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  //  File scan handler 
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileLoading(true);
    let tmp = document.getElementById('qr-reader-file-tmp');
    if (!tmp) {
      tmp = document.createElement('div');
      tmp.id = 'qr-reader-file-tmp';
      tmp.style.display = 'none';
      document.body.appendChild(tmp);
    }
    try {
      const decoded = await scanFileForQR(file);
      await handleSuccess(decoded);
    } catch {
      setErrMsg('No valid QR code detected in the image.');
      setStatus('error');
    } finally {
      setFileLoading(false);
      e.target.value = '';
    }
  }, [handleSuccess]);

  const handleRetry = useCallback(async () => {
    await destroyScanner();
    setErrMsg('');
    setStatus('idle');
    initTimerRef.current = setTimeout(() => { initScanner(); }, 300);
  }, [destroyScanner, initScanner]);

  //  JSX 
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="qr-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-[#FFFFFF] overflow-y-auto py-[calc(2.5rem+env(safe-area-inset-top))] pb-[calc(2.5rem+env(safe-area-inset-bottom))]"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-[calc(1.5rem+env(safe-area-inset-top))] right-6 font-black text-[9px] uppercase tracking-[0.2em] text-black/40 hover:text-black transition-colors z-50 border border-black/10 px-3 py-2"
            aria-label="Close scanner"
          >
            [CLOSE]
          </button>

          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1,    opacity: 1, y: 0  }}
            exit={{   scale: 0.95, opacity: 0, y: 20  }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-sm flex flex-col items-center px-6 relative will-change-transform"
          >
            {/* Header */}
            <div className="flex flex-col items-center gap-3 mb-6 relative z-10">
              <div className="w-16 h-16 mb-1 flex items-center justify-center">
                <img
                  src={ATOM_PNGTREE}
                  alt="Silver Atom"
                  className="w-full h-full object-contain"
                  style={{ mixBlendMode: 'multiply' }}
                  draggable={false}
                />
              </div>
              <h2 className="font-sans text-xl font-black text-[#050505] tracking-tighter uppercase">
                Link Session
              </h2>
            </div>

            {/* Tab switcher: Camera | Gallery */}
            <div className="w-full flex gap-2 mb-4">
              <button
                onClick={() => setTab('camera')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all border ${
                  tab === 'camera'
                    ? 'bg-white text-white border-[#050505]'
                    : 'bg-white text-black/40 border-black/10 hover:border-black/20'
                }`}
              >
                [CAM] Camera
              </button>
              <button
                onClick={() => setTab('file')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all border ${
                  tab === 'file'
                    ? 'bg-white text-white border-[#050505]'
                    : 'bg-white text-black/40 border-black/10 hover:border-black/20'
                }`}
              >
                [IMG] Gallery
              </button>
            </div>

            {/* Main scanner card */}
            <div className="relative w-full min-h-[340px] bg-white border border-black/8 rounded-[28px] overflow-hidden shadow-2xl flex flex-col items-center justify-start pt-5 px-4">

              {/*  CAMERA TAB  */}
              {tab === 'camera' && (
                <>
                  <div className="relative w-full h-[320px] rounded-[20px] overflow-hidden bg-black flex items-center justify-center shadow-inner">
                    <video
                      ref={videoRef}
                      className="absolute inset-0 w-full h-full object-cover"
                      style={{ display: status === 'error' || status === 'success' || status === 'signing' ? 'none' : 'block' }}
                      autoPlay
                      playsInline
                      muted
                    />
                    <canvas ref={canvasRef} className="hidden" />

                    {/* Atom watermark centered in viewfinder */}
                    <img
                      src={ATOM_PNGTREE}
                      alt=""
                      aria-hidden
                      className="absolute pointer-events-none z-[5] w-[55%] max-w-[180px] h-auto object-contain opacity-[0.35]"
                      style={{
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        mixBlendMode: 'screen',
                      }}
                    />

                    {/* Animated perimeter scan line */}
                    <ScanLine active={status === 'scanning'} />

                    {/* Loading state absolute centering */}
                    {status === 'idle' && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md z-10">
                        <Loader2 size={28} className="animate-spin text-white/80 mb-3" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/90">
                          Initializing camera...
                        </span>
                      </div>
                    )}

                    {/* Address Badge Over Camera (Visibility Fix) */}
                    {addressRef.current && status === 'scanning' && (
                      <div className="absolute bottom-4 left-4 right-4 z-20">
                        <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-full px-4 py-2.5 flex items-center justify-center gap-3 shadow-2xl">
                           <div className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse" />
                           <span className="font-mono text-[11px] font-black text-white uppercase tracking-widest">
                             {addressRef.current.slice(0, 8)}...{addressRef.current.slice(-6)}
                           </span>
                        </div>
                      </div>
                    )}
                  </div>



                  {/* Success overlay */}
                  <AnimatePresence>
                    {status === 'success' && <ScannedOverlay />}
                  </AnimatePresence>

                  {/* Error overlay */}
                  {status === 'error' && (
                    <div className="absolute inset-0 bg-white z-10 flex flex-col p-8 text-center justify-center gap-4">
                      <span className="text-[30px] font-black text-black mx-auto">[!]</span>
                      <p className="text-black text-[11px] font-black uppercase tracking-widest leading-relaxed">
                        {errMsg}
                      </p>
                      <button
                        onClick={handleRetry}
                        className="text-[9px] font-black uppercase tracking-[0.2em] px-6 py-3 bg-black text-white mx-auto mt-2 hover:bg-black/80 transition-colors"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                </>
              )}

              {/*  GALLERY TAB  */}
              {tab === 'file' && (
                <div className="flex flex-col items-center justify-center w-full h-full min-h-[280px] gap-5 p-6">
                  <div className="w-16 h-16 border border-black/10 flex items-center justify-center">
                    <span className="text-[20px] font-black text-black/30">[^]</span>
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-[12px] font-black uppercase tracking-widest text-[#050505]">
                      Upload QR Image
                    </p>
                    <p className="text-[10px] text-black/40 font-medium leading-relaxed max-w-[200px]">
                      Select a screenshot of the QR code from your desktop terminal.
                    </p>
                  </div>

                  <label className="relative cursor-pointer">
                    <span className="flex items-center gap-2 px-6 py-3 bg-white text-white text-[10px] font-black uppercase tracking-widest hover:bg-black/80 transition-colors">
                      {fileLoading ? (
                        <><span className="inline-block animate-spin">◌</span> Processing...</>
                      ) : (
                        <>[^] Select Image</>
                      )}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={handleFileChange}
                      disabled={fileLoading}
                    />
                  </label>

                  <AnimatePresence>
                    {status === 'success' && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center gap-2"
                      >
                        <span className="text-[11px] font-black uppercase tracking-widest text-[#050505]">[OK] Scanned!</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {status === 'error' && (
                    <p className="text-[11px] font-black uppercase tracking-widest text-black text-center">
                      [!] {errMsg}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Instructions */}
            <div className="mt-6 text-center space-y-1">
              <p className="text-[11px] text-[#050505]/50 leading-relaxed font-semibold max-w-[280px]">
                {tab === 'camera'
                  ? 'Point your camera at the QR code shown on the desktop terminal to sync instantly.'
                  : 'Take a screenshot of the QR on your PC and upload it here if the camera is unavailable.'}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
