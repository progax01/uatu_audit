import { motion } from 'framer-motion';
import { Shield, Coins, Users, Gamepad2, Lock, ArrowRight, Layers, Layout, Server, Database } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';

const useCases = [
    {
        icon: Coins,
        title: 'DeFi Protocols',
        description: 'Secure your decentralized finance applications and institutional liquidity pools.',
        challenges: [
            'Complex token economics & rebasing',
            'Flash loan & sandwich attack vulnerabilities',
            'Oracle manipulation & price feed risks',
            'Liquidity pool & slippage exploits',
        ],
        solutions: [
            'Automated economic model analysis',
            'Simulated flash loan attack detection',
            'Multi-source oracle verification',
            'LP & staking logic formal review',
        ],
        examples: ['DEXs', 'Lending Protocols', 'Yield Aggregators', 'Stablecoins'],
        color: 'from-emerald-500 to-teal-500',
    },
    {
        icon: Layout,
        title: 'Full-Stack DApps',
        description: 'Security for the entire journey: from UI components to backend APIs and code.',
        challenges: [
            'Frontend XSS & injection attacks',
            'Insecure Web3 provider connections',
            'API authentication & data leaks',
            'State-sync & race conditions',
        ],
        solutions: [
            'UI/UX security validation',
            'Secure communication channel audit',
            'Backend API & DB integrity checks',
            'State-machine reachability analysis',
        ],
        examples: ['DApp UI', 'Auth APIs', 'Session Logic', 'State Engines'],
        color: 'from-indigo-500 to-blue-500',
    },
    {
        icon: Layers,
        title: 'Infrastructure & Bridges',
        description: 'Hardened security for cross-chain communications and custody gateways.',
        challenges: [
            'Message replay & bridge exploits',
            'Validator consensus vulnerabilities',
            'Relayer manipulation risks',
            'Multi-sig & threshold key logic',
        ],
        solutions: [
            'Bridge contract formal verification',
            'Consensus logic & relayer stress-tests',
            'Threshold cryptography review',
            'Gateway gas-limit exploit analysis',
        ],
        examples: ['Cross-Chain Bridges', 'Validators', 'Oracles', 'Relayers'],
        color: 'from-blue-600 to-cyan-500',
    },
    {
        icon: Shield,
        title: 'NFT & Marketplaces',
        description: 'Protect your digital assets, royalty engines, and secondary market users.',
        challenges: [
            'Minting logic & gas-war exploits',
            'Royalty enforcement bypasses',
            'Metadata manipulation & spoofing',
            'Trade-offer & marketplace logic',
        ],
        solutions: [
            'Standard compliance (721/1155)',
            'Royalty engine & logic verification',
            'Metadata integrity & CDN audit',
            'Marketplace swap-logic formal review',
        ],
        examples: ['Marketplaces', 'Generative Art', 'Game Assets', 'Collectibles'],
        color: 'from-purple-500 to-pink-500',
    },
    {
        icon: Database,
        title: 'Security Libraries',
        description: 'Auditing the foundational SDKs and modular primitives your ecosystem builds on.',
        challenges: [
            'Modular logic inheritance flaws',
            'Dependency poisoning & supply-chain',
            'Shared-state corruption risks',
            'Universal gas-efficiency trade-offs',
        ],
        solutions: [
            'Library-specific edge-case audit',
            'Supply-chain & dependency mapping',
            'Abstract contract inheritance review',
            'Modular unit & property tests',
        ],
        examples: ['SDKs', 'Foundational Libs', 'Modular Primitives', 'Shared Logic'],
        color: 'from-orange-500 to-amber-500',
    },
];

