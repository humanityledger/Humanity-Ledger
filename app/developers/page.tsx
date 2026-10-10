"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Code, 
  Globe, 
  Webhook, 
  Bot, 
  Cpu,
  ChevronRight,
  Terminal,
  Book,
  FileText,
  Copy,
  Check
} from 'lucide-react';

const SECTIONS = [
  { id: 'community-sdk', label: 'Community SDK', icon: <Code size={18} /> },
  { id: 'rest-api', label: 'REST API', icon: <Globe size={18} /> },
  { id: 'webhooks', label: 'Webhooks', icon: <Webhook size={18} /> },
  { id: 'bot-framework', label: 'Bot Framework', icon: <Bot size={18} /> },
  { id: 'noir-circuits', label: 'Noir Circuits', icon: <Cpu size={18} /> },
];

function CodeBlock({ code, language, filename }: { code: string; language: string; filename?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl overflow-hidden bg-[#0a0a0a] border border-gray-800 shadow-2xl my-6">
      <div className="flex items-center justify-between px-4 py-2 bg-[#1c1c1c] border-b border-gray-800">
        <div className="flex space-x-2 items-center">
          <div className="flex space-x-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
          </div>
          {filename && <span className="ml-4 text-xs font-mono text-gray-400">{filename}</span>}
        </div>
        <button 
          onClick={handleCopy}
          className="p-1 hover:bg-gray-700 rounded transition-colors text-gray-400 hover:text-white"
          aria-label="Copy code"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
      <div className="p-4 overflow-x-auto text-sm">
        <pre className="font-mono text-gray-300 leading-relaxed">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}

export default function DevelopersPortal() {
  const [activeSection, setActiveSection] = useState('community-sdk');

  const renderContent = () => {
    switch (activeSection) {
      case 'community-sdk':
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-4">Community SDK</h1>
            <p className="text-lg text-gray-600 mb-10 max-w-2xl leading-relaxed">
              The Humanity Ledger Community SDK provides a complete set of tools to build identity-aware decentralized applications. Integrate user authentication, read verifiable credentials, and interact with the protocol seamlessly.
            </p>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-start">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Install the SDK</h3>
                <p className="text-gray-600 mb-6 leading-relaxed">
                  Get started by installing the core packages via npm or yarn. The SDK requires Node.js 18.0 or later.
                </p>
                
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Initialize Client</h3>
                <p className="text-gray-600 mb-6 leading-relaxed">
                  Initialize the client with your API keys. You can obtain your keys from the Developer Dashboard. Make sure never to expose your secret key in client-side code.
                </p>
              </div>
              
              <div className="sticky top-8">
                <CodeBlock 
                  filename="terminal"
                  language="bash"
                  code={`npm install @humanity-ledger/sdk\nyarn add @humanity-ledger/sdk`}
                />
                
                <CodeBlock 
                  filename="index.ts"
                  language="typescript"
                  code={`import { HumanityClient } from '@humanity-ledger/sdk';\n\nconst client = new HumanityClient({\n  apiKey: process.env.HUMANITY_API_KEY,\n  network: 'mainnet',\n});\n\nconst profile = await client.users.getProfile('did:humanity:12345');\nconsole.log(profile.verifiedStatus);`}
                />
              </div>
            </div>
          </div>
        );
      
      case 'rest-api':
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-4">REST API</h1>
            <p className="text-lg text-gray-600 mb-10 max-w-2xl leading-relaxed">
              Our REST API allows you to interact directly with the Humanity Ledger backend from any language or framework. All API endpoints are authenticated using Bearer tokens.
            </p>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-start">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Authentication</h3>
                <p className="text-gray-600 mb-6 leading-relaxed">
                  Authenticate your API requests by including your secret API key in the Authorization header. Do not share your secret API keys in publicly accessible areas.
                </p>
                
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Create a Verification Request</h3>
                <p className="text-gray-600 mb-6 leading-relaxed">
                  Create a new zero-knowledge verification request for a user. This will prompt the user to provide a proof that satisfies the requested criteria.
                </p>
              </div>
              
              <div className="sticky top-8">
                <CodeBlock 
                  filename="bash"
                  language="bash"
                  code={`curl https://api.humanityledger.com/v1/verifications \\\n  -H "Authorization: Bearer sk_test_12345" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "user_id": "did:humanity:12345",\n    "type": "proof_of_unique_human",\n    "callback_url": "https://yourapp.com/webhooks/verify"\n  }'`}
                />
                <CodeBlock 
                  filename="Response"
                  language="json"
                  code={`{\n  "id": "req_8x9y0z",\n  "status": "pending",\n  "created_at": "2026-10-10T12:00:00Z",\n  "expires_at": "2026-10-10T13:00:00Z"\n}`}
                />
              </div>
            </div>
          </div>
        );

      case 'webhooks':
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-4">Webhooks</h1>
            <p className="text-lg text-gray-600 mb-10 max-w-2xl leading-relaxed">
              Listen for events on your Humanity Ledger account so your integration can automatically trigger reactions. Webhooks are essential for responding to asynchronous events like zero-knowledge proof generation.
            </p>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-start">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Receiving Events</h3>
                <p className="text-gray-600 mb-6 leading-relaxed">
                  When an event occurs, Humanity Ledger creates an Event object and sends an HTTP POST request to your endpoint.
                </p>
                
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Verifying Signatures</h3>
                <p className="text-gray-600 mb-6 leading-relaxed">
                  Always verify the webhook signature to ensure the request originated from Humanity Ledger and hasn't been tampered with. We include the `Humanity-Signature` header in every webhook request.
                </p>
              </div>
              
              <div className="sticky top-8">
                <CodeBlock 
                  filename="server.ts"
                  language="typescript"
                  code={`import express from 'express';\nimport { Webhook } from '@humanity-ledger/sdk';\n\nconst app = express();\nconst endpointSecret = "whsec_...";\n\napp.post('/webhook', express.raw({type: 'application/json'}), (req, res) => {\n  const sig = req.headers['humanity-signature'];\n  let event;\n\n  try {\n    event = Webhook.constructEvent(req.body, sig, endpointSecret);\n  } catch (err) {\n    return res.status(400).send(\`Webhook Error: \${err.message}\`);\n  }\n\n  // Handle the event\n  if (event.type === 'verification.succeeded') {\n    console.log('User verified!', event.data.object);\n  }\n\n  res.json({received: true});\n});`}
                />
              </div>
            </div>
          </div>
        );

      case 'bot-framework':
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-4">Bot Framework</h1>
            <p className="text-lg text-gray-600 mb-10 max-w-2xl leading-relaxed">
              Build intelligent, identity-aware agents that interact with users over XMTP. The Bot Framework handles encryption, session management, and wallet-based authentication out of the box.
            </p>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-start">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Creating a Bot</h3>
                <p className="text-gray-600 mb-6 leading-relaxed">
                  Bots run as daemons and listen for incoming messages on the XMTP network. They automatically inherit the reputation and verified status of their deployer's wallet.
                </p>
                
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Handling Messages</h3>
                <p className="text-gray-600 mb-6 leading-relaxed">
                  Use the intuitive `onMessage` handler to parse incoming messages and dispatch replies. The context object contains the sender's verified Humanity Ledger profile.
                </p>
              </div>
              
              <div className="sticky top-8">
                <CodeBlock 
                  filename="bot.ts"
                  language="typescript"
                  code={`import { Bot } from '@humanity-ledger/bot-framework';\n\nconst agent = new Bot({\n  privateKey: process.env.BOT_PRIVATE_KEY,\n  env: 'production'\n});\n\nagent.onMessage(async (ctx) => {\n  const { sender, text } = ctx.message;\n  \n  if (!sender.profile.isHuman) {\n    return ctx.reply("Please verify your humanity first.");\n  }\n\n  if (text.startsWith('/balance')) {\n    const balance = await getBalance(sender.address);\n    await ctx.reply(\`Your balance is \${balance} HMN.\`);\n  }\n});\n\nagent.start().then(() => {\n  console.log('🤖 Bot is listening on XMTP...');\n});`}
                />
              </div>
            </div>
          </div>
        );

      case 'noir-circuits':
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-4">Noir Circuits</h1>
            <p className="text-lg text-gray-600 mb-10 max-w-2xl leading-relaxed">
              Write custom zero-knowledge circuits using Noir. Compile them to WebAssembly and generate proofs directly in the browser or on mobile devices.
            </p>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-start">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Writing Circuits</h3>
                <p className="text-gray-600 mb-6 leading-relaxed">
                  Noir is a Rust-like domain specific language for creating zero-knowledge programs. It abstracts away the complex cryptography into standard programming paradigms.
                </p>
                
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Compiling and Proving</h3>
                <p className="text-gray-600 mb-6 leading-relaxed">
                  Compile your circuit using Nargo, then use our TypeScript SDK to generate and verify proofs in any JavaScript environment.
                </p>
              </div>
              
              <div className="sticky top-8">
                <CodeBlock 
                  filename="main.nr"
                  language="rust"
                  code={`fn main(x: Field, y: pub Field) {\n    // Assert that x * x == y\n    // x is a private witness, y is public\n    assert(x * x == y);\n    \n    // Verify user is older than 18 without revealing age\n    let age: u8 = get_age_from_oracle();\n    assert(age >= 18);\n}`}
                />
                <CodeBlock 
                  filename="terminal"
                  language="bash"
                  code={`nargo compile\nnargo execute witness\nnargo prove`}
                />
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Top Navbar / Header area if needed, otherwise layout provides it */}
      
      <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row">
        
        {/* Sidebar */}
        <div className="w-full md:w-72 flex-shrink-0 border-r border-gray-100 bg-[#fafafa]/50 min-h-[calc(100vh-80px)]">
          <div className="sticky top-0 p-6 pt-10">
            <div className="mb-8">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 px-3">
                Documentation
              </h2>
              <nav className="space-y-1">
                {SECTIONS.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                      activeSection === section.id
                        ? 'bg-blue-50/50 text-blue-600 shadow-sm border border-blue-100/50'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`p-1 rounded-md ${
                        activeSection === section.id ? 'bg-blue-100 text-blue-600' : 'bg-transparent text-gray-500'
                      }`}>
                        {section.icon}
                      </div>
                      <span>{section.label}</span>
                    </div>
                    {activeSection === section.id && (
                      <ChevronRight size={16} className="text-blue-500 opacity-70" />
                    )}
                  </button>
                ))}
              </nav>
            </div>
            
            <div className="mb-8">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 px-3">
                Resources
              </h2>
              <nav className="space-y-1">
                <a href="#" className="flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors">
                  <Terminal size={18} className="text-gray-400" />
                  <span>API Reference</span>
                </a>
                <a href="#" className="flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors">
                  <Book size={18} className="text-gray-400" />
                  <span>Guides</span>
                </a>
                <a href="#" className="flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors">
                  <FileText size={18} className="text-gray-400" />
                  <span>Changelog</span>
                </a>
              </nav>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 w-full bg-white">
          <div className="py-10 px-6 sm:px-10 lg:px-16 max-w-5xl">
            {renderContent()}
          </div>
        </main>
        
      </div>
    </div>
  );
}
