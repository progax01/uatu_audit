import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, FileText, Activity, ShieldCheck, Download,
  ExternalLink, RefreshCw, Terminal
} from 'lucide-react'
import LiabilityTriage from '../components/LiabilityTriage'
import logo from '../assets/logo.svg'
import MouseTooltip from '../components/MouseTooltip'

interface AuditDetailsProps {
  jobId?: number
  onHomeClick: () => void
  onBack: () => void
}

export default function AuditDetails({ jobId, onBack, onHomeClick }: AuditDetailsProps) {
  const [activeTab, setActiveTab] = useState<'report' | 'triage'>('report')
  const [loading, setLoading] = useState(true)
  const [auditData, setAuditData] = useState<any>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setAuditData({
        projectName: 'SmartContractAudit',
        score: 72,
        grade: 'C',
        status: 'completed',
        timestamp: new Date().toISOString(),
        findings: {
          critical: 1,
          high: 2,
          medium: 5,
          low: 12
        },
        questions: [
          {
            id: 'q1',
            component_id: 'contracts/Vault.sol:owner',
            component_label: 'Admin Multi-Sig',
            question: 'Is the owner address controlled by a DAO or a standard hot wallet?',
            suggested_scope: 'EXTERNAL'
          }
        ]
      })
      setLoading(false)
    }, 1500)
    return () => clearTimeout(timer)
  }, [jobId])

  if (loading) {
    return (
      <div className="min-h-screen bg-base flex flex-col items-center justify-center">
        <div className="relative w-12 h-12 mb-8">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 border-4 border-indigo-500/10 border-t-indigo-600 rounded-full"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <RefreshCw size={20} className="text-indigo-600/30" strokeWidth={1.5} />
          </div>
        </div>
        <p className="text-slate-400 font-black uppercase tracking-[0.3em] text-[10px]">Assembling Security dossier...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-base selection:bg-indigo-500/20">
      <MouseTooltip />
      {/* Header */}
      <header className="h-28 bg-white/70 backdrop-blur-xl border-b border-black/[0.03] flex items-center justify-between px-12 sticky top-0 z-50">
        <div className="flex items-center gap-8">
          <button
            onClick={onBack}
            className="w-12 h-12 rounded-xl border border-black/[0.03] bg-white shadow-sm flex items-center justify-center hover:bg-slate-900 hover:text-white hover:scale-105 transition-all duration-500 text-slate-400 group"
          >
            <ArrowLeft size={18} strokeWidth={2.5} className="group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div className="flex flex-col">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">{auditData.projectName}</h1>
            <span className="text-[9px] font-bold text-indigo-600 uppercase tracking-[0.2em] mt-1.5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-pulse"></span>
              Security Audit ID: {jobId || '123'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-12">
          {/* Minimalist Logo in Sub-header */}
          <div className="hidden md:flex items-center opacity-30 hover:opacity-60 transition-opacity cursor-pointer" onClick={onHomeClick}>
            <img src={logo} alt="Uatu" className="h-8 object-contain" />
          </div>

          <div className="flex items-center gap-6">
            <button className="flex items-center gap-3 bg-white border border-black/[0.04] px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-slate-900 hover:border-black/10 shadow-sm transition-all duration-500">
              <Download size={14} strokeWidth={2} />
              Export Report
            </button>
            <div className={`px-6 py-2.5 rounded-xl text-lg font-black tracking-tight border shadow-sm ${auditData.score >= 80 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
              Grade {auditData.grade} <span className="text-[9px] text-slate-300 ml-1.5 font-bold uppercase tracking-widest">({auditData.score})</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-12">
        {/* Navigation Tabs */}
        <div className="flex p-2 rounded-[24px] bg-white border border-black/[0.03] shadow-sm w-fit mb-16">
          <button
            onClick={() => setActiveTab('report')}
            className={`flex items-center gap-3 px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-500 ${activeTab === 'report' ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10' : 'text-slate-400 hover:text-slate-900'}`}
          >
            <FileText size={14} strokeWidth={2.5} />
            Security Dossier
          </button>
          <button
            onClick={() => setActiveTab('triage')}
            className={`flex items-center gap-4 px-10 py-4 rounded-[18px] text-[10px] font-black uppercase tracking-[0.25em] transition-all duration-500 relative ${activeTab === 'triage' ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10' : 'text-slate-400 hover:text-slate-900'}`}
          >
            <Activity size={16} strokeWidth={2.5} />
            Liability Triage
            <span className="absolute -top-1 -right-1 bg-rose-500 text-white w-6 h-6 rounded-full text-[10px] flex items-center justify-center font-black animate-pulse shadow-lg">1</span>
          </button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'report' ? (
            <motion.div
              key="report"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              {/* Findings Summary */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                {['critical', 'high', 'medium', 'low'].map((sev) => (
                  <div key={sev} className="relative group card-premium !p-10 !bg-white/60 !backdrop-blur-3xl overflow-hidden hover:translate-y-[-5px] shadow-sm hover:shadow-premium">
                    <div className={`absolute -top-12 -right-12 w-32 h-32 blur-3xl rounded-full transition-opacity opacity-[0.03] group-hover:opacity-[0.08] ${sev === 'critical' ? 'bg-rose-600' : sev === 'high' ? 'bg-orange-600' : sev === 'medium' ? 'bg-amber-600' : 'bg-blue-600'}`} />
                    <span className="text-[9px] font-black uppercase tracking-[0.35em] text-slate-400 block mb-6">{sev} vulnerabilities</span>
                    <span className={`text-6xl font-black tabular-nums tracking-tighter ${sev === 'critical' ? 'text-rose-600' : sev === 'high' ? 'text-orange-600' : sev === 'medium' ? 'text-amber-600' : 'text-blue-600'}`}>{auditData.findings[sev]}</span>
                  </div>
                ))}
              </div>

              {/* Security Dossier Frame */}
              <div className="relative group card-premium !p-0 min-h-[700px] flex flex-col items-center justify-center !bg-white/40 !backdrop-blur-3xl border-dashed border-2 border-black/[0.04] shadow-sm">
                <div className="absolute top-0 left-12 right-12 h-px bg-gradient-to-r from-transparent via-indigo-500/10 to-transparent" />

                <div className="w-24 h-24 rounded-[40px] bg-white border border-black/[0.04] shadow-premium flex items-center justify-center mb-10 group-hover:scale-110 transition-transform duration-700">
                  <ShieldCheck className="w-12 h-12 text-indigo-100 group-hover:text-indigo-600 transition-colors" strokeWidth={1.5} />
                </div>

                <h3 className="text-lg font-black text-slate-900 tracking-tight mb-4 uppercase tracking-[0.2em]">Security Engine Active</h3>
                <p className="text-[10px] text-slate-400 font-bold max-w-sm text-center leading-relaxed uppercase tracking-[0.15em] opacity-60 mb-10">
                  Comprehensive bytecode analysis and logic flow verification complete.
                </p>

                <div className="flex items-center gap-4">
                  <button className="flex items-center gap-3 px-8 py-3 rounded-xl bg-white border border-black/[0.04] text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-slate-900 hover:border-black/20 shadow-sm transition-all duration-500 group/btn">
                    Technical Hub <ExternalLink size={14} strokeWidth={2} className="group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
                  </button>
                  <button className="btn-primary px-10">
                    Verify Contracts <Terminal size={14} strokeWidth={2} />
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="triage"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <LiabilityTriage
                questions={auditData.questions}
                onSubmit={(ans) => console.log('Submitting triage:', ans)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
