// @ts-nocheck
"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Copy, Check, Wifi } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { parseEther } from 'viem';
import { toast } from 'sonner';

interface OfflineCryptoShareProps {
  myAddress: string;
  amount: string;
  token: 'ETH' | 'USDC';
  onClose: () => void;
}

function buildEthUri(address: string, amount: string, token: 'ETH' | 'USDC'): string {
  if (!address || address.length < 10) return '';
  try {
    if (token === 'ETH') {
      const weiAmount = amount && Number(amount) > 0 ? parseEther(amount).toString() : '0';
      return `ethereum:${address}?value=${weiAmount}&chainId=1`;
    } else {
      // USDC — EIP-681 token transfer URI
      const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
      const raw = amount && Number(amount) > 0 ? Math.round(Number(amount) * 1e6).toString() : '0';
      return `ethereum:${USDC}/transfer?address=${address}&uint256=${raw}&chainId=1`;
    }
  } catch {
    return `ethereum:${address}?chainId=1`;
  }
}

export function OfflineCryptoShare({ myAddress, amount, token, onClose }: OfflineCryptoShareProps) {
  const uri = buildEthUri(myAddress, amount, token);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(uri);
      setCopied(true);
      toast.success('URI copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copy failed — manually select the text below');
    }
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 38, mass: 0.9 }}
        className="fixed bottom-0 left-0 right-0 z-[201] bg-white rounded-t-[28px] shadow-2xl overflow-hidden"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-black/10 rounded-full mx-auto mt-3 mb-2" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-4 pt-1 border-b border-black/[0.06]">
          <div>
            <h2 className="text-[18px] font-bold text-gray-900">Offline QR Share</h2>
            <p className="text-[12px] text-gray-400 mt-0.5 flex items-center gap-1">
              <Wifi size={11} className="text-[#25D366]" />
              Works without internet
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <X size={16} className="text-gray-600" />
          </button>
        </div>

        <div className="px-5 py-6 flex flex-col items-center gap-5">
          {/* Amount Badge */}
          {amount && Number(amount) > 0 && (
            <div className="px-5 py-2 rounded-full border border-[#25D366]/30 bg-[#25D366]/8">
              <p className="text-[15px] font-bold text-[#128C7E]">
                {amount} {token}
              </p>
            </div>
          )}

          {/* QR Code */}
          <div className="p-4 bg-white rounded-3xl shadow-lg border border-gray-100">
            {uri ? (
              <QRCodeSVG
                value={uri}
                size={220}
                level="M"
                includeMargin={false}
                fgColor="#0f0f0f"
                bgColor="#ffffff"
              />
            ) : (
              <div className="w-[220px] h-[220px] bg-gray-100 rounded-2xl flex items-center justify-center">
                <p className="text-gray-400 text-sm">Invalid address</p>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="bg-[#F0FBF4] rounded-2xl px-4 py-3 w-full border border-[#25D366]/20">
            <p className="text-[12px] font-semibold text-[#128C7E] mb-1">How to use</p>
            <p className="text-[12px] text-gray-600 leading-relaxed">
              Ask them to scan this QR code with any Ethereum-compatible wallet (MetaMask, Rainbow, etc.) to send you crypto directly — no internet required on your end.
            </p>
          </div>

          {/* Raw URI for copy */}
          <div className="w-full">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Ethereum URI</p>
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
              <p className="text-[11px] font-mono text-gray-600 break-all flex-1 leading-relaxed select-text">
                {uri}
              </p>
              <button
                onClick={handleCopy}
                className="flex-shrink-0 p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 active:scale-95 transition-all"
              >
                {copied ? (
                  <Check size={14} className="text-[#25D366]" />
                ) : (
                  <Copy size={14} className="text-gray-500" />
                )}
              </button>
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="w-full py-3.5 bg-gray-100 text-gray-700 rounded-2xl font-semibold text-[14px] hover:bg-gray-200 active:scale-[0.98] transition-all"
          >
            Done
          </button>
        </div>
      </motion.div>
    </>
  );
}
