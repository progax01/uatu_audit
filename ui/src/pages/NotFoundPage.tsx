import { motion } from 'framer-motion';
import { Home, Search, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';

export default function NotFoundPage() {
    return (
        <>
            <SEO
                title="404 - Page Not Found"
                description="The page you're looking for doesn't exist. Return to UatuAudit homepage."
            />

            <div className="min-h-screen bg-base relative flex items-center justify-center">
                {/* Decorative Background */}
                <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                    <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-500/[0.03] blur-[140px] rounded-full animate-pulse" />
                    <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-red-500/[0.02] blur-[120px] rounded-full" />
                </div>

                <div className="max-w-3xl mx-auto px-10 text-center relative z-10">
                    {/* 404 Number */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                        className="mb-12"
                    >
                        <div className="text-[200px] lg:text-[280px] font-black text-slate-900/5 leading-none select-none">
                            404
                        </div>
                        <div className="text-6xl lg:text-7xl font-black text-slate-900 leading-none -mt-32 lg:-mt-40">
                            Page Not Found
                        </div>
                    </motion.div>

                    {/* Message */}
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-xl text-slate-500 mb-12 leading-relaxed"
                    >
                        The page you're looking for doesn't exist or has been moved.
                        Let's get you back on track.
                    </motion.p>

                    {/* Actions */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="flex flex-col sm:flex-row gap-4 justify-center"
                    >
                        <Link
                            to="/"
                            className="inline-flex items-center justify-center gap-3 bg-indigo-600 text-white px-10 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-indigo-600/20 hover:shadow-indigo-500/30 hover:bg-indigo-700 transition-all duration-500"
                        >
                            <Home size={16} strokeWidth={3} />
                            Back to Home
                        </Link>
                        <button
                            onClick={() => window.history.back()}
                            className="inline-flex items-center justify-center gap-3 bg-white text-slate-900 px-10 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] border-2 border-slate-200 hover:border-indigo-600 transition-all duration-500"
                        >
                            <ArrowLeft size={16} strokeWidth={3} />
                            Go Back
                        </button>
                    </motion.div>

                    {/* Quick Links */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="mt-20 pt-12 border-t border-black/[0.04]"
                    >
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6">
                            Popular Pages
                        </p>
                        <div className="flex flex-wrap justify-center gap-4">
                            {[
                                { to: '/features', label: 'Features' },
                                { to: '/pricing', label: 'Pricing' },
                                { to: '/docs', label: 'Documentation' },
                                { to: '/supported-chains', label: 'Supported Chains' },
                                { to: '/about', label: 'About' },
                            ].map((link) => (
                                <Link
                                    key={link.to}
                                    to={link.to}
                                    className="text-sm font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
                                >
                                    {link.label}
                                </Link>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </div>
        </>
    );
}
