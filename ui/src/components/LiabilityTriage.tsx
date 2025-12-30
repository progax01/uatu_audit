import { useState } from 'react'
import { HelpCircle, ExternalLink, ShieldAlert, CheckCircle2, ChevronRight } from 'lucide-react'

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
    <div className="space-y-6">
      <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl">
        <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0" />
        <p className="text-sm text-amber-800 leading-relaxed">
          <span className="font-bold">Human Triage Required:</span> AI has identified hotspots where risk might be shifted to external dependencies. Your responses will refine the security score.
        </p>
      </div>

      <div className="space-y-4">
        {questions.map((q) => (
          <div key={q.id} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[10px] font-black uppercase tracking-widest bg-[#0F3F62] text-white px-2 py-0.5 rounded">
                {q.component_label}
              </span>
              <span className="text-gray-300">/</span>
              <span className="text-xs font-mono text-gray-400">{q.component_id}</span>
            </div>

            <h3 className="text-lg font-bold text-gray-900 mb-4">{q.question}</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Explanatory Response</label>
                <textarea 
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-[#0F3F62]"
                  rows={3}
                  placeholder="Explain how this is handled..."
                  value={answers[q.id]?.answer || ''}
                  onChange={(e) => handleUpdate(q.id, 'answer', e.target.value)}
                />
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Third-Party Source (GitHub URL)</label>
                  <div className="relative">
                    <input 
                      type="text"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-[#0F3F62] pr-10"
                      placeholder="https://github.com/..."
                      value={answers[q.id]?.url || ''}
                      onChange={(e) => handleUpdate(q.id, 'url', e.target.value)}
                    />
                    <ExternalLink className="absolute right-3 top-3.5 w-4 h-4 text-gray-300" />
                  </div>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between">
                  <span className="text-xs font-medium text-blue-700 italic">Suggested Scope: {q.suggested_scope}</span>
                  <HelpCircle className="w-4 h-4 text-blue-400" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button 
        onClick={() => onSubmit(answers)}
        className="w-full bg-[#0F3F62] hover:bg-[#1a5a8a] text-white py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 shadow-xl shadow-blue-900/10 transition-all"
      >
        Submit Triage & Recalculate Score
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  )
}

