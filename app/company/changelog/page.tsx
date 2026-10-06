import DocLayout from '@/components/layout/DocLayout';
import { Rocket, Bug, Sparkles, Shield, Zap, TrendingUp } from 'lucide-react';

export default function ChangelogPage() {
    return (
        <DocLayout
            title="Changelog"
            description="Track new features, improvements, and bug fixes in Humanity Ledger."
            lastUpdated="February 7, 2026"
            category="Company"
        >
            <div className="space-y-8">
                {/* Hero */}
                <section className="bg-gradient-to-r from-green-600/20 to-blue-600/20 p-8 rounded-xl border border-white/10">
                    <h2 className="text-4xl font-bold mb-4">Changelog</h2>
                    <p className="text-lg text-black/80">
                        Stay up-to-date with the latest features, improvements, and fixes across the Humanity Ledger platform.
                    </p>
                </section>

                {/* Latest Release */}
                <section>
                    <div className="border-l-4 border-green-500 pl-6">
                        <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-3xl font-bold">v2.1.0</h3>
                            <span className="bg-green-600/20 border border-green-500/30 px-3 py-1 rounded text-sm font-bold">LATEST</span>
                        </div>
                        <p className="text-black/60 mb-6">February 7, 2026</p>

                        <div className="space-y-4">
                            <div>
                                <h4 className="font-bold mb-2 flex items-center gap-2">
                                    <Rocket className="text-green-400" size={20} />
                                    New Features
                                </h4>
                                <ul className="list-disc pl-6 space-y-1 text-sm text-black/70">
                                    <li><strong>Ledger Tracker Premium Analytics:</strong> Advanced insights including P&L breakdown, smart contract interactions, and liquidity pool tracking</li>
                                    <li><strong>Multi-Chain Portfolio Dashboard:</strong> Real-time balance tracking across Ethereum, Base, Polygon, Arbitrum, and Optimism</li>
                                    <li><strong>Enhanced Authentication:</strong> Passkeys (WebAuthn) support for biometric login</li>
                                    <li><strong>NFT Gallery:</strong> View and manage your NFT collection across all supported chains</li>
                                    <li><strong>Transaction History Export:</strong> Download CSV reports for tax filing</li>
                                </ul>
                            </div>

                            <div>
                                <h4 className="font-bold mb-2 flex items-center gap-2">
                                    <TrendingUp className="text-blue-400" size={20} />
                                    Improvements
                                </h4>
                                <ul className="list-disc pl-6 space-y-1 text-sm text-black/70">
                                    <li>30% faster portfolio loading times via optimized Alchemy API calls</li>
                                    <li>Improved chart responsiveness with fluid typography (clamp-based sizing)</li>
                                    <li>Enhanced gas estimation accuracy for all supported networks</li>
                                    <li>Better error messages and user feedback across the platform</li>
                                </ul>
                            </div>

                            <div>
                                <h4 className="font-bold mb-2 flex items-center gap-2">
                                    <Bug className="text-red-400" size={20} />
                                    Bug Fixes
                                </h4>
                                <ul className="list-disc pl-6 space-y-1 text-sm text-black/70">
                                    <li>Fixed portfolio page "System Error" when wallet not connected</li>
                                    <li>Resolved landing page title overflow on different zoom levels</li>
                                    <li>Fixed chart flickering on timeframe switches</li>
                                    <li>Corrected token balance rounding errors for tokens with {'>'}18 decimals</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Previous Releases */}
                <section>
                    <h2 className="text-3xl font-bold mb-6">Previous Releases</h2>

                    <div className="space-y-8">
                        {/* v2.0.0 */}
                        <div className="border-l-4 border-[#25D366] pl-6">
                            <h3 className="text-2xl font-bold mb-1">v2.0.0</h3>
                            <p className="text-black/60 mb-4">January 15, 2026</p>

                            <div className="space-y-3">
                                <div>
                                    <h4 className="font-bold mb-2 flex items-center gap-2">
                                        <Rocket className="text-green-400" size={18} />
                                        New Features
                                    </h4>
                                    <ul className="list-disc pl-6 space-y-1 text-sm text-black/70">
                                        <li><strong>Sovereign Grid:</strong> Real-time charts, order book, and attest execution for 30+ pairs</li>
                                        <li><strong>Demo Attesting Mode:</strong> Practice with virtual funds before risking real crypto</li>
                                        <li><strong>WebSocket Integration:</strong> Active market data with sub-100ms latency</li>
                                        <li><strong>Multi-Timeframe Charts:</strong> 1m, 5m, 15m, 1h, 4h, 1D, 1W, 1M intervals</li>
                                    </ul>
                                </div>

                                <div>
                                    <h4 className="font-bold mb-2 flex items-center gap-2">
                                        <TrendingUp className="text-blue-400" size={18} />
                                        Improvements
                                    </h4>
                                    <ul className="list-disc pl-6 space-y-1 text-sm text-black/70">
                                        <li>Redesigned UI with Elite-grade aesthetics</li>
                                        <li>Optimized database queries for 50% faster page loads</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* v1.5.0 */}
                        <div className="border-l-4 border-purple-500 pl-6">
                            <h3 className="text-2xl font-bold mb-1">v1.5.0</h3>
                            <p className="text-black/60 mb-4">December 10, 2025</p>

                            <div className="space-y-3">
                                <div>
                                    <h4 className="font-bold mb-2 flex items-center gap-2">
                                        <Rocket className="text-green-400" size={18} />
                                        New Features
                                    </h4>
                                    <ul className="list-disc pl-6 space-y-1 text-sm text-black/70">
                                        <li><strong>Ledger Tracker (Basic):</strong> Monitor and analyze high-value wallets</li>
                                        <li><strong>Real-Time Alerts:</strong> Browser notifications for ledger movements and price targets</li>
                                        <li><strong>Cross-Chain Bridge:</strong> Move assets between L1s and L2s seamlessly</li>
                                    </ul>
                                </div>

                                <div>
                                    <h4 className="font-bold mb-2 flex items-center gap-2">
                                        <Shield className="text-purple-400" size={18} />
                                        Security
                                    </h4>
                                    <ul className="list-disc pl-6 space-y-1 text-sm text-black/70">
                                        <li>Implemented AML/CTF transaction monitoring</li>
                                        <li>Added sanctions screening for all wallet interactions</li>
                                        <li>Enhanced 2FA with backup codes</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* v1.0.0 */}
                        <div className="border-l-4 border-yellow-500 pl-6">
                            <h3 className="text-2xl font-bold mb-1">v1.0.0</h3>
                            <p className="text-black/60 mb-4">November 1, 2025</p>

                            <div className="space-y-3">
                                <div>
                                    <h4 className="font-bold mb-2 flex items-center gap-2">
                                        <Sparkles className="text-black" size={18} />
                                        Initial Launch
                                    </h4>
                                    <ul className="list-disc pl-6 space-y-1 text-sm text-black/70">
                                        <li><strong>World ID Integration:</strong> Zero-knowledge identity verification</li>
                                        <li><strong>Multi-Chain Wallet:</strong> Support for Ethereum, Base, and Polygon</li>
                                        <li><strong>Send & Receive:</strong> Basic token transfers with ENS support</li>
                                        <li><strong>Token Swaps:</strong> DEX aggregation for best prices</li>
                                        <li><strong>Portfolio Tracking:</strong> Real-time balance and performance charts</li>
                                        <li><strong>GHOST Tier:</strong> Free tier for all users</li>
                                        <li><strong>HUMAN Tier:</strong> Verified users with World ID</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Upcoming */}
                <section>
                    <h2 className="text-3xl font-bold mb-6 flex items-center gap-2">
                        <Zap className="text-black" />
                        Coming Soon
                    </h2>

                    <div className="space-y-4">
                        <div className="bg-black/5 border border-black/10 p-6 rounded-xl">
                            <h3 className="font-bold mb-2">v2.2.0 - Q2 2026 (Planned)</h3>
                            <ul className="list-disc pl-6 space-y-1 text-sm text-black/70">
                                <li><strong>LEGEND Tier Launch:</strong> Premium features with API access</li>
                                <li><strong>Public API (Beta):</strong> REST and WebSocket APIs for developers</li>
                                <li><strong>AI Attesting Assistant:</strong> Natural language market analysis</li>
                                <li><strong>Arbitrum & Optimism Support:</strong> Full L2 integration</li>
                                <li><strong>Spanish Localization:</strong> Complete UI translation</li>
                            </ul>
                        </div>

                        <div className="bg-blue-600/10 border border-[#25D366]/30 p-6 rounded-xl">
                            <h3 className="font-bold mb-2">v3.0.0 - Q3 2026 (Planned)</h3>
                            <ul className="list-disc pl-6 space-y-1 text-sm text-black/70">
                                <li><strong>Mobile Apps:</strong> Native iOS and Android applications</li>
                                <li><strong>DeFi Yield Aggregator:</strong> Auto-compound yields across protocols</li>
                                <li><strong>Social Attesting:</strong> Copy attestations from top performers</li>
                                <li><strong>Advanced Order Types:</strong> Stop-loss, take-profit, trailing stops</li>
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Feedback */}
                <section className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 p-8 rounded-xl border border-white/10 text-center">
                    <h2 className="text-3xl font-bold mb-4">Have Feedback?</h2>
                    <p className="text-lg text-black/80 mb-6">
                        We'd love to hear your ideas for new features or improvements.
                    </p>
                    <div className="flex flex-wrap justify-center gap-4">
                        <a href="https://discord.gg/humanityledger" target="_blank" rel="noopener noreferrer" className="px-8 py-3 bg-white/10 border border-white/20 rounded-lg font-bold hover:bg-white/20 transition-colors">
                            Join Discord
                        </a>
                        <a href="mailto:feedback@Humanity Ledger" className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg font-bold hover:scale-105 transition-transform">
                            Send Feedback
                        </a>
                    </div>
                </section>
            </div>
        </DocLayout>
    );
}


