import { useState, useEffect } from 'react'
import { Shield, Copy, Check, ExternalLink, Globe, Lock } from 'lucide-react'
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

        // Set current audit from latest
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

  const getBadgeUrl = () => {
    const baseUrl = window.location.origin
    return `${baseUrl}/badge/${projectSlug}`
  }

  const getMarkdownCode = () => {
    const badgeUrl = getBadgeUrl()
    return `[![Uatu Audit Score](${badgeUrl})](${window.location.origin}/project/${projectSlug})`
  }

  const getHtmlCode = () => {
    const badgeUrl = getBadgeUrl()
    return `<a href="${window.location.origin}/project/${projectSlug}"><img src="${badgeUrl}" alt="Uatu Audit Score" /></a>`
  }

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  const getAuditInfo = () => {
    if (!currentAudit) return null

    // Check if it's a GitHub repo audit
    if (currentAudit.repo && !currentAudit.repo.startsWith('contract:')) {
      return {
        type: 'repo' as const,
        line1: currentAudit.branch || 'main',
        line2: currentAudit.commitSha?.substring(0, 7) || 'latest'
      }
    }

    // Check if it's a contract audit
    if (currentAudit.contractAddress || currentAudit.repo?.startsWith('contract:')) {
      const address = currentAudit.contractAddress || currentAudit.repo?.split(':')[2] || ''
      const chain = currentAudit.chainId || 'ethereum'
      return {
        type: 'contract' as const,
        line1: `${address.substring(0, 6)}...${address.substring(address.length - 4)}`,
        line2: chain.charAt(0).toUpperCase() + chain.slice(1)
      }
    }

    return null
  }


  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const auditInfo = getAuditInfo()

  return (
    <div className="space-y-6">
      {/* Branding Preview - Hero style */}
      <BrandingPreviewCard
        logoUrl={logoUrl}
        primaryColor={primaryColor}
        projectName={projectName}
        score={currentAudit?.score}
        grade={currentAudit?.scoreLabel}
      />

      {/* Badge Preview */}
      <div>
        <h3 className="font-black text-sm text-slate-400 uppercase tracking-widest mb-4">Badge Preview</h3>
        <div className="card-premium p-10">
          {currentAudit ? (
            <div className="flex justify-center">
              {/* Horizontal badge design - more polished */}
              <div
                className="inline-flex items-center gap-4 px-6 py-3.5 rounded-xl shadow-lg"
                style={{
                  backgroundColor: primaryColor || '#5C61FF',
                  boxShadow: `0 4px 14px ${primaryColor || '#5C61FF'}40`
                }}
              >
                {/* Left side - Logos */}
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-white/25 backdrop-blur-sm p-1.5 flex items-center justify-center">
                    <img
                      src="/logo.svg"
                      alt="Uatu"
                      className="w-full h-full object-contain brightness-0 invert"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  </div>
                  {logoUrl && (
                    <>
                      <div className="text-white/40 text-lg font-black">×</div>
                      <div className="w-10 h-10 rounded-lg bg-white p-1.5 flex items-center justify-center shadow-sm">
                        <img src={logoUrl} alt="Project" className="w-full h-full object-contain" />
                      </div>
                    </>
                  )}
                </div>

                {/* Divider */}
                <div className="w-px h-12 bg-white/20"></div>

                {/* Middle - Project info */}
                <div className="text-left">
                  <div className="text-white text-xs font-bold uppercase tracking-wide mb-0.5">
                    {projectName}
                  </div>
                  {auditInfo && (
                    <div className="text-white/70 text-[10px] font-mono">
                      {auditInfo.type === 'repo' ? (
                        <>{auditInfo.line1} @ {auditInfo.line2}</>
                      ) : (
                        <>{auditInfo.line1} · {auditInfo.line2}</>
                      )}
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="w-px h-12 bg-white/20"></div>

                {/* Right side - Score */}
                <div className="text-left">
                  <div className="flex items-baseline gap-1.5">
                    <div className="text-3xl font-black text-white leading-none">
                      {currentAudit.scoreLabel}
                    </div>
                    <div className="text-lg font-bold text-white/90 leading-none">
                      {currentAudit.score}%
                    </div>
                  </div>
                  <div className="text-white/80 text-[10px] font-bold mt-1 uppercase tracking-wider">
                    Security Score
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <Shield size={28} className="text-slate-300" />
              </div>
              <p className="text-sm text-slate-400">
                Complete an audit to generate your security badge
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Public Settings */}
      {currentAudit && (
        <>
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
                    Markdown
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={getMarkdownCode()}
                      readOnly
                      className="flex-1 h-11 px-4 bg-slate-50 border border-black/[0.05] rounded-xl text-sm font-mono text-slate-600"
                    />
                    <button
                      onClick={() => handleCopy(getMarkdownCode(), 'markdown')}
                      className="px-4 h-11 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center justify-center"
                    >
                      {copied === 'markdown' ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    HTML
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={getHtmlCode()}
                      readOnly
                      className="flex-1 h-11 px-4 bg-slate-50 border border-black/[0.05] rounded-xl text-sm font-mono text-slate-600"
                    />
                    <button
                      onClick={() => handleCopy(getHtmlCode(), 'html')}
                      className="px-4 h-11 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center justify-center"
                    >
                      {copied === 'html' ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
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
