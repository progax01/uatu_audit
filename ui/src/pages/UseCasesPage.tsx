import { motion } from 'framer-motion';
import { Shield, Coins, Users, Gamepad2, Lock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';

const useCases = [
    {
        icon: Coins,
        title: 'DeFi Protocols',
        description: 'Secure your decentralized finance applications',
        challenges: [
            'Complex token economics',
            'Flash loan vulnerabilities',
            'Oracle manipulation risks',
            'Liquidity pool exploits',
        ],
        solutions: [
            'Automated economic model analysis',
            'Flash loan attack detection',
            'Oracle integration security',
            'LP contract verification',
        ],
        examples: ['DEXs', 'Lending Protocols', 'Yield Farming', 'Stablecoins'],
        color: 'from-emerald-500 to-teal-500',
    },
    {
        icon: Shield,
        title: 'NFT Marketplaces',
        description: 'Protect your NFT platform and users',
        challenges: [
            'Minting vulnerabilities',
            'Royalty bypass exploits',
            'Metadata manipulation',
            'Access control issues',
        ],
        solutions: [
            'ERC-721/1155 compliance checks',
            'Royalty enforcement verification',
            'Metadata security audit',
            'Role-based access review',
        ],
        examples: ['NFT Marketplaces', 'Generative Art', 'Gaming NFTs', 'Collectibles'],
        color: 'from-purple-500 to-pink-500',
    },
    {
        icon: Users,
        title: 'DAO & Governance',
        description: 'Ensure fair and secure governance',
        challenges: [
            'Voting manipulation',
            'Proposal execution risks',
            'Treasury security',
            'Delegation vulnerabilities',
        ],
        solutions: [
            'Governance logic verification',
            'Timelock security analysis',
            'Multi-sig wallet audit',
            'Voting weight calculations',
        ],
        examples: ['DAOs', 'Governance Tokens', 'Treasury Management', 'Voting Systems'],
        color: 'from-blue-500 to-cyan-500',
    },
    {
        icon: Gamepad2,
        title: 'Gaming & Metaverse',
        description: 'Secure in-game economies and assets',
        challenges: [
            'Item duplication exploits',
            'Economic imbalance',
            'Cross-chain bridge risks',
            'In-game currency security',
        ],
        solutions: [
            'Game logic security audit',
            'Economic model verification',
            'Bridge contract analysis',
            'Asset minting controls',
        ],
        examples: ['Play-to-Earn', 'Metaverse Platforms', 'Virtual Worlds', 'Gaming Tokens'],
        color: 'from-orange-500 to-red-500',
    },
    {
        icon: Lock,
        title: 'Token Contracts',
        description: 'Launch secure and compliant tokens',
        challenges: [
            'Mint/burn vulnerabilities',
            'Transfer restrictions',
            'Tax mechanism exploits',
            'Compliance requirements',
        ],
        solutions: [
            'ERC-20 standard compliance',
            'Tokenomics verification',
            'Tax logic security',
            'Regulatory compliance checks',
        ],
        examples: ['ERC-20 Tokens', 'Governance Tokens', 'Utility Tokens', 'Security Tokens'],
        color: 'from-indigo-500 to-purple-500',
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
                                        <div className="card p-6">
                                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-4">
                                                Common Challenges
                                            </h3>
                                            <ul className="space-y-2">
                                                {useCase.challenges.map((challenge) => (
                                                    <li key={challenge} className="text-sm text-slate-600 flex items-start gap-2">
                                                        <span className="text-red-500 mt-1">•</span>
                                                        {challenge}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        <div className="card p-6">
                                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-4">
                                                Our Solutions
                                            </h3>
                                            <ul className="space-y-2">
                                                {useCase.solutions.map((solution) => (
                                                    <li key={solution} className="text-sm text-slate-600 flex items-start gap-2">
                                                        <span className="text-emerald-500 mt-1">✓</span>
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