export default function UseCasesPage() {
    return (
        <>
            <SEO
                title="Use Cases - Security Audits for Every Web3 Project"
                description="Comprehensive security audits for DeFi, NFTs, DAOs, Gaming, and Token contracts. Industry-specific vulnerability detection and compliance."
                keywords={['DeFi audit', 'NFT security', 'DAO governance', 'gaming blockchain', 'token audit']}
            />

            <div className="min-h-screen bg-base relative">
                {/* Hero Section */}
                <section className="pt-32 pb-20">
                    <div className="max-w-7xl mx-auto px-10 text-center">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="inline-flex items-center gap-3 px-5 py-2.5 bg-white border border-black/[0.04] shadow-sm rounded-full text-indigo-600 text-[10px] font-black uppercase tracking-[0.25em] mb-10"
                        >
                            Industry-Specific Security
                        </motion.div>

                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="text-6xl lg:text-7xl font-black text-slate-900 leading-[0.9] mb-8 tracking-[-0.05em]"
                        >
                            Security for <br />
                            <span className="text-indigo-600">Every Use Case</span>
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="text-xl text-slate-500 max-w-3xl mx-auto mb-12 leading-relaxed"
                        >
                            From DeFi protocols to NFT marketplaces, we provide specialized security audits
                            tailored to your industry's unique challenges.
                        </motion.p>
                    </div>
                </section>

                {/* Use Cases */}
                <section className="pb-32">
                    <div className="max-w-7xl mx-auto px-10 space-y-32">
                        {useCases.map((useCase, index) => (
                            <motion.div
                                key={useCase.title}
                                initial={{ opacity: 0, y: 60 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.1 }}
                                className={`grid grid-cols-1 lg:grid-cols-2 gap-16 items-center ${index % 2 === 1 ? 'lg:flex-row-reverse' : ''
                                    }`}
                            >
                                <div className={index % 2 === 1 ? 'lg:order-2' : ''}>
                                    <div className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${useCase.color} flex items-center justify-center mb-8`}>
                                        <useCase.icon className="text-white" size={40} strokeWidth={1.5} />
                                    </div>

                                    <h2 className="text-5xl font-black text-slate-900 mb-6">{useCase.title}</h2>
                                    <p className="text-xl text-slate-600 mb-8 leading-relaxed">{useCase.description}</p>

                                    <div className="flex flex-wrap gap-3 mb-8">
                                        {useCase.examples.map((example) => (
                                            <span
                                                key={example}
                                                className="px-4 py-2 rounded-full bg-white border border-black/[0.04] text-sm font-bold text-slate-700"
                                            >
                                                {example}
                                            </span>
                                        ))}
                                    </div>

                                    <Link
                                        to="/dashboard"
                                        className="inline-flex items-center gap-3 bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-indigo-700 transition-all duration-500"
                                    >
                                        Start Audit
                                        <ArrowRight size={14} strokeWidth={3} />
                                    </Link>
                                </div>

                                <div className={index % 2 === 1 ? 'lg:order-1' : ''}>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="card-premium !p-8 border-rose-500/5 hover:border-rose-500/20 transition-all">
                                            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-6">
                                                Common Challenges
                                            </h3>
                                            <ul className="space-y-4">
                                                {useCase.challenges.map((challenge) => (
                                                    <li key={challenge} className="text-sm font-bold text-slate-500 flex items-start gap-3">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 mt-1.5" />
                                                        {challenge}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        <div className="card-premium !p-8 border-emerald-500/5 hover:border-emerald-500/20 transition-all">
                                            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-6">
                                                Advanced Solutions
                                            </h3>
                                            <ul className="space-y-4">
                                                {useCase.solutions.map((solution) => (
                                                    <li key={solution} className="text-sm font-bold text-slate-700 flex items-start gap-3">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                                                        {solution}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </section>

                {/* CTA Section */}
                <section className="py-32 bg-gradient-to-br from-indigo-600 to-purple-600 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
                    <div className="max-w-4xl mx-auto px-10 text-center relative z-10">
                        <h2 className="text-5xl font-black text-white mb-6">Ready to Secure Your Project?</h2>
                        <p className="text-xl text-indigo-100 mb-10">
                            Get industry-specific security audits tailored to your use case
                        </p>
                        <Link
                            to="/dashboard"
                            className="inline-flex items-center gap-3 bg-white text-indigo-600 px-12 py-6 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-500"
                        >
                            Start Free Audit
                        </Link>
                    </div>
                </section>
            </div>
        </>
    );
}
