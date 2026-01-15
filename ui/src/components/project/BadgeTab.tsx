import { useState, useEffect } from 'react'
import { Shield, Copy, Check, ExternalLink, Globe, Lock } from 'lucide-react'
import { authFetch } from '../../services/authService'

interface BadgeTabProps {
  projectId: string
  projectSlug: string
  projectName: string
}

interface AuditOption {
  id: string
  jobId: string
  createdAt: string
  score: number
}

export default function BadgeTab({ projectId, projectSlug, projectName }: BadgeTabProps) {
  const [isPublic, setIsPublic] = useState(false)
  const [selectedAuditId, setSelectedAuditId] = useState<string>('')
  const [audits, setAudits] = useState<AuditOption[]>([])
  const [currentScore, setCurrentScore] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchAudits()
    fetchBadgeSettings()
  }, [projectId])

  const fetchAudits = async () => {
    try {
      const res = await authFetch(`/api/projects/${projectId}/audits`)
      if (res.ok) {
        const data = await res.json()
        const completedAudits = (data.audits || [])
          .filter((a: any) => a.status === 'completed' && a.score !== undefined)
          .map((a: any) => ({
            id: a.id,
            jobId: a.jobId,
            createdAt: a.createdAt,
            score: a.score
          }))
        setAudits(completedAudits)

        // Set current score from latest audit
        if (completedAudits.length > 0) {
          setCurrentScore(completedAudits[0].score)
        }
      }
    } catch (err) {
      console.error('Failed to fetch audits:', err)
    }
  }

  const fetchBadgeSettings = async () => {
    try {
      const res = await authFetch(`/api/projects/${projectId}/badge-settings`)
      if (res.ok) {
        const data = await res.json()
        setIsPublic(data.isPublic || false)
        setSelectedAuditId(data.selectedAuditId || '')
      }
    } catch (err) {
      console.error('Failed to fetch badge settings:', err)
    }
  }

  const handleSaveSettings = async () => {
    setSaving(true)
    try {
      const res = await authFetch(`/api/projects/${projectId}/badge-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isPublic,
          selectedAuditId: selectedAuditId || null
        })
      })

      if (!res.ok) {
        throw new Error('Failed to save settings')
      }
    } catch (err) {
      console.error('Failed to save badge settings:', err)
    } finally {
      setSaving(false)
    }
  }

  const getBadgeUrl = () => {
    const baseUrl = window.location.origin
    return `${baseUrl}/badge/${projectSlug}`
  }

  const getEmbedCode = () => {
    const badgeUrl = getBadgeUrl()
    return `[![Uatu Audit Score](${badgeUrl})](${window.location.origin}/project/${projectSlug})`
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(getEmbedCode())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'from-emerald-500 to-emerald-600'
    if (score >= 60) return 'from-blue-500 to-blue-600'
    if (score >= 40) return 'from-amber-500 to-amber-600'
    return 'from-rose-500 to-rose-600'
  }

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent'
    if (score >= 60) return 'Good'
    if (score >= 40) return 'Fair'
    return 'Needs Work'
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div className="space-y-6">
      {/* Badge Preview */}
      <div>
        <h3 className="font-black text-sm text-slate-400 uppercase tracking-widest mb-4">Badge Preview</h3>
        <div className="card-premium p-8 text-center">
          {currentScore !== null ? (
            <div className="inline-block">
              <div className={`bg-gradient-to-r ${getScoreColor(currentScore)} p-8 rounded-2xl shadow-lg`}>
                <div className="flex items-center gap-6">
                  <Shield size={48} className="text-white" />
                  <div className="text-left">
                    <div className="text-white/80 text-xs font-black uppercase tracking-wider mb-1">
                      Uatu Security Score
                    </div>
                    <div className="text-5xl font-black text-white mb-1">
                      {currentScore}
                    </div>
                    <div className="text-white/90 text-sm font-bold">
                      {getScoreLabel(currentScore)}
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-4">{projectName}</p>
            </div>
          ) : (
            <div>
              <div className="w-20 h-20 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Shield size={32} className="text-slate-300" />
              </div>
              <p className="text-sm text-slate-400">
                Complete an audit to generate your security badge
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Public Settings */}
      {currentScore !== null && (
        <>
          <div>
            <h3 className="font-black text-sm text-slate-400 uppercase tracking-widest mb-4">Badge Settings</h3>
            <div className="card-premium p-6 space-y-6">
              {/* Public Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isPublic ? (
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                      <Globe size={18} className="text-emerald-600" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                      <Lock size={18} className="text-slate-400" />
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-sm text-slate-900">Make Badge Public</p>
                    <p className="text-xs text-slate-400">
                      Allow anyone to view your security score
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsPublic(!isPublic)}
                  className={`relative w-14 h-8 rounded-full transition-colors ${
                    isPublic ? 'bg-indigo-600' : 'bg-slate-200'
                  }`}
                >
                  <div
                    className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-sm transition-transform ${
                      isPublic ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Audit Selection */}
              {isPublic && audits.length > 0 && (
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    Display Audit Report
                  </label>
                  <select
                    value={selectedAuditId}
                    onChange={(e) => setSelectedAuditId(e.target.value)}
                    className="w-full h-11 px-4 bg-white border border-black/[0.05] rounded-xl text-sm"
                  >
                    <option value="">Latest Audit (Default)</option>
                    {audits.map((audit) => (
                      <option key={audit.id} value={audit.jobId}>
                        {formatDate(audit.createdAt)} - Score: {audit.score}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Save Button */}
              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="w-full h-11 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase hover:bg-indigo-600 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>

          {/* Embed Code */}
          {isPublic && (
            <div>
              <h3 className="font-black text-sm text-slate-400 uppercase tracking-widest mb-4">Embed Badge</h3>
              <div className="card-premium p-6 space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    Badge URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={getBadgeUrl()}
                      readOnly
                      className="flex-1 h-11 px-4 bg-slate-50 border border-black/[0.05] rounded-xl text-sm font-mono text-slate-600"
                    />
                    <a
                      href={getBadgeUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 h-11 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center justify-center"
                    >
                      <ExternalLink size={16} />
                    </a>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    Markdown Embed Code
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={getEmbedCode()}
                      readOnly
                      className="flex-1 h-11 px-4 bg-slate-50 border border-black/[0.05] rounded-xl text-sm font-mono text-slate-600"
                    />
                    <button
                      onClick={handleCopy}
                      className="px-4 h-11 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center justify-center"
                    >
                      {copied ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-400">
                  Copy this code to display your Uatu security badge in your README or documentation.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
