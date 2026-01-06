import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Github, Menu, X, Shield, BarChart3, Blocks } from 'lucide-react';
import { useState } from 'react';
import logo from '../assets/logo.svg';

interface HeaderProps {
    isAuthed?: boolean;
    onLogin?: () => void;
}

export default function Header({ isAuthed, onLogin }: HeaderProps) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const location = useLocation();

    const isActive = (path: string) => location.pathname === path;

    return (
        <header className="fixed top-0 left-0 right-0 z-[100] h-24 flex items-center bg-white/70 backdrop-blur-xl border-b border-black/[0.03]">
            <div className="max-w-7xl mx-auto px-10 w-full flex items-center justify-between">
                {/* Logo */}
                <Link to="/" className="flex items-center gap-4 group cursor-pointer">
                    <img src={logo} alt="Uatu" className="h-9" />
                </Link>

                {/* Desktop Navigation */}
                <nav className="hidden lg:flex items-center gap-12">
                    {/* Products Dropdown */}
                    <div className="relative group">
                        <button className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-indigo-600 transition-all duration-300 flex items-center gap-2">
                            Products
                            <svg width="10" height="6" viewBox="0 0 10 6" fill="currentColor">
                                <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none" />
                            </svg>
                        </button>

                        {/* Dropdown Menu */}
                        <div className="absolute top-full left-0 mt-4 w-80 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50">
                            <div className="bg-white rounded-2xl shadow-2xl border border-black/[0.04] p-4 space-y-2">
                                <Link
                                    to="/"
                                    className="block p-4 rounded-xl hover:bg-slate-50 transition-all duration-300 group/item"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shrink-0">
                                            <Shield size={20} className="text-white" />
                                        </div>
                                        <div>
                                            <div className="font-black text-sm text-slate-900 mb-1">UatuAudit</div>
                                            <div className="text-xs text-slate-500">AI-powered security audits</div>
                                        </div>
                                    </div>
                                </Link>

                                <a
                                    href="https://dashboard.uatu.xyz"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block p-4 rounded-xl hover:bg-slate-50 transition-all duration-300 group/item"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shrink-0">
                                            <BarChart3 size={20} className="text-white" />
                                        </div>
                                        <div>
                                            <div className="font-black text-sm text-slate-900 mb-1 flex items-center gap-2">
                                                Uatu Analyzer
                                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-slate-400">
                                                    <path d="M10 2L2 10M10 2H4M10 2V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                                </svg>
                                            </div>
                                            <div className="text-xs text-slate-500">Analytics & subgraphs</div>
                                        </div>
                                    </div>
                                </a>

                                <a
                                    href="https://build.uatu.xyz"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block p-4 rounded-xl hover:bg-slate-50 transition-all duration-300 group/item"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shrink-0">
                                            <Blocks size={20} className="text-white" />
                                        </div>
                                        <div>
                                            <div className="font-black text-sm text-slate-900 mb-1 flex items-center gap-2">
                                                Uatu Build
                                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-slate-400">
                                                    <path d="M10 2L2 10M10 2H4M10 2V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                                </svg>
                                            </div>
                                            <div className="text-xs text-slate-500">No-code DApp builder</div>
                                        </div>
                                    </div>
                                </a>
                            </div>
                        </div>
                    </div>

                    <Link
                        to="/features"
                        className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${isActive('/features') ? 'text-indigo-600' : 'text-slate-400 hover:text-indigo-600'
                            }`}
                    >
                        Features
                    </Link>
                    <Link
                        to="/pricing"
                        className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${isActive('/pricing') ? 'text-indigo-600' : 'text-slate-400 hover:text-indigo-600'
                            }`}
                    >
                        Pricing
                    </Link>
                    <Link
                        to="/docs"
                        className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${isActive('/docs') ? 'text-indigo-600' : 'text-slate-400 hover:text-indigo-600'
                            }`}
                    >
                        Docs
                    </Link>
                </nav>

                {/* CTA Buttons */}
                <div className="hidden lg:flex items-center gap-6">
                    {isAuthed ? (
                        <Link
                            to="/dashboard"
                            className="flex items-center gap-3 bg-indigo-600 text-white px-8 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-indigo-600/20 hover:shadow-indigo-500/30 hover:bg-indigo-700 transition-all duration-500"
                        >
                            Dashboard
                        </Link>
                    ) : (
                        <button
                            onClick={onLogin}
                            className="flex items-center gap-3 bg-indigo-600 text-white px-8 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-indigo-600/20 hover:shadow-indigo-500/30 hover:bg-indigo-700 transition-all duration-500 group"
                        >
                            <Github size={14} className="group-hover:rotate-12 transition-transform" />
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
                    className="lg:hidden absolute top-24 left-0 right-0 bg-white border-b border-black/[0.03] shadow-xl"
                >
                    <nav className="flex flex-col p-6 gap-6">
                        <Link
                            to="/features"
                            onClick={() => setMobileMenuOpen(false)}
                            className="text-sm font-bold text-slate-900 hover:text-indigo-600 transition-colors"
                        >
                            Features
                        </Link>
                        <Link
                            to="/pricing"
                            onClick={() => setMobileMenuOpen(false)}
                            className="text-sm font-bold text-slate-900 hover:text-indigo-600 transition-colors"
                        >
                            Pricing
                        </Link>
                        <Link
                            to="/docs"
                            onClick={() => setMobileMenuOpen(false)}
                            className="text-sm font-bold text-slate-900 hover:text-indigo-600 transition-colors"
                        >
                            Documentation
                        </Link>
                        <Link
                            to="/how-it-works"
                            onClick={() => setMobileMenuOpen(false)}
                            className="text-sm font-bold text-slate-900 hover:text-indigo-600 transition-colors"
                        >
                            How It Works
                        </Link>
                        <div className="pt-4 border-t border-black/[0.03]">
                            {isAuthed ? (
                                <Link
                                    to="/dashboard"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="block text-center bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-sm"
                                >
                                    Dashboard
                                </Link>
                            ) : (
                                <button
                                    onClick={() => {
                                        setMobileMenuOpen(false);
                                        onLogin?.();
                                    }}
                                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-sm"
                                >
                                    <Github size={16} />
                                    Sign In with GitHub
                                </button>
                            )}
                        </div>
                    </nav>
                </motion.div>
            )}
        </header>
    );
}
