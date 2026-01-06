import { Link } from 'react-router-dom';
import { Github, Twitter, Linkedin } from 'lucide-react';
import logo from '../assets/logo.svg';

export default function Footer() {
    return (
        <footer className="pt-48 pb-20 relative bg-slate-50">
            <div className="max-w-7xl mx-auto px-10">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-20 items-start border-b border-black/[0.03] pb-24 mb-20">
                    {/* Brand */}
                    <div className="md:col-span-2">
                        <div className="flex items-center mb-8">
                            <img src={logo} alt="Uatu Security" className="h-10 object-contain" />
                        </div>
                        <p className="text-slate-400 text-sm font-medium leading-relaxed max-w-sm mb-6">
                            AI-powered security audits for smart contracts and decentralized applications.
                            Detect vulnerabilities before deployment.
                        </p>
                        <div className="flex items-center gap-4">
                            <a
                                href="https://github.com/Wasserstoff-Innovation"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-10 h-10 rounded-xl bg-white border border-black/[0.04] flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-600/20 transition-all"
                            >
                                <Github size={18} />
                            </a>
                            <a
                                href="https://x.com/Uatuhq"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-10 h-10 rounded-xl bg-white border border-black/[0.04] flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-600/20 transition-all"
                            >
                                <Twitter size={18} />
                            </a>
                            <a
                                href="https://www.linkedin.com/company/uatu"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-10 h-10 rounded-xl bg-white border border-black/[0.04] flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-600/20 transition-all"
                            >
                                <Linkedin size={18} />
                            </a>
                        </div>
                    </div>

                    {/* Product */}
                    <div className="flex flex-col gap-6">
                        <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-900">Product</span>
                        <Link to="/features" className="text-sm font-bold text-slate-400 hover:text-indigo-600 transition-colors">Features</Link>
                        <Link to="/pricing" className="text-sm font-bold text-slate-400 hover:text-indigo-600 transition-colors">Pricing</Link>
                        <Link to="/how-it-works" className="text-sm font-bold text-slate-400 hover:text-indigo-600 transition-colors">How It Works</Link>
                        <Link to="/supported-chains" className="text-sm font-bold text-slate-400 hover:text-indigo-600 transition-colors">Supported Chains</Link>
                        <a href="https://dashboard.uatu.xyz" target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-slate-400 hover:text-emerald-600 transition-colors">Uatu Analyzer ↗</a>
                        <a href="https://build.uatu.xyz" target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-slate-400 hover:text-amber-600 transition-colors">Uatu Build ↗</a>
                    </div>

                    {/* Resources */}
                    <div className="flex flex-col gap-6">
                        <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-900">Resources</span>
                        <Link to="/docs" className="text-sm font-bold text-slate-400 hover:text-indigo-600 transition-colors">Documentation</Link>
                        <Link to="/use-cases" className="text-sm font-bold text-slate-400 hover:text-indigo-600 transition-colors">Use Cases</Link>
                        <Link to="/about" className="text-sm font-bold text-slate-400 hover:text-indigo-600 transition-colors">About</Link>
                        <a href="#blog" className="text-sm font-bold text-slate-400 hover:text-indigo-600 transition-colors">Blog</a>
                        <a href="#contact" className="text-sm font-bold text-slate-400 hover:text-indigo-600 transition-colors">Contact</a>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-10">
                    <div className="flex items-center gap-12">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                            © 2026 UatuAudit Security Platform
                        </p>
                        <div className="flex gap-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                            <a href="#" className="hover:text-indigo-600 transition-colors">Privacy</a>
                            <a href="#" className="hover:text-indigo-600 transition-colors">Terms</a>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}
