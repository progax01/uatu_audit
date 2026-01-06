import { motion } from 'framer-motion';
import { Book, Github, Zap, Code, Settings, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';

const docSections = [
    {
        icon: Zap,
        title: 'Quick Start',
        description: 'Get started with your first audit in under 5 minutes',
        links: [
            { name: 'Installation', href: '#install' },
            { name: 'First Audit', href: '#first-audit' },
            { name: 'Understanding Results', href: '#results' },
        ],
    },
    {
        icon: Github,
        title: 'GitHub Integration',
        description: 'Connect your repositories and automate security audits',
        links: [
            { name: 'OAuth Setup', href: '#oauth' },
            { name: 'Repository Access', href: '#repo-access' },
            { name: 'Branch Protection', href: '#branch-protection' },
        ],
    },
    {
        icon: Code,
        title: 'CI/CD Integration',
        description: 'Integrate audits into your deployment pipeline',
        links: [
            { name: 'GitHub Actions', href: '#github-actions' },
            { name: 'GitLab CI', href: '#gitlab-ci' },
            { name: 'Jenkins', href: '#jenkins' },
        ],
    },
    {
        icon: Settings,
        title: 'Configuration',
        description: 'Customize audit settings and security rules',
        links: [
            { name: 'Audit Types', href: '#audit-types' },
            { name: 'Custom Rules', href: '#custom-rules' },
            { name: 'Severity Levels', href: '#severity' },
        ],
    },
    {
        icon: Shield,
        title: 'Security Standards',
        description: 'Learn about our audit methodology and compliance',
        links: [
            { name: 'Audit Methodology', href: '#methodology' },
            { name: 'Vulnerability Database', href: '#vulnerabilities' },
            { name: 'Compliance Reports', href: '#compliance' },
        ],
    },
    {
        icon: Book,
        title: 'API Reference',
        description: 'Complete API documentation for developers',
        links: [
            { name: 'Authentication', href: '#api-auth' },
            { name: 'Endpoints', href: '#api-endpoints' },
            { name: 'Webhooks', href: '#webhooks' },
        ],
    },
];

export default function DocumentationPage() {
    return (
        <>
            <SEO
                title="Documentation - Complete Guide to UatuAudit"
                description="Comprehensive documentation for UatuAudit: quick start guides, GitHub integration, CI/CD setup, API reference, and security standards."
                keywords={['documentation', 'docs', 'guide', 'API', 'integration', 'tutorial']}
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
                            <Book size={14} />
                            Documentation
                        </motion.div>

                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="text-6xl lg:text-7xl font-black text-slate-900 leading-[0.9] mb-8 tracking-[-0.05em]"
                        >
                            Everything You Need <br />
                            <span className="text-indigo-600">To Get Started</span>
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="text-xl text-slate-500 max-w-3xl mx-auto mb-12 leading-relaxed"
                        >
                            Comprehensive guides, tutorials, and API documentation to help you integrate
                            UatuAudit into your development workflow.
                        </motion.p>
                    </div>
                </section>

                {/* Documentation Grid */}
                <section className="pb-32">
                    <div className="max-w-7xl mx-auto px-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {docSections.map((section, index) => (
                                <motion.div
                                    key={section.title}
                                    initial={{ opacity: 0, y: 40 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: index * 0.05 }}
                                    className="card p-8 hover:shadow-xl transition-all duration-500 group"
                                >
                                    <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                                        <section.icon className="text-indigo-600" size={24} strokeWidth={1.5} />
                                    </div>

                                    <h3 className="text-xl font-black text-slate-900 mb-3">{section.title}</h3>
                                    <p className="text-sm text-slate-600 mb-6">{section.description}</p>

                                    <div className="space-y-2">
                                        {section.links.map((link) => (
                                            <a
                                                key={link.name}
                                                href={link.href}
                                                className="block text-sm font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
                                            >
                                                {link.name} →
                                            </a>
                                        ))}
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Quick Start Section */}
                <section className="py-32 bg-white/40">
                    <div className="max-w-5xl mx-auto px-10">
                        <h2 className="text-4xl font-black text-slate-900 mb-12">Quick Start Guide</h2>

                        <div className="space-y-12">
                            <div className="card p-10">
                                <h3 className="text-2xl font-black text-slate-900 mb-4">1. Sign In with GitHub</h3>
                                <p className="text-slate-600 mb-4">
                                    Connect your GitHub account to get started. We use OAuth for secure authentication.
                                </p>
                                <div className="bg-slate-900 text-slate-100 p-6 rounded-xl font-mono text-sm">
                                    <div className="text-emerald-400"># Click "Sign In with GitHub" button</div>
                                    <div className="text-slate-400"># Authorize UatuAudit to access your repositories</div>
                                </div>
                            </div>

                            <div className="card p-10">
                                <h3 className="text-2xl font-black text-slate-900 mb-4">2. Create a Project</h3>
                                <p className="text-slate-600 mb-4">
                                    Select your repository and configure your first audit project.
                                </p>
                                <div className="bg-slate-900 text-slate-100 p-6 rounded-xl font-mono text-sm">
                                    <div className="text-emerald-400"># Navigate to Dashboard</div>
                                    <div className="text-slate-400"># Click "New Project"</div>
                                    <div className="text-slate-400"># Select repository and branch</div>
                                </div>
                            </div>

                            <div className="card p-10">
                                <h3 className="text-2xl font-black text-slate-900 mb-4">3. Run Your First Audit</h3>
                                <p className="text-slate-600 mb-4">
                                    Choose between a quick scan or full audit and let our AI analyze your code.
                                </p>
                                <div className="bg-slate-900 text-slate-100 p-6 rounded-xl font-mono text-sm">
                                    <div className="text-emerald-400"># Configure audit settings</div>
                                    <div className="text-slate-400"># Click "Start Audit"</div>
                                    <div className="text-slate-400"># Review results in 5-60 minutes</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* CTA Section */}
                <section className="py-32">
                    <div className="max-w-4xl mx-auto px-10 text-center">
                        <h2 className="text-5xl font-black text-slate-900 mb-6">Need Help?</h2>
                        <p className="text-xl text-slate-500 mb-10">
                            Our support team is here to help you get the most out of UatuAudit
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Link
                                to="/dashboard"
                                className="inline-flex items-center justify-center gap-3 bg-indigo-600 text-white px-10 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-indigo-600/20 hover:shadow-indigo-500/30 hover:bg-indigo-700 transition-all duration-500"
                            >
                                Get Started
                            </Link>
                            <a
                                href="#contact"
                                className="inline-flex items-center justify-center gap-3 bg-white text-slate-900 px-10 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] border-2 border-slate-200 hover:border-indigo-600 transition-all duration-500"
                            >
                                Contact Support
                            </a>
                        </div>
                    </div>
                </section>
            </div>
        </>
    );
}
