import { useState, useEffect } from 'react'
import { ArrowLeft, FileText, Activity, ShieldCheck, Download, ExternalLink, RefreshCw } from 'lucide-react'
import LiabilityTriage from '../components/LiabilityTriage'

interface AuditDetailsProps {
  jobId?: number
  onHomeClick: () => void
  onBack: () => void
}

export default function AuditDetails({ jobId, onHomeClick, onBack }: AuditDetailsProps) {
  const [activeTab, setActiveTab] = useState<'report' | 'triage'>('report')
  const [loading, setLoading] = useState(true)
  const [auditData, setAuditData] = useState<any>(null)

  useEffect(() => {
    // Simulate fetching audit data
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
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <RefreshCw className="w-10 h-10 text-[#0F3F62] animate-spin mb-4" />
        <p className="text-gray-500 font-medium">Assembling Deep Audit Evidence...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </button>
          <div className="flex flex-col">
            <h1 className="text-lg font-bold text-[#0F3F62]">{auditData.projectName}</h1>
            <span className="text-[10px] font-mono text-gray-400">JOB_ID: {jobId || '123'}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-all">
            <Download className="w-4 h-4" />
            PDF Report
          </button>
          <div className={`px-4 py-2 rounded-lg text-sm font-black ${
            auditData.score >= 80 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {auditData.grade} ({auditData.score}/100)
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-8">
        {/* Navigation Tabs */}
        <div className="flex gap-1 bg-gray-200 p-1 rounded-xl w-fit mb-8">
          <button 
            onClick={() => setActiveTab('report')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'report' ? 'bg-white text-[#0F3F62] shadow-sm' : 'text-gray-500 hover:text-[#0F3F62]'
            }`}
          >
            <FileText className="w-4 h-4" />
            Full Report
          </button>
          <button 
            onClick={() => setActiveTab('triage')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'triage' ? 'bg-white text-[#0F3F62] shadow-sm' : 'text-gray-500 hover:text-[#0F3F62]'
            }`}
          >
            <Activity className="w-4 h-4" />
            Liability Triage
            <span className="bg-red-500 text-white w-5 h-5 rounded-full text-[10px] flex items-center justify-center ml-1">1</span>
          </button>
        </div>

        {activeTab === 'report' ? (
          <div className="space-y-8">
            {/* Findings Summary */}
            <div className="grid grid-cols-4 gap-4">
              {['critical', 'high', 'medium', 'low'].map((sev) => (
                <div key={sev} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-2">{sev}</span>
                  <span className="text-3xl font-black text-gray-900">{auditData.findings[sev]}</span>
                </div>
              ))}
            </div>

            {/* Embedded HTML Report */}
            <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-xl shadow-gray-200/50 min-h-[800px] flex flex-col items-center justify-center text-gray-400">
              <ShieldCheck className="w-16 h-16 mb-4 opacity-20" />
              <p>Security Audit Evidence Rendering Engine...</p>
              <button className="mt-4 text-[#0F3F62] flex items-center gap-2 hover:underline font-bold">
                Open in New Tab <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <LiabilityTriage 
            questions={auditData.questions} 
            onSubmit={(ans) => console.log('Submitting triage:', ans)}
          />
        )}
      </main>
    </div>
  )
}

