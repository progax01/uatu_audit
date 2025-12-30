import { useState, useRef, useCallback, useEffect } from 'react'
import { ArrowRight, Loader2, CheckCircle, XCircle, ExternalLink, FileCode, AlertTriangle, Search, Brain, Radio, Shield, Zap, Lock, Code2 } from 'lucide-react'
import mascot from '../assets/letf-mascot.png'

// GitHub Icon SVG Component
function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
    </svg>
  )
}

interface HomePageProps {
  isAuthed?: boolean
  onGetStarted: () => void
  onEnterApp: () => void
  onScanContract: () => void
  onStartAudit?: (data: { project: string; branch: string; jobId: number }) => void
}

export default function HomePage({ isAuthed, onGetStarted, onEnterApp, onScanContract, onStartAudit }: HomePageProps) {
  return (
    <div className="min-h-screen bg-white relative font-sans">
      {/* Tech Grid Background */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div
          className="w-full h-full"
          style={{
            backgroundImage: `
              linear-gradient(rgba(15, 63, 98, 0.05) 1px, transparent 1px),
              linear-gradient(90deg, rgba(15, 63, 98, 0.05) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }}
        />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center cursor-pointer hover:opacity-80 transition-opacity">
            <img src="/logo.svg" alt="Uatu Logo" className="h-9" />
          </div>
          
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-semibold text-gray-500 hover:text-[#0F3F62]">Features</a>
            <a href="#audit-flow" className="text-sm font-semibold text-gray-500 hover:text-[#0F3F62]">How it Works</a>
            {isAuthed ? (
              <button 
                onClick={onEnterApp}
                className="bg-[#0F3F62] text-white px-6 py-2.5 rounded-full text-sm font-bold shadow-lg shadow-blue-900/10 hover:bg-[#1a5a8a] transition-all"
              >
                Go to Dashboard
              </button>
            ) : (
              <button 
                onClick={onGetStarted}
                className="bg-[#0F3F62] text-white px-6 py-2.5 rounded-full text-sm font-bold shadow-lg shadow-blue-900/10 hover:bg-[#1a5a8a] transition-all flex items-center gap-2"
              >
                <GithubIcon className="w-4 h-4" />
                Login with GitHub
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="relative z-10 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-100 rounded-full text-blue-600 text-xs font-bold uppercase tracking-widest mb-6">
              <Zap className="w-3 h-3" />
              Next-Gen CI Security
            </div>
            <h1 className="text-6xl lg:text-7xl font-black text-[#0F3F62] leading-[1.1] mb-8">
              Audit Grade <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0F3F62] to-[#3B82A0]">Deterministic</span> Security for CI/CD
            </h1>
            <p className="text-xl text-gray-500 max-w-xl mb-10 leading-relaxed mx-auto lg:mx-0 font-medium">
              Uatu isn't just an LLM crawler. It's a tool-augmented orchestration engine that combines Slither, Foundry, and Semgrep with Deep-Intelligence reasoning.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
              <button 
                onClick={onGetStarted}
                className="w-full sm:w-auto bg-[#0F3F62] text-white px-8 py-4 rounded-2xl font-black text-lg shadow-2xl shadow-blue-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Get Started Free
              </button>
              <button 
                onClick={onScanContract}
                className="w-full sm:w-auto bg-white border-2 border-gray-100 text-gray-600 px-8 py-4 rounded-2xl font-bold text-lg hover:bg-gray-50 transition-all"
              >
                Quick Scan Contract
              </button>
            </div>
          </div>

          <div className="relative lg:flex justify-center hidden">
            <div className="absolute inset-0 bg-blue-400/10 blur-[120px] rounded-full" />
            <img src={mascot} alt="Uatu" className="w-[480px] relative z-10 drop-shadow-2xl animate-float" />
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-[#0F3F62] py-16">
        <div className="max-w-7xl mx-auto px-8 grid grid-cols-2 md:grid-cols-4 gap-8 text-center text-white">
          <div>
            <div className="text-4xl font-black mb-2">100%</div>
            <div className="text-blue-200 text-sm font-bold uppercase tracking-widest">Deterministic</div>
          </div>
          <div>
            <div className="text-4xl font-black mb-2">5+</div>
            <div className="text-blue-200 text-sm font-bold uppercase tracking-widest">Local Scanners</div>
          </div>
          <div>
            <div className="text-4xl font-black mb-2">0</div>
            <div className="text-blue-200 text-sm font-bold uppercase tracking-widest">Hallucinations</div>
          </div>
          <div>
            <div className="text-4xl font-black mb-2">24/7</div>
            <div className="text-blue-200 text-sm font-bold uppercase tracking-widest">Branch Guard</div>
          </div>
        </div>
      </section>

      {/* Capabilities Section */}
      <section id="features" className="py-32 bg-gray-50">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-20">
            <h2 className="text-4xl font-black text-[#0F3F62] mb-4">The Uatu Capability Stack</h2>
            <p className="text-gray-500 font-medium max-w-2xl mx-auto italic">More than an LLM. A complete security toolchain wrapped in deep-intelligence.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-10 rounded-[40px] border border-gray-100 shadow-xl shadow-gray-200/50 hover:translate-y-[-8px] transition-all">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-8">
                <Shield className="w-8 h-8 text-[#0F3F62]" />
              </div>
              <h3 className="text-2xl font-black text-[#0F3F62] mb-4">Tool-Augmented</h3>
              <p className="text-gray-500 leading-relaxed font-medium">Uatu runs local binaries like Slither and Semgrep. AI doesn't "guess" code—it interprets verified tool logs.</p>
            </div>

            <div className="bg-white p-10 rounded-[40px] border border-gray-100 shadow-xl shadow-gray-200/50 hover:translate-y-[-8px] transition-all">
              <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mb-8">
                <Lock className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-2xl font-black text-[#0F3F62] mb-4">Liability Mapping</h3>
              <p className="text-gray-500 leading-relaxed font-medium">Human-in-the-loop triage allows you to shift liability to verified third-party deps like Gnosis or OpenZeppelin.</p>
            </div>

            <div className="bg-white p-10 rounded-[40px] border border-gray-100 shadow-xl shadow-gray-200/50 hover:translate-y-[-8px] transition-all">
              <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center mb-8">
                <Code2 className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-2xl font-black text-[#0F3F62] mb-4">Branch Protection</h3>
              <p className="text-gray-500 leading-relaxed font-medium">Integrates directly with GitHub Checks API to block unsafe merges until your deterministic score passes.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="audit-flow" className="py-32">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex flex-col md:flex-row gap-16 items-center">
            <div className="md:w-1/2">
              <h2 className="text-5xl font-black text-[#0F3F62] mb-12">The Deterministic Audit Pipeline</h2>
              <div className="space-y-12">
                <div className="flex gap-6">
                  <div className="w-12 h-12 bg-[#0F3F62] text-white rounded-full flex items-center justify-center shrink-0 font-black text-xl">1</div>
                  <div>
                    <h4 className="text-xl font-black text-gray-900 mb-2">Fingerprint & Scan</h4>
                    <p className="text-gray-500 font-medium">Local bash scripts identify frameworks and run scanners to build an Evidence Bundle.</p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="w-12 h-12 bg-[#0F3F62] text-white rounded-full flex items-center justify-center shrink-0 font-black text-xl">2</div>
                  <div>
                    <h4 className="text-xl font-black text-gray-900 mb-2">Interactive Triage</h4>
                    <p className="text-gray-500 font-medium">AI identifies liability hotspots. You explain admin wallets or oracles once; Uatu remembers forever.</p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="w-12 h-12 bg-[#0F3F62] text-white rounded-full flex items-center justify-center shrink-0 font-black text-xl">3</div>
                  <div>
                    <h4 className="text-xl font-black text-gray-900 mb-2">Deep Milestone Audit</h4>
                    <p className="text-gray-500 font-medium">5-stage reasoning pipeline simulates complex attack scenarios based on tool logs.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="md:w-1/2 bg-gray-900 rounded-[40px] p-8 shadow-2xl shadow-gray-900/40 font-mono text-xs text-blue-400">
              <div className="flex gap-2 mb-6">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <p className="mb-2">$ uatu run --repo protocol-v2</p>
              <p className="text-gray-500 mb-2">[+] Cloning repository...</p>
              <p className="text-gray-500 mb-2">[+] Detecting Ecosystem: Foundry/Solidity</p>
              <p className="text-yellow-400 mb-2">[!] Warning: Potential Admin Wallet risk found in Vault.sol</p>
              <p className="text-white mb-2">? Is the 'owner' controlled by a Gnosis Safe? (y/n)</p>
              <p className="text-green-400 mb-2">[✓] Response mapped. Liability shifted to EXTERNAL.</p>
              <p className="text-gray-500 mb-2">[+] Starting Milestone 3: Deep Logic Simulation...</p>
              <p className="text-white mt-8 font-black underline">AUDIT COMPLETE: GRADE A (94/100)</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-100 py-12">
        <div className="max-w-7xl mx-auto px-8 flex justify-between items-center text-gray-400 text-sm font-bold uppercase tracking-widest">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="Uatu" className="h-6 grayscale" />
            <span>&copy; 2025 UatuAudit. Deterministic Security.</span>
          </div>
          <div className="flex gap-8">
            <a href="#" className="hover:text-[#0F3F62]">Docs</a>
            <a href="#" className="hover:text-[#0F3F62]">Twitter</a>
            <a href="#" className="hover:text-[#0F3F62]">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
