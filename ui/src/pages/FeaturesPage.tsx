import { motion } from 'framer-motion';
import {
    Shield, Search, Cpu, Activity, Terminal,
    Lock, Users, FileText, Webhook
} from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import MouseTooltip from '../components/MouseTooltip';

const features = [
    {
        icon: Search,
        title: 'Vulnerability Detection',
        description: 'Detect 50+ vulnerability types including reentrancy, integer overflow, access control issues, and logic errors.',
        details: [
            'Reentrancy attacks',
            'Integer overflow/underflow',
            'Access control vulnerabilities',
            'Gas optimization issues',
            'Logic errors & edge cases',
            'Timestamp dependencies',
        ],
        color: 'text-indigo-600',
        bgColor: 'bg-indigo-500/10',
    },
    {
        icon: Cpu,
        title: 'AI-Powered Analysis',
        description: 'Advanced AI engine that understands code context and detects complex vulnerabilities that traditional tools miss.',
        details: [
            'Deep learning models',
            'Context-aware analysis',
            'Pattern recognition',
            'False positive reduction',
            'Continuous model improvement',
        ],
        color: 'text-purple-600',
        bgColor: 'bg-purple-500/10',
    },
    {
        icon: Activity,
        title: 'Continuous Monitoring',
        description: 'Real-time scanning of your repositories with instant alerts when new vulnerabilities are detected.',
        details: [
            'Automated scans every 15 minutes',
            'Instant Slack/Discord alerts',
            'Email notifications',
            'Dependency monitoring',
            'Branch protection',
        ],
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-500/10',
    },
    {
        icon: FileText,
        title: 'Compliance Reports',
        description: 'Generate comprehensive audit reports that meet industry standards and regulatory requirements.',
        details: [
            'PDF export',
            'Markdown format',
            'Executive summaries',
            'Technical deep-dives',
            'Remediation guides',
            'White-label options',
        ],
        color: 'text-amber-600',
        bgColor: 'bg-amber-500/10',
    },
    {
        icon: Users,
        title: 'Team Collaboration',
        description: 'Work together with your team to review findings, assign tasks, and track remediation progress.',
        details: [
            'Multi-user workspaces',
            'Role-based permissions',
            'Comment threads',
            'Task assignment',
            'Audit history',
        ],
        color: 'text-blue-600',
        bgColor: 'bg-blue-500/10',
    },
    {
        icon: Webhook,
        title: 'API & Integrations',
        description: 'Integrate with your existing workflow using our REST API, webhooks, and pre-built integrations.',
        details: [
            'REST API',
            'Webhooks',
            'GitHub Actions',
            'GitLab CI',
            'Slack & Discord',
            'Custom integrations',
        ],
        color: 'text-rose-600',
        bgColor: 'bg-rose-500/10',
    },
    {
        icon: Lock,
        title: 'Custom Security Rules',
        description: 'Define your own security rules and policies specific to your project requirements.',
        details: [
            'Custom rule engine',
            'Project-specific policies',
            'Severity configuration',
            'False positive tuning',
            'Rule templates',
        ],
        color: 'text-slate-900',
        bgColor: 'bg-slate-500/10',
    },
    {
        icon: Terminal,
        title: 'CI/CD Integration',
        description: 'Seamlessly integrate security audits into your deployment pipeline with zero configuration.',
        details: [
            'GitHub Actions',
            'GitLab CI/CD',
            'Bitbucket Pipelines',
            'Jenkins support',
            'Automated PR checks',
            'Deployment gates',
        ],
        color: 'text-cyan-600',
        bgColor: 'bg-cyan-500/10',
    },
];

export default function FeaturesPage() {
    return (
        <>
            <MouseTooltip />
            <SEO
                title="Features - Comprehensive Security Audit Platform"
                description="Explore UatuAudit's powerful features: AI-powered vulnerability detection, continuous monitoring, compliance reports, and seamless CI/CD integration."
                keywords={['features', 'smart contract security', 'vulnerability detection', 'AI audit']}
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
                            <Shield size={12} />
                            Complete Security Suite
                        </motion.div>

                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                            className="text-4xl lg:text-5xl font-black tracking-tight mb-8"
                        >
                            High-Assurance <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-br from-indigo-500 to-indigo-700">Security Infrastructure.</span>
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2, duration: 0.8 }}
                            className="text-lg lg:text-xl text-slate-400 font-medium max-w-3xl mx-auto mb-16 leading-relaxed"
                        >
                            A comprehensive security audit platform built for high-assurance Web3 teams.
                            From AI-powered detection to continuous mainnet monitoring.
                        </motion.p>
                    </div>
                </section>

                {/* Features Grid */}
                <section className="pb-40 relative">
                    <div className="max-w-7xl mx-auto px-6 lg:px-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            {features.map((feature, index) => (
                                <motion.div
                                    key={feature.title}
                                    initial={{ opacity: 0, y: 30 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: index * 0.05, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                                    className="card-premium !p-8 group hover:border-black/[0.1] transition-all duration-700 bg-white/60 backdrop-blur-3xl"
                                >
                                    <div className={`w-16 h-16 rounded-[22px] bg-white border border-black/[0.03] shadow-sm flex items-center justify-center mb-10 group-hover:scale-110 group-hover:shadow-xl transition-all duration-500 ${feature.color}`}>
                                        <feature.icon size={28} strokeWidth={2} />
                                    </div>

                                    <h3 className="text-xl font-black text-slate-900 mb-4 tracking-tight">{feature.title}</h3>
                                    <p className="text-sm text-slate-400 font-medium leading-relaxed mb-8 text-pretty">{feature.description}</p>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-8 border-t border-black/[0.03]">
                                        {feature.details.map((detail, i) => (
                                            <div key={i} className="flex items-center gap-3 text-xs font-bold text-slate-500 uppercase tracking-widest">
                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                                {detail}
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* CTA Section */}
                <section className="py-56 relative overflow-hidden bg-slate-900">
                    <div className="absolute inset-0 bg-dot-pattern opacity-[0.05] invert" />
                    <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/10 to-transparent" />
                    <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
                        <h2 className="text-4xl lg:text-6xl font-black text-white tracking-tight mb-10 leading-tight">Secure Your <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-indigo-200">Digital Infrastructure.</span></h2>
                        <p className="text-lg lg:text-xl text-slate-400 font-medium mb-14 max-w-2xl mx-auto">Join the teams building the next generation of decentralized finance with Uatu.</p>
                        <Link
                            to="/dashboard"
                            className="btn-primary py-6 px-16 text-sm"
                        >
                            Get Started Now
                        </Link>
                    </div>
                </section>
            </div>
        </>
    );
}
