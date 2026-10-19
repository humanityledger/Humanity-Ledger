'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Plus,
  Trash2,
  Shield,
  CheckCircle,
  X,
  CreditCard,
  QrCode,
  DollarSign,
  Calendar,
  Lock
} from 'lucide-react';
import {
  createShieldedInvoice,
  markInvoicePaid,
  ZkInvoice,
  CreateInvoiceParams
} from '@/lib/zk/zkInvoice';
import { executeShieldedPayment } from '@/lib/zk/zkMoney';

interface ZkInvoiceModalProps {
  userAddress: string;
  userTag?: string;
  recipientTag?: string;
  recipientAddress?: string;
  existingInvoice?: ZkInvoice;
  onClose: () => void;
  onInvoiceCreated?: (invoice: ZkInvoice) => void;
  onInvoicePaid?: (invoice: ZkInvoice) => void;
}

export function ZkInvoiceModal({
  userAddress,
  userTag,
  recipientTag: initialRecipientTag = '',
  recipientAddress: initialRecipientAddress = '',
  existingInvoice,
  onClose,
  onInvoiceCreated,
  onInvoicePaid,
}: ZkInvoiceModalProps) {
  // If viewing/paying existing invoice
  const [isPaying, setIsPaying] = useState(false);
  const [proofStep, setProofStep] = useState('');
  const [proofProgress, setProofProgress] = useState(0);

  // Form State for creating a new invoice
  const [title, setTitle] = useState('Frontend & Privacy Engineering Sprint');
  const [recipientTag, setRecipientTag] = useState(initialRecipientTag);
  const [token, setToken] = useState<'DAI' | 'USDC' | 'ETH'>('DAI');
  const [taxRate, setTaxRate] = useState(0);
  const [dueDateDays, setDueDateDays] = useState(14);
  const [notes, setNotes] = useState('Payment settlement via Aztec zk.money');

  const [items, setItems] = useState<Array<{ description: string; quantity: number; unitPrice: number }>>([
    { description: 'Aztec zk.money Native Chat Integration', quantity: 1, unitPrice: 2500 },
    { description: 'UltraPlonk Prover Pipeline Optimization', quantity: 1, unitPrice: 1500 },
  ]);

  const handleAddItem = () => {
    setItems([...items, { description: '', quantity: 1, unitPrice: 100 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (index: number, field: string, val: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: val };
    setItems(updated);
  };

  const subtotal = items.reduce((sum, it) => sum + (it.quantity || 0) * (it.unitPrice || 0), 0);
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientTag || items.length === 0) return;

    const invoice = createShieldedInvoice({
      title,
      senderTag: userTag || `zk:${userAddress.slice(2, 8)}`,
      senderAddress: userAddress,
      recipientTag: recipientTag.startsWith('zk:') ? recipientTag : `zk:${recipientTag}`,
      recipientAddress: initialRecipientAddress || (recipientTag.startsWith('0x') ? recipientTag : ''),
      token,
      items,
      taxRate,
      dueDateDays,
      notes,
    });

    if (onInvoiceCreated) onInvoiceCreated(invoice);
    onClose();
  };

  const handlePayInvoice = async () => {
    if (!existingInvoice) return;
    setIsPaying(true);

    try {
      const paymentResult = await executeShieldedPayment(
        {
          senderAddress: userAddress || '0x0',
          recipientTag: existingInvoice.senderTag,
          amount: existingInvoice.totalAmount,
          token: existingInvoice.token,
          memo: `Payment for ${existingInvoice.invoiceNumber}`,
        },
        (step, progress) => {
          setProofStep(step);
          setProofProgress(progress);
        }
      );

      markInvoicePaid(existingInvoice.id, paymentResult.txHash, paymentResult.nullifierHash);
      if (onInvoicePaid) {
        onInvoicePaid({ ...existingInvoice, status: 'paid', settlementTxHash: paymentResult.txHash });
      }
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl p-6 w-full max-w-xl shadow-2xl border border-black/[0.08] max-h-[90vh] overflow-y-auto space-y-5"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/[0.06] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1C1C1E]/10 flex items-center justify-center text-[#1C1C1E]">
              <FileText size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-gray-900 leading-tight">
                {existingInvoice ? existingInvoice.invoiceNumber : 'Create Shielded Freelance Invoice'}
              </h2>
              <p className="text-[11px] text-gray-500">
                {existingInvoice ? 'Review & settle privately on Aztec' : 'Confidential settlement without on-chain trail'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 text-gray-400 hover:text-gray-700"
          >
            <X size={18} />
          </button>
        </div>

        {existingInvoice ? (
          // ─── Pay / View Existing Invoice ──────────────────────────────
          <div className="space-y-4">
            <div className="bg-[#FAFAFA] border border-black/[0.06] rounded-2xl p-4 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-[15px] font-bold text-gray-900">{existingInvoice.title}</h3>
                  <p className="text-[12px] text-gray-500">From: {existingInvoice.senderTag}</p>
                </div>
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                    existingInvoice.status === 'paid'
                      ? 'bg-[#1C1C1E]/20 text-[#1C1C1E]'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {existingInvoice.status}
                </span>
              </div>
              <p className="text-[12px] text-gray-600 italic">"{existingInvoice.notes}"</p>
            </div>

            {/* Line items table */}
            <div className="border border-black/[0.06] rounded-2xl overflow-hidden">
              <table className="w-full text-left text-[12px]">
                <thead className="bg-[#f0f2f5] text-gray-500 font-semibold border-b border-black/[0.06]">
                  <tr>
                    <th className="p-3">Description</th>
                    <th className="p-3 text-center">Qty</th>
                    <th className="p-3 text-right">Unit Price</th>
                    <th className="p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04]">
                  {existingInvoice.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="p-3 font-medium text-gray-800">{it.description}</td>
                      <td className="p-3 text-center text-gray-600">{it.quantity}</td>
                      <td className="p-3 text-right text-gray-600 font-mono">${it.unitPrice.toFixed(2)}</td>
                      <td className="p-3 text-right font-bold text-gray-900 font-mono">${it.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary */}
            <div className="bg-[#FAFAFA] rounded-2xl p-4 flex justify-between items-center">
              <div className="text-[12px] text-gray-500">
                Due Date: <span className="font-semibold text-gray-800">{new Date(existingInvoice.dueDate).toLocaleDateString()}</span>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-gray-400 font-medium uppercase tracking-wider block">Total Amount</span>
                <span className="text-[20px] font-bold text-[#1C1C1E] font-mono">
                  {existingInvoice.totalAmount} {existingInvoice.token}
                </span>
              </div>
            </div>

            {isPaying && (
              <div className="bg-[#f0f2f5] rounded-2xl p-4 space-y-2">
                <div className="flex justify-between text-[12px]">
                  <span className="font-semibold text-gray-800">{proofStep}</span>
                  <span className="font-mono text-[#1C1C1E] font-bold">{proofProgress}%</span>
                </div>
                <div className="w-full bg-black/10 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-[#1C1C1E] h-full transition-all duration-300" style={{ width: `${proofProgress}%` }} />
                </div>
              </div>
            )}

            {existingInvoice.status === 'unpaid' && (
              <button
                onClick={handlePayInvoice}
                disabled={isPaying}
                className="w-full py-3.5 bg-[#1C1C1E] text-white text-[14px] font-bold rounded-2xl hover:bg-[#000000] transition flex items-center justify-center gap-2 shadow-sm"
              >
                <Shield size={16} /> Settle Privately via Aztec ({existingInvoice.totalAmount} {existingInvoice.token})
              </button>
            )}
          </div>
        ) : (
          // ─── Create New Invoice ───────────────────────────────────────
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase">Invoice Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full mt-1 bg-[#f0f2f5] border border-black/[0.06] rounded-xl px-3 py-2 text-[13px] font-semibold text-gray-900 outline-none focus:border-[#1C1C1E]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase">Client zk.money Tag</label>
                <input
                  type="text"
                  required
                  value={recipientTag}
                  onChange={e => setRecipientTag(e.target.value)}
                  placeholder="zk:client_name"
                  className="w-full mt-1 bg-[#f0f2f5] border border-black/[0.06] rounded-xl px-3 py-2 text-[13px] font-mono outline-none focus:border-[#1C1C1E]"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase">Payment Currency</label>
                <select
                  value={token}
                  onChange={e => setToken(e.target.value as any)}
                  className="w-full mt-1 bg-[#f0f2f5] border border-black/[0.06] rounded-xl px-3 py-2 text-[13px] font-bold outline-none"
                >
                  <option value="DAI">zkDAI (Aztec)</option>
                  <option value="USDC">zkUSDC (Aztec)</option>
                  <option value="ETH">zkETH (Aztec)</option>
                </select>
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-gray-500 uppercase">Itemized Deliverables</label>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="text-[11px] font-bold text-[#1C1C1E] hover:underline flex items-center gap-1"
                >
                  <Plus size={12} /> Add Item
                </button>
              </div>

              {items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    type="text"
                    required
                    placeholder="Description of milestone or work"
                    value={item.description}
                    onChange={e => handleUpdateItem(idx, 'description', e.target.value)}
                    className="flex-3 bg-[#f0f2f5] border border-black/[0.06] rounded-xl px-3 py-2 text-[12px] outline-none focus:border-[#1C1C1E]"
                  />
                  <input
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={e => handleUpdateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                    className="w-16 bg-[#f0f2f5] border border-black/[0.06] rounded-xl px-2 py-2 text-[12px] text-center outline-none"
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="Price"
                    value={item.unitPrice}
                    onChange={e => handleUpdateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                    className="w-24 bg-[#f0f2f5] border border-black/[0.06] rounded-xl px-2 py-2 text-[12px] font-mono outline-none"
                  />
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="p-2 text-gray-400 hover:text-red-500 transition"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Total calculation */}
            <div className="bg-[#FAFAFA] border border-black/[0.06] rounded-2xl p-4 flex justify-between items-center">
              <div className="text-[12px] text-gray-500">
                Estimated settlement time: <span className="font-semibold text-gray-800">Instant on confirmation</span>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-gray-400 uppercase font-semibold">Total Due</span>
                <span className="text-[20px] font-mono font-bold text-gray-900 block">
                  {total.toFixed(2)} {token}
                </span>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-[#1C1C1E] text-white text-[14px] font-bold rounded-2xl hover:bg-[#000000] transition flex items-center justify-center gap-2 shadow-sm"
            >
              <FileText size={16} /> Generate & Send Shielded Invoice
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
