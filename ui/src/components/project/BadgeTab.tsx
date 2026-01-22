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

  const getBadgeData = () => {
    if (currentAudit) {
      return {
        score: currentAudit.score.toString().padStart(2, '0'),
        grade: currentAudit.scoreLabel,
        link: `${window.location.origin}/project/${projectSlug}`
      }
    }
    // Mock data when no audit
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
      {/* Branding Preview - Hero style */}
      <BrandingPreviewCard
        logoUrl={logoUrl}
        primaryColor={primaryColor}
        projectName={projectName}
        score={currentAudit?.score}
        grade={currentAudit?.scoreLabel}
      />

      {/* Badge Previews */}
      <div>
        <h3 className="font-black text-sm text-slate-400 uppercase tracking-widest mb-4">Badge Styles</h3>

        {/* Ribbon Badge */}
        <div className="card-premium p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-bold text-sm text-slate-900">Ribbon Badge</h4>
              <p className="text-xs text-slate-500">Compact horizontal badge for READMEs</p>
            </div>
            {currentAudit && (
              <button
                onClick={() => handleCopy(getEmbedCode('ribbon'), 'ribbon')}
                className="px-4 h-9 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
              >
                {copied === 'ribbon' ? (
                  <>
                    <Check size={14} className="text-emerald-600" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    Copy Embed
                  </>
                )}
              </button>
            )}
          </div>

          <div className="flex justify-center p-6 bg-slate-50 rounded-lg">
            {/* Ribbon Badge Preview */}
            <div
              className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full shadow-lg"
              style={{
                backgroundColor: color,
                boxShadow: `0 4px 14px ${color}40`
              }}
            >
              {/* Logo */}
              <div className="w-7 h-7 rounded-full bg-white/20 backdrop-blur-sm p-1 flex items-center justify-center">
                <img
                  src="/logo.svg"
                  alt="Uatu"
                  className="w-full h-full object-contain brightness-0 invert"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              </div>

              {/* Project Name */}
              <div className="text-white text-xs font-bold uppercase tracking-wide">
                {projectName}
              </div>

              {/* Divider */}
              <div className="w-px h-6 bg-white/30"></div>

              {/* Score */}
              <div className="flex items-baseline gap-1">
                <div className="text-xl font-black text-white leading-none">
                  {badgeData.grade}
                </div>
                <div className="text-sm font-bold text-white/90 leading-none">
                  {badgeData.score}%
                </div>
              </div>

              {/* Shield Icon */}
              <Shield size={16} className="text-white/80" fill="white" fillOpacity={0.2} />
            </div>
          </div>
        </div>

        {/* Rectangle Badge (OG Image) */}
        <div className="card-premium p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-bold text-sm text-slate-900">Rectangle Badge</h4>
              <p className="text-xs text-slate-500">Perfect for OG meta images and social sharing</p>
            </div>
            {currentAudit && (
              <button
                onClick={() => handleCopy(getEmbedCode('rectangle'), 'rectangle')}
                className="px-4 h-9 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
              >
                {copied === 'rectangle' ? (
                  <>
                    <Check size={14} className="text-emerald-600" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    Copy Embed
                  </>
                )}
              </button>
            )}
          </div>

          <div className="flex justify-center p-6 bg-slate-50 rounded-lg">
            {/* Rectangle Badge Preview */}
            <div
              className="w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden"
              style={{
                backgroundColor: color,
                boxShadow: `0 8px 32px ${color}40`
              }}
            >
              <div className="flex items-center justify-between p-6">
                {/* Left: Logos and Project */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm p-2 flex items-center justify-center">
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
                        <div className="text-white/40 text-2xl font-black">×</div>
                        <div className="w-12 h-12 rounded-xl bg-white p-2 flex items-center justify-center shadow">
                          <img src={logoUrl} alt="Project" className="w-full h-full object-contain" />
                        </div>
                      </>
                    )}
                  </div>

                  <div className="text-left">
                    <div className="text-white text-base font-bold uppercase tracking-wide">
                      {projectName}
                    </div>
                    <div className="text-white/70 text-xs font-medium mt-0.5">
                      Security Audit
                    </div>
                  </div>
                </div>

                {/* Right: Score */}
                <div className="text-right">
                  <div className="flex items-baseline gap-2 justify-end">
                    <div className="text-5xl font-black text-white leading-none">
                      {badgeData.grade}
                    </div>
                    <div className="text-2xl font-bold text-white/90 leading-none">
                      {badgeData.score}%
                    </div>
                  </div>
                  <div className="text-white/80 text-xs font-bold mt-2 uppercase tracking-wider">
                    Security Score
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Square Card Badge */}
        <div className="card-premium p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-bold text-sm text-slate-900">Square Card Badge</h4>
              <p className="text-xs text-slate-500">Square format for websites and documentation</p>
            </div>
            {currentAudit && (
              <button
                onClick={() => handleCopy(getEmbedCode('square'), 'square')}
                className="px-4 h-9 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
              >
                {copied === 'square' ? (
                  <>
                    <Check size={14} className="text-emerald-600" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    Copy Embed
                  </>
                )}
              </button>
            )}
          </div>

          <div className="flex justify-center p-6 bg-slate-50 rounded-lg">
            {/* Square Badge Preview */}
            <div
              className="w-64 rounded-2xl shadow-2xl overflow-hidden"
              style={{
                backgroundColor: color,
                boxShadow: `0 8px 32px ${color}40`
              }}
            >
              <div className="p-6 text-center space-y-4">
                {/* Logos */}
                <div className="flex items-center justify-center gap-2">
                  <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm p-2 flex items-center justify-center">
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
                      <div className="text-white/40 text-xl font-black">×</div>
                      <div className="w-12 h-12 rounded-xl bg-white p-2 flex items-center justify-center shadow">
                        <img src={logoUrl} alt="Project" className="w-full h-full object-contain" />
                      </div>
                    </>
                  )}
                </div>

                {/* Project Name */}
                <div>
                  <div className="text-white text-lg font-bold uppercase tracking-wide">
                    {projectName}
                  </div>
                  <div className="text-white/70 text-xs font-medium mt-1">
                    Security Audit
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-white/20"></div>

                {/* Score */}
                <div>
                  <div className="flex items-baseline gap-2 justify-center">
                    <div className="text-6xl font-black text-white leading-none">
                      {badgeData.grade}
                    </div>
                    <div className="text-3xl font-bold text-white/90 leading-none">
                      {badgeData.score}%
                    </div>
                  </div>
                  <div className="text-white/80 text-xs font-bold mt-2 uppercase tracking-wider">
                    Security Score
                  </div>
                </div>

                {/* Shield Icon */}
                <div className="flex justify-center">
                  <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
                    <Shield size={20} className="text-white" fill="white" fillOpacity={0.2} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {!currentAudit && (
          <p className="text-center text-sm text-slate-400 mt-4">
            Complete an audit to enable embed codes and actual security scores
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
