import { useState } from 'react'
import { HelpCircle, ExternalLink, ShieldAlert, CheckCircle2, ChevronRight, Github } from 'lucide-react'
import { motion } from 'framer-motion'

interface Question {
  id: string
  component_id: string
  component_label: string
  question: string
  suggested_scope: 'INTERNAL' | 'EXTERNAL'
}

interface LiabilityTriageProps {
  questions: Question[]
  onSubmit: (answers: any) => void
}

export default function LiabilityTriage({ questions, onSubmit }: LiabilityTriageProps) {
  const [answers, setAnswers] = useState<Record<string, { answer: string, url: string }>>({})

  const handleUpdate = (id: string, field: 'answer' | 'url', value: string) => {
    setAnswers(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }))
  }

  return (
    <div className="space-y-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-6 p-10 bg-amber-50/50 border border-amber-100 rounded-[40px] shadow-sm"
      >
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center shrink-0">
          <ShieldAlert className="w-8 h-8 text-amber-600" strokeWidth={1.5} />
        </div>
        <p className="text-[12px] font-bold text-amber-900 leading-[1.8] uppercase tracking-[0.15em] opacity-80">
          <span className="font-black text-amber-600 mr-2">Human Liability Triage:</span>
          AI has identified hotspots where risk might be shifted to external dependencies. Your responses will refine the final integrity grade.
        </p>
      </motion.div>

      <div className="space-y-10">
        {questions.map((q, i) => (
          <motion.div
            key={q.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="card !p-12 !bg-white/60 !backdrop-blur-3xl hover:translate-x-2 transition-all duration-700"
          >
            <div className="flex items-center gap-3 mb-10">
              <span className="text-[9px] font-black uppercase tracking-[0.3em] bg-slate-900 text-white px-4 py-2 rounded-xl">
                {q.component_label}
              </span>
              <span className="text-slate-200">/</span>
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 italic font-mono">{q.component_id}</span>
            </div>

            <h3 className="text-3xl font-black text-slate-900 mb-10 tracking-tight leading-snug">{q.question}</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-4">
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.25em] ml-1">Explanatory Logic</label>
                <textarea
                  className="w-full bg-white border border-black/[0.04] rounded-3xl p-6 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all min-h-[160px] text-slate-700 placeholder:text-slate-300"
                  placeholder="Provide internal justification for this logic path..."
                  value={answers[q.id]?.answer || ''}
                  onChange={(e) => handleUpdate(q.id, 'answer', e.target.value)}
                />
              </div>
              <div className="space-y-10">
                <div className="space-y-4">
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.25em] ml-1">Third-Party Archive (GitHub)</label>
                  <div className="relative group/input">
                    <input
                      type="text"
                      className="w-full bg-white border border-black/[0.04] rounded-2xl p-4 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all pr-12 text-slate-700 placeholder:text-slate-300"
                      placeholder="https://github.com/archive/source"
                      value={answers[q.id]?.url || ''}
                      onChange={(e) => handleUpdate(q.id, 'url', e.target.value)}
                    />
                    <Github className="absolute right-4 top-4.5 w-4 h-4 text-slate-200 group-hover/input:text-slate-400 transition-colors" />
                  </div>
                </div>
                <div className="p-6 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-between shadow-sm">
                  <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest italic opacity-70">Suggested Scope: {q.suggested_scope}</span>
                  <HelpCircle className="w-5 h-5 text-indigo-400" strokeWidth={1.5} />
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.button
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={() => onSubmit(answers)}
        className="w-full bg-slate-900 hover:bg-slate-800 text-white py-6 rounded-[32px] font-black text-[12px] uppercase tracking-[0.4em] flex items-center justify-center gap-4 shadow-xl shadow-slate-900/10 transition-all duration-500 group"
      >
        Synchronize & Recalculate Hub
        <ChevronRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" strokeWidth={3} />
      </motion.button>
    </div>
  )
}
