"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Camera, Loader, RefreshCcw } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { QRCodeSVG } from 'qrcode.react';



type ScanState = 'idle' | 'requesting' | 'scanning' | 'validating' | 'success' | 'error';

interface QrScannerProps {
    className?: string;
    mode?: 'project' | 'scan';
    onScanSuccess?: (decodedText: string) => void;
    projectValue?: string;
    projectTitle?: string;
    projectDescription?: string;
}

// Module-level constant  QrScanner is never mounted more than once simultaneously,
// so a fixed DOM ID for html5-qrcode's internal container is safe and allocation-free.
const QR_CONTAINER_ID = 'qr-reader-container';

export function QrScanner({ className, mode = 'scan', onScanSuccess, projectValue, projectTitle, projectDescription }: QrScannerProps) {
    const [state, setState] = useState<ScanState>('idle');
    const [message, setMessage] = useState('');
    const scannerRef = useRef<Html5Qrcode | null>(null);

    // Stop all camera resources
    const stopCamera = useCallback(async () => {
        if (scannerRef.current && scannerRef.current.isScanning) {
            try {
                await scannerRef.current.stop();
            } catch (err) {
                console.warn("[Scanner] Stop error:", err);
            }
        }
    }, []);

    useEffect(() => {
        return () => {
            stopCamera();
        };
    }, [stopCamera]);

    const handleDecode = async (decodedText: string) => {
        let extractedText = decodedText.trim();
        let isBridgeToken = false;
        
        try {
            // Check if it's a URL and extract 'address' or 'token' if present
            const url = new URL(extractedText);
            if (url.searchParams.has('token') || url.pathname.includes('bridge')) {
                isBridgeToken = true;
            }
            extractedText = url.searchParams.get('address') ?? url.searchParams.get('token') ?? extractedText;
        } catch {
            // Not a URL, check for ethereum: prefix
            if (extractedText.toLowerCase().startsWith('ethereum:')) {
                extractedText = extractedText.substring(9).split('@')[0];
            }
        }

        // If the extracted text is a 64-character hex token, it's also a bridge token
        if (/^[a-fA-F0-9]{64}$/.test(extractedText)) {
            isBridgeToken = true;
        }

        if (onScanSuccess && !isBridgeToken) {
            await stopCamera();
            onScanSuccess(extractedText);
            return;
        }
        
        setState('validating');
        await stopCamera();
        
        try {
            let walletParam = '';
            try {
                const raw = localStorage.getItem('system_session_v2');
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed?.wallet) walletParam = `&wallet=${parsed.wallet}`;
                }
                if (!walletParam) {
                    const sess = sessionStorage.getItem('system_wallet_addr');
                    if (sess) walletParam = `&wallet=${sess}`;
                }
            } catch {}

            const res = await fetch(`/api/bridge/generate?token=${encodeURIComponent(extractedText)}${walletParam}`);
            const data = await res.json();
            
            if (data.valid) {
                setState('success');
                setMessage(data.message ?? 'Device successfully linked to your account!');
            } else {
                setState('error');
                setMessage(data.error ?? 'Invalid or expired QR code.');
            }
        } catch {
            setState('error');
            setMessage('Network error. Please check your connection and try again.');
        }
    };

    const startCamera = async () => {
        setState('requesting');
        
        // Ensure previous instances are cleaned up
        await stopCamera();

        // Switch to scanning state to mount the DOM container FIRST
        setState('scanning');

        // Wait a tiny bit for React to commit the DOM
        setTimeout(async () => {
            const container = document.getElementById(QR_CONTAINER_ID);
            if (!container) return; // Safeguard: component unmounted before timeout

            try {
                const scanner = new Html5Qrcode(QR_CONTAINER_ID);
                scannerRef.current = scanner;

                const config = {
                    fps: 10,
                    qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
                        const min = Math.min(viewfinderWidth, viewfinderHeight);
                        const size = Math.floor(min * 0.75);
                        return { width: size, height: size };
                    },
                    aspectRatio: 1.0,
                    disableFlip: false
                };

                let started = false;
                try {
                    await scanner.start(
                        { facingMode: "environment" },
                        config,
                        (decodedText) => { handleDecode(decodedText); },
                        () => {} // ignore ongoing errors
                    );
                    started = true;
                } catch (envErr) {
                    console.warn("[Scanner] Environment camera failed, trying fallback...", envErr);
                }

                if (!started) {
                    const cameras = await Html5Qrcode.getCameras();
                    if (cameras && cameras.length > 0) {
                        // Use the last camera in the list as fallback (often the back camera)
                        await scanner.start(
                            cameras[cameras.length - 1].id,
                            config,
                            (decodedText) => { handleDecode(decodedText); },
                            () => {}
                        );
                    } else {
                        throw new Error("No cameras found on device.");
                    }
                }
            } catch (err: any) {
                console.error("[Scanner] Start failure:", err);
                setState('error');
                
                if (err?.toString().includes("NotAllowedError")) {
                    setMessage('Camera access denied. Tap "Allow" when prompted, then try again.');
                } else if (err?.toString().includes("NotFound")) {
                    setMessage('No camera found on this device.');
                } else {
                    setMessage(`Camera error: ${err.message || 'Check permissions and try again.'}`);
                }
                await stopCamera();
            }
        }, 100);
    };

    const reset = async () => { 
        await stopCamera(); 
        setState('idle'); 
        setMessage(''); 
    };

    const [projectData, setProjectData] = useState<{ token: string, linkUrl: string } | null>(null);
    const [projectLoading, setProjectLoading] = useState(false);

    const generateQr = useCallback(async () => {
        if (projectValue) {
            setProjectData({ token: projectValue, linkUrl: projectValue });
            return;
        }
        setProjectLoading(true);
        try {
            const res = await fetch('/api/bridge/generate', { method: 'POST' });
            const data = await res.json();
            if (data.token) {
                setProjectData(data);
            }
        } catch (e) {
            console.error("Failed to generate QR", e);
        } finally {
            setProjectLoading(false);
        }
    }, [projectValue]);

    useEffect(() => {
        if (mode === 'project') {
            generateQr();
        } else if (mode === 'scan') {
            if (state === 'idle') {
                startCamera();
            }
        }
    }, [mode, generateQr]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            setState('validating');
            await stopCamera();
            const html5QrCode = new Html5Qrcode(QR_CONTAINER_ID);
            const decodedText = await html5QrCode.scanFile(file, true);
            await handleDecode(decodedText);
        } catch (err) {
            setState('error');
            setMessage('Could not detect a valid QR code in the image. Please try another image.');
        }
    };

    if (mode === 'project') {
        return (
            <div className={`w-full flex flex-col items-center gap-6 ${className ?? ''}`}>
                <div className="flex flex-col items-center gap-4 text-center">
                    <h3 className="font-mono text-xl font-semibold tracking-[0.2em] text-[#15171c]">{projectTitle || 'Link Device'}</h3>
                    <p className="text-xs text-black/50 max-w-xs leading-relaxed font-serif">
                        {projectDescription || 'Scan this QR code from the HumanID mobile terminal to securely link your sovereign session.'}
                    </p>
                </div>
                
                {projectLoading ? (
                    <div className="w-64 h-64 flex items-center justify-center border border-black/10 rounded-3xl bg-black/5">
                        <Loader size={36} className="animate-spin text-black/20" />
                    </div>
                ) : projectData ? (
                    <div className="p-6 bg-white rounded-3xl border border-black/10 shadow-xl">
                        <QRCodeSVG
                            value={projectData.linkUrl}
                            size={220}
                            fgColor="#000000"
                            bgColor="#FFFFFF"
                            level="H"
                            includeMargin={false}
                        />
                    </div>
                ) : (
                    <button onClick={generateQr} className="px-6 py-3 bg-black text-white font-semibold text-[12.5px] rounded-xl active:scale-95 transition-all">
                        Generate Link QR
                    </button>
                )}
                
                {projectData && !projectValue && (
                    <button onClick={generateQr} className="text-[12px] tabular-nums text-black/40 hover:opacity-80 transition-opacity flex items-center gap-2">
                        <RefreshCcw size={12} /> Refresh QR Code
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className={`w-full flex flex-col items-center gap-6 ${className ?? ''}`}>

            <AnimatePresence mode="wait">
                {/* IDLE */}
                {state === 'idle' && (
                    <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="flex flex-col items-center gap-6 w-full">
                        <div className="relative w-64 h-64 rounded-3xl border border-black/10 bg-black/5 flex flex-col items-center justify-center overflow-hidden backdrop-blur-md">
                            <div className="absolute top-3 left-3 w-7 h-7 border-t-2 border-l-2 border-black/20 rounded-tl-2xl" />
                            <div className="absolute top-3 right-3 w-7 h-7 border-t-2 border-r-2 border-black/20 rounded-tr-2xl" />
                            <div className="absolute bottom-3 left-3 w-7 h-7 border-b-2 border-l-2 border-black/20 rounded-bl-2xl" />
                            <div className="absolute bottom-3 right-3 w-7 h-7 border-b-2 border-r-2 border-black/20 rounded-br-2xl" />
                            <Camera size={36} className="text-black/10 mb-2" />
                            <span className="text-[12px] tabular-nums text-black/20">Awaiting Activation</span>
                        </div>
                        <div className="w-full space-y-3">
                            <button onClick={startCamera}
                                className="w-full py-4 rounded-2xl bg-black text-white tabular-nums text-[12.5px] font-semibold shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-3">
                                <Camera size={16} /> Activate Camera
                            </button>
                            <label className="w-full py-4 rounded-2xl bg-black/5 border border-black/10 text-black tabular-nums text-[12.5px] font-semibold shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-3 cursor-pointer hover:bg-black/10">
                                <Camera size={16} /> Upload QR Image
                                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                            </label>
                        </div>
                    </motion.div>
                )}

                {/* REQUESTING */}
                {state === 'requesting' && (
                    <motion.div key="requesting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="flex flex-col items-center gap-4 py-16">
                        <div className="w-14 h-14 rounded-full border-2 border-black/20 border-t-black animate-spin" />
                        <p className="font-mono text-[12px] text-black/40">Requesting camera access</p>
                    </motion.div>
                )}

                {/* VALIDATING */}
                {state === 'validating' && (
                    <motion.div key="validating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="flex flex-col items-center gap-4 py-16">
                        <Loader size={36} className="animate-spin text-black/40" />
                        <p className="font-mono text-[12px] text-black/40">Validating QR token</p>
                    </motion.div>
                )}

                {/* SCANNING  live camera viewfinder */}
                {state === 'scanning' && (
                    <motion.div key="scanning" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                        className="flex flex-col items-center gap-5 w-full">
                        <div className="relative w-72 h-72 rounded-3xl overflow-hidden border border-black/10 shadow-xl bg-black">
                            <div id={QR_CONTAINER_ID} className="w-full h-full [&>video]:w-full [&>video]:h-full [&>video]:object-cover" />

                            {/* Scan overlay */}
                            <div className="absolute inset-0 pointer-events-none">
                                <div className="absolute top-3 left-3 w-8 h-8 border-t-2 border-l-2 border-white/40 rounded-tl-2xl" />
                                <div className="absolute top-3 right-3 w-8 h-8 border-t-2 border-r-2 border-white/40 rounded-tr-2xl" />
                                <div className="absolute bottom-3 left-3 w-8 h-8 border-b-2 border-l-2 border-white/40 rounded-bl-2xl" />
                                <div className="absolute bottom-3 right-3 w-8 h-8 border-b-2 border-r-2 border-white/40 rounded-br-2xl" />
                                <motion.div animate={{ y: [-100, 100] }} transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
                                    className="absolute left-6 right-6 h-0.5 bg-white/20 shadow-[0_0_16px_rgba(255,255,255,0.2)]" />
                            </div>
                        </div>
                        <p className="font-mono text-[12px] text-black/30">
                            Point at the QR code on your PC screen
                        </p>
                        <div className="w-full space-y-3 pt-2">
                            <label className="w-full py-3 rounded-xl bg-black/5 border border-black/10 text-black tabular-nums text-[12px] font-semibold shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer hover:bg-black/10">
                                <Camera size={14} /> Upload QR Image
                                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                            </label>
                            <button onClick={reset} className="w-full text-black/30 text-xs tabular-nums hover:text-black/60 transition-colors">
                                Cancel
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* SUCCESS */}
                {state === 'success' && (
                    <motion.div key="success" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                        className="flex flex-col items-center gap-5 text-center py-8">
                        <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 0.6, type: 'spring' }}
                            className="w-20 h-20 rounded-full bg-black/5 border border-black/10 flex items-center justify-center">
                            <CheckCircle size={40} className="text-black/40" />
                        </motion.div>
                        <h3 className="font-mono text-xl font-semibold text-[#15171c]">Bridge Established</h3>
                        <p className="text-xs text-black/60 max-w-xs leading-relaxed font-serif">{message}</p>
                        <button onClick={reset}
                            className="mt-2 px-6 py-2 rounded-lg border border-black/10 text-black/50 text-[12px] font-semibold hover:bg-black/5 transition-colors flex items-center gap-2">
                            <RefreshCcw size={12} /> Scan another
                        </button>
                    </motion.div>
                )}

                {/* ERROR */}
                {state === 'error' && (
                    <motion.div key="error" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                        className="flex flex-col items-center gap-5 text-center py-8">
                        <div className="w-20 h-20 rounded-full bg-[#e5484d]/10 border border-red-500/30 flex items-center justify-center">
                            <XCircle size={40} className="text-red-400" />
                        </div>
                        <h3 className="font-mono text-xl font-semibold text-[#15171c]">
                            {mode === 'scan' ? 'Scan Failed' : 'Link Failed'}
                        </h3>
                        <p className="text-xs text-black/60 max-w-xs leading-relaxed font-serif">{message}</p>
                        <div className="w-full space-y-3 pt-2">
                            <button onClick={reset}
                                className="w-full py-4 rounded-xl bg-black text-white text-[12px] font-semibold hover:bg-black/80 transition-colors">
                                Try Again
                            </button>
                            <label className="w-full py-4 rounded-xl bg-black/5 border border-black/10 text-black tabular-nums text-[12px] font-semibold shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer hover:bg-black/10">
                                <Camera size={14} /> Upload QR Image
                                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                            </label>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

