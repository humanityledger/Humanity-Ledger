const fs = require('fs');

// Fix 2: The queue route also reads x-web3-address as fallback for non-cookie auth
let routeContent = fs.readFileSync('app/api/chat/queue/route.ts', 'utf8');

const oldGET = `export async function GET(req: NextRequest) {
  try {
    const session = await require('@/lib/session').getSession();
    const address = session?.userId;
    if (!address) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });`;

const newGET = `export async function GET(req: NextRequest) {
  try {
    // Primary: JWT cookie session
    let address: string | null = null;
    try {
      const session = await require('@/lib/session').getSession();
      address = session?.userId ?? null;
    } catch {}
    // Secondary fallback: x-web3-address header (used by XMTP client background sync)
    if (!address) {
      const headerAddr = req.headers.get('x-web3-address');
      if (headerAddr && /^0x[0-9a-fA-F]{40}$/.test(headerAddr)) {
        address = headerAddr.toLowerCase();
      }
    }
    if (!address) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });`;

routeContent = routeContent.replace(oldGET, newGET);

const oldPOST = `export async function POST(req: NextRequest) {
  try {
    const session = await require('@/lib/session').getSession();
    const address = session?.userId;
    if (!address) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });`;

const newPOST = `export async function POST(req: NextRequest) {
  try {
    let address: string | null = null;
    try {
      const session = await require('@/lib/session').getSession();
      address = session?.userId ?? null;
    } catch {}
    if (!address) {
      const headerAddr = req.headers.get('x-web3-address');
      if (headerAddr && /^0x[0-9a-fA-F]{40}$/.test(headerAddr)) {
        address = headerAddr.toLowerCase();
      }
    }
    if (!address) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });`;

routeContent = routeContent.replace(oldPOST, newPOST);
fs.writeFileSync('app/api/chat/queue/route.ts', routeContent);
console.log('Fixed queue route to accept x-web3-address as fallback auth');
