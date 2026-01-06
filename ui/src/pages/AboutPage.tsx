import { motion } from 'framer-motion';
import { Shield, Target, Users, Zap, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';

export default function AboutPage() {
    return (
        <>
            <SEO
                title="About - Complete Web3 Security & Development Platform"
                description="Learn about Uatu's mission to secure the Web3 ecosystem with AI-powered audits, analytics, and no-code building tools."
                keywords={['about uatu', 'web3 security', 'blockchain audit company', 'smart contract security']}
            />

            <div className="min-h-screen bg-base relative">
                {/* Hero Section */}
                <section className="pt-32 pb-20">
                    <div className="max-w-7xl mx-auto px-10">
                        <div className="max-w-4xl">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="inline-flex items-center gap-3 px-5 py-2.5 bg-white border border-black/[0.04] shadow-sm rounded-full text-indigo-600 text-[10px] font-black uppercase tracking-[0.25em] mb-10"
                            >
                                About Uatu
                            </motion.div>

                            <motion.h1
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="text-6xl lg:text-7xl font-black text-slate-900 leading-[0.9] mb-8 tracking-[-0.05em]"
                            >
                                Securing the <br />
                                <span className="text-indigo-600">Web3 Future</span>
                            </motion.h1>

                            <motion.p
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="text-2xl text-slate-600 mb-12 leading-relaxed"
                            >
                                We're building the complete platform for Web3 development: from AI-powered security
                                audits to real-time analytics and no-code DApp creation.
                            </motion.p>
                        </div>
                    </div>
                </section>

                {/* Mission & Vision */}
                <section className="py-32 bg-white/40">
                    <div className="max-w-7xl mx-auto px-10">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                            <motion.div
                                initial={{ opacity: 0, x: -40 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                className="card p-12"
                            >
                                <Target size={48} className="text-indigo-600 mb-6" strokeWidth={1.5} />
                                <h2 className="text-4xl font-black text-slate-900 mb-6">Our Mission</h2>
                                <p className="text-lg text-slate-600 leading-relaxed">
                                    To make Web3 development secure, accessible, and efficient for everyone. We believe
                                    that security shouldn't be an afterthought—it should be built into every step of
                                    the development process.
                                </p>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, x: 40 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                className="card p-12"
                            >
                                <Zap size={48} className="text-indigo-600 mb-6" strokeWidth={1.5} />
                                <h2 className="text-4xl font-black text-slate-900 mb-6">Our Vision</h2>
                                <p className="text-lg text-slate-600 leading-relaxed">
                                    A Web3 ecosystem where every smart contract is secure, every DApp is audited, and
                                    developers have the tools they need to build with confidence. We're making this
                                    vision a reality with AI and automation.
                                </p>
                            </motion.div>
                        </div>
                    </div>
                </section>

                {/* Our Products */}
                <section className="py-32">
                    <div className="max-w-7xl mx-auto px-10">
                        <div className="text-center mb-20">
                            <h2 className="text-5xl font-black text-slate-900 mb-6">Our Platform</h2>
                            <p className="text-xl text-slate-500 max-w-3xl mx-auto">
                                Three powerful products working together to secure and accelerate Web3 development
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <motion.div
                                initial={{ opacity: 0, y: 40 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                className="card p-10 text-center"
                            >
                                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center mx-auto mb-6">
                                    <Shield className="text-white" size={40} strokeWidth={1.5} />
                                </div>
                                <h3 className="text-2xl font-black text-slate-900 mb-4">UatuAudit</h3>
                                <p className="text-slate-600 mb-6">
                                    AI-powered security audits that detect vulnerabilities before deployment
                                </p>
                                <Link to="/" className="text-indigo-600 font-bold hover:text-indigo-700">
                                    Learn More →
                                </Link>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 40 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.1 }}
                                className="card p-10 text-center"
                            >
                                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mx-auto mb-6">
                                    <Users className="text-white" size={40} strokeWidth={1.5} />
                                </div>
                                <h3 className="text-2xl font-black text-slate-900 mb-4">Uatu Analyzer</h3>
                                <p className="text-slate-600 mb-6">
                                    Real-time analytics and on-chain data queries with custom subgraphs
                                </p>
                                <a
                                    href="https://dashboard.uatu.xyz"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-emerald-600 font-bold hover:text-emerald-700"
                                >
                                    Explore Analytics →
                                </a>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 40 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.2 }}
                                className="card p-10 text-center"
                            >
                                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mx-auto mb-6">
                                    <Zap className="text-white" size={40} strokeWidth={1.5} />
                                </div>
                                <h3 className="text-2xl font-black text-slate-900 mb-4">Uatu Build</h3>
                                <p className="text-slate-600 mb-6">
                                    No-code platform for creating and deploying smart contracts and DApps
                                </p>
                                <a
                                    href="https://build.uatu.xyz"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-amber-600 font-bold hover:text-amber-700"
                                >
                                    Start Building →
                                </a>
                            </motion.div>
                        </div>
                    </div>
                </section>

                {/* Stats */}
                <section className="py-32 bg-gradient-to-br from-slate-900 to-slate-800 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />
                    <div className="max-w-7xl mx-auto px-10 relative z-10">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 text-center">
                            {[
                                { value: '10,000+', label: 'Audits Completed' },
                                { value: '500+', label: 'Vulnerabilities Found' },
                                { value: '15+', label: 'Blockchains Supported' },
                                { value: '99.8%', label: 'Accuracy Rate' },
                            ].map((stat, i) => (
                                <motion.div
                                    key={stat.label}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.1 }}
                                >
                                    <div className="text-6xl font-black text-white mb-3">{stat.value}</div>
                                    <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">{stat.label}</div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* CTA */}
                <section className="py-32">
                    <div className="max-w-4xl mx-auto px-10 text-center">
                        <h2 className="text-5xl font-black text-slate-900 mb-6">Join Us in Securing Web3</h2>
                        <p className="text-xl text-slate-500 mb-10">
                            Start using our platform today and experience the future of Web3 development
                        </p>
                        <div className="flex flex-col sm:flex-row gap-6 justify-center">
                            <Link
                                to="/dashboard"
                                className="inline-flex items-center justify-center gap-3 bg-indigo-600 text-white px-10 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-indigo-700 transition-all duration-500"
                            >
                                Start Free Audit
                                <ArrowRight size={16} strokeWidth={3} />
                            </Link>
                            <Link
                                to="/pricing"
                                className="inline-flex items-center justify-center gap-3 bg-white text-slate-900 px-10 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] border-2 border-slate-200 hover:border-indigo-600 transition-all duration-500"
                            >
                                View Pricing
                            </Link>
                        </div>
                    </div>
                </section>
            </div>
        </>
    );
}
