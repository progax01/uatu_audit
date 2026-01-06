import { motion } from 'framer-motion';
import { Github, Settings, Cpu, FileCheck, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';

const steps = [
    {
        number: '01',
        icon: Github,
        title: 'Connect Your Repository',
        description: 'Link your GitHub, GitLab, or Bitbucket repository in seconds. We support public and private repos.',
        details: [
            'One-click GitHub integration',
            'Support for monorepos',
            'Branch selection',
            'Automatic sync',
        ],
        color: 'from-indigo-500 to-purple-500',
    },
    {
        number: '02',
        icon: Settings,
        title: 'Configure Audit Settings',
        description: 'Choose your audit type, select specific files or directories, and customize security rules.',
        details: [
            'Quick scan or full audit',
            'File/directory selection',
            'Custom security rules',
            'Compliance standards',
        ],
        color: 'from-purple-500 to-pink-500',
    },
    {
        number: '03',
        icon: Cpu,
        title: 'AI Analysis Runs',
        description: 'Our advanced AI engine analyzes your code, dependencies, and logic flow to detect vulnerabilities.',
        details: [
            'Deep code analysis',
            'Dependency scanning',
            'Logic flow verification',
            'Gas optimization',
        ],
        color: 'from-pink-500 to-rose-500',
    },
    {
        number: '04',
        icon: FileCheck,
        title: 'Review Results',
        description: 'Get a comprehensive report with detailed findings, severity ratings, and step-by-step remediation guides.',
        details: [
            'Detailed vulnerability reports',
            'Severity classifications',
            'Remediation guides',
            'Export to PDF/Markdown',
        ],
        color: 'from-rose-500 to-orange-500',
    },
];

export default function HowItWorksPage() {
    return (
        <>
            <SEO
                title="How It Works - Simple 4-Step Security Audit Process"
                description="Learn how UatuAudit makes smart contract security audits simple: connect your repo, configure settings, let AI analyze, and review results."
                keywords={['how it works', 'audit process', 'smart contract audit', 'security workflow']}
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
                            4-Step Process
                        </motion.div>

                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="text-6xl lg:text-7xl font-black text-slate-900 leading-[0.9] mb-8 tracking-[-0.05em]"
                        >
                            Security Audits <br />
                            <span className="text-indigo-600">Made Simple</span>
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="text-xl text-slate-500 max-w-3xl mx-auto mb-12 leading-relaxed"
                        >
                            From connecting your repository to receiving comprehensive audit reports,
                            UatuAudit makes security audits effortless.
                        </motion.p>
                    </div>
                </section>

                {/* Steps Section */}
                <section className="pb-32">
                    <div className="max-w-5xl mx-auto px-10">
                        <div className="space-y-24">
                            {steps.map((step, index) => (
                                <motion.div
                                    key={step.number}
                                    initial={{ opacity: 0, y: 60 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: index * 0.1 }}
                                    className="relative"
                                >
                                    {/* Connector Line */}
                                    {index < steps.length - 1 && (
                                        <div className="absolute left-[60px] top-[140px] w-0.5 h-24 bg-gradient-to-b from-indigo-200 to-transparent" />
                                    )}

                                    <div className="flex flex-col md:flex-row gap-10 items-start">
                                        {/* Icon & Number */}
                                        <div className="relative shrink-0">
                                            <div className={`w-32 h-32 rounded-3xl bg-gradient-to-br ${step.color} p-0.5 shadow-2xl`}>
                                                <div className="w-full h-full rounded-3xl bg-white flex items-center justify-center">
                                                    <step.icon className="text-slate-900" size={48} strokeWidth={1.5} />
                                                </div>
                                            </div>
                                            <div className="absolute -bottom-3 -right-3 w-16 h-16 rounded-2xl bg-slate-900 flex items-center justify-center shadow-xl">
                                                <span className="text-2xl font-black text-white">{step.number}</span>
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 pt-4">
                                            <h3 className="text-4xl font-black text-slate-900 mb-4">{step.title}</h3>
                                            <p className="text-lg text-slate-600 leading-relaxed mb-6">{step.description}</p>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {step.details.map((detail, i) => (
                                                    <div key={i} className="flex items-center gap-3 text-sm text-slate-500">
                                                        <div className={`w-2 h-2 rounded-full bg-gradient-to-br ${step.color}`} />
                                                        {detail}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Interactive Demo Section */}
                <section className="py-32 bg-white/40">
                    <div className="max-w-5xl mx-auto px-10">
                        <div className="text-center mb-16">
                            <h2 className="text-5xl font-black text-slate-900 mb-6">See It In Action</h2>
                            <p className="text-xl text-slate-500">Watch how easy it is to audit your smart contracts</p>
                        </div>

                        <div className="card p-12 text-center">
                            <div className="w-full aspect-video bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl flex items-center justify-center mb-8">
                                <div className="text-slate-400">
                                    <Cpu size={64} strokeWidth={1} />
                                    <p className="mt-4 text-sm font-bold">Video Demo Coming Soon</p>
                                </div>
                            </div>

                            <Link
                                to="/dashboard"
                                className="inline-flex items-center gap-3 bg-indigo-600 text-white px-10 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-indigo-600/20 hover:shadow-indigo-500/30 hover:bg-indigo-700 transition-all duration-500 group"
                            >
                                Try It Yourself
                                <ArrowRight size={16} strokeWidth={3} className="group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </div>
                    </div>
                </section>

                {/* Integration Section */}
                <section className="py-32">
                    <div className="max-w-7xl mx-auto px-10">
                        <div className="text-center mb-16">
                            <h2 className="text-5xl font-black text-slate-900 mb-6">Integrate With Your Workflow</h2>
                            <p className="text-xl text-slate-500 max-w-3xl mx-auto">
                                UatuAudit seamlessly integrates with your existing development tools and CI/CD pipeline
                            </p>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                            {['GitHub Actions', 'GitLab CI', 'Slack', 'Discord', 'Webhooks', 'REST API', 'Jenkins', 'Bitbucket'].map((tool) => (
                                <div key={tool} className="card p-8 text-center hover:shadow-lg transition-all duration-300">
                                    <p className="font-black text-slate-900 text-sm">{tool}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* CTA Section */}
                <section className="py-32 bg-gradient-to-br from-slate-900 to-slate-800 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />
                    <div className="max-w-4xl mx-auto px-10 text-center relative z-10">
                        <h2 className="text-5xl font-black text-white mb-6">Ready to Get Started?</h2>
                        <p className="text-xl text-slate-300 mb-10">Start your first security audit in under 2 minutes.</p>
                        <Link
                            to="/dashboard"
                            className="inline-flex items-center gap-3 bg-white text-slate-900 px-10 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-500"
                        >
                            Start Free Audit
                        </Link>
                    </div>
                </section>
            </div>
        </>
    );
}
