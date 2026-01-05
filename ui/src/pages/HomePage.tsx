import { motion, useScroll, useTransform, useSpring, useMotionValue } from 'framer-motion';
import {
  ArrowRight, Shield,
  Box, Activity, ShieldCheck,
  Terminal, Github, Fingerprint, Eye, Search, Code, Cpu
} from 'lucide-react';
import mascot from '../assets/letf-mascot.png';
import logo from '../assets/logo.svg';
import {
  IntegrityScoreboard,
  SecurityStream,
  ControlModuleCard
} from '../components/CommandCenterComponents';

interface HomePageProps {
  isAuthed?: boolean;
  onLogin: () => void;
  onGetStarted: () => void;
  onEnterApp: () => void;
  onScanContract: () => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.2 }
  }
};

const itemVariants = {
  hidden: { y: 30, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1
  }
};

export default function HomePage({ isAuthed, onLogin, onGetStarted, onEnterApp, onScanContract }: HomePageProps) {
  const { scrollYProgress } = useScroll();
  const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.2], [1, 0.95]);

  const mouseX = useSpring(useMotionValue(0), { damping: 25 });
  const mouseY = useSpring(useMotionValue(0), { damping: 25 });

  const handleMouseMove = ({ clientX, clientY }: React.MouseEvent) => {
    const x = (clientX / window.innerWidth - 0.5) * 15;
    const y = (clientY / window.innerHeight - 0.5) * -15;
    mouseX.set(x);
    mouseY.set(y);
  };

  return (
    <div className="min-h-screen bg-base relative selection:bg-indigo-500/20" onMouseMove={handleMouseMove}>
      {/* Decorative Atmosphere */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-500/[0.03] blur-[140px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-500/[0.02] blur-[120px] rounded-full" />
      </div>

      {/* Ultra-Premium Navbar */}
      <header className="fixed top-0 left-0 right-0 z-[100] h-24 flex items-center bg-white/70 backdrop-blur-xl border-b border-black/[0.03]">
        <div className="max-w-7xl mx-auto px-10 w-full flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-4 group cursor-pointer"
          >
            <img src={logo} alt="Uatu" className="h-9" />
          </motion.div>

          <nav className="hidden lg:flex items-center gap-12">
            {['Analytics', 'Security Pulse', 'Infrastructure'].map((item) => (
              <a key={item} href="#" className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-indigo-600 transition-all duration-300">
                {item}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-6">
            <button
              onClick={isAuthed ? onEnterApp : onLogin}
              className="flex items-center gap-3 bg-indigo-600 text-white px-8 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-indigo-600/20 hover:shadow-indigo-500/30 hover:bg-indigo-700 transition-all duration-500 group"
            >
              {isAuthed ? 'Enter Command' : <><Github size={14} className="group-hover:rotate-12 transition-transform" /> Sign In with GitHub</>}
            </button>
          </div>
        </div>
      </header>

      {/* Hero: The Alabaster Origin */}
      <section className="relative min-h-screen flex items-center pt-24 overflow-hidden">
        <motion.div style={{ opacity, scale }} className="max-w-7xl mx-auto px-10 w-full grid grid-cols-1 lg:grid-cols-2 gap-24 items-center h-full">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="relative z-10"
          >
            {/* Mascot Placement: Assistant Guardian */}
            <motion.div
              initial={{ opacity: 0, scale: 0.5, rotate: -20 }}
              animate={{ opacity: 1, scale: 1, rotate: -15 }}
              transition={{ delay: 0.5, duration: 1 }}
              className="absolute -top-20 -left-16 w-32 h-32 pointer-events-none opacity-40 hover:opacity-100 transition-opacity duration-700 select-none grayscale"
            >
              <img src={mascot} alt="Guardian" className="w-full h-full object-contain animate-float" />
            </motion.div>

            <motion.div variants={itemVariants} className="inline-flex items-center gap-3 px-5 py-2.5 bg-white border border-black/[0.04] shadow-sm rounded-full text-indigo-600 text-[10px] font-black uppercase tracking-[0.25em] mb-10">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
              AI-Powered Security Auditing
            </motion.div>

            <motion.h1 variants={itemVariants} className="text-7xl lg:text-[100px] font-black text-slate-900 leading-[0.85] mb-10 tracking-[-0.06em]">
              Sovereign <br />
              <span className="text-indigo-600">Auditing.</span>
            </motion.h1>

            <motion.p variants={itemVariants} className="text-xl text-slate-500 max-w-lg mb-14 leading-[1.6] font-medium italic">
              "Experience the next generation of code analysis. Deterministic proofs, real-time vulnerability tracking, and total sovereignty over your project's integrity."
            </motion.p>

            <motion.div variants={itemVariants} className="flex flex-wrap gap-6">
              <button
                onClick={onGetStarted}
                className="btn-primary"
              >
                Start New Audit
                <ArrowRight size={16} strokeWidth={3} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={onScanContract}
                className="btn-secondary"
              >
                Scan Single Contract
              </button>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex justify-center items-center"
          >
            {/* Cinematic HUD Atmosphere */}
            <div className="absolute inset-0 bg-indigo-500/5 blur-[120px] rounded-full scale-110 pointer-events-none" />

            <motion.div
              className="relative flex justify-center items-center"
              style={{
                perspective: 1200,
                rotateY: mouseX,
                rotateX: mouseY
              }}
            >
              <div className="relative z-20 shadow-premium rounded-[100px]">
                <IntegrityScoreboard />
              </div>

              {/* Advanced UI Stream Fragments */}
              <motion.div
                animate={{ y: [0, -12, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-12 -right-8 card p-5 flex items-center gap-4 z-30 scale-90"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <ShieldCheck className="text-emerald-500" size={20} strokeWidth={1.5} />
                </div>
                <div className="flex flex-col">
                  <div className="text-[10px] font-black text-slate-900 uppercase tracking-widest leading-none">Security Proof</div>
                  <div className="text-[8px] text-slate-400 font-bold uppercase mt-1.5 flex items-center gap-2">
                    <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse"></span>
                    Verified Logic Path
                  </div>
                </div>
              </motion.div>

              <motion.div
                animate={{ y: [0, 12, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                className="absolute -bottom-12 -left-12 card p-5 flex items-center gap-4 z-30 scale-90"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                  <Fingerprint className="text-indigo-500" size={20} strokeWidth={1.5} />
                </div>
                <div className="flex flex-col text-left">
                  <div className="text-[10px] font-black text-slate-900 uppercase tracking-widest leading-none">Identity Linked</div>
                  <div className="text-[8px] text-slate-400 font-bold uppercase mt-1.5">GitHub Sovereign #0421</div>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        </motion.div>
      </section>

      {/* Cinematic Flow: Capabilities */}
      <section id="capabilities" className="py-48 relative bg-white/40">
        <div className="max-w-7xl mx-auto px-10">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-col items-center text-center mb-32"
          >
            <h2 className="text-6xl font-black text-slate-900 tracking-[-0.05em] mb-8">Engineering Certainty.</h2>
            <p className="text-slate-500 max-w-2xl text-lg leading-relaxed font-medium uppercase text-[10px] tracking-[0.3em]">
              Beyond simple linting. We provide a complete security suit <br /> for high-stakes decentralized applications.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <ControlModuleCard
              title="Vulnerability Sentry"
              description="Continuous inspection of your dependency tree and logic flow. We detect exploits before they reach production environments."
              icon={Search}
              colorClass="text-indigo-500"
              stats={[{ label: 'ACCURACY', value: '99.8%' }, { label: 'STATUS', value: 'ACTIVE' }]}
            />
            <ControlModuleCard
              title="Deterministic Proofs"
              description="Every finding is backed by a verifiable trace. No hallucinations, only cold mathematical certainty for your logic."
              icon={Code}
              colorClass="text-slate-900"
              stats={[{ label: 'LOGIC', value: 'VERIFIED' }, { label: 'TRACE', value: 'GEN-2' }]}
            />
            <ControlModuleCard
              title="Supply Chain Guard"
              description="Deep analysis of NPM and Library sources. Protect your project against malicious package updates and backdoors."
              icon={Cpu}
              colorClass="text-amber-500"
              stats={[{ label: 'DEPENDENCIES', value: 'REAL-TIME' }]}
            />
          </div>
        </div>
      </section>

      {/* Security Pulse: Narrative Visualization */}
      <section id="sovereignty" className="py-48 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-10 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-32 items-center">
            <div>
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                className="space-y-12"
              >
                <div className="w-16 h-1 bg-indigo-600 rounded-full mb-10" />
                <h2 className="text-5xl font-black text-slate-900 tracking-[-0.04em] leading-tight">Proactive Security <br />Intelligence Stream.</h2>

                <div className="grid gap-10">
                  {[
                    { title: 'Continuous Pulse', desc: 'Background scanners execute deep analysis every 15 minutes, protecting your codebase.', icon: Activity },
                    { title: 'Deterministic Analysis', desc: 'Our engine identifies complex logical vulnerabilities that standard tools miss.', icon: Terminal },
                    { title: 'Integrity Hub', desc: 'One centralized plane for all your security reports, dependency alerts, and audit history.', icon: Shield }
                  ].map((f, i) => (
                    <div key={i} className="flex gap-8 group">
                      <div className="w-14 h-14 rounded-2xl bg-white border border-black/[0.04] shadow-sm flex items-center justify-center shrink-0 group-hover:shadow-indigo-500/10 transition-all duration-500">
                        <f.icon className="text-indigo-600" size={24} strokeWidth={1.5} />
                      </div>
                      <div className="flex flex-col justify-center">
                        <h4 className="text-md font-black text-slate-900 mb-1.5 uppercase tracking-wider">{f.title}</h4>
                        <p className="text-[10px] text-slate-400 font-bold leading-relaxed uppercase tracking-widest">{f.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              className="card !p-10 !rounded-[48px] shadow-premium relative bg-white/60 backdrop-blur-3xl overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-12 opacity-[0.03]">
                <Activity size={200} className="text-indigo-900" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-10 text-indigo-600">
                  <Activity size={24} strokeWidth={3} />
                  <span className="text-[10px] font-black uppercase tracking-[0.4em]">Live Intelligence Feed</span>
                </div>
                <SecurityStream />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Flowing Footer */}
      <footer className="pt-48 pb-20 relative bg-slate-50">
        <div className="max-w-7xl mx-auto px-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-20 items-start border-b border-black/[0.03] pb-24 mb-20">
            <div className="md:col-span-2">
              <div className="flex items-center mb-8">
                <img src={logo} alt="Uatu Sovereignty Hub" className="h-10 object-contain" />
              </div>
              <p className="text-slate-400 text-sm font-medium leading-relaxed max-w-sm">
                Engineering certainty for high-stakes decentralized projects. Modular, deterministic, and security-first.
              </p>
            </div>

            <div className="flex flex-col gap-6">
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-900">Intelligence</span>
              {['Security Dossiers', 'Vulnerability Feed', 'Library Analysis'].map(l => (
                <a key={l} href="#" className="text-sm font-bold text-slate-400 hover:text-indigo-600 transition-colors">{l}</a>
              ))}
            </div>

            <div className="flex flex-col gap-6">
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-900">Platform</span>
              {['Command Center', 'GitHub Integration', 'Audit History'].map(l => (
                <a key={l} href="#" className="text-sm font-bold text-slate-400 hover:text-indigo-600 transition-colors">{l}</a>
              ))}
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center gap-10">
            <div className="flex items-center gap-12">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">&copy; 2026 Uatu Security Hub</p>
              <div className="flex gap-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                <a href="#" className="hover:text-indigo-600 transition-colors">Privacy</a>
                <a href="#" className="hover:text-indigo-600 transition-colors">Terms</a>
              </div>
            </div>

            <div className="relative flex justify-center scale-90 grayscale opacity-40 hover:grayscale-0 hover:opacity-100 transition-all duration-700">
              <img src={mascot} alt="Guardian" className="w-24 pointer-events-auto cursor-help animate-float" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
