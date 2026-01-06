import { motion } from 'framer-motion';
import { Book, Github, Zap, Code, Settings, Shield, Terminal } from 'lucide-react';
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

            <div className="min-h-screen bg-[#FAFAFA] selection:bg-indigo-500/10 text-slate-900 font-sans overflow-x-hidden">
                {/* Hero Section */}
                <section className="pt-48 pb-24 relative overflow-hidden text-center">
                    <div className="absolute inset-0 z-0 bg-dot-pattern opacity-30" />
                    <div className="max-w-7xl mx-auto px-6 lg:px-10 relative z-10">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="inline-flex items-center gap-2.5 px-4 py-2 bg-indigo-50/50 border border-indigo-100/50 backdrop-blur-sm rounded-full text-[10px] font-extrabold uppercase tracking-[0.25em] text-indigo-600 mb-10"
                        >
                            <Book size={12} />
                            Knowledge Base
                        </motion.div>

                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                            className="text-6xl lg:text-[100px] font-black leading-[0.85] tracking-[-0.07em] mb-12"
                        >
                            Master Your <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-b from-indigo-500 to-indigo-800">Sovereignty.</span>
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2, duration: 0.8 }}
                            className="text-xl lg:text-2xl text-slate-400 font-medium max-w-3xl mx-auto mb-16 leading-relaxed"
                        >
                            Comprehensive guides to building, auditing, and scaling with Uatu.
                            From first scan to enterprise-wide infrastructure security.
                        </motion.p>
                    </div>
                </section>

                {/* Documentation Grid */}
                <section className="pb-40 relative">
                    <div className="max-w-7xl mx-auto px-6 lg:px-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                            {docSections.map((section, index) => (
                                <motion.div
                                    key={section.title}
                                    initial={{ opacity: 0, y: 30 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: index * 0.05, duration: 0.8 }}
                                    className="card-premium p-10 flex flex-col hover:border-black/[0.1] transition-all duration-700 bg-white/60 backdrop-blur-3xl group"
                                >
                                    <div className="w-14 h-14 rounded-2xl bg-white border border-black/[0.03] shadow-sm flex items-center justify-center mb-8 group-hover:scale-110 group-hover:shadow-xl transition-all duration-500 text-indigo-600">
                                        <section.icon size={24} strokeWidth={2} />
                                    </div>

                                    <h3 className="text-2xl font-black text-slate-900 mb-4 tracking-tight">{section.title}</h3>
                                    <p className="text-sm text-slate-400 font-medium leading-relaxed mb-8 flex-grow">{section.description}</p>

                                    <div className="space-y-3 pt-6 border-t border-black/[0.03]">
                                        {section.links.map((link) => (
                                            <a
                                                key={link.name}
                                                href={link.href}
                                                className="flex items-center justify-between text-[11px] font-black uppercase tracking-[0.2em] text-indigo-600 hover:text-indigo-800 transition-colors group/link"
                                            >
                                                {link.name}
                                                <Zap size={10} className="opacity-0 group-hover/link:opacity-100 transition-opacity" />
                                            </a>
                                        ))}
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Quick Start Section */}
                <section className="py-40 bg-white relative border-y border-black/[0.02]">
                    <div className="max-w-5xl mx-auto px-6 lg:px-10">
                        <div className="text-center mb-32">
                            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-600 mb-6 block">The Workflow</span>
                            <h2 className="text-6xl font-black text-slate-900 tracking-[-0.04em]">Quick Start Guide</h2>
                        </div>

                        <div className="space-y-20">
                            {[
                                { step: "1. Sign In with GitHub", desc: "Connect your GitHub account to get started. We use OAuth for secure authentication.", commands: ["# Click \"Sign In with GitHub\" button", "# Authorize UatuAudit to access your repositories"] },
                                { step: "2. Create a Project", desc: "Select your repository and configure your first audit project.", commands: ["# Navigate to Dashboard", "# Click \"New Project\"", "# Select repository and branch"] },
                                { step: "3. Run Your First Audit", desc: "Choose between a quick scan or full audit and let our AI analyze your code.", commands: ["# Configure audit settings", "# Click \"Start Audit\"", "# Review results in 5-60 minutes"] }
                            ].map((item, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -20 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.1 }}
                                    className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
                                >
                                    <div>
                                        <h3 className="text-3xl font-black text-slate-900 mb-6 tracking-tight">{item.step}</h3>
                                        <p className="text-slate-400 font-medium leading-relaxed">
                                            {item.desc}
                                        </p>
                                    </div>
                                    <div className="card-premium bg-slate-900 p-8 font-mono text-xs overflow-hidden relative">
                                        <div className="absolute top-0 right-0 p-4 opacity-10">
                                            <Terminal size={40} className="text-white" />
                                        </div>
                                        <div className="space-y-4">
                                            {item.commands.map((cmd, ci) => (
                                                <div key={ci} className={ci === 0 ? "text-emerald-400" : "text-slate-400 opacity-60"}>
                                                    {cmd}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* CTA Section */}
                <section className="py-56 relative overflow-hidden">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/5 blur-[120px] rounded-full" />
                    <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
                        <h2 className="text-6xl lg:text-[80px] font-black tracking-[-0.06em] mb-12 leading-[0.9]">Stuck on <span className="text-indigo-600">Complex</span> <br />Logic?</h2>
                        <p className="text-xl text-slate-400 font-medium mb-16 max-w-2xl mx-auto">Our specialized security engineering team is available for deep manual reviews.</p>
                        <div className="flex flex-col sm:flex-row gap-6 justify-center">
                            <Link
                                to="/dashboard"
                                className="btn-primary py-6 px-16 text-sm"
                            >
                                Get Started
                            </Link>
                            <a
                                href="#contact"
                                className="btn-ghost py-6 px-16 text-sm"
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
