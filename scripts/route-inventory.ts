import fs from 'fs';
import path from 'path';

interface RouteEntry {
  route: string;
  methods: string;
  isPublic: boolean;
  authMechanism: string;
  tables: string;
  filePath: string;
}

const API_DIR = path.resolve(process.cwd(), 'app/api');
const OUTPUT_FILE = path.resolve(process.cwd(), 'docs/security/routes.csv');

const PUBLIC_EXACT = new Set([
  '/api/health',
  '/api/status',
  '/api/siwe/nonce',
  '/api/siwe/verify',
  '/api/auth/session',
  '/api/auth/send-code',
  '/api/auth/verify-code',
]);

const PUBLIC_PREFIXES = [
  '/api/auth/',
  '/api/metrics/',
  '/api/chat/stories',
  '/api/aztec/airdrop',
  '/api/aztec/balance',
  '/api/aztec/transactions',
  '/api/aztec/derive-address',
  '/api/aztec/identity-status',
  '/api/aztec/restore-session',
  '/api/payments/checkout',
  '/api/webhooks/',
  '/api/registry/',
  '/api/user/register',
  '/api/settings',
];

function isPathPublic(routePath: string): boolean {
  if (PUBLIC_EXACT.has(routePath)) return true;
  return PUBLIC_PREFIXES.some(prefix => routePath.startsWith(prefix));
}

function findRoutes(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      findRoutes(fullPath, fileList);
    } else if (file === 'route.ts' || file === 'route.js') {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function analyzeRoute(filePath: string): RouteEntry {
  const relative = path.relative(API_DIR, path.dirname(filePath)).replace(/\\/g, '/');
  const route = '/api/' + (relative === '' ? '' : relative);
  const content = fs.readFileSync(filePath, 'utf-8');

  // Detect HTTP methods
  const methods: string[] = [];
  if (content.includes('export async function GET') || content.includes('export function GET')) methods.push('GET');
  if (content.includes('export async function POST') || content.includes('export function POST')) methods.push('POST');
  if (content.includes('export async function PUT') || content.includes('export function PUT')) methods.push('PUT');
  if (content.includes('export async function PATCH') || content.includes('export function PATCH')) methods.push('PATCH');
  if (content.includes('export async function DELETE') || content.includes('export function DELETE')) methods.push('DELETE');

  // Detect Auth Mechanism
  let authMechanism = 'none';
  if (content.includes('requireWallet')) {
    authMechanism = 'requireWallet';
  } else if (content.includes('withAuth')) {
    authMechanism = 'withAuth';
  } else if (content.includes('getSession')) {
    authMechanism = 'getSession';
  } else if (content.includes('resolveVerifiedCaller')) {
    authMechanism = 'resolveVerifiedCaller';
  } else if (content.includes('INTERNAL_CRON_SECRET') || content.includes('DEPLOY_SECRET')) {
    authMechanism = 'sharedSecret';
  }

  const isPublic = isPathPublic(route) || authMechanism === 'none';

  // Detect DB Tables
  const prismaMatches = content.match(/prisma\.([a-zA-Z0-9_]+)\./g) || [];
  const tables = Array.from(new Set(prismaMatches.map(m => m.replace('prisma.', '').replace('.', '')))).join(';');

  return {
    route,
    methods: methods.join('|') || 'UNKNOWN',
    isPublic,
    authMechanism,
    tables: tables || 'none',
    filePath: path.relative(process.cwd(), filePath).replace(/\\/g, '/'),
  };
}

export function generateInventory() {
  const routeFiles = findRoutes(API_DIR);
  const entries = routeFiles.map(analyzeRoute);

  // Ensure output dir exists
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });

  const csvRows = [
    'route,methods,is_public,auth_mechanism,tables,file_path',
    ...entries.map(e => `"${e.route}","${e.methods}",${e.isPublic},"${e.authMechanism}","${e.tables}","${e.filePath}"`)
  ];

  fs.writeFileSync(OUTPUT_FILE, csvRows.join('\n'), 'utf-8');
  console.log(`Inventory successfully generated: ${entries.length} routes recorded in ${OUTPUT_FILE}`);
}

generateInventory();
