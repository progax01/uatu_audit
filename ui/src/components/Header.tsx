import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Github, Menu, X } from 'lucide-react';
import { useState } from 'react';
import logo from '../assets/logo.svg';
import ThemeToggle from './ThemeToggle';

interface HeaderProps {
    isAuthed?: boolean;
    onLogin?: () => void;
}

export default function Header({ isAuthed, onLogin }: HeaderProps) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const location = useLocation();

    const isActive = (path: string) => location.pathname === path;

    return (
        <header className="fixed top-0 left-0 right-0 z-[100] h-20 flex items-center bg-white/70 dark:bg-slate-900/80 backdrop-blur-xl border-b border-black/[0.02] dark:border-white/[0.05] transition-colors duration-300">
            <div className="max-w-7xl mx-auto px-6 lg:px-10 w-full flex items-center justify-between">
                {/* Logo */}
                <Link to="/" className="flex items-center group">
                    <img src={logo} alt="Uatu Security" className="h-9 transition-transform duration-500 group-hover:scale-105" />
                </Link>

                {/* Desktop Navigation */}
                <nav className="hidden lg:flex items-center gap-10">
                    {/* Products Dropdown */}
                    <div className="relative group">
                        <button className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all duration-300 flex items-center gap-2">
                            Products
                            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="transition-transform duration-300 group-hover:rotate-180">
                                <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                        </button>

                        {/* Dropdown Menu */}
                        <div className="absolute top-[80%] left-[-20px] pt-6 w-80 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50">
                            <div className="bg-white dark:bg-slate-800 rounded-[32px] shadow-premium border border-black/[0.04] dark:border-white/[0.05] p-4 space-y-1">
                                {[
                                    { name: 'UatuAudit', desc: 'Enterprise AI Security', img: '/audit.png', path: '/', color: 'text-indigo-600' },
                                    { name: 'Uatu Analyzer', desc: 'Real-time On-Chain Data', img: '/analyse.png', path: '#', color: 'text-emerald-600', comingSoon: true },
                                    { name: 'Uatu Build', desc: 'No-Code DApp Foundry', img: '/build.png', path: '#', color: 'text-amber-600', comingSoon: true },
                                ].map((item) => {
                                    const Content = (
                                        <div className={`flex items-center gap-4 p-4 rounded-[20px] transition-all duration-300 group/item ${item.comingSoon ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                                            <div className={`w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 border border-black/[0.03] dark:border-white/[0.05] shadow-sm flex items-center justify-center shrink-0 ${!item.comingSoon && 'group-hover/item:shadow-md'} transition-all overflow-hidden`}>
                                                <img src={item.img} alt={item.name} className="w-8 h-8 object-contain" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="font-black text-xs text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-wide">
                                                    {item.name}
                                                    {item.comingSoon && (
                                                        <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-400 text-[7px] font-black rounded uppercase tracking-wider">Soon</span>
                                                    )}
                                                </div>
                                                <div className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-0.5">{item.desc}</div>
                                            </div>
                                        </div>
                                    );
                                    return item.comingSoon ? (
                                        <div key={item.name}>{Content}</div>
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
                            className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${isActive(link.path) ? 'text-indigo-600 dark:text-indigo-400 shadow-[inset_0_-2px_0_0_currentColor]' : 'text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                        >
                            {link.name}
                        </Link>
                    ))}
                </nav>

                {/* CTA Buttons */}
                <div className="hidden lg:flex items-center gap-3">
                    <ThemeToggle />
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
                    className="lg:hidden p-2 text-slate-900 dark:text-white"
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
                    className="lg:hidden absolute top-20 left-0 right-0 bg-white dark:bg-slate-900 border-b border-black/[0.04] dark:border-white/[0.05] shadow-2xl z-50 p-6"
                >
                    <nav className="flex flex-col gap-6">
                        {['Features', 'Pricing', 'Docs', 'How It Works'].map(item => (
                            <Link
                                key={item}
                                to={`/${item.toLowerCase().replace(/ /g, '-')}`}
                                onClick={() => setMobileMenuOpen(false)}
                                className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest"
                            >
                                {item}
                            </Link>
                        ))}
                        <div className="pt-6 border-t border-black/[0.04] flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Theme</span>
                                <ThemeToggle />
                            </div>
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
