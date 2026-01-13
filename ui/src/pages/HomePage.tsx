import { useState, useEffect } from 'react';
import { motion, Variants } from 'framer-motion';
import {
  ArrowRight, Activity, Check, Shield, ShieldAlert, Fingerprint,
  Bell, Info, Wallet, Eye, Zap, ShieldCheck, Github, GitBranch,
  BarChart3, TrendingUp, FileCode, AlertTriangle, CheckCircle
} from 'lucide-react';
import {
  PremiumShield, PremiumRadar, PremiumCode,
  PremiumAnalytics, PremiumBlocks
} from '../components/IconSystem';
import { Link } from 'react-router-dom';
import SEO, { pageSEO } from '../components/SEO';
import { supportedChains, SolanaIcon, StellarIcon, EthereumIcon } from '../components/icons/CryptoIcons';
import MouseTooltip from '../components/MouseTooltip';

interface PlatformStats {
  totalAudits: number;
  quickScans: number;
}

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
  const [stats, setStats] = useState<PlatformStats>({
    totalAudits: 0,
    quickScans: 0,
  });

  useEffect(() => {
    // Fetch real stats from API
    fetch('/api/public-audits/stats')
      .then(res => res.json())
      .then(data => {
        if (data.ok && data.stats) {
          setStats({
            totalAudits: data.stats.totalAudits,
            quickScans: data.stats.quickScans,
          });
        }
      })
      .catch(() => {
        // Keep defaults on error
      });
  }, []);

  const formatNumber = (num: number): string => {
    if (num === 0) return '0';
    if (num >= 1000) return `${(num / 1000).toFixed(1).replace(/\.0$/, '')}k+`;
    return `${num}+`;
  };

  return (
    <>
      <MouseTooltip />
      <SEO
        title={pageSEO.home.title}
        description={pageSEO.home.description}
        keywords={pageSEO.home.keywords}
        url="https://uatu.xyz/"
      />

      <div className="min-h-screen selection:bg-indigo-500/10 font-sans overflow-x-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">

        {/* Hero Section: The Command Center */}
        <section className="relative py-12 lg:py-20 overflow-hidden border-b border-black/[0.02] dark:border-white/[0.02]">
          {/* Subtle Background Elements */}
          <div className="absolute inset-0 z-0 bg-dot-pattern opacity-30" />
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-indigo-500/5 blur-[160px] rounded-full" />

          <div className="max-w-7xl mx-auto px-5 lg:px-10 relative z-10">
            <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-24">
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="flex-[1.2] text-center lg:text-left"
              >
                <motion.div
                  variants={itemVariants}
                  className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full text-[10px] font-extrabold uppercase tracking-[0.25em] mb-6 lg:mb-10 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/50 dark:border-indigo-800/50 text-indigo-600 dark:text-indigo-400"
                >
                  <Shield size={12} />
                  <span>High-Assurance Auditing</span>
                </motion.div>

                <motion.h1
                  variants={itemVariants}
                  className="text-3xl lg:text-5xl font-black leading-tight tracking-tight mb-6 lg:mb-8 text-slate-900 dark:text-white"
                >
                  High-Assurance <span className="block lg:inline text-slate-400 dark:text-slate-500">Security</span> <br className="hidden lg:block" />
                  for Web3 <span className="text-transparent bg-clip-text bg-gradient-to-br from-indigo-500 to-indigo-700">Infrastructure.</span>
                </motion.h1>

                <motion.p
                  variants={itemVariants}
                  className="text-base lg:text-xl max-w-2xl mx-auto lg:mx-0 leading-relaxed font-medium mb-8 lg:mb-12 lg:pr-10 text-slate-500 dark:text-slate-400"
                >
                  Uatu provides mission-critical security auditing, real-time threat detection, and formal verification for high-stakes blockchain protocols.
                </motion.p>

                <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                  <Link
                    to="/quick-scan"
                    className="inline-flex items-center justify-center gap-3 min-w-[260px] lg:min-w-[280px] py-4 lg:py-5 px-8 rounded-2xl text-sm font-black uppercase tracking-widest transition-all bg-slate-900 dark:bg-indigo-600 text-white hover:bg-indigo-600 dark:hover:bg-indigo-500"
                  >
                    Quick Scan <Activity size={18} strokeWidth={2.5} />
                  </Link>
                  <Link
                    to="/public-audits"
                    className="inline-flex items-center justify-center gap-3 min-w-[200px] lg:min-w-[220px] py-4 lg:py-5 px-8 rounded-2xl text-sm font-black uppercase tracking-widest transition-all border-2 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    View Reports <ArrowRight size={18} strokeWidth={2.5} />
                  </Link>
                </motion.div>

                {/* Live Stats Bar */}
                <motion.div
                  variants={itemVariants}
                  className="mt-10 lg:mt-16 pt-8 lg:pt-12 border-t border-black/[0.03] dark:border-white/[0.05] flex flex-wrap justify-center lg:justify-start items-center gap-6 lg:gap-16"
                >
                  {[
                    { label: 'Security Standard', value: 'OWASP' },
                    { label: 'Threat Framework', value: 'STRIDE' },
                    { label: 'Compliance Level', value: 'ISO/IEC' },
                  ].map((stat) => (
                    <div key={stat.label} className="text-center lg:text-left">
                      <div className="text-xl lg:text-2xl font-black mb-1 tracking-tighter text-indigo-600 dark:text-indigo-400">{stat.value}</div>
                      <div className="text-[9px] lg:text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">{stat.label}</div>
                    </div>
                  ))}
                </motion.div>
              </motion.div>

              {/* Product Visual: 2D Command UI Mockup - Hidden on mobile */}
              <motion.div
                initial={{ opacity: 0, scale: 0.98, x: 50 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                className="hidden lg:block flex-1 w-full max-w-2xl perspective-1000"
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
        <section className="py-16 lg:py-32 relative border-b border-black/[0.02] dark:border-white/[0.02] bg-white dark:bg-slate-900">
          <div className="max-w-7xl mx-auto px-5 lg:px-10">
            <div className="text-center mb-12 lg:mb-24">
              <motion.span
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="text-[10px] font-black uppercase tracking-[0.4em] mb-4 lg:mb-6 block text-indigo-600 dark:text-indigo-400"
              >
                The Unified Command
              </motion.span>
              <h2 className="text-2xl lg:text-4xl font-black tracking-tight mb-4 lg:mb-6 text-slate-900 dark:text-white">Integrated Security Ecosystem.</h2>
              <p className="text-sm lg:text-lg font-medium max-w-2xl mx-auto leading-relaxed text-slate-400 dark:text-slate-500">A unified suite for the entire security lifecycle. From rigorous bytecode analysis to live on-chain monitoring.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              {[
                {
                  id: 'audit',
                  title: 'UatuAudit',
                  tag: 'Security Scan',
                  desc: 'Enterprise-grade bytecode and logic analysis for any smart contract. Identify flaws before they become exploits.',
                  img: '/audit.png',
                  color: 'text-indigo-600',
                  link: '/dashboard',
                  ext: false,
                  comingSoon: false
                },
                {
                  id: 'analyzer',
                  title: 'Uatu Analyzer',
                  tag: 'Data Indexing',
                  desc: 'Real-time on-chain analytics and automated subgraph creation. Turn raw data into actionable insights.',
                  img: '/analyse.png',
                  color: 'text-emerald-600',
                  link: 'https://dashboard.uatu.xyz',
                  ext: true,
                  comingSoon: true
                },
                {
                  id: 'build',
                  title: 'Uatu Build',
                  tag: 'DApp Builder',
                  desc: 'Ship secure contracts and frontends in minutes with our no-code environment. Security-hardened by design.',
                  img: '/build.png',
                  color: 'text-amber-600',
                  link: 'https://build.uatu.xyz',
                  ext: true,
                  comingSoon: true
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
                  <div className="card-premium h-full flex flex-col items-start text-left hover:border-black/[0.1] transition-all duration-700 relative overflow-hidden min-h-[420px]">
                    {/* Large watermark icon - top left corner */}
                    <img
                      src={p.img}
                      alt=""
                      className={`absolute -top-8 -left-8 w-44 h-44 object-contain pointer-events-none select-none transition-all duration-700 ${p.comingSoon ? 'opacity-[0.04] grayscale' : 'opacity-[0.07] group-hover:opacity-[0.12] group-hover:scale-110'}`}
                    />

                    {/* Content */}
                    <div className="relative z-10 w-full flex flex-col h-full pt-6">
                      <span className={`text-[10px] font-black uppercase tracking-[0.3em] transition-colors mb-6 ${p.comingSoon ? 'text-slate-200' : 'text-slate-300 group-hover:text-indigo-600'}`}>{p.tag}</span>
                      <h3 className={`text-3xl font-black mb-6 tracking-tight ${p.comingSoon ? 'text-slate-300' : ''}`}>{p.title}</h3>
                      <p className={`font-medium leading-relaxed text-sm flex-grow ${p.comingSoon ? 'text-slate-300' : 'text-slate-400'}`}>{p.desc}</p>
                      <div className="mt-auto pt-10">
                        {p.comingSoon ? (
                          <div className="w-full py-4 px-6 bg-slate-50 border border-slate-100 rounded-2xl text-center cursor-not-allowed">
                            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-300">Coming Soon</span>
                          </div>
                        ) : p.ext ? (
                          <a href={p.link} target="_blank" rel="noopener noreferrer" className="btn-ghost w-full">
                            Launch {p.title.split(' ')[1]} <ArrowRight size={14} className="opacity-50" />
                          </a>
                        ) : (
                          <div className="flex flex-col gap-3">
                            <Link to="/quick-scan" className="btn-primary w-full">
                              Quick Scan <Activity size={14} strokeWidth={3} />
                            </Link>
                            <Link to={p.link} className="btn-ghost w-full">
                              Secure Code <ArrowRight size={14} className="opacity-50" />
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Security Methodology */}
        <section className="py-16 lg:py-24 relative border-b border-black/[0.02] dark:border-white/[0.02] bg-white dark:bg-slate-900">
          <div className="max-w-7xl mx-auto px-5 lg:px-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center">
              <div className="order-2 lg:order-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  {[
                    { step: '01', title: 'Static Analysis', desc: 'Automated scans detecting common patterns and vulnerabilities.' },
                    { step: '02', title: 'Symbolic Execution', desc: 'Exhaustive exploration of contract state space.' },
                    { step: '03', title: 'Formal Verification', desc: 'Mathematical proofs of business logic correctness.' },
                    { step: '04', title: 'Live Pulse', desc: 'Continuous on-chain monitoring and runtime assertions.' },
                  ].map((s) => (
                    <div key={s.step} className="card-premium !p-6 bg-slate-50/50 relative overflow-hidden group">
                      <div className="absolute -right-4 -bottom-4 text-8xl font-black text-slate-900/[0.06] select-none group-hover:text-indigo-600/[0.08] transition-colors duration-700">
                        {s.step}
                      </div>
                      <div className="relative z-10">
                        <div className="text-[10px] font-black text-indigo-600 mb-2">{s.step}</div>
                        <h4 className="text-base font-black text-slate-900 mb-2">{s.title}</h4>
                        <p className="text-xs text-slate-400 leading-relaxed font-medium">{s.desc}</p>
                      </div>
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
                <div className="inline-flex items-center gap-4 px-6 py-3 bg-slate-900 text-white rounded-xl text-[11px] font-black uppercase tracking-wider relative overflow-hidden group">
                  <div className="flex items-center gap-3">
                    <ShieldAlert size={14} className="text-indigo-400" />
                    <Bell size={14} className="text-indigo-400/50 group-hover:text-indigo-400 transition-colors" />
                    <Info size={14} className="text-indigo-400/30 group-hover:text-indigo-400 transition-colors" />
                  </div>
                  <div className="w-px h-4 bg-white/10 mx-1" />
                  Deterministic Safety Guarantee
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Wallet Security Sentinel: Real-Time Protection */}
        <section className="py-16 lg:py-32 relative overflow-hidden bg-white dark:bg-slate-900">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-emerald-500/5 blur-[160px] rounded-full pointer-events-none" />

          <div className="max-w-7xl mx-auto px-5 lg:px-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center">
              <div>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.25em] mb-6 lg:mb-10 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50"
                >
                  <Wallet size={12} />
                  <span>Wallet Security Sentinel</span>
                </motion.div>

                <h2 className="text-3xl lg:text-5xl font-black tracking-tight mb-6 lg:mb-8 leading-tight text-slate-900 dark:text-white">
                  Deterministic Protection <br className="hidden lg:block" />
                  for <span className="text-indigo-600 dark:text-indigo-400">Every Transaction.</span>
                </h2>

                <p className="text-base lg:text-lg font-medium leading-relaxed mb-8 lg:mb-12 text-slate-500 dark:text-slate-400">
                  Targeted analysis for institutional and high-net-worth individual wallets. Uatu monitors every outgoing call, signature request, and state change in real-time.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  {[
                    { icon: Eye, title: 'Live Watchtower', desc: 'Real-time monitoring of wallet activity and external contract interactions.' },
                    { icon: ShieldCheck, title: 'Signature Audit', desc: 'Pre-flight analysis of EIP-712 and permit signatures before broadcast.' },
                    { icon: Zap, title: 'Drainer Detection', desc: 'AI-powered detection of malicious approval requests and phishing vectors.' },
                    { icon: Activity, title: 'Exposure Tracking', desc: 'Live metrics on protocol risk exposure and token approval health.' },
                  ].map((f, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 border border-black/[0.03] flex items-center justify-center text-indigo-500 shrink-0">
                        <f.icon size={18} />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900 mb-1">{f.title}</h4>
                        <p className="text-[11px] text-slate-400 font-bold leading-relaxed">{f.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative">
                <div className="card-premium bg-slate-950 border-white/5 shadow-2xl overflow-hidden p-0 relative group">
                  <div className="bg-white/5 border-b border-white/5 px-8 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center">
                        <Wallet size={18} className="text-indigo-500" />
                      </div>
                      <div>
                        <div className="text-[10px] font-black text-white uppercase tracking-widest leading-none mb-1">Institutional Custody</div>
                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none italic">0x71C...a4E9</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                      <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Sentinel Active</span>
                    </div>
                  </div>

                  <div className="p-8 space-y-6">
                    <div className="space-y-4">
                      <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Live Activity Feed</div>

                      {[
                        { type: 'SWAP', target: 'Uniswap V3', amount: '12,050.00 USDC', status: 'Safe', risk: 'Low' },
                        { type: 'APPROVE', target: 'Unknown Contract', amount: 'Unlimited stETH', status: 'Blocked', risk: 'Critical' },
                        { type: 'TRANSFER', target: 'Cold Wallet (Root)', amount: '5.0 ETH', status: 'Safe', risk: 'Low' },
                      ].map((tx, idx) => (
                        <div key={idx} className={`p-5 rounded-2xl border flex items-center justify-between transition-all hover:bg-white/10 ${tx.status === 'Blocked' ? 'bg-rose-500/10 border-rose-500/20' : 'bg-white/5 border-white/10'
                          }`}>
                          <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-lg ${tx.status === 'Blocked' ? 'bg-rose-500/20 text-rose-500' : 'bg-indigo-500/20 text-indigo-500'}`}>
                              {tx.status === 'Blocked' ? <ShieldAlert size={14} /> : <Zap size={14} />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-black text-white">{tx.type}</span>
                                <span className="text-[9px] font-bold text-slate-500">{tx.target}</span>
                              </div>
                              <div className="text-[10px] text-slate-300 font-mono mt-0.5">{tx.amount}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-[9px] font-black uppercase tracking-widest mb-1 ${tx.status === 'Blocked' ? 'text-rose-500' : 'text-indigo-400'
                              }`}>{tx.status}</div>
                            <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Risk: {tx.risk}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-6 border-t border-white/5 flex items-center justify-between">
                      <div className="flex -space-x-3">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="w-8 h-8 rounded-full border-2 border-slate-950 bg-slate-800 flex items-center justify-center">
                            <ShieldCheck size={12} className="text-indigo-400" />
                          </div>
                        ))}
                      </div>
                      <button className="text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-300 transition-colors">View All Audits →</button>
                    </div>
                  </div>
                </div>

                {/* Floating Micro-Element */}
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute -bottom-6 -right-6 bg-white border border-black/[0.1] p-5 rounded-3xl shadow-2xl z-20"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                      <Shield size={20} strokeWidth={2.5} />
                    </div>
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Total Secured</div>
                      <div className="text-sm font-black text-slate-900">$1.24B+</div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </section>

        {/* Security Feature Grid */}
        <section className="py-16 lg:py-32 relative bg-slate-50 dark:bg-slate-950">
          <div className="max-w-7xl mx-auto px-5 lg:px-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center">
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.4em] mb-4 lg:mb-8 block text-indigo-600 dark:text-indigo-400">Defense in Depth</span>
                <h2 className="text-2xl lg:text-4xl font-black tracking-tight mb-4 lg:mb-6 leading-tight text-slate-900 dark:text-white">
                  Defense in Depth <br className="hidden lg:block" />
                  for <span className="text-slate-300 dark:text-slate-600">Modern Architecture.</span>
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
                        <Activity size={24} strokeWidth={2.5} />
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

        {/* Multi-Chain Security Deep-Dive */}
        <section className="py-16 lg:py-32 border-t border-black/[0.02] dark:border-white/[0.02] overflow-hidden bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
          <div className="max-w-7xl mx-auto px-5 lg:px-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-24 items-center">
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.4em] mb-4 lg:mb-8 block text-indigo-600 dark:text-indigo-400">Multi-Chain Security Coverage</span>
                <h2 className="text-2xl lg:text-5xl font-black tracking-tight mb-4 lg:mb-6 text-slate-900 dark:text-white">Specialized Audits for <br className="hidden lg:block" /><span className="text-slate-300 dark:text-slate-600">Every VM Architecture.</span></h2>
                <p className="text-sm lg:text-lg font-medium leading-relaxed mb-8 lg:mb-12 text-slate-500 dark:text-slate-400">
                  From EVM bytecode to Rust-based runtimes, Uatu provides depth-level state analysis across all major blockchain virtual machines. We go beyond logical checks into deterministic verification.
                </p>
                <div className="space-y-6">
                  {[
                    { name: 'EVM (Solidity)', icon: EthereumIcon, color: '#627EEA', desc: 'Deep bytecode analysis, storage layout verification, and gas optimization for Ethereum & L2s.' },
                    { name: 'Solana (BPF)', icon: SolanaIcon, color: '#14F195', desc: 'Account-data validation, BPF instruction analysis, and program-derived address security.' },
                    { name: 'Stellar (Soroban)', icon: StellarIcon, color: '#5C61FF', desc: 'Contract storage isolation, host-function boundaries, and WASM runtime verification.' },
                  ].map((chain) => (
                    <div key={chain.name} className="flex gap-5 items-start group p-5 rounded-2xl hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-500 -ml-5">
                      <div className="w-14 h-14 rounded-2xl bg-white border border-black/[0.04] shadow-sm flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:shadow-lg transition-all duration-500">
                        <chain.icon size={28} color={chain.color} />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-base font-black text-slate-900 mb-1.5 group-hover:text-indigo-600 transition-colors">{chain.name}</h4>
                        <p className="text-sm text-slate-400 font-medium leading-relaxed">{chain.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mascot Security Visualization */}
              <div className="relative">
                {/* Background glow effects */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-violet-500/10 rounded-[60px] blur-3xl" />

                {/* Main container */}
                <div className="relative bg-white/80 backdrop-blur-xl rounded-[48px] border border-black/[0.04] shadow-2xl shadow-indigo-500/10 p-8 lg:p-12">
                  {/* Top stats bar */}
                  <div className="flex items-center justify-between mb-8 pb-6 border-b border-black/[0.04]">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-lg shadow-emerald-500/50" />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Security Engine Active</span>
                    </div>
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">v3.0 STABLE</span>
                  </div>

                  {/* Mascot centered */}
                  <div className="relative flex justify-center mb-8">
                    <motion.img
                      src="/mascot.png"
                      alt="Uatu Security Mascot"
                      className="w-48 h-48 lg:w-64 lg:h-64 object-contain drop-shadow-2xl"
                      animate={{ y: [0, -10, 0] }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    />

                    {/* Floating badges around mascot */}
                    <motion.div
                      className="absolute -left-4 top-8 px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-xl shadow-lg"
                      animate={{ x: [0, 5, 0], y: [0, -5, 0] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-[9px] font-black text-emerald-700 uppercase tracking-wider">98% Safe</span>
                      </div>
                    </motion.div>

                    <motion.div
                      className="absolute -right-4 top-16 px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-xl shadow-lg"
                      animate={{ x: [0, -5, 0], y: [0, 5, 0] }}
                      transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-500" />
                        <span className="text-[9px] font-black text-indigo-700 uppercase tracking-wider">Live Scan</span>
                      </div>
                    </motion.div>

                    <motion.div
                      className="absolute right-0 bottom-4 px-3 py-2 bg-violet-50 border border-violet-100 rounded-xl shadow-lg"
                      animate={{ x: [0, 5, 0], y: [0, -3, 0] }}
                      transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-violet-500" />
                        <span className="text-[9px] font-black text-violet-700 uppercase tracking-wider">AI Powered</span>
                      </div>
                    </motion.div>
                  </div>

                  {/* Sample Report Preview */}
                  <div className="bg-slate-50/80 rounded-2xl p-4 mb-8 border border-black/[0.02]">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-500" />
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Sample Report Preview</span>
                      </div>
                      <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wider">Score: 94/100</span>
                    </div>

                    {/* Mini findings preview */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 p-2.5 bg-white rounded-xl border border-black/[0.02]">
                        <div className="w-5 h-5 rounded-md bg-amber-100 flex items-center justify-center">
                          <span className="text-[8px] font-black text-amber-600">M</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] font-bold text-slate-700 truncate block">Unchecked Return Value</span>
                          <span className="text-[8px] text-slate-400">Line 142 • transfer()</span>
                        </div>
                        <span className="text-[8px] font-black text-amber-600 uppercase">Medium</span>
                      </div>
                      <div className="flex items-center gap-3 p-2.5 bg-white rounded-xl border border-black/[0.02]">
                        <div className="w-5 h-5 rounded-md bg-sky-100 flex items-center justify-center">
                          <span className="text-[8px] font-black text-sky-600">L</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] font-bold text-slate-700 truncate block">Missing Event Emission</span>
                          <span className="text-[8px] text-slate-400">Line 89 • withdraw()</span>
                        </div>
                        <span className="text-[8px] font-black text-sky-600 uppercase">Low</span>
                      </div>
                    </div>
                  </div>

                  {/* Security check items */}
                  <div className="space-y-3">
                    {[
                      { check: 'Reentrancy Protection', status: 'verified' },
                      { check: 'Access Control Audit', status: 'verified' },
                      { check: 'Integer Overflow Check', status: 'verified' },
                    ].map((item) => (
                      <div key={item.check} className="flex items-center justify-between p-3 bg-emerald-50/50 rounded-xl border border-emerald-100/50">
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-lg bg-emerald-500 flex items-center justify-center">
                            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <span className="text-xs font-bold text-slate-700">{item.check}</span>
                        </div>
                        <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Verified</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Compliance & Deliverables */}
        <section className="py-16 lg:py-24 relative overflow-hidden bg-white dark:bg-slate-900">
          <div className="max-w-7xl mx-auto px-5 lg:px-10">
            <div className="flex flex-col lg:flex-row items-start lg:items-end justify-between gap-6 lg:gap-12 mb-10 lg:mb-20">
              <div className="max-w-2xl">
                <span className="text-[10px] font-black uppercase tracking-[0.4em] mb-4 lg:mb-6 block text-indigo-600 dark:text-indigo-400">Deliverables & Standards</span>
                <h2 className="text-2xl lg:text-4xl font-black tracking-tight text-slate-900 dark:text-white">Enterprise Compliance <br className="hidden lg:block" /><span className="text-slate-300 dark:text-slate-600">for High-Stakes Protocols.</span></h2>
              </div>
              <p className="text-sm font-medium max-w-sm text-slate-400 dark:text-slate-500">We provide formalized security artifacts that meet institutional and regulatory standards for digital asset infrastructure.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { title: 'Compliance Certificates', desc: 'Formal verification certificates validating mainnet deployment readiness and security standards.' },
                { title: 'Architecture Analysis', desc: 'Comprehensive backend architecture review with detailed logic flow vulnerability assessments.' },
                { title: 'Frontend Security', desc: 'In-depth analysis of UI security patterns, provider integrations, and client-side vulnerabilities.' },
                { title: 'Threat Modeling', desc: 'Systematic STRIDE-based threat analysis aligned with OWASP security standards.' },
              ].map((d, i) => (
                <div key={d.title} className="card-premium !p-8 bg-slate-50/30 group hover:bg-white transition-all relative overflow-hidden min-h-[180px]">
                  {/* Watermark number - bottom right */}
                  <span className="absolute -bottom-4 -right-2 text-[120px] font-black text-slate-100 leading-none select-none pointer-events-none group-hover:text-indigo-100 transition-colors duration-500">
                    0{i + 1}
                  </span>
                  {/* Content */}
                  <div className="relative z-10">
                    <h4 className="text-sm font-black text-slate-900 mb-3 uppercase tracking-tight">{d.title}</h4>
                    <p className="text-[11px] text-slate-400 font-medium leading-relaxed max-w-[200px]">{d.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Infrastructure & Ecosystem Section */}
        <section className="py-16 lg:py-24 border-y border-black/[0.01] overflow-hidden relative bg-white dark:bg-slate-900">
          <div className="absolute inset-0 bg-dot-pattern opacity-[0.05]" />

          <div className="max-w-7xl mx-auto px-5 lg:px-10 mb-10 lg:mb-16 relative z-10 text-center flex flex-col items-center">
            <span className="text-[10px] font-black uppercase tracking-[0.4em] mb-4 lg:mb-6 block text-indigo-600 dark:text-indigo-400">Ecosystem Connectivity</span>
            <h2 className="text-2xl lg:text-4xl font-black tracking-tight mb-6 lg:mb-8 text-slate-900 dark:text-white">Engineering Powerhouse <br className="hidden lg:block" /><span className="text-slate-300 dark:text-slate-600">for the Global Multi-Chain.</span></h2>

            {/* Static Frameworks Row */}
            <div className="flex flex-wrap justify-center gap-2 lg:gap-3 mb-10 lg:mb-16">
              {[
                { name: 'Hardhat', color: '#F8D12F', id: 'H' },
                { name: 'Foundry', color: '#F36722', id: 'F' },
                { name: 'Jest', color: '#99425B', id: 'J' },
                { name: 'Node.js', color: '#339933', id: 'N' },
                { name: 'Next.js', color: '#000000', id: 'N' },
                { name: 'GitHub', color: '#181717', id: 'G' },
                { name: 'Jenkins', color: '#D24939', id: 'J' },
              ].map((tool) => (
                <div key={tool.name} className="flex items-center gap-2 px-4 py-2 bg-slate-50/50 dark:bg-slate-800/50 border border-black/[0.03] dark:border-white/[0.05] rounded-xl hover:border-indigo-100/50 dark:hover:border-indigo-800/50 transition-all cursor-default">
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black text-white italic shadow-sm"
                    style={{ backgroundColor: tool.color }}
                  >
                    {tool.id}
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">{tool.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            {/* Gradient Fades for Marquee */}
            <div className="absolute inset-y-0 left-0 w-64 bg-gradient-to-r from-white dark:from-slate-900 via-white dark:via-slate-900 to-transparent z-10 pointer-events-none" />
            <div className="absolute inset-y-0 right-0 w-64 bg-gradient-to-l from-white dark:from-slate-900 via-white dark:via-slate-900 to-transparent z-10 pointer-events-none" />

            <div className="flex overflow-hidden">
              <motion.div
                animate={{ x: [0, -2000] }}
                transition={{ repeat: Infinity, duration: 60, ease: "linear" }}
                className="flex gap-4 items-center py-2"
              >
                {[...supportedChains, ...supportedChains, ...supportedChains].map((chain, idx) => (
                  <div key={`${chain.name}-${idx}`} className="flex-shrink-0">
                    <div
                      className="flex items-center gap-4 px-6 py-3.5 bg-white dark:bg-slate-800 border rounded-[22px] group transition-all duration-500 hover:shadow-lg hover:shadow-indigo-500/5"
                      style={{
                        borderColor: `${chain.color}15`,
                        boxShadow: `0 4px 20px -10px ${chain.color}15`
                      }}
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center p-1.5 transition-transform duration-500 group-hover:scale-110">
                        {/* @ts-ignore */}
                        <chain.icon size={22} color={chain.color} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[11px] font-black tracking-tight text-slate-800 dark:text-white">{chain.name}</span>
                        <span className="text-[8px] font-bold uppercase tracking-widest text-slate-300 dark:text-slate-500 group-hover:text-indigo-400 transition-colors">Mainnet</span>
                      </div>
                    </div>
                  </div>
                ))}
              </motion.div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 lg:py-40 relative overflow-hidden bg-slate-50 dark:bg-slate-950">
          {/* Background blur */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/5 blur-[120px] rounded-full" />

          {/* Dashboard-like background UI - More realistic mockups */}
          <div className="absolute inset-0 pointer-events-none hidden lg:block">
            {/* Left side cards */}
            <div className="absolute left-[5%] top-[15%] w-56 opacity-[0.06]">
              {/* Score Card */}
              <div className="bg-slate-900 rounded-2xl p-4 mb-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[8px] text-slate-400 uppercase tracking-wider">Security Score</div>
                  <CheckCircle size={12} className="text-emerald-400" />
                </div>
                <div className="text-3xl font-black text-white mb-1">94</div>
                <div className="flex items-center gap-1">
                  <TrendingUp size={10} className="text-emerald-400" />
                  <span className="text-[8px] text-emerald-400">+12 this week</span>
                </div>
              </div>
              {/* GitHub Card */}
              <div className="bg-slate-900 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Github size={14} className="text-white" />
                  <span className="text-[9px] text-white font-bold">Connected Repos</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[8px] text-slate-400">
                    <GitBranch size={10} />
                    <span>protocol/core-v3</span>
                  </div>
                  <div className="flex items-center gap-2 text-[8px] text-slate-400">
                    <GitBranch size={10} />
                    <span>protocol/staking</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right side cards */}
            <div className="absolute right-[5%] top-[20%] w-60 opacity-[0.06]">
              {/* Chart Card */}
              <div className="bg-slate-900 rounded-2xl p-4 mb-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[8px] text-slate-400 uppercase tracking-wider">Vulnerabilities</div>
                  <BarChart3 size={12} className="text-indigo-400" />
                </div>
                <div className="flex items-end gap-1 h-16">
                  {[30, 45, 25, 60, 40, 75, 55, 85, 45, 65].map((h, i) => (
                    <div key={i} className="flex-1 bg-indigo-500 rounded-t" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
              {/* Projects Card */}
              <div className="bg-slate-900 rounded-2xl p-4">
                <div className="text-[8px] text-slate-400 uppercase tracking-wider mb-3">Recent Audits</div>
                <div className="space-y-2">
                  {['TokenVault.sol', 'Staking.sol', 'Governor.sol'].map((file) => (
                    <div key={file} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileCode size={10} className="text-slate-500" />
                        <span className="text-[8px] text-slate-400">{file}</span>
                      </div>
                      <CheckCircle size={10} className="text-emerald-400" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom left - Alert card */}
            <div className="absolute left-[8%] bottom-[18%] w-52 opacity-[0.06]">
              <div className="bg-slate-900 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={12} className="text-amber-400" />
                  <span className="text-[9px] text-white font-bold">Live Alerts</span>
                </div>
                <div className="text-[8px] text-slate-400">Monitoring 24 contracts across 6 chains</div>
                <div className="flex gap-1 mt-2">
                  {[1,2,3,4,5,6].map(i => (
                    <div key={i} className="w-2 h-2 rounded-full bg-emerald-500" />
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom right - Stats card */}
            <div className="absolute right-[8%] bottom-[15%] w-48 opacity-[0.06]">
              <div className="bg-slate-900 rounded-2xl p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xl font-black text-white">156</div>
                    <div className="text-[7px] text-slate-500 uppercase">Issues Fixed</div>
                  </div>
                  <div>
                    <div className="text-xl font-black text-white">$2.4M</div>
                    <div className="text-[7px] text-slate-500 uppercase">TVL Secured</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Floating feature tags */}
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute left-[10%] top-[12%] hidden lg:flex items-center gap-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 px-4 py-2 rounded-full shadow-lg"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Real-time Monitoring</span>
          </motion.div>

          <motion.div
            animate={{ y: [0, 12, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            className="absolute right-[6%] top-[10%] hidden lg:flex items-center gap-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 px-4 py-2 rounded-full shadow-lg"
          >
            <div className="w-2 h-2 rounded-full bg-indigo-500" />
            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Linked to Every Update</span>
          </motion.div>

          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute left-[12%] bottom-[12%] hidden lg:flex items-center gap-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 px-4 py-2 rounded-full shadow-lg"
          >
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Zero-Day Protection</span>
          </motion.div>

          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
            className="absolute right-[10%] bottom-[8%] hidden lg:flex items-center gap-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 px-4 py-2 rounded-full shadow-lg"
          >
            <div className="w-2 h-2 rounded-full bg-rose-500" />
            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Automated Security</span>
          </motion.div>

          {/* Main content */}
          <div className="max-w-4xl mx-auto px-5 text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-600 mb-6 block">Get Started Now</span>
              <h2 className="text-3xl lg:text-6xl font-black tracking-tight mb-6 lg:mb-8 leading-tight text-slate-900 dark:text-white">
                Secure Your <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-indigo-600">Infrastructure Today.</span>
              </h2>
              <p className="text-base lg:text-xl font-medium mb-4 max-w-2xl mx-auto text-slate-400 dark:text-slate-500">
                Join the elite engineering teams securing the future of decentralized finance with Uatu.
              </p>
              <p className="text-sm font-medium mb-10 lg:mb-14 max-w-xl mx-auto text-slate-300 dark:text-slate-600">
                Automated audits. Real-time alerts. Complete peace of mind.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Link
                  to="/dashboard"
                  className="inline-flex items-center justify-center gap-3 py-5 lg:py-6 px-12 lg:px-16 rounded-2xl text-sm font-black uppercase tracking-widest transition-all hover:scale-105 bg-slate-900 dark:bg-indigo-600 text-white hover:bg-indigo-600 dark:hover:bg-indigo-500"
                >
                  Visit Dashboard <ArrowRight size={18} strokeWidth={2.5} />
                </Link>
                <Link
                  to="/quick-scan"
                  className="inline-flex items-center justify-center gap-3 py-5 lg:py-6 px-10 lg:px-12 rounded-2xl text-sm font-black uppercase tracking-widest transition-all border-2 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-indigo-300 dark:hover:border-indigo-600 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-800"
                >
                  Quick Scan <Activity size={16} strokeWidth={2.5} />
                </Link>
              </div>

              {/* Trust indicators */}
              <div className="mt-12 lg:mt-16 flex flex-wrap justify-center gap-6 lg:gap-10">
                {[
                  { label: 'Contracts Audited', value: formatNumber(stats.totalAudits) },
                  { label: 'Quick Scans', value: formatNumber(stats.quickScans) },
                  { label: 'Chains Supported', value: '9+' },
                ].map((stat) => (
                  <div key={stat.label} className="text-center">
                    <div className="text-2xl lg:text-3xl font-black text-slate-900 dark:text-white">{stat.value}</div>
                    <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

      </div>
    </>
  );
}
