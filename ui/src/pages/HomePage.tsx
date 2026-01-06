import { motion, Variants } from 'framer-motion';
import {
  ArrowRight, Zap, Check, Sparkles, ShieldAlert, Fingerprint
} from 'lucide-react';
import {
  PremiumShield, PremiumRadar, PremiumCode,
  PremiumAnalytics, PremiumBlocks
} from '../components/IconSystem';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import { supportedChains, SolanaIcon, StellarIcon, PartisiaIcon } from '../components/icons/CryptoIcons';
import MouseTooltip from '../components/MouseTooltip';

interface HomePageProps {
  isAuthed?: boolean;
  onLogin: () => void;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] }
  }
};

export default function HomePage({ isAuthed, onLogin }: HomePageProps) {
  return (
    <>
      <MouseTooltip />
      <SEO
        title="Uatu - The Ultimate Web3 Security & Development Control Center"
        description="High-assurance AI security audits, real-time analytics, and no-code DApp infrastructure. The unified command center for Web3 security."
      />

      <div className="min-h-screen bg-[#FAFAFA] selection:bg-indigo-500/10 text-slate-900 font-sans overflow-x-hidden">

        {/* Hero Section: The Command Center */}
        <section className="relative pb-20 pt-16 lg:pb-40 overflow-hidden border-b border-black/[0.02]">
          {/* Subtle Background Elements */}
          <div className="absolute inset-0 z-0 bg-dot-pattern opacity-30" />
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-indigo-500/5 blur-[160px] rounded-full" />

          <div className="max-w-7xl mx-auto px-6 lg:px-10 relative z-10">
            <div className="flex flex-col lg:flex-row items-center gap-20 lg:gap-32">
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="flex-[1.2] text-center lg:text-left"
              >
                <motion.div
                  variants={itemVariants}
                  className="inline-flex items-center gap-2.5 px-4 py-2 bg-indigo-50/50 border border-indigo-100/50 backdrop-blur-sm rounded-full text-[10px] font-extrabold uppercase tracking-[0.25em] text-indigo-600 mb-10"
                >
                  <Sparkles size={12} />
                  <span>Next Generation Security</span>
                </motion.div>

                <motion.h1
                  variants={itemVariants}
                  className="text-4xl lg:text-5xl font-black leading-tight tracking-tight mb-8"
                >
                  High-Assurance <span className="text-slate-400 block lg:inline">Security</span> <br />
                  for Web3 <span className="text-transparent bg-clip-text bg-gradient-to-br from-indigo-500 to-indigo-700">Infrastructure.</span>
                </motion.h1>

                <motion.p
                  variants={itemVariants}
                  className="text-lg lg:text-xl text-slate-500 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-medium mb-12 lg:pr-10"
                >
                  Uatu provides mission-critical security auditing, real-time threat detection, and formal verification for high-stakes blockchain protocols.
                </motion.p>

                <motion.div variants={itemVariants} className="flex flex-wrap justify-center lg:justify-start gap-5">
                  {isAuthed ? (
                    <Link to="/dashboard" className="btn-primary min-w-[220px]">
                      Go to Dashboard <ArrowRight size={16} strokeWidth={3} />
                    </Link>
                  ) : (
                    <Link to="/dashboard" className="btn-primary min-w-[220px]">
                      Secure Project <ArrowRight size={16} strokeWidth={3} />
                    </Link>
                  )}
                  <Link to="/how-it-works" className="btn-ghost min-w-[200px]">
                    How It Works
                  </Link>
                </motion.div>

                {/* Live Stats Bar */}
                <motion.div
                  variants={itemVariants}
                  className="mt-20 pt-16 border-t border-black/[0.03] flex items-center gap-16"
                >
                  {[
                    { label: 'Audits', value: '12K+' },
                    { label: 'Vulns Found', value: '850+' },
                    { label: 'TVL Secured', value: '$4.2B' },
                  ].map((stat) => (
                    <div key={stat.label}>
                      <div className="text-3xl font-black text-slate-900 mb-1">{stat.value}</div>
                      <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">{stat.label}</div>
                    </div>
                  ))}
                </motion.div>
              </motion.div>

              {/* Product Visual: 2D Command UI Mockup */}
              <motion.div
                initial={{ opacity: 0, scale: 0.98, x: 50 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                className="flex-1 w-full max-w-2xl perspective-1000"
              >
                <div className="relative group lg:rotate-[-2deg] lg:hover:rotate-0 transition-transform duration-700">
                  {/* Glass Card Shadow Depth */}
                  <div className="absolute inset-0 bg-indigo-500/5 rounded-[40px] blur-3xl group-hover:bg-indigo-500/10 transition-all duration-700 -z-10" />

                  {/* The "Command" Window */}
                  <div className="relative bg-white border border-black/[0.04] rounded-[40px] shadow-2xl overflow-hidden backdrop-blur-3xl">
                    {/* Header bar */}
                    <div className="bg-slate-50/80 border-b border-black/[0.02] px-8 py-5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex gap-2">
                          <div className="w-3 h-3 rounded-full bg-red-400/20" />
                          <div className="w-3 h-3 rounded-full bg-amber-400/20" />
                          <div className="w-3 h-3 rounded-full bg-emerald-400/20" />
                        </div>
                        <span className="ml-6 text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">Uatu Command v4.2</span>
                      </div>
                      <div className="px-4 py-1.5 bg-white border border-black/[0.04] rounded-full text-[9px] font-black text-emerald-500 uppercase tracking-[0.3em] flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Live Monitoring
                      </div>
                    </div>

                    {/* Content area */}
                    <div className="p-10 space-y-10">
                      <div className="flex items-center justify-between">
                        <div className="space-y-2">
                          <h4 className="text-lg font-black text-slate-800 tracking-tight">Security Engine Running</h4>
                          <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Target: ERC-20 Proxy Contract</p>
                        </div>
                        <div className="w-14 h-14 rounded-2xl bg-indigo-600 shadow-xl shadow-indigo-600/20 flex items-center justify-center text-white">
                          <PremiumRadar size={28} />
                        </div>
                      </div>

                      {/* Mock Progress Bars */}
                      <div className="space-y-6">
                        {[
                          { name: 'Symbolic Analysis', color: 'bg-indigo-600', w: '85%', delay: 1 },
                          { name: 'Control Flow Graph', color: 'bg-emerald-500', w: '65%', delay: 1.2 },
                          { name: 'Reentrancy Hooks', color: 'bg-indigo-600', w: '100%', delay: 1.4 },
                        ].map(p => (
                          <div key={p.name} className="space-y-2.5">
                            <div className="flex justify-between text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">
                              <span>{p.name}</span>
                              <span className="text-slate-900">{p.w}</span>
                            </div>
                            <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden border border-black/[0.02]">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: p.w }}
                                transition={{ duration: 2, delay: p.delay, ease: [0.16, 1, 0.3, 1] }}
                                className={`h-full ${p.color}`}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Mock Vulnerability List */}
                      <div className="pt-4 flex gap-4">
                        <div className="flex-1 p-5 bg-red-50/50 border border-red-100/50 rounded-3xl">
                          <div className="flex items-center gap-2.5 mb-2">
                            <ShieldAlert size={14} className="text-red-500" />
                            <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">Critical Alert</span>
                          </div>
                          <div className="text-xs text-red-950 font-bold leading-relaxed">Shadow-Variable Shadowing Found in Line 142</div>
                        </div>
                        <div className="w-[100px] p-5 bg-slate-50 border border-black/[0.02] rounded-3xl flex flex-col items-center justify-center text-center">
                          <span className="text-xl font-black text-slate-800">12</span>
                          <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest mt-1">Modules</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Floating Micro-Cards */}
                  <motion.div
                    animate={{ y: [0, -15, 0] }}
                    transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute -right-10 top-1/3 bg-white border border-black/[0.04] p-6 rounded-[24px] shadow-2xl z-20 flex items-center gap-4"
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                      <Check size={18} strokeWidth={3} />
                    </div>
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Audit Status</div>
                      <div className="text-xs font-black text-slate-900 uppercase">Verified Secure</div>
                    </div>
                  </motion.div>

                  <motion.div
                    animate={{ y: [0, 15, 0] }}
                    transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                    className="absolute -left-16 bottom-1/4 bg-white border border-black/[0.04] p-6 rounded-[24px] shadow-2xl z-20 flex items-center gap-4"
                  >
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                      <PremiumAnalytics size={20} />
                    </div>
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">On-Chain Data</div>
                      <div className="text-xs font-black text-slate-900 uppercase">Sync Live</div>
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Product Trinity: Ecosystem */}
        <section className="py-40 bg-white relative border-b border-black/[0.02]">
          <div className="max-w-7xl mx-auto px-6 lg:px-10">
            <div className="text-center mb-32">
              <motion.span
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-600 mb-6 block"
              >
                The Unified Command
              </motion.span>
              <h2 className="text-3xl lg:text-4xl font-black tracking-tight mb-6">Integrated Security Ecosystem.</h2>
              <p className="text-base lg:text-lg text-slate-400 font-medium max-w-2xl mx-auto leading-relaxed">A unified suite for the entire security lifecycle. From rigorous bytecode analysis to live on-chain monitoring.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              {[
                {
                  id: 'audit',
                  title: 'UatuAudit',
                  tag: 'Security Scan',
                  desc: 'Enterprise-grade bytecode and logic analysis for any smart contract. Identify flaws before they become exploits.',
                  icon: PremiumShield,
                  color: 'text-indigo-600',
                  link: '/dashboard',
                  ext: false
                },
                {
                  id: 'analyzer',
                  title: 'Uatu Analyzer',
                  tag: 'Data Indexing',
                  desc: 'Real-time on-chain analytics and automated subgraph creation. Turn raw data into actionable insights.',
                  icon: PremiumAnalytics,
                  color: 'text-emerald-600',
                  link: 'https://dashboard.uatu.xyz',
                  ext: true
                },
                {
                  id: 'build',
                  title: 'Uatu Build',
                  tag: 'DApp Builder',
                  desc: 'Ship secure contracts and frontends in minutes with our no-code environment. Security-hardened by design.',
                  icon: PremiumBlocks,
                  color: 'text-amber-600',
                  link: 'https://build.uatu.xyz',
                  ext: true
                }
              ].map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  className="group"
                >
                  <div className="card-premium h-full flex flex-col items-start text-left hover:border-black/[0.1] transition-all duration-700">
                    <div className="w-16 h-16 rounded-[22px] bg-[#FDFCF8] border border-black/[0.03] flex items-center justify-center text-slate-800 mb-10 group-hover:scale-110 group-hover:bg-white group-hover:shadow-xl transition-all duration-500">
                      <p.icon size={28} />
                    </div>
                    <div className="flex items-center gap-3 mb-5">
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 group-hover:text-indigo-600 transition-colors">{p.tag}</span>
                    </div>
                    <h3 className="text-3xl font-black mb-8 tracking-tight">{p.title}</h3>
                    <p className="text-slate-400 font-medium leading-relaxed flex-grow mb-12 text-sm">{p.desc}</p>
                    {p.ext ? (
                      <a href={p.link} target="_blank" rel="noopener noreferrer" className="btn-ghost w-full">
                        Launch {p.title.split(' ')[1]} <Zap size={14} className="opacity-50" />
                      </a>
                    ) : (
                      <Link to={p.link} className="btn-primary w-full">
                        Secure Code <ArrowRight size={14} strokeWidth={3} />
                      </Link>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Security Methodology */}
        <section className="py-32 relative bg-white border-b border-black/[0.02]">
          <div className="max-w-7xl mx-auto px-6 lg:px-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
              <div className="order-2 lg:order-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  {[
                    { step: '01', title: 'Static Analysis', desc: 'Automated scans detecting common patterns and vulnerabilities.' },
                    { step: '02', title: 'Symbolic Execution', desc: 'Exhaustive exploration of contract state space.' },
                    { step: '03', title: 'Formal Verification', desc: 'Mathematical proofs of business logic correctness.' },
                    { step: '04', title: 'Live Pulse', desc: 'Continuous on-chain monitoring and runtime assertions.' },
                  ].map((s) => (
                    <div key={s.step} className="card-premium !p-6 bg-slate-50/50">
                      <div className="text-[10px] font-black text-indigo-600 mb-2">{s.step}</div>
                      <h4 className="text-base font-black text-slate-900 mb-2">{s.title}</h4>
                      <p className="text-xs text-slate-400 leading-relaxed font-medium">{s.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="order-1 lg:order-2">
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-600 mb-6 block">Our Methodology</span>
                <h2 className="text-3xl lg:text-4xl font-black tracking-tight mb-6">The Multi-Layered <br /><span className="text-slate-300">Security Standard.</span></h2>
                <p className="text-base text-slate-400 font-medium leading-relaxed mb-10">
                  Uatu doesn't just scan; it verifies. Our engine combines classic static analysis with modern formal methods to provide a deterministic safety guarantee for your protocol.
                </p>
                <div className="inline-flex items-center gap-4 px-6 py-3 bg-slate-900 text-white rounded-xl text-[11px] font-black uppercase tracking-wider">
                  <ShieldAlert size={14} className="text-indigo-400" />
                  Deterministic Safety Guarantee
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Security Feature Grid */}
        <section className="py-40 relative bg-[#FAFAFA]">
          <div className="max-w-7xl mx-auto px-6 lg:px-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-32 items-center">
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-600 mb-8 block">Defense in Depth</span>
                <h2 className="text-3xl lg:text-4xl font-black tracking-tight mb-6 leading-tight">
                  Defense in Depth <br />
                  for <span className="text-slate-300">Modern Architecture.</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-12">
                  {[
                    { icon: PremiumShield, title: 'Smart Contracts', text: 'Advanced bytecode & logic scanning.' },
                    { icon: PremiumCode, title: 'Frontend Audits', text: 'Web3 provider & hook security.' },
                    { icon: PremiumRadar, title: '24/7 Monitoring', text: 'Live on-chain threat alerting.' },
                    { icon: PremiumBlocks, title: 'Build Integrity', text: 'Verified compile-time checks.' },
                  ].map((f, i) => (
                    <motion.div
                      key={f.title}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1, duration: 0.6 }}
                      className="group"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-white border border-black/[0.03] flex items-center justify-center text-slate-400 mb-6 group-hover:bg-indigo-600 group-hover:text-white group-hover:shadow-lg transition-all duration-500">
                        <f.icon size={20} />
                      </div>
                      <h4 className="text-lg font-black mb-2 tracking-tight">{f.title}</h4>
                      <p className="text-sm text-slate-400 font-medium leading-relaxed">{f.text}</p>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500/5 blur-[120px] rounded-full" />
                <div className="card-premium bg-white/40 backdrop-blur-3xl relative z-10 border-black/[0.02] p-12">
                  <div className="space-y-8">
                    <div className="flex items-center gap-5 p-6 bg-white border border-black/[0.02] rounded-[24px] shadow-sm transform hover:scale-105 transition-transform duration-500">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <Fingerprint size={24} strokeWidth={2.5} />
                      </div>
                      <div>
                        <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-300 mb-1">Vulnerability Scan</div>
                        <div className="text-sm font-black text-slate-800 tracking-tight">Access Control Integrity</div>
                      </div>
                      <div className="ml-auto flex items-center gap-2 px-3 py-1 bg-emerald-50 rounded-full">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Secure</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-5 p-6 bg-white border border-black/[0.02] rounded-[24px] shadow-sm translate-x-12 opacity-80">
                      <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
                        <PremiumCode size={24} />
                      </div>
                      <div>
                        <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-300 mb-1">Logic Check</div>
                        <div className="text-sm font-black text-slate-800 tracking-tight">Reentrancy Guard</div>
                      </div>
                      <div className="ml-auto flex items-center gap-2 px-3 py-1 bg-amber-50 rounded-full">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Running</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-5 p-6 bg-white border border-black/[0.02] rounded-[24px] shadow-sm translate-x-4">
                      <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center text-red-600">
                        <Zap size={24} strokeWidth={2.5} />
                      </div>
                      <div>
                        <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-300 mb-1">Threat Feed</div>
                        <div className="text-sm font-black text-slate-800 tracking-tight">Gas Limit Overflow</div>
                      </div>
                      <div className="ml-auto flex items-center gap-2 px-3 py-1 bg-red-50 rounded-full">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        <span className="text-[9px] font-black text-red-600 uppercase tracking-widest">Alert</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Rust & Specialty Ecosystems */}
        <section className="py-40 bg-[#FAFAFA] border-t border-black/[0.02]">
          <div className="max-w-7xl mx-auto px-6 lg:px-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-600 mb-8 block">Rust & WASM Security</span>
                <h2 className="text-3xl lg:text-4xl font-black tracking-tight mb-6">Specialized Audits for <br /><span className="text-slate-300">High-Performance Chains.</span></h2>
                <p className="text-lg text-slate-500 font-medium leading-relaxed mb-12">
                  Uatu provides deep-level bytecode analysis and formal verification for Rust-based ecosystems, ensuring deterministic safety for the next generation of blockchains.
                </p>
                <div className="space-y-6">
                  {[
                    { name: 'Solana', icon: SolanaIcon, desc: 'Advanced BPF and Program-Level security analysis.' },
                    { name: 'Stellar', icon: StellarIcon, desc: 'Soroban smart contract safety & formal verification.' },
                    { name: 'Partisia', icon: PartisiaIcon, desc: 'Zero-knowledge and MPC contract auditing.' }
                  ].map((chain) => (
                    <div key={chain.name} className="flex gap-6 items-start group">
                      <div className="w-12 h-12 rounded-xl glass-liquid border-slate-100 flex items-center justify-center shrink-0 group-hover:border-indigo-100 transition-all">
                        <chain.icon size={22} color="#5C61FF" />
                      </div>
                      <div>
                        <h4 className="text-lg font-black text-slate-900 mb-1">{chain.name} Security</h4>
                        <p className="text-sm text-slate-400 font-medium">{chain.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="relative aspect-square lg:aspect-video rounded-[40px] glass-liquid border-white/20 p-1 bg-gradient-to-br from-indigo-500/5 to-transparent">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />
                <div className="w-full h-full flex items-center justify-center p-12">
                  <div className="text-center">
                    <PremiumCode size={80} className="text-indigo-200 mb-8 mx-auto" strokeWidth={1} />
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">Binary Analysis Active</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Integrations & Trust */}
        <section className="py-24 bg-white border-t border-black/[0.02]">
          <div className="max-w-7xl mx-auto px-6 lg:px-10">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
              <div className="max-w-sm">
                <h3 className="text-xl font-black tracking-tight mb-2">Protocol Native.</h3>
                <p className="text-xs text-slate-400 font-medium leading-relaxed">Integrated directly into your existing development toolchain and CI/CD pipelines.</p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-12 lg:gap-20 opacity-30 invert">
                {/* Mock Integrations Icons / Labels */}
                <div className="flex items-center gap-3 grayscale">
                  <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center text-white text-[10px] font-black italic">H</div>
                  <span className="text-[10px] font-black uppercase tracking-widest">Hardhat</span>
                </div>
                <div className="flex items-center gap-3 grayscale">
                  <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center text-white text-[10px] font-black italic">F</div>
                  <span className="text-[10px] font-black uppercase tracking-widest">Foundry</span>
                </div>
                <div className="flex items-center gap-3 grayscale">
                  <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center text-white text-[10px] font-black italic">G</div>
                  <span className="text-[10px] font-black uppercase tracking-widest">GitHub</span>
                </div>
                <div className="flex items-center gap-3 grayscale">
                  <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center text-white text-[10px] font-black italic">J</div>
                  <span className="text-[10px] font-black uppercase tracking-widest">Jenkins</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials / Social Proof */}
        <section className="py-40 bg-white relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 lg:px-10">
            <div className="text-center mb-32">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-600 mb-6 block">Social Proof</span>
              <h2 className="text-5xl lg:text-[72px] font-black tracking-[-0.05em] leading-[0.9]">Trusted by <br /><span className="text-slate-200">Industry Leaders.</span></h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              {[
                { quote: "Uatu is the first tool that actually caught a reentrancy edge case our manual auditors missed. It's now mandatory for all our PRs.", author: "Marcus Thorne", role: "Lead Dev, SolarDeFi" },
                { quote: "The speed of UatuAudit is incredible. We went from waiting days for audit results to getting them in minutes during our sprint.", author: "Elena Rossi", role: "CTO, Nexus Protocol" },
                { quote: "A unified command center for Web3 security. Analyzer and Build integration makes it the most powerful suite on the market.", author: "Dr. Julian Vance", role: "Security Researcher" },
              ].map((t, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.8 }}
                  className="card-premium p-10 bg-[#FAFAFA]/50 border-black/[0.01] hover:bg-white transition-all duration-700"
                >
                  <div className="flex gap-1 mb-8">
                    {[1, 2, 3, 4, 5].map(s => <Sparkles key={s} size={10} className="text-amber-400" />)}
                  </div>
                  <p className="text-lg font-medium text-slate-800 leading-relaxed mb-10 italic">"{t.quote}"</p>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-black text-[10px] uppercase">
                      {t.author.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900 uppercase tracking-wider">{t.author}</div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{t.role}</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Global Multi-Chain Section */}
        <section className="py-32 bg-slate-900 border-y border-black relative overflow-hidden">
          <div className="absolute inset-0 bg-dot-pattern opacity-[0.05] invert" />
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/10 to-transparent" />
          <div className="max-w-7xl mx-auto px-6 lg:px-10 relative z-10">
            <div className="text-center mb-16">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400 mb-4 block">Ecosystem Connectivity</span>
              <h2 className="text-3xl lg:text-4xl font-black text-white tracking-tight mb-6">Trusted Across All <span className="opacity-40">Protocols.</span></h2>
              <p className="text-sm text-slate-400 max-w-xl mx-auto font-medium">Seamlessly integrated with the world's leading blockchain infrastructures and development toolchains.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-12 lg:gap-20 opacity-40 hover:opacity-80 transition-opacity duration-700">
              {supportedChains.map((chain) => (
                <div key={chain.name} className="flex flex-col items-center gap-4 group cursor-default">
                  <div
                    className="w-16 h-16 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center p-4 group-hover:bg-white/10 group-hover:border-white/10 transition-all duration-500"
                  >
                    <chain.icon size={32} color={chain.color} />
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 group-hover:text-white transition-colors">{chain.name}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-56 bg-[#FAFAFA] relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/5 blur-[120px] rounded-full" />
          <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
            <h2 className="text-5xl lg:text-7xl font-black tracking-tight mb-10 leading-tight">Secure Your <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-indigo-600">Infrastructure Today.</span></h2>
            <p className="text-lg lg:text-xl text-slate-400 font-medium mb-14 max-w-2xl mx-auto">Join the elite engineering teams securing the future of decentralized finance with Uatu.</p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              {isAuthed ? (
                <Link to="/dashboard" className="btn-primary py-6 px-16 text-sm">
                  Go to Dashboard <ArrowRight size={18} strokeWidth={3} />
                </Link>
              ) : (
                <>
                  <Link to="/dashboard" className="btn-primary py-6 px-16 text-sm">
                    Secure Your Project <ArrowRight size={18} strokeWidth={3} />
                  </Link>
                  <button onClick={onLogin} className="btn-ghost py-6 px-16 text-sm">
                    Get Started Now
                  </button>
                </>
              )}
            </div>
          </div>
        </section>

      </div>
    </>
  );
}
