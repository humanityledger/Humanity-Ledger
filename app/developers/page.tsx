'use client';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Code2, BookOpen, Webhook, Bot, Zap, Terminal, ChevronRight,
  Copy, CheckCircle2, Search, ExternalLink, Hash, Lock, Globe,
  Package, Play, ArrowRight, Star, Users, Shield, Cpu
} from 'lucide-react';

const SIDEBAR_SECTIONS = [
  {
    label: 'Getting Started',
    icon: Zap,
    items: ['Introduction', 'Authentication', 'Quick Start', 'SDKs & Libraries'],
  },
  {
    label: 'Community SDK',
    icon: Package,
    items: ['Installation', 'Communities', 'Channels', 'Members', 'Token Gating'],
  },
  {
    label: 'REST API',
    icon: Globe,
    items: ['Communities API', 'Posts API', 'Members API', 'Payments API', 'Webhooks API'],
  },
  {
    label: 'Webhooks',
    icon: Webhook,
    items: ['Overview', 'Events Reference', 'Signatures', 'Retry Policy'],
  },
  {
    label: 'Bot Framework',
    icon: Bot,
    items: ['Creating a Bot', 'Bot Permissions', 'Commands', 'Slash Commands', 'Interactive UI'],
  },
  {
    label: 'Noir Circuits',
    icon: Shield,
    items: ['Overview', 'Token Gating Circuit', 'Membership Proofs', 'Governance Proofs'],
  },
];

