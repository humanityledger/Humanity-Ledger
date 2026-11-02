'use client';

import React, { useState } from 'react';
import { useWalletConnectStore } from '@/lib/store/wallet-connect-store';
import { getWeb3Wallet } from '@/lib/walletconnect/walletKit';
import { useWalletStore } from '@/lib/store/wallet-store';
import { getSdkError } from '@walletconnect/utils';
import { ethers } from 'ethers';
import { toast } from 'sonner';
import { Shield, Fingerprint, Code } from 'lucide-react';

export function SessionRequestModal() {
    const { requests, removeRequest } = useWalletConnectStore();
    const { privateKey, sendTransaction } = useWalletStore();
    const [isProcessing, setIsProcessing] = useState(false);

    if (requests.length === 0) return null;

    const request = requests[0];
    const { topic, params, id } = request;
    const { request: methodRequest, chainId } = params;

    const handleApprove = async () => {
        setIsProcessing(true);
        const web3wallet = getWeb3Wallet();
        if (!web3wallet) {
            toast.error('Wallet engine not initialized');
            setIsProcessing(false);
            return;
        }

        try {
            let response: { id: number; result: string; jsonrpc: string };

            if (methodRequest.method === 'personal_sign') {
                if (!privateKey) throw new Error('System key not unlocked');
                const wallet = new ethers.Wallet(privateKey);
                // params[0] = message (hex or plain text), params[1] = address
                const messageParam = methodRequest.params[0] as string;
                let signature: string;

                if (messageParam.startsWith('0x')) {
                    // Hex-encoded bytes  decode to raw bytes then sign
                    const messageBytes = ethers.getBytes(messageParam);
                    signature = await wallet.signMessage(messageBytes);
                } else {
                    // Plain UTF-8 string
                    signature = await wallet.signMessage(messageParam);
                }
                response = { id, result: signature, jsonrpc: '2.0' };
                toast.success('Message signed', { description: `${methodRequest.method}` });
            }
            else if (methodRequest.method === 'eth_signTypedData_v4' || methodRequest.method === 'eth_signTypedData') {
                if (!privateKey) throw new Error('System key not unlocked');
                const wallet = new ethers.Wallet(privateKey);
                // params[0] = address, params[1] = JSON typed data string
                const typedDataRaw = methodRequest.params[1] as string;
                const typedData = typeof typedDataRaw === 'string' ? JSON.parse(typedDataRaw) : typedDataRaw;

                // Remove EIP712Domain from types (ethers v6 does not want it there)
                const { EIP712Domain: _removed, ...types } = typedData.types;
                const signature = await wallet.signTypedData(typedData.domain, types, typedData.message);
                response = { id, result: signature, jsonrpc: '2.0' };
                toast.success('Typed data signed', { description: `EIP-712 compliant` });
            }
            else if (methodRequest.method === 'eth_sendTransaction') {
                const txParams = methodRequest.params[0];
                const valueHex = txParams.value || '0x0';
                const amountEth = ethers.formatEther(BigInt(valueHex));
                const hash = await sendTransaction(txParams.to, amountEth);
                if (!hash) throw new Error('Transaction rejected or broadcast failed');
                response = { id, result: hash, jsonrpc: '2.0' };
                toast.success('Transaction broadcast', { description: hash.slice(0, 16) + '...' });
            }
            else {
                throw new Error(`Method "${methodRequest.method}" is not supported by Ledger Portfolio`);
            }

            await web3wallet.respondSessionRequest({ topic, response });
        } catch (e: any) {
            console.error('[WC] Signature failure:', e);
            toast.error('Signature Failed', { description: e.message });
            try {
                await web3wallet.respondSessionRequest({
                    topic,
                    response: { id, jsonrpc: '2.0', error: getSdkError('USER_REJECTED') }
                });
            } catch (_err) {}
        } finally {
            setIsProcessing(false);
            removeRequest(id);
        }
    };

    const handleReject = async () => {
        setIsProcessing(true);
        const web3wallet = getWeb3Wallet();
        if (web3wallet) {
            try {
                await web3wallet.respondSessionRequest({
                    topic,
                    response: { id, jsonrpc: '2.0', error: getSdkError('USER_REJECTED') }
                });
            } catch (_err) {}
        }
        removeRequest(id);
        setIsProcessing(false);
        toast.info('Request rejected');
    };

    const isSign = methodRequest.method === 'personal_sign' || methodRequest.method.includes('signTypedData');
    const isTx = methodRequest.method === 'eth_sendTransaction';

    return (
        <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-black/10 overflow-hidden flex flex-col">

                {/* Header */}
                <div className="p-5 flex items-center gap-3 border-b border-black/5 bg-[#FFFFFF]">
                    <div className="p-2.5 bg-black/5 rounded-xl border border-black/10">
                        <Fingerprint size={20} className="text-black" />
                    </div>
                    <div>
                        <h2 className="text-sm font-black font-aztec-mono uppercase tracking-widest text-black">
                            {isTx ? 'Transaction Request' : 'Signature Request'}
                        </h2>
                        <p className="text-[10px] text-black/50 font-mono tracking-widest mt-0.5 uppercase">
                            Chain: {chainId}
                        </p>
                    </div>
                </div>

                <div className="p-6 space-y-5">
                    {/* Method badge */}
                    <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-black uppercase text-black/40 tracking-widest">Requested Method</span>
                        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 text-emerald-700 rounded-lg border border-emerald-500/20 font-mono text-[11px] font-bold uppercase tracking-widest">
                            <Code size={14} /> {methodRequest.method}
                        </div>
                    </div>

                    {/* Payload preview */}
                    <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-black uppercase text-black/40 tracking-widest">Payload</span>
                        <pre className="p-4 bg-white text-[#FFFFFF] rounded-xl font-mono text-[10px] break-all max-h-[160px] overflow-y-auto border border-black/20 shadow-inner whitespace-pre-wrap">
                            {JSON.stringify(methodRequest.params, null, 2)}
                        </pre>
                    </div>

                    {!privateKey && isSign && (
                        <div className="text-[10px] font-black text-red-500 uppercase tracking-widest border border-red-200 bg-red-50 rounded-xl px-4 py-3">
                             System key not unlocked  unlock your wallet to sign.
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="p-4 bg-black/5 flex gap-3 border-t border-black/10">
                    <button
                        onClick={handleReject}
                        disabled={isProcessing}
                        className="flex-1 py-3.5 rounded-xl font-aztec-mono text-[11px] font-black uppercase tracking-widest bg-white border border-black/10 text-black hover:bg-black/5 transition-all"
                    >
                        Decline
                    </button>
                    <button
                        onClick={handleApprove}
                        disabled={isProcessing || (!privateKey && isSign)}
                        className="flex-1 py-3.5 flex items-center justify-center gap-2 rounded-xl font-aztec-mono text-[11px] font-black uppercase tracking-widest bg-black text-white hover:bg-black/80 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {isProcessing ? 'Signing...' : <><Shield size={14} /> Sign & Respond</>}
                    </button>
                </div>
            </div>
        </div>
    );
}
