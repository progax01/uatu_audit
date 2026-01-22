import { useState, useEffect } from 'react'
import { Shield, Copy, Check, Globe, Lock } from 'lucide-react'
import { authFetch } from '../../services/authService'
import { BrandingPreviewCard } from './BrandingPreview'

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
    if (currentAudit) {
      return {
        score: currentAudit.score.toString().padStart(2, '0'),
        grade: currentAudit.scoreLabel,
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
      {/* Branding Preview with Score */}
      <BrandingPreviewCard
        logoUrl={logoUrl}
        primaryColor={primaryColor}
        projectName={projectName}
        score={currentAudit?.score}
        grade={currentAudit?.scoreLabel}
      />

      {/* Badge Styles Grid */}
      <div>
        <h3 className="font-black text-sm text-slate-400 uppercase tracking-widest mb-4">Badge Styles</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Ribbon Badge */}
          <div className="card-premium p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-bold text-xs text-slate-900">Ribbon</h4>
                <p className="text-[10px] text-slate-500">For READMEs</p>
              </div>
              {currentAudit && (
                <button
                  onClick={() => handleCopy(getEmbedCode('ribbon'), 'ribbon')}
                  className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  title="Copy embed code"
                >
                  {copied === 'ribbon' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                </button>
              )}
            </div>

            <div className="flex justify-center p-4 bg-slate-50 rounded-lg">
              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full shadow-lg text-xs"
                style={{ backgroundColor: color }}
              >
                <div className="w-6 h-6 rounded-full bg-white/20 p-1 flex items-center justify-center">
                  <img src="/logo.svg" alt="Uatu" className="w-full h-full object-contain" />
                </div>
                <span className="text-white font-bold">{projectName}</span>
                <div className="w-px h-4 bg-white/30"></div>
                <span className="text-white font-black">{badgeData.grade}</span>
                <span className="text-white/90 font-bold">{badgeData.score}%</span>
                <Shield size={12} className="text-white/80" />
              </div>
            </div>
          </div>

          {/* Rectangle Badge */}
          <div className="card-premium p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-bold text-xs text-slate-900">Rectangle</h4>
                <p className="text-[10px] text-slate-500">OG Image</p>
              </div>
              {currentAudit && (
                <button
                  onClick={() => handleCopy(getEmbedCode('rectangle'), 'rectangle')}
                  className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  title="Copy embed code"
                >
                  {copied === 'rectangle' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                </button>
              )}
            </div>

            <div className="flex justify-center p-4 bg-slate-50 rounded-lg">
              <div
                className="w-full rounded-lg shadow-xl overflow-hidden text-[8px]"
                style={{ backgroundColor: color }}
              >
                <div className="flex items-center justify-between p-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-8 h-8 rounded-lg bg-white/20 p-1 flex items-center justify-center">
                      <img src="/logo.svg" alt="Uatu" className="w-full h-full object-contain" />
                    </div>
                    {logoUrl && (
                      <>
                        <span className="text-white/40 text-sm font-black">×</span>
                        <div className="w-8 h-8 rounded-lg bg-white p-1">
                          <img src={logoUrl} alt="Project" className="w-full h-full object-contain" />
                        </div>
                      </>
                    )}
                    <div className="text-left ml-1">
                      <div className="text-white font-bold leading-none">{projectName}</div>
                      <div className="text-white/70 text-[7px] mt-0.5">Security Audit</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-baseline gap-1">
                      <span className="text-white font-black text-lg leading-none">{badgeData.grade}</span>
                      <span className="text-white/90 font-bold text-xs leading-none">{badgeData.score}%</span>
                    </div>
                    <div className="text-white/80 text-[6px] font-bold mt-0.5">SECURITY SCORE</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Square Badge */}
          <div className="card-premium p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-bold text-xs text-slate-900">Square</h4>
                <p className="text-[10px] text-slate-500">For websites</p>
              </div>
              {currentAudit && (
                <button
                  onClick={() => handleCopy(getEmbedCode('square'), 'square')}
                  className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  title="Copy embed code"
                >
                  {copied === 'square' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                </button>
              )}
            </div>

            <div className="flex justify-center p-4 bg-slate-50 rounded-lg">
              <div
                className="w-32 rounded-xl shadow-xl overflow-hidden"
                style={{ backgroundColor: color }}
              >
                <div className="p-3 text-center space-y-2">
                  <div className="flex items-center justify-center gap-1">
                    <div className="w-8 h-8 rounded-lg bg-white/20 p-1">
                      <img src="/logo.svg" alt="Uatu" className="w-full h-full object-contain" />
                    </div>
                    {logoUrl && (
                      <>
                        <span className="text-white/40 text-xs font-black">×</span>
                        <div className="w-8 h-8 rounded-lg bg-white p-1">
                          <img src={logoUrl} alt="Project" className="w-full h-full object-contain" />
                        </div>
                      </>
                    )}
                  </div>
                  <div className="text-white text-[10px] font-bold">{projectName}</div>
                  <div className="h-px bg-white/20"></div>
                  <div>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-white font-black text-3xl leading-none">{badgeData.grade}</span>
                      <span className="text-white/90 font-bold text-lg leading-none">{badgeData.score}%</span>
                    </div>
                    <div className="text-white/80 text-[8px] font-bold mt-1">SECURITY SCORE</div>
                  </div>
                  <div className="flex justify-center">
                    <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                      <Shield size={12} className="text-white" />
                    </div>
                  </div>
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
