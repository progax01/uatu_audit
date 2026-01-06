import { motion } from 'framer-motion';
import { Check, Clock, Loader } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import {
    supportedChains,
    EthereumIcon,
    PolygonIcon,
    BSCIcon,
    ArbitrumIcon,
    OptimismIcon,
    BaseIcon,
    AvalancheIcon
} from '../components/icons/CryptoIcons';

export default function SupportedChainsPage() {
    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'supported':
                return (
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-bold">
                        <Check size={12} strokeWidth={3} />
                        Supported
                    </span>
                );
            case 'beta':
                return (
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 text-xs font-bold">
                        <Loader size={12} strokeWidth={3} />
                        Beta
                    </span>
                );
            case 'coming-soon':
                return (
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-500/10 text-slate-600 text-xs font-bold">
                        <Clock size={12} strokeWidth={3} />
                        Coming Soon
                    </span>
                );
        }
    };

    return (
        <>
            <SEO
                title="Supported Blockchains - Multi-Chain Security Audits"
                description="UatuAudit supports 15+ blockchains including Ethereum, Polygon, BSC, Arbitrum, Optimism, Base, and more. Comprehensive security audits for all major chains."
                keywords={['supported chains', 'blockchains', 'ethereum audit', 'polygon audit', 'multi-chain']}
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
                            15+ Blockchains Supported
                        </motion.div>

                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="text-6xl lg:text-7xl font-black text-slate-900 leading-[0.9] mb-8 tracking-[-0.05em]"
                        >
                            Multi-Chain <br />
                            <span className="text-indigo-600">Security Audits</span>
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="text-xl text-slate-500 max-w-3xl mx-auto mb-12 leading-relaxed"
                        >
                            Comprehensive security audits for smart contracts across all major blockchain networks.
                            One platform, unlimited chains.
                        </motion.p>
                    </div>
                </section>

                {/* Chains Grid */}
                <section className="pb-32">
                    <div className="max-w-7xl mx-auto px-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {supportedChains.map((chain, index) => {
                                const IconComponent = chain.icon;
                                return (
                                    <motion.div
                                        key={chain.name}
                                        initial={{ opacity: 0, y: 40 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: index * 0.05 }}
                                        className="card p-8 hover:shadow-xl transition-all duration-500 group"
                                    >
                                        <div className="flex items-start justify-between mb-6">
                                            <div
                                                className="w-16 h-16 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500"
                                                style={{ backgroundColor: `${chain.color}15` }}
                                            >
                                                <IconComponent size={32} style={{ color: chain.color }} />
                                            </div>
                                            {getStatusBadge(chain.status)}
                                        </div>

                                        <h3 className="text-2xl font-black text-slate-900 mb-2">{chain.name}</h3>
                                        <p className="text-sm text-slate-500">
                                            Full support for {chain.name} smart contracts, including mainnet and testnets.
                                        </p>
                                    </motion.div>
                                );
                            })}

                            {/* More Coming Soon Card */}
                            <motion.div
                                initial={{ opacity: 0, y: 40 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.4 }}
                                className="card p-8 border-2 border-dashed border-slate-200 bg-slate-50/50"
                            >
                                <div className="flex items-center justify-center h-full flex-col gap-4">
                                    <Clock size={48} className="text-slate-300" strokeWidth={1} />
                                    <div className="text-center">
                                        <h3 className="text-xl font-black text-slate-900 mb-2">More Chains Coming</h3>
                                        <p className="text-sm text-slate-500 mb-4">
                                            We're constantly adding support for new blockchains
                                        </p>
                                        <a href="#request" className="text-sm font-bold text-indigo-600 hover:text-indigo-700">
                                            Request a Chain →
                                        </a>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </section>

                {/* Network Details Section */}
                <section className="py-32 bg-white/40">
                    <div className="max-w-7xl mx-auto px-10">
                        <div className="text-center mb-16">
                            <h2 className="text-5xl font-black text-slate-900 mb-6">What We Audit</h2>
                            <p className="text-xl text-slate-500 max-w-3xl mx-auto">
                                Comprehensive security analysis for all contract types across supported chains
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="card p-8">
                                <h3 className="text-xl font-black text-slate-900 mb-4">Smart Contracts</h3>
                                <ul className="space-y-2 text-sm text-slate-600">
                                    <li>• ERC-20 Tokens</li>
                                    <li>• ERC-721 NFTs</li>
                                    <li>• ERC-1155 Multi-tokens</li>
                                    <li>• DeFi Protocols</li>
                                    <li>• DAO Governance</li>
                                    <li>• Staking Contracts</li>
                                </ul>
                            </div>

                            <div className="card p-8">
                                <h3 className="text-xl font-black text-slate-900 mb-4">DApp Components</h3>
                                <ul className="space-y-2 text-sm text-slate-600">
                                    <li>• Frontend Integration</li>
                                    <li>• Web3 Connections</li>
                                    <li>• Transaction Logic</li>
                                    <li>• Wallet Interactions</li>
                                    <li>• Event Handling</li>
                                    <li>• State Management</li>
                                </ul>
                            </div>

                            <div className="card p-8">
                                <h3 className="text-xl font-black text-slate-900 mb-4">Infrastructure</h3>
                                <ul className="space-y-2 text-sm text-slate-600">
                                    <li>• Deployment Scripts</li>
                                    <li>• Upgrade Mechanisms</li>
                                    <li>• Access Controls</li>
                                    <li>• Oracle Integrations</li>
                                    <li>• Cross-chain Bridges</li>
                                    <li>• Layer 2 Solutions</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </section>

                {/* CTA Section */}
                <section className="py-32">
                    <div className="max-w-4xl mx-auto px-10 text-center">
                        <h2 className="text-5xl font-black text-slate-900 mb-6">Start Auditing Today</h2>
                        <p className="text-xl text-slate-500 mb-10">
                            Choose your blockchain and start your first security audit in minutes
                        </p>
                        <Link
                            to="/dashboard"
                            className="inline-flex items-center gap-3 bg-indigo-600 text-white px-10 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-indigo-600/20 hover:shadow-indigo-500/30 hover:bg-indigo-700 transition-all duration-500"
                        >
                            Start Free Audit
                        </Link>
                    </div>
                </section>
            </div>
        </>
    );
}
