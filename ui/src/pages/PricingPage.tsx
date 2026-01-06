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

            <div className="min-h-screen bg-base relative">
                {/* Hero Section */}
                <section className="pt-32 pb-20">
                    <div className="max-w-7xl mx-auto px-10 text-center">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="inline-flex items-center gap-3 px-5 py-2.5 bg-white border border-black/[0.04] shadow-sm rounded-full text-indigo-600 text-[10px] font-black uppercase tracking-[0.25em] mb-10"
                        >
                            Simple, Transparent Pricing
                        </motion.div>

                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="text-6xl lg:text-7xl font-black text-slate-900 leading-[0.9] mb-8 tracking-[-0.05em]"
                        >
                            Choose Your <br />
                            <span className="text-indigo-600">Security Plan</span>
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="text-xl text-slate-500 max-w-2xl mx-auto mb-12 leading-relaxed"
                        >
                            From quick scans to comprehensive enterprise audits, we have a plan that fits your needs.
                        </motion.p>
                    </div>
                </section>

                {/* Pricing Cards */}
                <section className="pb-32">
                    <div className="max-w-7xl mx-auto px-10">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {plans.map((plan, index) => (
                                <motion.div
                                    key={plan.name}
                                    initial={{ opacity: 0, y: 40 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    className={`relative card p-10 ${plan.popular
                                            ? 'ring-2 ring-indigo-600 shadow-2xl shadow-indigo-600/10'
                                            : ''
                                        }`}
                                >
                                    {plan.popular && (
                                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em]">
                                            Most Popular
                                        </div>
                                    )}

                                    <div className="mb-8">
                                        <h3 className="text-2xl font-black text-slate-900 mb-2">{plan.name}</h3>
                                        <p className="text-sm text-slate-400 font-medium mb-6">{plan.description}</p>

                                        <div className="flex items-baseline gap-2 mb-2">
                                            <span className="text-5xl font-black text-slate-900">{plan.price}</span>
                                            {plan.price !== 'Custom' && (
                                                <span className="text-sm text-slate-400 font-bold">/{plan.period}</span>
                                            )}
                                        </div>
                                        {plan.price === 'Custom' && (
                                            <span className="text-sm text-slate-400 font-bold">{plan.period}</span>
                                        )}
                                    </div>

                                    <Link
                                        to={plan.ctaLink}
                                        className={`block w-full text-center py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all duration-300 mb-8 ${plan.popular
                                                ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-600/20'
                                                : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                                            }`}
                                    >
                                        {plan.cta}
                                    </Link>

                                    <div className="space-y-4">
                                        {plan.features.map((feature, i) => (
                                            <div key={i} className="flex items-start gap-3">
                                                {feature.included ? (
                                                    <Check size={18} className="text-emerald-500 shrink-0 mt-0.5" strokeWidth={3} />
                                                ) : (
                                                    <X size={18} className="text-slate-300 shrink-0 mt-0.5" strokeWidth={3} />
                                                )}
                                                <span className={`text-sm font-medium ${feature.included ? 'text-slate-700' : 'text-slate-400'
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
                <section className="pb-32 bg-white/40">
                    <div className="max-w-4xl mx-auto px-10 pt-32">
                        <h2 className="text-4xl font-black text-slate-900 mb-12 text-center">Frequently Asked Questions</h2>

                        <div className="space-y-8">
                            <div className="card p-8">
                                <h3 className="text-lg font-black text-slate-900 mb-3">What's included in a quick scan?</h3>
                                <p className="text-slate-600 leading-relaxed">
                                    Quick scans analyze your smart contract for common vulnerabilities like reentrancy, integer overflow,
                                    and access control issues. Results are available in 5-10 minutes.
                                </p>
                            </div>

                            <div className="card p-8">
                                <h3 className="text-lg font-black text-slate-900 mb-3">How does a full audit differ?</h3>
                                <p className="text-slate-600 leading-relaxed">
                                    Full audits include deep AI analysis, logic flow verification, gas optimization recommendations,
                                    and compliance reports. They take 30-60 minutes and provide comprehensive documentation.
                                </p>
                            </div>

                            <div className="card p-8">
                                <h3 className="text-lg font-black text-slate-900 mb-3">Can I upgrade or downgrade anytime?</h3>
                                <p className="text-slate-600 leading-relaxed">
                                    Yes! You can change your plan at any time. Upgrades take effect immediately, and downgrades
                                    take effect at the end of your current billing period.
                                </p>
                            </div>

                            <div className="card p-8">
                                <h3 className="text-lg font-black text-slate-900 mb-3">Do you offer refunds?</h3>
                                <p className="text-slate-600 leading-relaxed">
                                    We offer a 14-day money-back guarantee on all paid plans. If you're not satisfied,
                                    contact us for a full refund.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* CTA Section */}
                <section className="py-32">
                    <div className="max-w-4xl mx-auto px-10 text-center">
                        <h2 className="text-5xl font-black text-slate-900 mb-6">Ready to Secure Your Code?</h2>
                        <p className="text-xl text-slate-500 mb-10">Start with a free quick scan today. No credit card required.</p>
                        <Link
                            to="/dashboard"
                            className="inline-flex items-center gap-3 bg-indigo-600 text-white px-10 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-indigo-600/20 hover:shadow-indigo-500/30 hover:bg-indigo-700 transition-all duration-500 group"
                        >
                            Start Free Audit
                            <ArrowRight size={16} strokeWidth={3} className="group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </div>
                </section>
            </div>
        </>
    );
}
