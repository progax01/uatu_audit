import { motion } from 'framer-motion';
import {
  ArrowRight, Shield, Code, Cpu, Activity, Terminal,
  Zap, Check, Github, BarChart3, Blocks
} from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import { supportedChains } from '../components/icons/CryptoIcons';

interface HomePageProps {
  isAuthed?: boolean;
  onLogin: () => void;
}

const products = [
  {
    name: 'UatuAudit',
    tagline: 'Security First',
    description: 'AI-powered security audits for smart contracts and DApps. Detect vulnerabilities before deployment.',
    icon: Shield,
    color: 'from-indigo-500 to-purple-500',
    features: ['50+ Vulnerability Types', 'AI Analysis', 'Real-time Alerts', 'Compliance Reports'],
    link: '/',
    external: false,
  },
  {
    name: 'Uatu Analyzer',
    tagline: 'Analytics & Insights',
    description: 'Query platform with real on-chain data creation using subgraphs. Complete analytics for your DApps.',
    icon: BarChart3,
    color: 'from-emerald-500 to-teal-500',
    features: ['Subgraph Creation', 'Real-time Queries', 'Custom Analytics', 'Data Visualization'],
    link: 'https://dashboard.uatu.xyz',
    external: true,
  },
  {
    name: 'Uatu Build',
    tagline: 'Build in Minutes',
    description: 'Create contracts and DApps with ease. No-code builder for deploying production-ready applications.',
    icon: Blocks,
    color: 'from-amber-500 to-orange-500',
    features: ['No-Code Builder', 'Smart Templates', 'One-Click Deploy', 'Multi-Chain Support'],
    link: 'https://build.uatu.xyz',
    external: true,
  },
];

const auditTypes = [
  {
    name: 'Quick Scan',
    time: '5-10 minutes',
    description: 'Fast surface-level analysis',
    price: 'Free',
    features: ['Basic vulnerabilities', 'Dependency check', 'Public repos only'],
  },
  {
    name: 'Full Audit',
    time: '30-60 minutes',
    description: 'Comprehensive deep analysis',
    price: 'From $99/mo',
    features: ['All vulnerabilities', 'Logic flow analysis', 'Private repos', 'Compliance reports'],
  },
];

const auditCapabilities = [
  {
    icon: Code,
    title: 'Smart Contracts',
    description: 'Deep analysis of Solidity, Vyper, and other smart contract languages',
  },
  {
    icon: Cpu,
    title: 'Frontend DApps',
    description: 'Security review of Web3 integrations and wallet connections',
  },
  {
    icon: Terminal,
    title: 'Backend Services',
    description: 'API security, database checks, and infrastructure review',
  },
  {
    icon: Activity,
    title: 'Live Monitoring',
    description: 'Real-time alerts for deployed contracts and continuous scanning',
  },
];

const vulnerabilities = [
  'Reentrancy Attacks',
  'Integer Overflow/Underflow',
  'Access Control Issues',
  'Gas Optimization Problems',
  'Logic Errors & Edge Cases',
  'Timestamp Dependencies',
  'Denial of Service',
  'Front-Running Vulnerabilities',
  'And 50+ more...',
];

const integrations = [
  { name: 'GitHub Actions', logo: Github },
  { name: 'GitLab CI', logo: Terminal },
  { name: 'Slack', logo: Activity },
  { name: 'Discord', logo: Activity },
  { name: 'Webhooks', logo: Zap },
  { name: 'REST API', logo: Code },
];

