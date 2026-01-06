import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Github, Menu, X } from 'lucide-react';
import { useState } from 'react';
import logo from '../assets/logo.svg';
import {
    PremiumShield, PremiumAnalytics, PremiumBlocks
} from './IconSystem';

interface HeaderProps {
    isAuthed?: boolean;
    onLogin?: () => void;
}

export default function Header({ isAuthed, onLogin }: HeaderProps) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const location = useLocation();

    const isActive = (path: string) => location.pathname === path;

    return (
        <header className="fixed top-0 left-0 right-0 z-[100] h-20 flex items-center bg-white/70 backdrop-blur-xl border-b border-black/[0.02]">
            <div className="max-w-7xl mx-auto px-6 lg:px-10 w-full flex items-center justify-between">
                {/* Logo */}
                <Link to="/" className="flex items-center gap-3 group">
                    <img src={logo} alt="Uatu" className="h-8 transition-transform duration-500 group-hover:scale-110" />
                    <div className="flex flex-col">
                        <span className="text-[11px] font-black uppercase tracking-[0.5em] text-slate-900 leading-tight">Uatu</span>
                        <span className="text-[7px] font-black uppercase tracking-[0.2em] text-slate-400">Security</span>
                    </div>
                </Link>

                {/* Desktop Navigation */}
                <nav className="hidden lg:flex items-center gap-10">
                    {/* Products Dropdown */}
                    <div className="relative group">
                        <button className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-900 transition-all duration-300 flex items-center gap-2">
                            Products
                            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="transition-transform duration-300 group-hover:rotate-180">
                                <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                        </button>

                        {/* Dropdown Menu */}
                        <div className="absolute top-[80%] left-[-20px] pt-6 w-80 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50">
                            <div className="bg-white rounded-[32px] shadow-premium border border-black/[0.04] p-4 space-y-1">
                                {[
                                    { name: 'UatuAudit', desc: 'Enterprise AI Security', icon: PremiumShield, path: '/', color: 'text-indigo-600' },
                                    { name: 'Uatu Analyzer', desc: 'Real-time On-Chain Data', icon: PremiumAnalytics, path: 'https://dashboard.uatu.xyz', color: 'text-emerald-600', ext: true },
                                    { name: 'Uatu Build', desc: 'No-Code DApp Foundry', icon: PremiumBlocks, path: 'https://build.uatu.xyz', color: 'text-amber-600', ext: true },
                                ].map((item) => {
                                    const Content = (
                                        <div className="flex items-center gap-4 p-4 rounded-[20px] hover:bg-slate-50 transition-all duration-300 group/item">
                                            <div className={`w-12 h-12 rounded-2xl bg-white border border-black/[0.03] shadow-sm flex items-center justify-center shrink-0 group-hover/item:shadow-md transition-all ${item.color}`}>
                                                <item.icon size={22} />
                                            </div>
                                            <div>
                                                <div className="font-black text-xs text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                                                    {item.name}
                                                    {item.ext && <span className="text-[9px] opacity-20">↗</span>}
                                                </div>
                                                <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{item.desc}</div>
                                            </div>
                                        </div>
                                    );
                                    return item.ext ? (
                                        <a key={item.name} href={item.path} target="_blank" rel="noopener noreferrer">{Content}</a>
                                    ) : (
                                        <Link key={item.name} to={item.path}>{Content}</Link>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {[
                        { name: 'Features', path: '/features' },
                        { name: 'Pricing', path: '/pricing' },
                        { name: 'Resources', path: '/docs' },
                    ].map(link => (
                        <Link
                            key={link.name}
                            to={link.path}
                            className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${isActive(link.path) ? 'text-indigo-600 shadow-[inset_0_-2px_0_0_currentColor]' : 'text-slate-400 hover:text-slate-900'
                                }`}
                        >
                            {link.name}
                        </Link>
                    ))}
                </nav>

                {/* CTA Buttons */}
                <div className="hidden lg:flex items-center gap-4">
                    {isAuthed ? (
                        <Link to="/dashboard" className="btn-primary py-2.5">
                            Dashboard
                        </Link>
                    ) : (
                        <button onClick={onLogin} className="btn-primary py-2.5">
                            <Github size={14} />
                            Sign In
                        </button>
                    )}
                </div>

                {/* Mobile Menu Button */}
                <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="lg:hidden p-2 text-slate-900"
                >
                    {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

            {/* Mobile Menu */}
            {mobileMenuOpen && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="lg:hidden absolute top-20 left-0 right-0 bg-white border-b border-black/[0.04] shadow-2xl z-50 p-6"
                >
                    <nav className="flex flex-col gap-6">
                        {['Features', 'Pricing', 'Docs', 'How It Works'].map(item => (
                            <Link
                                key={item}
                                to={`/${item.toLowerCase().replace(/ /g, '-')}`}
                                onClick={() => setMobileMenuOpen(false)}
                                className="text-sm font-black text-slate-900 uppercase tracking-widest"
                            >
                                {item}
                            </Link>
                        ))}
                        <div className="pt-6 border-t border-black/[0.04]">
                            <button
                                onClick={() => { setMobileMenuOpen(false); onLogin?.(); }}
                                className="w-full btn-primary"
                            >
                                <Github size={16} /> Sign In
                            </button>
                        </div>
                    </nav>
                </motion.div>
            )}
        </header>
    );
}