const CODE_EXAMPLES: Record<string, { lang: string; code: string }> = {
  'Introduction': {
    lang: 'typescript',
    code: `import { LedgerClient } from '@humanity-ledger/sdk';

// Initialize the client with your API key
const client = new LedgerClient({
  apiKey: process.env.LEDGER_API_KEY,
  network: 'mainnet', // or 'testnet'
});

// Fetch all communities you have access to
const communities = await client.communities.list();
console.log(communities);
// => [{ id: '...', name: 'DeFi Builders', members: 2140, ... }]`,
  },
  'Authentication': {
    lang: 'typescript',
    code: `// Option 1: API Key (server-side)
const client = new LedgerClient({ apiKey: 'lk_live_...' });

// Option 2: Wallet Signature (client-side)
import { useWalletClient } from 'wagmi';
const { data: walletClient } = useWalletClient();

const session = await LedgerClient.createSession({
  walletClient,
  // Signs a standard SIWE message
});
const client = new LedgerClient({ session });

// Option 3: JWT Token (after SIWE)
const client = new LedgerClient({
  token: 'eyJhbGciOiJIUzI1NiJ9...',
});`,
  },
  'Quick Start': {
    lang: 'typescript',
    code: `import { LedgerClient } from '@humanity-ledger/sdk';
const client = new LedgerClient({ apiKey: process.env.LEDGER_API_KEY });

// Create a token-gated community
const community = await client.communities.create({
  name: 'My Alpha Community',
  description: 'For our NFT holders',
  isPrivate: false,
  tokenGating: {
    contractAddress: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
    standard: 'ERC-721',
    minimumBalance: 1,
  },
});
console.log(community.joinCode); // => 'abc123'`,
  },
  'Communities': {
    lang: 'typescript',
    code: `// List communities
const communities = await client.communities.list({ limit: 20 });

// Create a community
const community = await client.communities.create({
  name: 'Builders Hub',
  description: 'For web3 builders',
  isPrivate: false,
});

// Get a community by ID
const c = await client.communities.get('cm_abc123');

// Update community info
await client.communities.update('cm_abc123', {
  name: 'Builders Hub v2',
  description: 'Updated description',
});

// Delete a community (owner only)
await client.communities.delete('cm_abc123');`,
  },
  'Channels': {
    lang: 'typescript',
    code: `// Create a free channel
const channel = await client.channels.create('cm_abc123', {
  name: 'general',
  isPaid: false,
});

// Create a paid channel
const premiumChannel = await client.channels.create('cm_abc123', {
  name: 'alpha-calls',
  isPaid: true,
  price: '10',
  currency: 'USDC',
});

// List channels
const channels = await client.channels.list('cm_abc123');

// Delete a channel
await client.channels.delete('ch_xyz789');`,
  },
  'Token Gating': {
    lang: 'typescript',
    code: `// Set ERC-721 token gate (NFT)
await client.communities.setTokenGate('cm_abc123', {
  type: 'ERC721',
  contractAddress: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
  minimumBalance: 1,
  chain: 'ethereum',
});

// Set ERC-20 token gate (with threshold)
await client.communities.setTokenGate('cm_abc123', {
  type: 'ERC20',
  contractAddress: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
  minimumBalance: 1000, // 1000 UNI tokens
  chain: 'ethereum',
});

// Cross-chain token gate (Base)
await client.communities.setTokenGate('cm_abc123', {
  type: 'ERC20',
  contractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  minimumBalance: 100,
  chain: 'base',
});

// Verify a user's access
const { hasAccess } = await client.communities.verifyAccess('cm_abc123', {
  walletAddress: '0x1234...',
});`,
  },
  'Overview': {
    lang: 'typescript',
    code: `// Register a webhook endpoint
const webhook = await client.webhooks.create({
  url: 'https://yourapp.com/webhooks/ledger',
  events: [
    'community.member.joined',
    'community.message.sent',
    'community.payment.received',
  ],
  secret: 'your-webhook-secret',
});

// Verify webhook signature (in your handler)
import { verifyWebhookSignature } from '@humanity-ledger/sdk';

app.post('/webhooks/ledger', (req, res) => {
  const isValid = verifyWebhookSignature({
    payload: req.body,
    signature: req.headers['x-ledger-signature'],
    secret: 'your-webhook-secret',
  });
  if (!isValid) return res.status(401).send('Unauthorized');
  // Handle the event...
  res.status(200).send('OK');
});`,
  },
  'Creating a Bot': {
    lang: 'typescript',
    code: `import { LedgerBot } from '@humanity-ledger/bots';

const bot = new LedgerBot({
  name: 'MyBot',
  apiKey: process.env.BOT_API_KEY,
  permissions: ['READ_MESSAGES', 'SEND_MESSAGES', 'MANAGE_MEMBERS'],
});

// Handle messages
bot.on('message', async (ctx) => {
  if (ctx.content.startsWith('!hello')) {
    await ctx.reply('Hello from MyBot!');
  }
});

// Register a slash command
bot.command('price', async (ctx) => {
  const price = await fetchETHPrice();
  await ctx.reply(\`ETH: \$\${price.toLocaleString()}\`);
});

bot.start();
console.log('Bot is running!');`,
  },
  'Overview_noir': {
    lang: 'noir',
    code: `// Token Gating Circuit (Noir)
// Proves NFT ownership without revealing wallet address

fn main(
    wallet_address: Field,  // Private: user's wallet
    nft_contract: pub Field, // Public: the contract
    merkle_proof: [Field; 32], // Private: Merkle proof
    merkle_root: pub Field,  // Public: known NFT holders root
) -> pub bool {
    // Verify the wallet holds the NFT via Merkle proof
    let leaf = pedersen_hash([wallet_address, nft_contract]);
    let is_member = merkle_verify(leaf, merkle_proof, merkle_root);
    
    // Assert membership without revealing identity
    constrain is_member == true;
    is_member
}`,
  },
};

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group rounded-2xl overflow-hidden border border-black/8 bg-[#1C1C1E]">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
        </div>
        <span className="text-[11px] font-mono text-white/30 uppercase tracking-widest">{lang}</span>
        <button onClick={copy}
          className="flex items-center gap-1.5 text-[11px] font-bold text-white/30 hover:text-white/70 transition-colors">
          {copied ? <CheckCircle2 size={12} className="text-[#25D366]" /> : <Copy size={12} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-[13px] font-mono text-green-300 leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function DeveloperPortal() {
  const [activeSection, setActiveSection] = useState('Introduction');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['Getting Started'])
  );

  const toggleSection = (label: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  const codeKey = activeSection === 'Overview' &&
    SIDEBAR_SECTIONS.find(s => s.items.includes('Creating a Bot'))?.items.includes(activeSection)
    ? 'Overview_noir'
    : activeSection;
  const example = CODE_EXAMPLES[activeSection] || CODE_EXAMPLES['Introduction'];

  const allItems = SIDEBAR_SECTIONS.flatMap(s => s.items);
  const filteredItems = searchQuery
    ? allItems.filter(i => i.toLowerCase().includes(searchQuery.toLowerCase()))
    : null;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="border-b border-black/[0.06] bg-white/95 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#1C1C1E] flex items-center justify-center">
              <Terminal size={15} className="text-[#25D366]" />
            </div>
            <div>
              <span className="text-[15px] font-black text-[#1C1C1E]">Ledger</span>
              <span className="text-[15px] font-black text-[#25D366]"> Dev Portal</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://github.com/humanityledger/Humanity-Ledger" target="_blank" rel="noreferrer"
              className="text-[13px] font-semibold text-black/50 hover:text-black transition-colors flex items-center gap-1.5">
              <Star size={14} /> GitHub
            </a>
            <a href="/chat" className="px-4 py-2 bg-[#1C1C1E] text-white text-[13px] font-bold rounded-xl hover:bg-black transition-colors">
              Open App
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-[#FAFAFA] border-b border-black/[0.06] py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2 mb-4">
            <div className="px-2.5 py-1 bg-[#25D366]/10 text-[#25D366] text-[11px] font-black rounded-full uppercase tracking-widest">
              Beta
            </div>
          </div>
          <h1 className="text-[48px] md:text-[64px] font-black text-[#1C1C1E] leading-none tracking-tight mb-4">
            Build on<br />
            <span className="text-[#25D366]">Humanity Ledger</span>
          </h1>
          <p className="text-[18px] text-black/50 max-w-xl leading-relaxed mb-8">
            APIs, SDKs, Noir circuits and webhooks to build privacy-preserving communities and payments natively in your app.
          </p>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setActiveSection('Quick Start')}
              className="flex items-center gap-2 px-6 py-3 bg-[#1C1C1E] text-white font-bold rounded-2xl hover:bg-black transition-colors">
              <Play size={16} /> Quick Start
            </button>
            <a href="https://github.com/humanityledger/Humanity-Ledger" target="_blank" rel="noreferrer"
              className="flex items-center gap-2 px-6 py-3 bg-white text-[#1C1C1E] font-bold rounded-2xl border border-black/10 hover:bg-[#F2F2F7] transition-colors">
              <Code2 size={16} /> View Source
            </a>
          </div>

          {/* Stats */}
          <div className="mt-12 flex flex-wrap gap-8">
            {[
              { label: 'API Endpoints', val: '47' },
              { label: 'SDK Downloads', val: '12.4K' },
              { label: 'Active Bots', val: '89' },
              { label: 'Noir Circuits', val: '8' },
            ].map(s => (
              <div key={s.label}>
                <p className="text-[28px] font-black text-[#1C1C1E] leading-none">{s.val}</p>
                <p className="text-[12px] font-semibold text-black/40 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main docs layout */}
      <div className="max-w-7xl mx-auto flex flex-1 min-h-0 w-full">
        {/* Sidebar */}
        <aside className="w-64 shrink-0 border-r border-black/[0.06] py-6 sticky top-16 self-start max-h-[calc(100vh-4rem)] overflow-y-auto">
          {/* Search */}
          <div className="px-4 mb-4">
            <div className="flex items-center gap-2 bg-[#F2F2F7] rounded-xl px-3 py-2">
              <Search size={13} className="text-black/30 shrink-0" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search docs..."
                className="bg-transparent text-[13px] outline-none flex-1 placeholder:text-black/30" />
            </div>
          </div>

          {filteredItems ? (
            <div className="px-4 space-y-1">
              {filteredItems.map(item => (
                <button key={item} onClick={() => { setActiveSection(item); setSearchQuery(''); }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-[13px] font-medium transition-colors ${activeSection === item ? 'bg-[#25D366]/10 text-[#25D366] font-bold' : 'text-black/60 hover:text-black hover:bg-black/5'}`}>
                  {item}
                </button>
              ))}
            </div>
          ) : (
            SIDEBAR_SECTIONS.map(section => {
              const expanded = expandedSections.has(section.label);
              return (
                <div key={section.label} className="mb-1">
                  <button onClick={() => toggleSection(section.label)}
                    className="w-full flex items-center justify-between px-4 py-2 text-left hover:bg-black/[0.03] transition-colors">
                    <div className="flex items-center gap-2">
                      <section.icon size={13} className="text-black/40 shrink-0" />
                      <span className="text-[12px] font-black uppercase tracking-widest text-black/40">{section.label}</span>
                    </div>
                    <ChevronRight size={12} className={`text-black/25 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {expanded && (
                      <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                        <div className="pl-8 pr-4 pb-1 space-y-0.5">
                          {section.items.map(item => (
                            <button key={item} onClick={() => setActiveSection(item)}
                              className={`w-full text-left px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${activeSection === item ? 'text-[#25D366] font-bold bg-[#25D366]/8' : 'text-black/55 hover:text-black hover:bg-black/5'}`}>
                              {item}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}
        </aside>

        {/* Content */}
        <main className="flex-1 py-10 px-8 max-w-3xl">
          <motion.div key={activeSection} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            <div className="flex items-center gap-2 text-[12px] text-black/30 font-medium mb-6">
              <span>Docs</span>
              <ChevronRight size={12} />
              <span className="text-[#1C1C1E] font-bold">{activeSection}</span>
            </div>

            <h1 className="text-[36px] font-black text-[#1C1C1E] mb-3 leading-tight">{activeSection}</h1>
            <p className="text-[16px] text-black/50 leading-relaxed mb-8">
              Complete reference documentation for the <strong className="text-black/70">{activeSection}</strong> API.
              All endpoints are authenticated and support JSON.
            </p>

            <CodeBlock code={example.code} lang={example.lang} />

            {/* Quick links below the code */}
            <div className="mt-8 grid grid-cols-2 gap-3">
              {[
                { title: 'NPM Package', desc: '@humanity-ledger/sdk', href: '#' },
                { title: 'GitHub', desc: 'View source code', href: 'https://github.com/humanityledger' },
                { title: 'Discord', desc: 'Join our dev server', href: '#' },
                { title: 'Changelog', desc: 'Latest SDK updates', href: '/changelog' },
              ].map(link => (
                <a key={link.title} href={link.href} target={link.href.startsWith('http') ? '_blank' : '_self'} rel="noreferrer"
                  className="flex items-center justify-between p-4 rounded-2xl border border-black/8 hover:border-[#25D366]/30 hover:bg-[#25D366]/5 transition-all group">
                  <div>
                    <p className="text-[14px] font-bold text-[#1C1C1E]">{link.title}</p>
                    <p className="text-[12px] text-black/40">{link.desc}</p>
                  </div>
                  <ArrowRight size={14} className="text-black/20 group-hover:text-[#25D366] transition-colors" />
                </a>
              ))}
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