export default function HomePage({ isAuthed, onLogin }: HomePageProps) {
  return (
    <>
      <SEO
        title="Uatu - Complete Web3 Security, Analytics & Build Platform"
        description="AI-powered security audits, real-time analytics with subgraphs, and no-code DApp builder. Complete platform for Web3 development across 15+ blockchains."
        keywords={['smart contract audit', 'web3 analytics', 'dapp builder', 'blockchain security', 'subgraph', 'no-code']}
      />

      <div className="min-h-screen bg-base relative selection:bg-indigo-500/20">
        {/* Decorative Atmosphere */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-500/[0.03] blur-[140px] rounded-full animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-500/[0.02] blur-[120px] rounded-full" />
        </div>

        {/* Hero Section */}
        <section className="relative min-h-screen flex items-center pt-24 overflow-hidden">
          <div className="max-w-7xl mx-auto px-10 w-full">
            <div className="text-center max-w-5xl mx-auto">
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-3 px-5 py-2.5 bg-white border border-black/[0.04] shadow-sm rounded-full text-indigo-600 text-[10px] font-black uppercase tracking-[0.25em] mb-10"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                </span>
                Complete Web3 Development Platform
              </motion.div>

              {/* Headline */}
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-6xl lg:text-8xl font-black text-slate-900 leading-[0.9] mb-8 tracking-[-0.06em]"
              >
                Audit. Analyze. <br />
                Build. <br />
                <span className="text-indigo-600">Ship Secure.</span>
              </motion.h1>

              {/* Subheadline */}
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-2xl text-slate-500 max-w-3xl mx-auto mb-12 leading-relaxed"
              >
                AI-powered security audits, real-time analytics with subgraphs, and no-code DApp builder.
                Everything you need for Web3 development.
              </motion.p>

              {/* CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex flex-col sm:flex-row gap-6 justify-center mb-16"
              >
                <Link
                  to="/dashboard"
                  className="inline-flex items-center justify-center gap-3 bg-indigo-600 text-white px-10 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-indigo-600/20 hover:shadow-indigo-500/30 hover:bg-indigo-700 transition-all duration-500 group"
                >
                  Start Free Audit
                  <ArrowRight size={16} strokeWidth={3} className="group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  to="/how-it-works"
                  className="inline-flex items-center justify-center gap-3 bg-white text-slate-900 px-10 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] border-2 border-slate-200 hover:border-indigo-600 transition-all duration-500"
                >
                  Explore Platform
                </Link>
              </motion.div>

              {/* Trust Indicators */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="flex flex-wrap justify-center gap-12 text-center"
              >
                <div>
                  <div className="text-3xl font-black text-slate-900 mb-1">10,000+</div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Audits Completed</div>
                </div>
                <div>
                  <div className="text-3xl font-black text-slate-900 mb-1">500+</div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Vulnerabilities Found</div>
                </div>
                <div>
                  <div className="text-3xl font-black text-slate-900 mb-1">15+</div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Blockchains Supported</div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Uatu Ecosystem Products */}
        <section className="py-32 bg-gradient-to-br from-slate-900 to-slate-800 relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />
          <div className="max-w-7xl mx-auto px-10 relative z-10">
            <div className="text-center mb-20">
              <h2 className="text-5xl font-black text-white mb-6">Complete Web3 Ecosystem</h2>
              <p className="text-xl text-slate-300 max-w-3xl mx-auto">
                Three powerful products working together to secure, analyze, and build your Web3 applications
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {products.map((product, i) => (
                <motion.div
                  key={product.name}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="relative group"
                >
                  <div className="card p-8 bg-white/5 backdrop-blur-sm border-white/10 hover:bg-white/10 transition-all duration-500 h-full flex flex-col">
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${product.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500`}>
                      <product.icon className="text-white" size={28} strokeWidth={1.5} />
                    </div>

                    <div className="mb-2">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{product.tagline}</span>
                    </div>
                    <h3 className="text-3xl font-black text-white mb-4">{product.name}</h3>
                    <p className="text-slate-300 mb-6 leading-relaxed flex-grow">{product.description}</p>

                    <div className="space-y-2 mb-8">
                      {product.features.map((feature) => (
                        <div key={feature} className="flex items-center gap-2 text-sm text-slate-400">
                          <Check size={14} className="text-emerald-400" strokeWidth={3} />
                          {feature}
                        </div>
                      ))}
                    </div>

                    {product.external ? (
                      <a
                        href={product.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`block text-center py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] bg-gradient-to-br ${product.color} text-white hover:scale-105 transition-all duration-300 shadow-lg`}
                      >
                        Launch {product.name.split(' ')[1]}
                      </a>
                    ) : (
                      <Link
                        to={product.link}
                        className={`block text-center py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] bg-gradient-to-br ${product.color} text-white hover:scale-105 transition-all duration-300 shadow-lg`}
                      >
                        Explore Audit
                      </Link>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* What We Audit - Enhanced */}
        <section className="py-32 bg-white/40 relative">
          <div className="max-w-7xl mx-auto px-10">
            <div className="text-center mb-20">
              <h2 className="text-5xl font-black text-slate-900 mb-6">Complete Security Coverage</h2>
              <p className="text-xl text-slate-500 max-w-3xl mx-auto">
                From smart contracts to full-stack DApps, we audit every layer of your application
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {auditCapabilities.map((item, i) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="card p-8 text-center hover:shadow-xl transition-all duration-500 group"
                >
                  <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                    <item.icon className="text-indigo-600" size={28} strokeWidth={1.5} />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mb-3">{item.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{item.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Supported Blockchains */}
        <section className="py-32 relative">
          <div className="max-w-7xl mx-auto px-10">
            <div className="text-center mb-20">
              <h2 className="text-5xl font-black text-slate-900 mb-6">Multi-Chain Support</h2>
              <p className="text-xl text-slate-500 max-w-3xl mx-auto">
                Security audits, analytics, and deployment across 15+ major blockchain networks
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-8 mb-12">
              {supportedChains.slice(0, 7).map((chain, i) => {
                const IconComponent = chain.icon;
                return (
                  <motion.div
                    key={chain.name}
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                    className="flex flex-col items-center gap-3 p-6 rounded-2xl hover:bg-white/60 transition-all duration-300"
                  >
                    <div
                      className="w-16 h-16 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${chain.color}15` }}
                    >
                      <IconComponent size={32} style={{ color: chain.color }} />
                    </div>
                    <span className="text-sm font-bold text-slate-900">{chain.name}</span>
                  </motion.div>
                );
              })}
            </div>

            <div className="text-center">
              <Link
                to="/supported-chains"
                className="inline-flex items-center gap-2 text-indigo-600 font-bold hover:text-indigo-700 transition-colors"
              >
                View All Supported Chains
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-32 bg-white/40 relative">
          <div className="max-w-7xl mx-auto px-10">
            <div className="text-center mb-20">
              <h2 className="text-5xl font-black text-slate-900 mb-6">How It Works</h2>
              <p className="text-xl text-slate-500 max-w-3xl mx-auto">
                Four simple steps to comprehensive security audits with live monitoring
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {[
                { num: '01', title: 'Connect Repo', desc: 'Link GitHub or upload contracts' },
                { num: '02', title: 'Configure', desc: 'Select audit scope and settings' },
                { num: '03', title: 'AI Analyzes', desc: 'Deep scan with live alerts' },
                { num: '04', title: 'Monitor', desc: 'Continuous protection & reports' },
              ].map((step, i) => (
                <motion.div
                  key={step.num}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="text-center"
                >
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center mx-auto mb-6">
                    <span className="text-3xl font-black text-white">{step.num}</span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mb-2">{step.title}</h3>
                  <p className="text-sm text-slate-500">{step.desc}</p>
                </motion.div>
              ))}
            </div>

            <div className="text-center mt-16">
              <Link
                to="/how-it-works"
                className="inline-flex items-center gap-3 bg-indigo-600 text-white px-10 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-indigo-700 transition-all duration-500"
              >
                Learn More
              </Link>
            </div>
          </div>
        </section>

        {/* Security Coverage */}
        <section className="py-32 relative">
          <div className="max-w-7xl mx-auto px-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
              <div>
                <h2 className="text-5xl font-black text-slate-900 mb-8">
                  50+ Vulnerability <br />Types Detected
                </h2>
                <p className="text-xl text-slate-600 mb-10 leading-relaxed">
                  Our AI engine identifies critical security issues across smart contracts, frontends,
                  backends, and infrastructure with real-time alerts.
                </p>
                <Link
                  to="/features"
                  className="inline-flex items-center gap-3 bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-indigo-700 transition-all duration-500"
                >
                  View All Features
                  <ArrowRight size={14} strokeWidth={3} />
                </Link>
              </div>

              <div className="card p-10">
                <div className="space-y-3">
                  {vulnerabilities.map((vuln, i) => (
                    <motion.div
                      key={vuln}
                      initial={{ opacity: 0, x: 20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-3 text-sm text-slate-700"
                    >
                      <Check size={16} className="text-emerald-500 shrink-0" strokeWidth={3} />
                      {vuln}
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Audit Types Comparison */}
        <section className="py-32 bg-white/40 relative">
          <div className="max-w-7xl mx-auto px-10">
            <div className="text-center mb-20">
              <h2 className="text-5xl font-black text-slate-900 mb-6">Choose Your Audit Type</h2>
              <p className="text-xl text-slate-500 max-w-3xl mx-auto">
                From quick scans to comprehensive audits with continuous monitoring
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {auditTypes.map((type, i) => (
                <motion.div
                  key={type.name}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="card p-10"
                >
                  <h3 className="text-3xl font-black text-slate-900 mb-2">{type.name}</h3>
                  <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-2xl font-black text-indigo-600">{type.price}</span>
                    <span className="text-sm text-slate-400">• {type.time}</span>
                  </div>
                  <p className="text-slate-600 mb-6">{type.description}</p>
                  <div className="space-y-2">
                    {type.features.map((feature) => (
                      <div key={feature} className="flex items-center gap-2 text-sm text-slate-600">
                        <Check size={14} className="text-emerald-500" strokeWidth={3} />
                        {feature}
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="text-center mt-12">
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 text-indigo-600 font-bold hover:text-indigo-700 transition-colors"
              >
                View Full Pricing
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>

        {/* Integrations */}
        <section className="py-32 relative">
          <div className="max-w-7xl mx-auto px-10">
            <div className="text-center mb-20">
              <h2 className="text-5xl font-black text-slate-900 mb-6">Seamless Integration</h2>
              <p className="text-xl text-slate-500 max-w-3xl mx-auto">
                Integrate security audits into your existing workflow with zero configuration
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
              {integrations.map((integration, i) => (
                <motion.div
                  key={integration.name}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="card p-6 text-center hover:shadow-lg transition-all duration-300"
                >
                  <integration.logo size={32} className="text-slate-400 mx-auto mb-3" strokeWidth={1.5} />
                  <p className="text-xs font-bold text-slate-900">{integration.name}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-32 bg-gradient-to-br from-indigo-600 to-purple-600 relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
          <div className="max-w-4xl mx-auto px-10 text-center relative z-10">
            <h2 className="text-6xl font-black text-white mb-6">
              Ready to Secure Your Web3 Project?
            </h2>
            <p className="text-2xl text-indigo-100 mb-12">
              Start with a free audit, explore analytics, or build your first DApp today.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-3 bg-white text-indigo-600 px-12 py-6 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-500"
              >
                Start Free Audit
              </Link>
              <a
                href="https://dashboard.uatu.xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 bg-transparent border-2 border-white text-white px-12 py-6 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-white hover:text-indigo-600 transition-all duration-500"
              >
                Explore Analytics
              </a>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
