import DocLayout from '@/components/layout/DocLayout';
import { Mail, MessageSquare, Twitter, Github } from 'lucide-react';

export default function ContactPage() {
    return (
        <DocLayout
            title="Contact Us"
            description="Get in touch with the Humanity Ledger team for support, partnerships, or general inquiries."
            lastUpdated="February 7, 2026"
            category="Company"
        >
            <div className="space-y-8">
                {/* Hero */}
                <section className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 p-8 rounded-xl border border-white/10 text-center">
                    <h2 className="text-4xl font-bold mb-4">We're Here to Help</h2>
                    <p className="text-lg text-white/80">
                        Have questions? Need support? Want to partner with us? We'd love to hear from you.
                    </p>
                </section>

                {/* Contact Methods */}
                <section>
                    <h2 className="text-3xl font-bold mb-6">Get in Touch</h2>

                    <div className="grid md:grid-cols-2 gap-6">
                        {/* General */}
                        <div className="bg-white/5 p-6 rounded-xl border border-white/10">
                            <div className="flex items-center gap-3 mb-4">
                                <Mail className="text-blue-400" size={32} />
                                <h3 className="text-2xl font-bold">General Inquiries</h3>
                            </div>
                            <p className="mb-4 text-sm text-white/70">
                                For general questions, feedback, or business inquiries.
                            </p>
                            <a href="mailto:hello@Humanity Ledger" className="text-blue-400 hover:underline text-lg font-bold">
                                hello@Humanity Ledger
                            </a>
                        </div>

                        {/* Support */}
                        <div className="bg-white/5 p-6 rounded-xl border border-white/10">
                            <div className="flex items-center gap-3 mb-4">
                                <MessageSquare className="text-green-400" size={32} />
                                <h3 className="text-2xl font-bold">Technical Support</h3>
                            </div>
                            <p className="mb-4 text-sm text-white/70">
                                Need help with your account, wallet, or attesting?
                            </p>
                            <a href="mailto:support@Humanity Ledger" className="text-green-400 hover:underline text-lg font-bold">
                                support@Humanity Ledger
                            </a>
                            <p className="mt-3 text-xs text-white/60">Response time: Within 24 hours</p>
                        </div>

                        {/* Legal */}
                        <div className="bg-white/5 p-6 rounded-xl border border-white/10">
                            <div className="flex items-center gap-3 mb-4">
                                <Mail className="text-purple-400" size={32} />
                                <h3 className="text-2xl font-bold">Legal & Attestation</h3>
                            </div>
                            <p className="mb-4 text-sm text-white/70">
                                GDPR requests, regulatory inquiries, attestation matters.
                            </p>
                            <a href="mailto:legal@Humanity Ledger" className="text-purple-400 hover:underline text-lg font-bold">
                                legal@Humanity Ledger
                            </a>
                        </div>

                        {/* Security */}
                        <div className="bg-white/5 p-6 rounded-xl border border-white/10">
                            <div className="flex items-center gap-3 mb-4">
                                <Mail className="text-red-400" size={32} />
                                <h3 className="text-2xl font-bold">Security</h3>
                            </div>
                            <p className="mb-4 text-sm text-white/70">
                                Report vulnerabilities responsibly (bug bounty available).
                            </p>
                            <a href="mailto:security@Humanity Ledger" className="text-red-400 hover:underline text-lg font-bold">
                                security@Humanity Ledger
                            </a>
                            <p className="mt-3 text-xs text-white/60">
                                <a href="/legal/security#bug-bounty" className="text-blue-400 hover:underline">View Bug Bounty Program </a>
                            </p>
                        </div>

                        {/* Press */}
                        <div className="bg-white/5 p-6 rounded-xl border border-white/10">
                            <div className="flex items-center gap-3 mb-4">
                                <Mail className="text-yellow-400" size={32} />
                                <h3 className="text-2xl font-bold">Press & Media</h3>
                            </div>
                            <p className="mb-4 text-sm text-white/70">
                                Journalists, podcasters, and media inquiries.
                            </p>
                            <a href="mailto:press@Humanity Ledger" className="text-yellow-400 hover:underline text-lg font-bold">
                                press@Humanity Ledger
                            </a>
                        </div>

                        {/* Partnerships */}
                        <div className="bg-white/5 p-6 rounded-xl border border-white/10">
                            <div className="flex items-center gap-3 mb-4">
                                <Mail className="text-cyan-400" size={32} />
                                <h3 className="text-2xl font-bold">Partnerships</h3>
                            </div>
                            <p className="mb-4 text-sm text-white/70">
                                Integrations, collaborations, and strategic partnerships.
                            </p>
                            <a href="mailto:partnerships@Humanity Ledger" className="text-cyan-400 hover:underline text-lg font-bold">
                                partnerships@Humanity Ledger
                            </a>
                        </div>
                    </div>
                </section>

                {/* Community */}
                <section>
                    <h2 className="text-3xl font-bold mb-6">Join Our Community</h2>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <a href="https://discord.gg/humanityledger" target="_blank" rel="noopener noreferrer" className="bg-gradient-to-br from-indigo-600/20 to-purple-600/20 p-6 rounded-xl border border-indigo-500/30 hover:scale-105 transition-transform">
                            <MessageSquare size={32} className="text-indigo-400 mb-3" />
                            <h3 className="font-bold mb-2">Discord</h3>
                            <p className="text-sm text-white/70">Chat with the community, get support, share ideas.</p>
                        </a>

                        <a href="https://twitter.com/HumanityLedger" target="_blank" rel="noopener noreferrer" className="bg-gradient-to-br from-blue-600/20 to-cyan-600/20 p-6 rounded-xl border border-[#25D366]/30 hover:scale-105 transition-transform">
                            <Twitter size={32} className="text-blue-400 mb-3" />
                            <h3 className="font-bold mb-2">Twitter</h3>
                            <p className="text-sm text-white/70">Latest updates, announcements, and crypto insights.</p>
                        </a>

                        <a href="https://github.com/humanityledger" target="_blank" rel="noopener noreferrer" className="bg-gradient-to-br from-gray-600/20 to-slate-600/20 p-6 rounded-xl border border-gray-500/30 hover:scale-105 transition-transform">
                            <Github size={32} className="text-gray-300 mb-3" />
                            <h3 className="font-bold mb-2">GitHub</h3>
                            <p className="text-sm text-white/70">Open source code, SDKs, and developer resources.</p>
                        </a>

                        <a href="https://t.me/humanityledger" target="_blank" rel="noopener noreferrer" className="bg-gradient-to-br from-sky-600/20 to-blue-600/20 p-6 rounded-xl border border-sky-500/30 hover:scale-105 transition-transform">
                            <MessageSquare size={32} className="text-sky-400 mb-3" />
                            <h3 className="font-bold mb-2">Telegram</h3>
                            <p className="text-sm text-white/70">Real-time chat with verifiers and community members.</p>
                        </a>
                    </div>
                </section>

                {/* Office Location */}
                <section>
                    <h2 className="text-3xl font-bold mb-6">Office</h2>

                    <div className="bg-white/5 p-8 rounded-xl border border-white/10">
                        <h3 className="text-xl font-bold mb-4">Registered Address</h3>
                        <div className="space-y-2 text-white/70">
                            <p>[Company Legal Name]</p>
                            <p>[Street Address]</p>
                            <p>[Postal Code, City]</p>
                            <p>Spain</p>
                        </div>

                        <div className="bg-blue-600/10 border border-[#25D366]/30 p-4 rounded-lg mt-6">
                            <p className="text-sm">
                                <strong>Note:</strong> We operate as a remote-first team. For fastest response, please email rather than mailing physical correspondence.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Business Hours */}
                <section>
                    <h2 className="text-3xl font-bold mb-6">Business Hours</h2>

                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="bg-white/5 p-6 rounded-xl border border-white/10">
                            <h3 className="font-bold mb-4">Email Support</h3>
                            <p className="text-sm text-white/70 mb-2">
                                <strong>Monday - Friday:</strong> 9:00 AM - 6:00 PM CET
                            </p>
                            <p className="text-sm text-white/70 mb-2">
                                <strong>Saturday - Sunday:</strong> Closed (emergency support available via Discord)
                            </p>
                            <p className="text-xs text-white/60 mt-4">
                                Response time: Within 24 hours on business days
                            </p>
                        </div>

                        <div className="bg-white/5 p-6 rounded-xl border border-white/10">
                            <h3 className="font-bold mb-4">LEGEND Tier Support</h3>
                            <p className="text-sm text-white/70 mb-2">
                                <strong>24/7 Active Chat</strong> for premium subscribers
                            </p>
                            <p className="text-sm text-white/70 mb-2">
                                Response time: {'<'} 1 hour average
                            </p>
                            <p className="text-xs text-white/60 mt-4">
                                <a href="/product/pricing" className="text-blue-400 hover:underline">Upgrade to LEGEND </a>
                            </p>
                        </div>
                    </div>
                </section>

                {/* FAQ */}
                <section>
                    <h2 className="text-3xl font-bold mb-6">Frequently Asked Questions</h2>

                    <div className="space-y-4">
                        <div className="bg-white/5 p-6 rounded-xl border border-white/10">
                            <h3 className="font-bold mb-2">Q: How quickly will I get a response?</h3>
                            <p className="text-sm text-white/70">
                                We typically respond within 24 hours on business days. LEGEND tier users have access to 24/7 live chat with {'<'} 1 hour average response times.
                            </p>
                        </div>

                        <div className="bg-white/5 p-6 rounded-xl border border-white/10">
                            <h3 className="font-bold mb-2">Q: I need urgent help with a stuck transaction. What should I do?</h3>
                            <p className="text-sm text-white/70">
                                Email <a href="mailto:support@Humanity Ledger" className="text-blue-400 hover:underline">support@Humanity Ledger</a> with "[URGENT]" in the subject line and include your transaction hash. For LEGEND users, use live chat for immediate assistance.
                            </p>
                        </div>

                        <div className="bg-white/5 p-6 rounded-xl border border-white/10">
                            <h3 className="font-bold mb-2">Q: Can I visit your office in person?</h3>
                            <p className="text-sm text-white/70">
                                We operate remote-first. For meetings, please email <a href="mailto:hello@Humanity Ledger" className="text-blue-400 hover:underline">hello@Humanity Ledger</a> to schedule a video call.
                            </p>
                        </div>

                        <div className="bg-white/5 p-6 rounded-xl border border-white/10">
                            <h3 className="font-bold mb-2">Q: How do I report a bug or security vulnerability?</h3>
                            <p className="text-sm text-white/70">
                                For bugs: <a href="mailto:support@Humanity Ledger" className="text-blue-400 hover:underline">support@Humanity Ledger</a><br />
                                For security issues: <a href="mailto:security@Humanity Ledger" className="text-red-400 hover:underline">security@Humanity Ledger</a> (eligible for bug bounty rewards)
                            </p>
                        </div>
                    </div>
                </section>

                {/* CTA */}
                <section className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 p-8 rounded-xl border border-white/10 text-center">
                    <h2 className="text-3xl font-bold mb-4">Still Have Questions?</h2>
                    <p className="text-lg text-white/80 mb-6">
                        Check our comprehensive documentation or reach out directly.
                    </p>
                    <div className="flex flex-wrap justify-center gap-4">
                        <a href="/support" className="px-8 py-3 bg-white/10 border border-white/20 rounded-lg font-bold hover:bg-white/20 transition-colors">
                            View Support Center
                        </a>
                        <a href="mailto:support@Humanity Ledger" className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg font-bold hover:scale-105 transition-transform">
                            Email Support
                        </a>
                    </div>
                </section>
            </div>
        </DocLayout>
    );
}


