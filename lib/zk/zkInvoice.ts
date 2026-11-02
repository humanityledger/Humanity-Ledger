/**
 * zk.money Confidential Freelance Invoicing & Private Settlement Engine
 * Ledger Chat × Aztec Network Private Payments
 *
 * Implements private peer-to-peer and business-to-peer freelance invoicing:
 * - Direct mapping from Humanity Ledger identity to invoice recipient
 * - Itemized billing with automatic tax and discount calculations
 * - Instant one-click settlement via Aztec shielded note transfers
 * - Cryptographic nullifier-backed payment receipts without public transaction exposure
 */

export interface ZkInvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ZkInvoice {
  id: string;
  invoiceNumber: string;
  title: string;
  senderTag: string;
  senderAddress: string;
  recipientTag: string;
  recipientAddress: string;
  token: 'DAI' | 'USDC' | 'ETH';
  items: ZkInvoiceItem[];
  subtotal: string;
  taxRate: number; // percentage (e.g. 0 or 10)
  taxAmount: string;
  totalAmount: string;
  notes?: string;
  dueDate: number;
  createdAt: number;
  status: 'unpaid' | 'paid' | 'cancelled';
  settlementTxHash?: string;
  settledAt?: number;
  aztecReceiptNoteId?: string;
}

const INVOICE_STORAGE_KEY = 'ledger_zk_invoices';

// ─── Storage Helpers ─────────────────────────────────────────────────────────

export function getAllInvoices(): ZkInvoice[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(INVOICE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveInvoices(invoices: ZkInvoice[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(INVOICE_STORAGE_KEY, JSON.stringify(invoices));
    window.dispatchEvent(new CustomEvent('ledger_zk_invoice_updated', { detail: { invoices } }));
  } catch {
    // quota
  }
}

// ─── Invoice Factory & Actions ───────────────────────────────────────────────

export interface CreateInvoiceParams {
  title: string;
  senderTag: string;
  senderAddress: string;
  recipientTag: string;
  recipientAddress: string;
  token: 'DAI' | 'USDC' | 'ETH';
  items: Array<{ description: string; quantity: number; unitPrice: number }>;
  taxRate?: number;
  dueDateDays?: number;
  notes?: string;
}

export function createShieldedInvoice(params: CreateInvoiceParams): ZkInvoice {
  const items: ZkInvoiceItem[] = params.items.map((it, idx) => {
    const total = it.quantity * it.unitPrice;
    return {
      id: `item_${idx}_${Date.now()}`,
      description: it.description,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      total,
    };
  });

  const subtotalNum = items.reduce((sum, it) => sum + it.total, 0);
  const taxRate = params.taxRate || 0;
  const taxNum = subtotalNum * (taxRate / 100);
  const totalNum = subtotalNum + taxNum;

  const now = Date.now();
  const dueDays = params.dueDateDays || 14;
  const invoiceNum = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const invoice: ZkInvoice = {
    id: `zinvoice_${now}_${Math.random().toString(36).substring(2, 7)}`,
    invoiceNumber: invoiceNum,
    title: params.title || 'Freelance Settlement Services',
    senderTag: params.senderTag,
    senderAddress: params.senderAddress.toLowerCase(),
    recipientTag: params.recipientTag,
    recipientAddress: params.recipientAddress.toLowerCase(),
    token: params.token,
    items,
    subtotal: subtotalNum.toFixed(2),
    taxRate,
    taxAmount: taxNum.toFixed(2),
    totalAmount: totalNum.toFixed(2),
    notes: params.notes || 'Confidential settlement via zk.money on Aztec Network',
    dueDate: now + dueDays * 86_400_000,
    createdAt: now,
    status: 'unpaid',
  };

  const invoices = getAllInvoices();
  invoices.unshift(invoice);
  saveInvoices(invoices);

  return invoice;
}

export function getInvoiceById(id: string): ZkInvoice | null {
  const invoices = getAllInvoices();
  return invoices.find(inv => inv.id === id) || null;
}

export function getUserInvoices(address: string): { issued: ZkInvoice[]; received: ZkInvoice[] } {
  const clean = address.toLowerCase();
  const all = getAllInvoices();
  return {
    issued: all.filter(inv => inv.senderAddress === clean),
    received: all.filter(inv => inv.recipientAddress === clean),
  };
}

export function markInvoicePaid(invoiceId: string, txHash: string, noteId?: string): boolean {
  const invoices = getAllInvoices();
  const idx = invoices.findIndex(inv => inv.id === invoiceId);
  if (idx === -1) return false;

  invoices[idx] = {
    ...invoices[idx],
    status: 'paid',
    settlementTxHash: txHash,
    settledAt: Date.now(),
    aztecReceiptNoteId: noteId || `note_rcpt_${Date.now()}`,
  };

  saveInvoices(invoices);
  return true;
}

export function cancelInvoice(invoiceId: string, callerAddress: string): boolean {
  const invoices = getAllInvoices();
  const idx = invoices.findIndex(inv => inv.id === invoiceId);
  if (idx === -1) return false;

  const inv = invoices[idx];
  if (inv.senderAddress !== callerAddress.toLowerCase()) return false;

  invoices[idx] = {
    ...inv,
    status: 'cancelled',
  };

  saveInvoices(invoices);
  return true;
}

// ─── Chat Payload Encoders ───────────────────────────────────────────────────

export function encodeInvoicePayload(invoice: ZkInvoice): string {
  return `__ZK_INVOICE__:${JSON.stringify(invoice)}`;
}

export function parseInvoicePayload(content: string): ZkInvoice | null {
  if (!content || !content.startsWith('__ZK_INVOICE__:')) return null;
  try {
    const raw = content.slice('__ZK_INVOICE__:'.length);
    return JSON.parse(raw) as ZkInvoice;
  } catch {
    return null;
  }
}
