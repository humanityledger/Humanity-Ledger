import { NextRequest, NextResponse } from 'next/server';

// In-memory address book for zk.money contacts
interface ZkContact {
  id: string;
  ownerAddress: string;
  contactAddress: string;
  contactHandle: string;
  displayName?: string;
  ensName?: string;
  avatarColor: string;
  lastInteracted: number;
  totalTransactions: number;
  totalVolume: string;
  token: string;
  isFavorite: boolean;
  note?: string;
  verified: boolean;
}

const addressBookDb = new Map<string, ZkContact[]>();

function getAvatarColor(address: string): string {
  const colors = ['#25D366', '#128C7E', '#075E54', '#34D399', '#059669', '#10B981'];
  const idx = parseInt(address.slice(2, 4), 16) % colors.length;
  return colors[idx];
}

export async function GET(req: NextRequest) {
  const ownerAddress = req.nextUrl.searchParams.get('ownerAddress')?.toLowerCase();
  const search = req.nextUrl.searchParams.get('search')?.toLowerCase();

  if (!ownerAddress) return NextResponse.json({ error: 'ownerAddress required' }, { status: 400 });

  let contacts = addressBookDb.get(ownerAddress) || [];

  if (search) {
    contacts = contacts.filter(c =>
      c.contactHandle.includes(search) ||
      c.displayName?.toLowerCase().includes(search) ||
      c.contactAddress.toLowerCase().includes(search)
    );
  }

  return NextResponse.json({
    contacts: contacts.sort((a, b) => b.lastInteracted - a.lastInteracted),
    total: contacts.length,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.action || !body?.ownerAddress) {
    return NextResponse.json({ error: 'action and ownerAddress required' }, { status: 400 });
  }

  const ownerAddress = body.ownerAddress.toLowerCase();
  const contacts = addressBookDb.get(ownerAddress) || [];

  if (body.action === 'add') {
    if (!body.contactAddress || !body.contactHandle) {
      return NextResponse.json({ error: 'contactAddress and contactHandle required' }, { status: 400 });
    }

    // Check duplicate
    const existing = contacts.find(c => c.contactAddress.toLowerCase() === body.contactAddress.toLowerCase());
    if (existing) {
      return NextResponse.json({ error: 'Contact already in address book', existing }, { status: 409 });
    }

    const contact: ZkContact = {
      id: `zkc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ownerAddress,
      contactAddress: body.contactAddress.toLowerCase(),
      contactHandle: body.contactHandle,
      displayName: body.displayName,
      ensName: body.ensName,
      avatarColor: getAvatarColor(body.contactAddress),
      lastInteracted: Date.now(),
      totalTransactions: 0,
      totalVolume: '0.00',
      token: 'DAI',
      isFavorite: false,
      note: body.note,
      verified: body.verified || false,
    };

    contacts.push(contact);
    addressBookDb.set(ownerAddress, contacts);
    return NextResponse.json({ success: true, contact });
  }

  if (body.action === 'favorite') {
    const { contactId, value } = body;
    const idx = contacts.findIndex(c => c.id === contactId);
    if (idx === -1) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    contacts[idx].isFavorite = value !== false;
    addressBookDb.set(ownerAddress, contacts);
    return NextResponse.json({ success: true, contact: contacts[idx] });
  }

  if (body.action === 'record_interaction') {
    const { contactAddress, amount, token } = body;
    const idx = contacts.findIndex(c => c.contactAddress === contactAddress?.toLowerCase());
    if (idx !== -1) {
      contacts[idx].totalTransactions += 1;
      contacts[idx].lastInteracted = Date.now();
      contacts[idx].totalVolume = (parseFloat(contacts[idx].totalVolume || '0') + parseFloat(amount || '0')).toFixed(2);
      contacts[idx].token = token || contacts[idx].token;
      addressBookDb.set(ownerAddress, contacts);
    }
    return NextResponse.json({ success: true });
  }

  if (body.action === 'remove') {
    const { contactId } = body;
    const filtered = contacts.filter(c => c.id !== contactId);
    addressBookDb.set(ownerAddress, filtered);
    return NextResponse.json({ success: true, removed: contacts.length - filtered.length });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
