import { NextRequest, NextResponse } from 'next/server';

interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  title: string;
  senderTag: string;
  senderAddress: string;
  recipientTag: string;
  recipientAddress: string;
  token: string;
  items: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
  totalAmount: string;
  status: 'unpaid' | 'paid' | 'cancelled';
  settlementTxHash?: string;
  settledAt?: number;
  dueDate: number;
  createdAt: number;
}

const invoiceDb = new Map<string, InvoiceRecord>();

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')?.toLowerCase();
  const id = req.nextUrl.searchParams.get('id');

  if (id) {
    const inv = invoiceDb.get(id);
    if (!inv) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    return NextResponse.json({ invoice: inv });
  }

  if (address) {
    const userInvoices: InvoiceRecord[] = [];
    for (const inv of invoiceDb.values()) {
      if (inv.senderAddress === address || inv.recipientAddress === address) {
        userInvoices.push(inv);
      }
    }
    return NextResponse.json({ invoices: userInvoices, count: userInvoices.length });
  }

  return NextResponse.json({ invoices: Array.from(invoiceDb.values()) });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.action) {
    return NextResponse.json({ error: 'action required (create, pay, cancel)' }, { status: 400 });
  }

  if (body.action === 'create') {
    if (!body.senderAddress || !body.recipientAddress || !body.totalAmount || !body.token) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const id = `zinvoice_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const invoiceNum = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const record: InvoiceRecord = {
      id,
      invoiceNumber: invoiceNum,
      title: body.title || 'Freelance Services',
      senderTag: body.senderTag || `zk:${body.senderAddress.slice(2, 8)}`,
      senderAddress: body.senderAddress.toLowerCase(),
      recipientTag: body.recipientTag || `zk:${body.recipientAddress.slice(2, 8)}`,
      recipientAddress: body.recipientAddress.toLowerCase(),
      token: body.token,
      items: body.items || [],
      totalAmount: body.totalAmount,
      status: 'unpaid',
      dueDate: Date.now() + (body.dueDateDays || 14) * 86_400_000,
      createdAt: Date.now(),
    };

    invoiceDb.set(id, record);
    return NextResponse.json({ success: true, invoice: record });
  }

  if (body.action === 'pay') {
    const { id, txHash } = body;
    const inv = invoiceDb.get(id);
    if (!inv) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    inv.status = 'paid';
    inv.settlementTxHash = txHash || '0x' + Math.random().toString(36).substring(2, 18);
    inv.settledAt = Date.now();

    invoiceDb.set(id, inv);
    return NextResponse.json({ success: true, invoice: inv });
  }

  if (body.action === 'cancel') {
    const { id } = body;
    const inv = invoiceDb.get(id);
    if (!inv) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    inv.status = 'cancelled';
    invoiceDb.set(id, inv);
    return NextResponse.json({ success: true, invoice: inv });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
