import { motion } from 'framer-motion';
import { Check, X, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';

const plans = [
    {
        name: 'Free',
        price: '$0',
        period: 'forever',
        description: 'Perfect for trying out UatuAudit',
        features: [
            { text: '5 quick scans per month', included: true },
            { text: 'Basic vulnerability detection', included: true },
            { text: 'Public repository support', included: true },
            { text: 'Community support', included: true },
            { text: 'Full audit reports', included: false },
            { text: 'Private repositories', included: false },
            { text: 'CI/CD integration', included: false },
            { text: 'Priority support', included: false },
        ],
        cta: 'Start Free',
        ctaLink: '/dashboard',
        popular: false,
    },
    {
        name: 'Pro',
        price: '$99',
        period: 'per month',
        description: 'For serious developers and small teams',
        features: [
            { text: 'Unlimited quick scans', included: true },
            { text: '20 full audits per month', included: true },
            { text: 'Private repository support', included: true },
            { text: 'Advanced AI analysis', included: true },
            { text: 'CI/CD integration', included: true },
            { text: 'Compliance reports', included: true },
            { text: 'Email support', included: true },
            { text: 'API access', included: true },
        ],
        cta: 'Start Pro Trial',
        ctaLink: '/dashboard',
        popular: true,
    },
    {
        name: 'Enterprise',
        price: 'Custom',
        period: 'contact us',
        description: 'For organizations with advanced needs',
        features: [
            { text: 'Unlimited everything', included: true },
            { text: 'Dedicated account manager', included: true },
            { text: 'Custom security rules', included: true },
            { text: 'On-premise deployment option', included: true },
            { text: 'SLA guarantees', included: true },
            { text: 'White-label reports', included: true },
            { text: '24/7 priority support', included: true },
            { text: 'Custom integrations', included: true },
        ],
        cta: 'Contact Sales',
        ctaLink: '#contact',
        popular: false,
    },
];

export default function PricingPage() {
    return (
        <>
            <SEO
                title="Pricing - Transparent & Scalable Plans"
                description="Choose the perfect plan for your security audit needs. From free quick scans to enterprise solutions with custom SLAs."
                keywords={['pricing', 'plans', 'smart contract audit cost', 'security audit pricing']}
            />

            <div className="min-h-screen bg-[#FAFAFA] selection:bg-indigo-500/10 text-slate-900 font-sans overflow-x-hidden">
                {/* Hero Section */}
                <section className="pt-48 pb-24 relative overflow-hidden">
                    <div className="absolute inset-0 z-0 bg-dot-pattern opacity-30" />
                    <div className="max-w-7xl mx-auto px-6 lg:px-10 relative z-10 text-center">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="inline-flex items-center gap-2.5 px-4 py-2 bg-indigo-50/50 border border-indigo-100/50 backdrop-blur-sm rounded-full text-[10px] font-extrabold uppercase tracking-[0.25em] text-indigo-600 mb-10"
                        >
                            Transparent Engineering
                        </motion.div>

                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                            className="text-6xl lg:text-[100px] font-black leading-[0.85] tracking-[-0.07em] mb-12"
                        >
                            Scale With <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-b from-indigo-500 to-indigo-800">Confidence.</span>
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2, duration: 0.8 }}
                            className="text-xl lg:text-2xl text-slate-400 font-medium max-w-2xl mx-auto mb-16 leading-relaxed"
                        >
                            Predictable pricing for high-assurance teams. No hidden fees, just pure security excellence.
                        </motion.p>
                    </div>
                </section>

                {/* Pricing Cards */}
                <section className="pb-40 relative">
                    <div className="max-w-7xl mx-auto px-6 lg:px-10">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                            {plans.map((plan, index) => (
                                <motion.div
                                    key={plan.name}
                                    initial={{ opacity: 0, y: 30 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                                    className={`relative card-premium p-12 flex flex-col ${plan.popular
                                        ? 'border-indigo-600/20 shadow-2xl shadow-indigo-600/5 bg-white'
                                        : 'bg-white/40 backdrop-blur-3xl'
                                        }`}
                                >
                                    {plan.popular && (
                                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-6 py-2 rounded-full text-[9px] font-black uppercase tracking-[0.3em] shadow-xl shadow-indigo-600/20">
                                            Recommended
                                        </div>
                                    )}

                                    <div className="mb-10">
                                        <h3 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">{plan.name}</h3>
                                        <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mb-10">{plan.description}</p>

                                        <div className="flex items-baseline gap-2">
                                            <span className="text-6xl font-black text-slate-900 tracking-tighter">{plan.price}</span>
                                            {plan.price !== 'Custom' && (
                                                <span className="text-sm text-slate-400 font-black uppercase tracking-widest">/{plan.period.split(' ')[1]}</span>
                                            )}
                                        </div>
                                    </div>

                                    <Link
                                        to={plan.ctaLink}
                                        className={`w-full text-center py-5 transition-all duration-500 mb-12 ${plan.popular
                                            ? 'btn-primary'
                                            : 'btn-ghost'
                                            }`}
                                    >
                                        {plan.cta}
                                    </Link>

                                    <div className="space-y-5 flex-grow">
                                        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 mb-8 block">Included Features</div>
                                        {plan.features.map((feature, i) => (
                                            <div key={i} className="flex items-start gap-4">
                                                <div className={`mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${feature.included ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-300'}`}>
                                                    {feature.included ? (
                                                        <Check size={12} strokeWidth={4} />
                                                    ) : (
                                                        <X size={12} strokeWidth={4} />
                                                    )}
                                                </div>
                                                <span className={`text-sm font-semibold leading-snug ${feature.included ? 'text-slate-700' : 'text-slate-400 opacity-60'
                                                    }`}>
                                                    {feature.text}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* FAQ Section */}
                <section className="py-40 bg-white relative border-y border-black/[0.02]">
                    <div className="max-w-4xl mx-auto px-6 lg:px-10">
                        <div className="text-center mb-24">
                            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-600 mb-6 block">Questions?</span>
                            <h2 className="text-5xl font-black text-slate-900 tracking-tight">Frequently Asked Questions</h2>
                        </div>

                        <div className="grid grid-cols-1 gap-8">
                            {[
                                { q: "What's included in a quick scan?", a: "Quick scans analyze your smart contract for common vulnerabilities like reentrancy, integer overflow, and access control issues. Results are available in 5-10 minutes." },
                                { q: "How does a full audit differ?", a: "Full audits include deep AI analysis, logic flow verification, gas optimization recommendations, and compliance reports. They take 30-60 minutes." },
                                { q: "Can I upgrade or downgrade anytime?", a: "Yes! You can change your plan at any time. Upgrades take effect immediately, and downgrades take effect at the end of your billing period." },
                                { q: "Do you offer refunds?", a: "We offer a 14-day money-back guarantee on all paid plans. If you're not satisfied, contact us for a full refund." }
                            ].map((faq, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 10 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.1 }}
                                    className="card-premium p-10 bg-[#FAFAFA]/50"
                                >
                                    <h3 className="text-lg font-black text-slate-900 mb-4 tracking-tight">{faq.q}</h3>
                                    <p className="text-slate-400 font-medium leading-relaxed text-sm">{faq.a}</p>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* CTA Section */}
                <section className="py-56 relative overflow-hidden">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/5 blur-[120px] rounded-full" />
                    <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
                        <h2 className="text-6xl lg:text-[80px] font-black tracking-[-0.06em] mb-12 leading-[0.9]">Ready to <span className="text-indigo-600">Secure</span> <br />Your Code?</h2>
                        <p className="text-xl text-slate-400 font-medium mb-16 max-w-2xl mx-auto">Start with a free quick scan today. No credit card required.</p>
                        <Link
                            to="/dashboard"
                            className="btn-primary py-6 px-16 text-sm"
                        >
                            Start Free Audit <ArrowRight size={18} strokeWidth={3} />
                        </Link>
                    </div>
                </section>
            </div>
        </>
    );
}
