import { useState, useEffect } from 'react'
import { Copy, Check, Globe, Lock } from 'lucide-react'
import { authFetch } from '../../services/authService'

interface BadgeTabProps {
  projectId: string
  projectSlug: string
  projectName: string
  primaryColor?: string
  logoUrl?: string
}

interface AuditOption {
  id: string
  jobId: string
  createdAt: string
  score: number
  scoreLabel: string
  repo?: string
  branch?: string
  commitSha?: string
  contractAddress?: string
  chainId?: string
}

type BadgeStyle = 'ribbon' | 'rectangle' | 'square'

export default function BadgeTab({ projectId, projectSlug, projectName, primaryColor, logoUrl }: BadgeTabProps) {
  const [isPublic, setIsPublic] = useState(false)
  const [selectedAuditId, setSelectedAuditId] = useState<string>('')
  const [audits, setAudits] = useState<AuditOption[]>([])
  const [currentAudit, setCurrentAudit] = useState<AuditOption | null>(null)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

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
            score: a.score,
            scoreLabel: a.scoreLabel || 'N/A',
            repo: a.repo,
            branch: a.branch,
            commitSha: a.commitSha,
            contractAddress: a.contractAddress,
            chainId: a.chainId
          }))
        setAudits(completedAudits)

        if (completedAudits.length > 0) {
          setCurrentAudit(completedAudits[0])
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

  const getBadgeData = () => {
    if (currentAudit && currentAudit.score !== null && currentAudit.score !== undefined) {
      return {
        score: currentAudit.score.toString().padStart(2, '0'),
        grade: currentAudit.scoreLabel || 'A+',
        link: `${window.location.origin}/project/${projectSlug}`
      }
    }
    return {
      score: '00',
      grade: 'A+',
      link: 'https://uatu.xyz'
    }
  }

  const getBadgeImageUrl = (style: BadgeStyle) => {
    const baseUrl = window.location.origin
    const { score, grade } = getBadgeData()
    return `${baseUrl}/api/badge/${projectSlug}/${style}?score=${score}&grade=${grade}`
  }

  const getEmbedCode = (style: BadgeStyle) => {
    const { link } = getBadgeData()
    const imageUrl = getBadgeImageUrl(style)
    return `<a href="${link}"><img src="${imageUrl}" alt="${projectName} Security Audit" /></a>`
  }

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const badgeData = getBadgeData()
  const color = primaryColor || '#5C61FF'

  return (
    <div className="space-y-6">
      {/* Badge Styles Grid */}
      <div>
        <h3 className="font-black text-sm text-slate-400 uppercase tracking-widest mb-4">Badge Styles</h3>

        <div className="flex gap-4">
          {/* Left: Rectangle Badge - 65% */}
          <div className="card-premium p-4" style={{ width: '65%' }}>
            {currentAudit && (
              <div className="flex justify-end mb-3">
                <button
                  onClick={() => handleCopy(getEmbedCode('rectangle'), 'rectangle')}
                  className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  title="Copy embed code"
                >
                  {copied === 'rectangle' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                </button>
              </div>
            )}

            <div className="flex justify-center p-8 bg-slate-50 rounded-lg">
              <div
                className="w-full rounded-xl shadow-xl overflow-hidden relative"
                style={{
                  backgroundColor: color,
                  aspectRatio: '1.91 / 1',
                  maxWidth: '600px'
                }}
              >
                {/* Watermark mascot */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ opacity: 0.08 }}>
                  <img src="/mascot.png" alt="" className="h-full object-contain scale-110" />
                </div>

                <div className="flex items-center justify-between p-8 h-full relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl bg-white/20 p-3 flex items-center justify-center flex-shrink-0">
                      <img src="/logo.svg" alt="Uatu" className="w-full h-full object-contain" />
                    </div>
                    {logoUrl ? (
                      <>
                        <span className="text-white/40 text-3xl font-black">×</span>
                        <img src={logoUrl} alt="Project" className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
                      </>
                    ) : (
                      <>
                        <span className="text-white/40 text-3xl font-black">×</span>
                        <div className="w-16 h-16 rounded-xl bg-white shadow-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-2xl font-black" style={{ color: color }}>
                            {projectName?.charAt(0).toUpperCase() || 'P'}
                          </span>
                        </div>
                      </>
                    )}
                    <div className="text-left ml-2">
                      <div className="text-white font-bold text-base leading-tight">{projectName}</div>
                      <div className="text-white/70 text-sm mt-1.5">Security Audit</div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-white font-black text-5xl leading-none">{badgeData.grade}</span>
                      <span className="text-white/90 font-bold text-2xl leading-none">{badgeData.score}%</span>
                    </div>
                    <div className="text-white/80 text-xs font-bold mt-2 uppercase tracking-wider">Security Score</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Square + Ribbon - 35% */}
          <div className="space-y-4" style={{ width: '35%' }}>
            {/* Square Badge */}
            <div className="card-premium p-4">
              {currentAudit && (
                <div className="flex justify-end mb-3">
                  <button
                    onClick={() => handleCopy(getEmbedCode('square'), 'square')}
                    className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    title="Copy embed code"
                  >
                    {copied === 'square' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                  </button>
                </div>
              )}

              <div className="flex justify-center p-6 bg-slate-50 rounded-lg">
                <div
                  className="w-full max-w-[200px] rounded-xl shadow-xl overflow-hidden relative"
                  style={{ backgroundColor: color }}
                >
                  {/* Watermark mascot */}
                  <div className="absolute inset-0 flex items-end justify-center pointer-events-none pb-4" style={{ opacity: 0.1 }}>
                    <img src="/mascot.png" alt="" className="h-32 object-contain" />
                  </div>

                  <div className="p-5 text-center space-y-3 relative z-10">
                    <div className="flex items-center justify-center gap-1.5">
                      <img src="/favicon.svg" alt="Uatu" className="w-12 h-12 object-contain" />
                      {logoUrl ? (
                        <>
                          <span className="text-white/40 text-base font-black">×</span>
                          <img src={logoUrl} alt="Project" className="w-12 h-12 rounded-lg object-cover" />
                        </>
                      ) : (
                        <>
                          <span className="text-white/40 text-base font-black">×</span>
                          <div className="w-12 h-12 rounded-lg bg-white shadow-lg flex items-center justify-center">
                            <span className="text-xl font-black" style={{ color: color }}>
                              {projectName?.charAt(0).toUpperCase() || 'P'}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="text-white text-sm font-bold">{projectName}</div>
                    <div className="h-px bg-white/20"></div>
                    <div>
                      <div className="flex items-baseline justify-center gap-2">
                        <span className="text-white font-black text-5xl leading-none">{badgeData.grade}</span>
                        <span className="text-white/90 font-bold text-2xl leading-none">{badgeData.score}%</span>
                      </div>
                      <div className="text-white/80 text-[10px] font-bold mt-2 uppercase tracking-wider">Security Score</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Ribbon Badge */}
            <div className="card-premium p-4">
              {currentAudit && (
                <div className="flex justify-end mb-3">
                  <button
                    onClick={() => handleCopy(getEmbedCode('ribbon'), 'ribbon')}
                    className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    title="Copy embed code"
                  >
                    {copied === 'ribbon' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                  </button>
                </div>
              )}

              <div className="flex justify-center p-6 bg-slate-50 rounded-lg">
                <div
                  className="inline-flex items-center gap-3 px-6 py-3 rounded-full shadow-lg relative overflow-hidden"
                  style={{ backgroundColor: color }}
                >
                  {/* Watermark mascot */}
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ opacity: 0.15 }}>
                    <img src="/mascot.png" alt="" className="w-12 h-12 object-contain" />
                  </div>

                  <img src="/favicon.svg" alt="Uatu" className="w-8 h-8 object-contain relative z-10" />
                  {logoUrl ? (
                    <>
                      <div className="w-px h-6 bg-white/30 relative z-10"></div>
                      <img src={logoUrl} alt="Project" className="w-8 h-8 rounded-full object-cover relative z-10" />
                    </>
                  ) : (
                    <>
                      <div className="w-px h-6 bg-white/30 relative z-10"></div>
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center relative z-10">
                        <span className="text-base font-black" style={{ color: color }}>
                          {projectName?.charAt(0).toUpperCase() || 'P'}
                        </span>
                      </div>
                    </>
                  )}
                  <span className="text-white font-bold text-sm relative z-10">{projectName}</span>
                  <div className="w-px h-6 bg-white/30 relative z-10"></div>
                  <span className="text-white font-black text-xl relative z-10">{badgeData.grade}</span>
                  <span className="text-white/90 font-bold text-sm relative z-10">{badgeData.score}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {!currentAudit && (
          <p className="text-center text-sm text-slate-400 mt-4">
            Complete an audit to enable embed codes. Currently showing mock data (00% A+).
          </p>
        )}
      </div>

      {/* Public Settings */}
      {currentAudit && (
        <div>
          <h3 className="font-black text-sm text-slate-400 uppercase tracking-widest mb-4">Badge Settings</h3>
          <div className="card-premium p-6 space-y-6">
            {/* Public Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isPublic ? (
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <Globe size={16} className="text-emerald-600" />
                  </div>
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Lock size={16} className="text-slate-400" />
                  </div>
                )}
                <div>
                  <p className="font-bold text-sm text-slate-900">Make Badge Public</p>
                  <p className="text-xs text-slate-500">
                    Allow anyone to view your security score
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPublic(!isPublic)}
                className={`relative w-12 h-7 rounded-full transition-all flex-shrink-0 ${
                  isPublic ? 'bg-indigo-600' : 'bg-slate-300'
                }`}
              >
                <div
                  className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                    isPublic ? 'translate-x-[22px]' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Audit Selection */}
            {isPublic && audits.length > 0 && (
              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-2">
                  Display Audit Report
                </label>
                <select
                  value={selectedAuditId}
                  onChange={(e) => setSelectedAuditId(e.target.value)}
                  className="w-full h-10 px-3 bg-white border-2 border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
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
              className="w-full h-10 bg-indigo-600 text-white rounded-lg font-bold text-xs hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
