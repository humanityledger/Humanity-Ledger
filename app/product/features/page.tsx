import DocLayout from '@/components/layout/DocLayout';
import { Sparkles, Shield, Wallet, TrendingUp, Users, Zap, Eye, Lock } from 'lucide-react';

export default function FeaturesPage() {
    return (
        <DocLayout
            title="Features"
            description="Discover Humanity Ledger's powerful features: zero knowledge identity, multi-chain wallet, professional attesting tools, and Elite-grade analytics."
            lastUpdated="February 7, 2026"
            category="Product"
        >
            <div className="space-y-8">
                {/* Hero */}
                <section className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 p-8 rounded-xl border border-white/10">
                    <h2 className="text-4xl font-bold mb-4">The Future of DeFi Identity & Attesting</h2>
                    <p className="text-lg text-white/80">
                        Humanity Ledger combines cutting-edge zero knowledge technology with professional-grade attesting tools to deliver an unparalleled DeFi experience.
                    </p>
                </section>

                {/* Core Features */}
                <section>
                    <h2 className="text-3xl font-bold mb-6 flex items-center gap-2">
                        <Sparkles className="text-yellow-400" />
                        Core Features
                    </h2>

                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Zero Knowledge Identity */}
                        <div className="bg-gradient-to-br from-purple-600/10 to-pink-600/10 p-6 rounded-xl border border-purple-500/30">
                            <div className="flex items-center gap-3 mb-4">
                                <Shield className="text-purple-400" size={32} />
                                <h3 className="text-2xl font-bold">Zero Knowledge Identity</h3>
                            </div>
                            <p className="mb-4 text-white/70">
                                Prove you're human without revealing who you are. Our World ID integration uses zero knowledge proofs to verify your identity while preserving complete privacy.
                            </p>
                            <ul className="space-y-2 text-sm">
                                <li className="flex items-start gap-2">
                                    <span className="text-purple-400"></span>
                                    <span><strong>Biometric Verification:</strong> Iris scan proves unique personhood</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-purple-400"></span>
                                    <span><strong>No PII Stored:</strong> Zero personal data on our servers</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-purple-400"></span>
                                    <span><strong>Sybil Resistance:</strong> One identity per human, prevents bots and multi-accounting</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-purple-400"></span>
                                    <span><strong>GDPR Compliant:</strong> Privacy by design</span>
                                </li>
                            </ul>
                        </div>

                        {/* Multi-Chain Wallet */}
                        <div className="bg-gradient-to-br from-blue-600/10 to-cyan-600/10 p-6 rounded-xl border border-[#25D366]/30">
                            <div className="flex items-center gap-3 mb-4">
                                <Wallet className="text-blue-400" size={32} />
                                <h3 className="text-2xl font-bold">Multi-Chain Wallet</h3>
                            </div>
                            <p className="mb-4 text-white/70">
                                Self-custody wallet supporting 5 major blockchain networks. Your keys, your cryptoalways.
                            </p>
                            <ul className="space-y-2 text-sm">
                                <li className="flex items-start gap-2">
                                    <span className="text-blue-400"></span>
                                    <span><strong>Supported Chains:</strong> Ethereum, Base, Polygon, Arbitrum, Optimism</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-blue-400"></span>
                                    <span><strong>Self-Custody:</strong> Private keys never leave your device</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-blue-400"></span>
                                    <span><strong>WalletConnect:</strong> Compatible with all major dApps</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-blue-400"></span>
                                    <span><strong>Hardware Wallet Support:</strong> Ledger, Trezor integration</span>
                                </li>
                            </ul>
                        </div>

                        {/* Attesting Terminal */}
                        <div className="bg-gradient-to-br from-green-600/10 to-emerald-600/10 p-6 rounded-xl border border-green-500/30">
                            <div className="flex items-center gap-3 mb-4">
                                <TrendingUp className="text-green-400" size={32} />
                                <h3 className="text-2xl font-bold">Professional Attesting Terminal</h3>
                            </div>
                            <p className="mb-4 text-white/70">
                                Elite-grade attesting interface with real-time data, advanced charting, and order types.
                            </p>
                            <ul className="space-y-2 text-sm">
                                <li className="flex items-start gap-2">
                                    <span className="text-green-400"></span>
                                    <span><strong>30+ Attesting Pairs:</strong> BTC, ETH, SOL, and more</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-green-400"></span>
                                    <span><strong>Real-Time Charts:</strong> AttestingView-style candles with indicators</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-green-400"></span>
                                    <span><strong>Order Book:</strong> Active depth visualization</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-green-400"></span>
                                    <span><strong>Demo Mode:</strong> Practice with virtual funds (currently active)</span>
                                </li>
                            </ul>
                        </div>

                        {/* Analytics */}
                        <div className="bg-gradient-to-br from-orange-600/10 to-red-600/10 p-6 rounded-xl border border-orange-500/30">
                            <div className="flex items-center gap-3 mb-4">
                                <Eye className="text-orange-400" size={32} />
                                <h3 className="text-2xl font-bold">Ledger Tracker & Analytics</h3>
                            </div>
                            <p className="mb-4 text-white/70">
                                Track, analyze, and learn from the biggest wallets in crypto. See what ledgers are doing before the market reacts.
                            </p>
                            <ul className="space-y-2 text-sm">
                                <li className="flex items-start gap-2">
                                    <span className="text-orange-400"></span>
                                    <span><strong>Ledger Detection:</strong> Auto-identify high-value wallets</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-orange-400"></span>
                                    <span><strong>Real-Time Alerts:</strong> Get notified of large transactions</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-orange-400"></span>
                                    <span><strong>Comprehensive Analytics:</strong> Activity score, risk score, P&L</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-orange-400"></span>
                                    <span><strong>Portfolio Insights:</strong> Real blockchain data via Alchemy</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Detailed Feature Breakdown */}
                <section>
                    <h2 className="text-3xl font-bold mb-6">Detailed Features</h2>

                    {/* Wallet Features */}
                    <div className="mb-8">
                        <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
                            <Wallet className="text-blue-400" />
                            Wallet Capabilities
                        </h3>

                        <div className="grid md:grid-cols-3 gap-4">
                            <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                                <h4 className="font-bold mb-2"> Send & Receive</h4>
                                <p className="text-sm text-white/70">Seamless transfers with QR codes, ENS support, and transaction history.</p>
                            </div>

                            <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                                <h4 className="font-bold mb-2"> Token Swaps</h4>
                                <p className="text-sm text-white/70">Instant DEX swaps with best-price routing across liquidity pools.</p>
                            </div>

                            <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                                <h4 className="font-bold mb-2"> Cross-Chain Bridge</h4>
                                <p className="text-sm text-white/70">Move assets between L1s and L2s with minimal fees.</p>
                            </div>

                            <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                                <h4 className="font-bold mb-2">️ NFT Gallery</h4>
                                <p className="text-sm text-white/70">View, send, and receive NFTs from all supported chains.</p>
                            </div>

                            <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                                <h4 className="font-bold mb-2"> Portfolio Dashboard</h4>
                                <p className="text-sm text-white/70">Real-time balance tracking with historical performance charts.</p>
                            </div>

                            <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                                <h4 className="font-bold mb-2"> Gas Optimization</h4>
                                <p className="text-sm text-white/70">Real-time gas estimates with EIP-1559 support for optimal fees.</p>
                            </div>
                        </div>
                    </div>

                    {/* Attesting Features */}
                    <div className="mb-8">
                        <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
                            <TrendingUp className="text-green-400" />
                            Attesting Tools
                        </h3>

                        <div className="grid md:grid-cols-3 gap-4">
                            <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                                <h4 className="font-bold mb-2"> Advanced Charting</h4>
                                <p className="text-sm text-white/70">Multiple timeframes (1m-1M), 50+ indicators, drawing tools.</p>
                            </div>

                            <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                                <h4 className="font-bold mb-2"> Order Book Depth</h4>
                                <p className="text-sm text-white/70">Real-time order book with bid/ask spread visualization.</p>
                            </div>

                            <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                                <h4 className="font-bold mb-2">️ Recent Attestations</h4>
                                <p className="text-sm text-white/70">Active attest feed showing market activity and price action.</p>
                            </div>

                            <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                                <h4 className="font-bold mb-2"> Limit Orders</h4>
                                <p className="text-sm text-white/70">Set target prices for automated entry/exit.</p>
                            </div>

                            <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                                <h4 className="font-bold mb-2"> Volume Analysis</h4>
                                <p className="text-sm text-white/70">Volume bars, VWAP, and liquidity heatmaps.</p>
                            </div>

                            <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                                <h4 className="font-bold mb-2"> Price Alerts</h4>
                                <p className="text-sm text-white/70">Browser notifications when your price targets are hit.</p>
                            </div>
                        </div>
                    </div>

                    {/* Security Features */}
                    <div className="mb-8">
                        <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
                            <Lock className="text-purple-400" />
                            Security & Privacy
                        </h3>

                        <div className="grid md:grid-cols-3 gap-4">
                            <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                                <h4 className="font-bold mb-2"> Multi-Factor Auth</h4>
                                <p className="text-sm text-white/70">Passkeys, 2FA, hardware keys for maximum account security.</p>
                            </div>

                            <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                                <h4 className="font-bold mb-2">️ Zero Knowledge Proofs</h4>
                                <p className="text-sm text-white/70">Verify identity without revealing personal data.</p>
                            </div>

                            <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                                <h4 className="font-bold mb-2"> End to End Encryption</h4>
                                <p className="text-sm text-white/70">TLS 1.3, AES-256 encryption for all data.</p>
                            </div>

                            <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                                <h4 className="font-bold mb-2"> Fraud Detection</h4>
                                <p className="text-sm text-white/70">AI-powered anomaly detection for suspicious activity.</p>
                            </div>

                            <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                                <h4 className="font-bold mb-2"> Seed Phrase Backup</h4>
                                <p className="text-sm text-white/70">Secure 24-word mnemonic with offline storage recommendations.</p>
                            </div>

                            <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                                <h4 className="font-bold mb-2"> Session Management</h4>
                                <p className="text-sm text-white/70">Device tracking, auto-logout, and remote session termination.</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Tier Comparison */}
                <section>
                    <h2 className="text-3xl font-bold mb-6">Feature Tiers</h2>

                    <div className="overflow-x-auto">
                        <table className="w-full border border-white/10 text-sm">
                            <thead className="bg-white/5">
                                <tr>
                                    <th className="border border-white/10 p-3 text-left">Feature</th>
                                    <th className="border border-white/10 p-3 text-center">GHOST (Free)</th>
                                    <th className="border border-white/10 p-3 text-center">HUMAN (Free)</th>
                                    <th className="border border-white/10 p-3 text-center">LEGEND (TBD)</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className="border border-white/10 p-3">Account Creation</td>
                                    <td className="border border-white/10 p-3 text-center"></td>
                                    <td className="border border-white/10 p-3 text-center"></td>
                                    <td className="border border-white/10 p-3 text-center"></td>
                                </tr>
                                <tr className="bg-white/5">
                                    <td className="border border-white/10 p-3">World ID Verification</td>
                                    <td className="border border-white/10 p-3 text-center"></td>
                                    <td className="border border-white/10 p-3 text-center"></td>
                                    <td className="border border-white/10 p-3 text-center"></td>
                                </tr>
                                <tr>
                                    <td className="border border-white/10 p-3">Multi-Chain Wallet</td>
                                    <td className="border border-white/10 p-3 text-center"></td>
                                    <td className="border border-white/10 p-3 text-center"></td>
                                    <td className="border border-white/10 p-3 text-center"></td>
                                </tr>
                                <tr className="bg-white/5">
                                    <td className="border border-white/10 p-3">Real Wallet Transactions</td>
                                    <td className="border border-white/10 p-3 text-center"></td>
                                    <td className="border border-white/10 p-3 text-center"></td>
                                    <td className="border border-white/10 p-3 text-center"></td>
                                </tr>
                                <tr>
                                    <td className="border border-white/10 p-3">Demo Attesting</td>
                                    <td className="border border-white/10 p-3 text-center"></td>
                                    <td className="border border-white/10 p-3 text-center"></td>
                                    <td className="border border-white/10 p-3 text-center"></td>
                                </tr>
                                <tr className="bg-white/5">
                                    <td className="border border-white/10 p-3">Attesting Pairs</td>
                                    <td className="border border-white/10 p-3 text-center">30+</td>
                                    <td className="border border-white/10 p-3 text-center">30+</td>
                                    <td className="border border-white/10 p-3 text-center">50+</td>
                                </tr>
                                <tr>
                                    <td className="border border-white/10 p-3">Advanced Charts</td>
                                    <td className="border border-white/10 p-3 text-center"></td>
                                    <td className="border border-white/10 p-3 text-center"></td>
                                    <td className="border border-white/10 p-3 text-center"> + Custom Indicators</td>
                                </tr>
                                <tr className="bg-white/5">
                                    <td className="border border-white/10 p-3">Ledger Tracker (Basic)</td>
                                    <td className="border border-white/10 p-3 text-center"></td>
                                    <td className="border border-white/10 p-3 text-center"></td>
                                    <td className="border border-white/10 p-3 text-center"></td>
                                </tr>
                                <tr>
                                    <td className="border border-white/10 p-3">Ledger Tracker (Premium Analytics)</td>
                                    <td className="border border-white/10 p-3 text-center"></td>
                                    <td className="border border-white/10 p-3 text-center"></td>
                                    <td className="border border-white/10 p-3 text-center"></td>
                                </tr>
                                <tr className="bg-white/5">
                                    <td className="border border-white/10 p-3">API Access</td>
                                    <td className="border border-white/10 p-3 text-center"></td>
                                    <td className="border border-white/10 p-3 text-center"></td>
                                    <td className="border border-white/10 p-3 text-center"></td>
                                </tr>
                                <tr>
                                    <td className="border border-white/10 p-3">Priority Support</td>
                                    <td className="border border-white/10 p-3 text-center"></td>
                                    <td className="border border-white/10 p-3 text-center">Email</td>
                                    <td className="border border-white/10 p-3 text-center">24/7 Active Chat</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Coming Soon */}
                <section>
                    <h2 className="text-3xl font-bold mb-6 flex items-center gap-2">
                        <Zap className="text-yellow-400" />
                        Coming Soon
                    </h2>

                    <div className="grid md:grid-cols-3 gap-4">
                        <div className="bg-gradient-to-br from-yellow-600/10 to-orange-600/10 p-4 rounded-lg border border-yellow-500/30">
                            <h4 className="font-bold mb-2"> AI Attesting Assistant</h4>
                            <p className="text-sm text-white/70">Natural language interface for market analysis and attest execution.</p>
                            <p className="text-xs text-yellow-400 mt-2">Q2 2026</p>
                        </div>

                        <div className="bg-gradient-to-br from-green-600/10 to-emerald-600/10 p-4 rounded-lg border border-green-500/30">
                            <h4 className="font-bold mb-2"> Mobile App</h4>
                            <p className="text-sm text-white/70">Native iOS and Android apps with full feature parity.</p>
                            <p className="text-xs text-green-400 mt-2">Q3 2026</p>
                        </div>

                        <div className="bg-gradient-to-br from-blue-600/10 to-cyan-600/10 p-4 rounded-lg border border-[#25D366]/30">
                            <h4 className="font-bold mb-2"> DeFi Yield Aggregator</h4>
                            <p className="text-sm text-white/70">Auto-compound yields across protocols with one click.</p>
                            <p className="text-xs text-blue-400 mt-2">Q4 2026</p>
                        </div>

                        <div className="bg-gradient-to-br from-purple-600/10 to-pink-600/10 p-4 rounded-lg border border-purple-500/30">
                            <h4 className="font-bold mb-2"> Prediction Markets</h4>
                            <p className="text-sm text-white/70">Bet on real-world events with crypto-native prediction markets.</p>
                            <p className="text-xs text-purple-400 mt-2">Q1 2027</p>
                        </div>

                        <div className="bg-gradient-to-br from-red-600/10 to-orange-600/10 p-4 rounded-lg border border-red-500/30">
                            <h4 className="font-bold mb-2"> Fiat On/Off Ramps</h4>
                            <p className="text-sm text-white/70">Buy crypto with credit card, bank transfer, or Apple Pay.</p>
                            <p className="text-xs text-red-400 mt-2">Q2 2027</p>
                        </div>

                        <div className="bg-gradient-to-br from-indigo-600/10 to-blue-600/10 p-4 rounded-lg border border-indigo-500/30">
                            <h4 className="font-bold mb-2"> Social Attesting</h4>
                            <p className="text-sm text-white/70">Copy attestations from top performers, share strategies, earn commissions.</p>
                            <p className="text-xs text-indigo-400 mt-2">Q3 2027</p>
                        </div>
                    </div>
                </section>

                {/* CTA */}
                <section className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 p-8 rounded-xl border border-white/10 text-center">
                    <h2 className="text-3xl font-bold mb-4">Ready to Experience the Future?</h2>
                    <p className="text-lg text-white/80 mb-6">
                        Join Humanity Ledger today and unlock the full power of DeFi with privacy, security, and professional-grade tools.
                    </p>
                    <div className="flex flex-wrap justify-center gap-4">
                        <a href="/signup" className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg font-bold hover:scale-105 transition-transform">
                            Get Started Free
                        </a>
                        <a href="/demo" className="px-8 py-3 bg-white/10 border border-white/20 rounded-lg font-bold hover:bg-white/20 transition-colors">
                            Try Demo
                        </a>
                    </div>
                </section>
            </div>
        </DocLayout>
    );
}


