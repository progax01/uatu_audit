import { motion } from 'framer-motion';
import {
    Shield, Search, Code, Cpu, Activity, Terminal,
    Lock, Eye, Zap, Users, FileText, Webhook
} from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';

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
            <SEO
                title="Features - Comprehensive Security Audit Platform"
                description="Explore UatuAudit's powerful features: AI-powered vulnerability detection, continuous monitoring, compliance reports, and seamless CI/CD integration."
                keywords={['features', 'smart contract security', 'vulnerability detection', 'AI audit']}
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
                            <Shield size={14} />
                            Complete Security Suite
                        </motion.div>

                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="text-6xl lg:text-7xl font-black text-slate-900 leading-[0.9] mb-8 tracking-[-0.05em]"
                        >
                            Everything You Need <br />
                            <span className="text-indigo-600">To Ship Secure Code</span>
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="text-xl text-slate-500 max-w-3xl mx-auto mb-12 leading-relaxed"
                        >
                            From AI-powered vulnerability detection to continuous monitoring and compliance reports,
                            UatuAudit provides a complete security audit platform for smart contracts and DApps.
                        </motion.p>
                    </div>
                </section>

                {/* Features Grid */}
                <section className="pb-32">
                    <div className="max-w-7xl mx-auto px-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {features.map((feature, index) => (
                                <motion.div
                                    key={feature.title}
                                    initial={{ opacity: 0, y: 40 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: index * 0.05 }}
                                    className="card p-10 group hover:shadow-xl transition-all duration-500"
                                >
                                    <div className={`w-16 h-16 rounded-2xl ${feature.bgColor} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500`}>
                                        <feature.icon className={feature.color} size={28} strokeWidth={1.5} />
                                    </div>

                                    <h3 className="text-2xl font-black text-slate-900 mb-4">{feature.title}</h3>
                                    <p className="text-slate-600 leading-relaxed mb-6">{feature.description}</p>

                                    <div className="space-y-2">
                                        {feature.details.map((detail, i) => (
                                            <div key={i} className="flex items-center gap-2 text-sm text-slate-500">
                                                <div className={`w-1.5 h-1.5 rounded-full ${feature.bgColor}`} />
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
                <section className="py-32 bg-gradient-to-br from-indigo-600 to-purple-600 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
                    <div className="max-w-4xl mx-auto px-10 text-center relative z-10">
                        <h2 className="text-5xl font-black text-white mb-6">Experience All Features</h2>
                        <p className="text-xl text-indigo-100 mb-10">Start with a free quick scan and explore the full platform.</p>
                        <Link
                            to="/dashboard"
                            className="inline-flex items-center gap-3 bg-white text-indigo-600 px-10 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-500"
                        >
                            Start Free Trial
                        </Link>
                    </div>
                </section>
            </div>
        </>
    );
}
