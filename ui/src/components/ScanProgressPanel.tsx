import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Timer, CheckCircle, AlertTriangle, ChevronDown, Activity, Layers } from 'lucide-react'

interface Phase {
  name: string
  label: string
  status: 'pending' | 'active' | 'complete'
  pct: number
}

interface ContractInfo {
  sloc?: number
  contractName?: string
  network?: string
}

interface ScanProgressPanelProps {
  jobId: string
  status: string
  progressPct: number
  message: string
  phases: Phase[]
  logs: string[]
  contractInfo?: ContractInfo
  isProxy?: boolean
}

export default function ScanProgressPanel({
  jobId,
  status,
  progressPct,
  message,
  phases,
  logs,
  contractInfo,
  isProxy
}: ScanProgressPanelProps) {
  const [showLogs, setShowLogs] = useState(false)
  const [elapsedTime, setElapsedTime] = useState(0)

  // Timer effect
  useEffect(() => {
    if (status === 'completed' || status === 'failed') return

    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [status])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getPhaseColor = (phase: Phase) => {
    if (phase.status === 'complete') return 'bg-emerald-500'
    if (phase.status === 'active') {
      if (phase.name === 'CONTROL_FLOW') return 'bg-emerald-500'
      return 'bg-indigo-500'
    }
    return 'bg-slate-200'
  }

  const getPhaseBarBg = (phase: Phase) => {
    if (phase.status === 'complete') return 'bg-emerald-100'
    if (phase.status === 'active') {
      if (phase.name === 'CONTROL_FLOW') return 'bg-emerald-100'
      return 'bg-indigo-100'
    }
    return 'bg-slate-100'
  }

  const completedPhases = phases.filter(p => p.status === 'complete').length
  const isSecure = status === 'completed' && progressPct === 100

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-[32px] border border-black/[0.04] shadow-xl overflow-hidden"
    >
      {/* Terminal Header */}
      <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-rose-400" />
            <div className="w-3 h-3 rounded-full bg-amber-400" />
            <div className="w-3 h-3 rounded-full bg-emerald-400" />
          </div>
          <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase ml-4">
            UATU COMMAND V4.2
          </span>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
          <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wider">
            Live Monitoring
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-8">
        {/* Title Row */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-1">
              Security Engine Running
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              TARGET: {isProxy ? 'PROXY CONTRACT' : 'SMART CONTRACT'}
              {contractInfo?.network && ` • ${contractInfo.network.toUpperCase()}`}
            </p>
          </div>
          <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-2xl px-4 py-3">
            <Timer className="w-5 h-5 text-indigo-500" />
            <span className="text-lg font-black text-indigo-600 font-mono tracking-tight">
              {formatTime(elapsedTime)}
            </span>
          </div>
        </div>

        {/* Phase Progress Bars */}
        <div className="flex gap-8">
          <div className="flex-1 space-y-5">
            {phases.slice(0, 4).map((phase, index) => (
              <div key={phase.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                    {phase.label}
                  </span>
                  {phase.status !== 'pending' && (
                    <span className={`text-[10px] font-bold ${
                      phase.status === 'complete' ? 'text-emerald-600' : 'text-indigo-600'
                    }`}>
                      {phase.pct}%
                    </span>
                  )}
                </div>
                <div className={`relative h-2 rounded-full ${getPhaseBarBg(phase)} overflow-hidden`}>
                  <motion.div
                    className={`absolute inset-y-0 left-0 rounded-full ${getPhaseColor(phase)}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${phase.pct}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                  {phase.status === 'active' && (
                    <motion.div
                      className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-indigo-500 shadow-lg"
                      initial={{ left: 0 }}
                      animate={{ left: `calc(${phase.pct}% - 8px)` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Audit Status Badge */}
          <div className="shrink-0">
            <div className={`rounded-2xl p-5 ${
              isSecure ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50 border border-slate-200'
            }`}>
              <div className="flex items-center gap-3 mb-2">
                {isSecure ? (
                  <CheckCircle className="w-6 h-6 text-emerald-500" />
                ) : (
                  <Activity className="w-6 h-6 text-slate-400 animate-pulse" />
                )}
              </div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                Audit Status
              </div>
              <div className={`text-sm font-black uppercase tracking-wide ${
                isSecure ? 'text-emerald-600' : 'text-slate-500'
              }`}>
                {isSecure ? 'Verified Secure' : 'Analyzing...'}
              </div>
            </div>
          </div>
        </div>

        {/* Remaining phases in compact form */}
        {phases.length > 4 && (
          <div className="grid grid-cols-3 gap-4 mt-6">
            {phases.slice(4).map(phase => (
              <div key={phase.name} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider truncate">
                    {phase.label}
                  </span>
                  {phase.status !== 'pending' && (
                    <span className="text-[9px] font-bold text-slate-500">{phase.pct}%</span>
                  )}
                </div>
                <div className={`h-1.5 rounded-full ${getPhaseBarBg(phase)} overflow-hidden`}>
                  <motion.div
                    className={`h-full rounded-full ${getPhaseColor(phase)}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${phase.pct}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-slate-100 my-6" />

        {/* Bottom Section */}
        <div className="flex items-center justify-between">
          {/* On-Chain Data Sync */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
              <Activity className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                On-Chain Data
              </div>
              <div className="text-xs font-black text-slate-900 uppercase tracking-wide">
                Sync Live
              </div>
            </div>
          </div>

          {/* Current Message / Alert */}
          <div className="flex-1 mx-6">
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-[10px] font-bold text-amber-700 truncate">
                {message}
              </span>
            </div>
          </div>

          {/* Module Count */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 text-center">
            <div className="text-2xl font-black text-slate-900">
              {contractInfo?.sloc ? Math.ceil(contractInfo.sloc / 100) : completedPhases}
            </div>
            <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
              Modules
            </div>
          </div>
        </div>

        {/* See Logs Toggle */}
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="w-full mt-6 flex items-center justify-center gap-2 py-3 text-slate-400 hover:text-slate-600 transition-colors group"
        >
          <motion.div
            animate={{ rotate: showLogs ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-4 h-4" />
          </motion.div>
          <span className="text-[10px] font-bold uppercase tracking-widest">
            {showLogs ? 'Hide Logs' : 'See Logs'}
          </span>
        </button>

        {/* Logs Panel */}
        <AnimatePresence>
          {showLogs && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="bg-slate-900 rounded-xl p-4 mt-2 font-mono text-xs max-h-48 overflow-y-auto">
                {logs.length === 0 ? (
                  <div className="text-slate-500">Waiting for analysis logs...</div>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="text-slate-300 leading-relaxed">
                      <span className="text-slate-600 mr-2">[{i + 1}]</span>
                      {log}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
