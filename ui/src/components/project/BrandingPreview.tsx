import { useState } from 'react'
import { Copy, Check, ExternalLink, Eye, Code, Award, Shield, TrendingUp } from 'lucide-react'

interface BrandingPreviewProps {
  logoUrl?: string
  primaryColor?: string
  projectName: string
  score?: number
  grade?: string
}

export function BrandingPreviewCard({ logoUrl, primaryColor, projectName, score, grade }: BrandingPreviewProps) {
  const brandColor = primaryColor || '#5C61FF'

  // Get ribbon color based on grade
  const getRibbonColor = () => {
    if (!grade) return brandColor

    const gradeUpper = grade.toUpperCase()
    if (gradeUpper.startsWith('A')) return '#10b981' // Green
    if (gradeUpper.startsWith('B')) return '#3b82f6' // Blue
    if (gradeUpper.startsWith('C')) return '#f59e0b' // Amber
    if (gradeUpper.startsWith('D')) return '#f97316' // Orange
    return '#ef4444' // Red (F)
  }

  // Check if color is light or dark
  const isLightColor = (color: string) => {
    const hex = color.replace('#', '')
    const r = parseInt(hex.substr(0, 2), 16)
    const g = parseInt(hex.substr(2, 2), 16)
    const b = parseInt(hex.substr(4, 2), 16)
    const brightness = (r * 299 + g * 587 + b * 114) / 1000
    return brightness > 155
  }

  const ribbonColor = getRibbonColor()
  const displayScore = grade || '---'
  const isLight = isLightColor(brandColor)
  const bgColor = isLight ? '#e2e8f0' : '#f8fafc' // Darker bg for light colors, lighter bg for dark colors

  return (
    <div className="bg-white rounded-2xl border-2 border-slate-100 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Eye size={16} className="text-indigo-600" />
        <h4 className="text-xs font-bold text-slate-900">Branding Preview</h4>
      </div>

      {/* Hero-style preview with large logos */}
      <div
        className="relative rounded-xl overflow-hidden border-2 border-slate-200 aspect-[1.91/1]"
        style={{ backgroundColor: bgColor }}
      >
        {/* Mascot watermark in background */}
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
          <img
            src="/mascot.png"
            alt=""
            className="w-full h-full object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        </div>

        {/* Main content - hero centered */}
        <div className="relative h-full flex flex-col items-center justify-center p-8">
          {/* Large Logos row */}
          <div className="flex items-center gap-5 mb-6">
            {/* Uatu logo - large rectangle with logo.svg */}
            <div
              className="w-32 h-28 rounded-2xl flex items-center justify-center shadow-xl relative"
              style={{
                backgroundColor: brandColor,
                boxShadow: `0 10px 40px ${brandColor}40`
              }}
            >
              <img
                src="/logo.svg"
                alt="Uatu"
                className="w-20 h-20 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            </div>

            {logoUrl && (
              <>
                {/* Multiplication symbol */}
                <div
                  className="text-4xl font-black opacity-30"
                  style={{ color: brandColor }}
                >
                  ×
                </div>
                {/* Project logo - large square */}
                <div className="w-28 h-28 rounded-2xl bg-white shadow-xl flex items-center justify-center p-3">
                  <img
                    src={logoUrl}
                    alt="Project"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                </div>
              </>
            )}
          </div>

          {/* Project name - large and bold */}
          <h2 className="text-4xl font-black text-slate-900 mb-4 text-center leading-tight tracking-tight">
            {projectName || 'Your Project'}
          </h2>

          {/* Security Audit badge with score */}
          <div className="flex items-center gap-4">
            <div
              className="px-6 py-2.5 rounded-full text-xs font-bold text-white uppercase tracking-widest shadow-lg"
              style={{ backgroundColor: brandColor }}
            >
              SECURITY AUDIT
            </div>
            {/* Score Display */}
            {grade && score !== undefined ? (
              <div
                className="px-6 py-2.5 rounded-xl font-black text-white shadow-lg flex items-baseline gap-2"
                style={{ backgroundColor: ribbonColor }}
              >
                <span className="text-2xl leading-none">{displayScore}</span>
                <span className="text-sm leading-none opacity-90">{score}%</span>
              </div>
            ) : (
              <div
                className="px-6 py-2.5 rounded-xl font-black text-white shadow-lg flex items-baseline gap-2"
                style={{ backgroundColor: brandColor, opacity: 0.5 }}
              >
                <span className="text-2xl leading-none">--</span>
                <span className="text-sm leading-none opacity-90">--%</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="text-[10px] text-slate-400 mt-2 text-center">
        Meta image / OG preview
      </p>
    </div>
  )
}

interface PublicProfileCardProps {
  projectId: string
  projectSlug: string
  isPublic: boolean
  selectedAuditId?: string
}

export function PublicProfileCard({ projectId, projectSlug, isPublic, selectedAuditId }: PublicProfileCardProps) {
  const [copied, setCopied] = useState<string | null>(null)

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      setTimeout(() => setCopied(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const baseUrl = window.location.origin
  const publicUrl = selectedAuditId ? `${baseUrl}/public-audits/${selectedAuditId}` : ''
  const badgeUrl = `${baseUrl}/badge/${projectSlug}`

  return (
    <div className="bg-white rounded-2xl border-2 border-slate-100 p-5">
      <div className="flex items-center gap-2 mb-3">
        <ExternalLink size={16} className="text-indigo-600" />
        <h4 className="text-xs font-bold text-slate-900">Public Profile & Sharing</h4>
      </div>

      {!isPublic ? (
        <div className="relative overflow-hidden rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center min-h-[200px] flex items-center justify-center">
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-slate-200 mx-auto mb-2 flex items-center justify-center">
              <Shield size={20} className="text-slate-400" />
            </div>
            <p className="text-xs font-bold text-slate-900 mb-1">Badge is Private</p>
            <p className="text-[10px] text-slate-500 max-w-[180px] mx-auto leading-relaxed">
              Enable public visibility in Badge tab
            </p>
          </div>
        </div>
      ) : !selectedAuditId ? (
        <div className="relative overflow-hidden rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center min-h-[200px] flex items-center justify-center">
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-slate-200 mx-auto mb-2 flex items-center justify-center">
              <Shield size={20} className="text-slate-400" />
            </div>
            <p className="text-xs font-bold text-slate-900 mb-1">No Audit Selected</p>
            <p className="text-[10px] text-slate-500 max-w-[180px] mx-auto leading-relaxed">
              Select an audit in Badge tab to generate URLs
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {/* Public Audit URL */}
          <div>
            <label className="text-[10px] font-bold text-slate-600 mb-1.5 block uppercase tracking-wider">Public Audit</label>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={publicUrl}
                readOnly
                className="flex-1 px-2.5 py-2 bg-slate-50 rounded-lg border border-slate-200 text-[10px] font-mono text-slate-600 truncate focus:outline-none"
              />
              <button
                onClick={() => copyToClipboard(publicUrl, 'url')}
                className="p-2 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors"
                title="Copy URL"
              >
                {copied === 'url' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              </button>
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors"
                title="View"
              >
                <ExternalLink size={14} />
              </a>
            </div>
          </div>

          {/* Badge URL */}
          <div>
            <label className="text-[10px] font-bold text-slate-600 mb-1.5 block uppercase tracking-wider">Badge Image</label>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={badgeUrl}
                readOnly
                className="flex-1 px-2.5 py-2 bg-slate-50 rounded-lg border border-slate-200 text-[10px] font-mono text-slate-600 truncate focus:outline-none"
              />
              <button
                onClick={() => copyToClipboard(badgeUrl, 'badge')}
                className="p-2 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors"
                title="Copy"
              >
                {copied === 'badge' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface MetaTagsPreviewCardProps {
  projectName: string
  selectedAuditId?: string
  grade?: string
  score?: number
  severityCounts?: {
    critical: number
    high: number
    medium: number
    low: number
  }
  componentScores?: Array<{ library: string; grade: string }>
}

export function MetaTagsPreviewCard({
  projectName,
  selectedAuditId,
  grade,
  score,
  severityCounts,
  componentScores
}: MetaTagsPreviewCardProps) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  if (!selectedAuditId) {
    return (
      <div className="bg-white rounded-2xl border-2 border-slate-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Code size={18} className="text-indigo-600" />
          <h4 className="text-sm font-bold text-slate-900">Link Preview (OG Image)</h4>
        </div>
        <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-slate-100 p-6 text-center">
          <div className="absolute inset-0 opacity-[0.03]">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-8 border-slate-400 rounded-full"></div>
          </div>
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-slate-200 mx-auto mb-3 flex items-center justify-center">
              <Code size={24} className="text-slate-400" />
            </div>
            <p className="text-sm font-bold text-slate-900 mb-1">No Preview Available</p>
            <p className="text-xs text-slate-600 max-w-xs mx-auto">
              Complete an audit to see how your badge appears when shared on social media
            </p>
          </div>
        </div>
      </div>
    )
  }

  const baseUrl = window.location.origin
  const publicUrl = `${baseUrl}/public-audits/${selectedAuditId}`
  const ogImageUrl = `${baseUrl}/og-images/${selectedAuditId}.png`

  // Build description
  const statusParts = []
  if (severityCounts) {
    if (severityCounts.critical > 0) statusParts.push(`${severityCounts.critical} Critical`)
    if (severityCounts.high > 0) statusParts.push(`${severityCounts.high} High`)
    if (severityCounts.medium > 0) statusParts.push(`${severityCounts.medium} Medium`)
    if (severityCounts.low > 0) statusParts.push(`${severityCounts.low} Low`)
  }

  const componentSummary = componentScores?.slice(0, 3)
    .map(c => `${c.library} (${c.grade})`)
    .join(', ') || ''

  const description = [
    statusParts.join(' • '),
    componentSummary && `Top components: ${componentSummary}`,
    'AI-powered security analysis by Uatu'
  ].filter(Boolean).join(' • ')

  const title = `${projectName} - Security Audit Report | ${grade || 'N/A'} Grade${score !== undefined ? ` (${score}%)` : ''} | Uatu`

  const metaTags = `<!-- Open Graph -->
<meta property="og:type" content="article" />
<meta property="og:url" content="${publicUrl}" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:image" content="${ogImageUrl}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="${title}" />

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:url" content="${publicUrl}" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${description}" />
<meta name="twitter:image" content="${ogImageUrl}" />
<meta name="twitter:image:alt" content="${title}" />`

  return (
    <div className="bg-white rounded-2xl border-2 border-slate-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ExternalLink size={18} className="text-indigo-600" />
          <h4 className="text-sm font-bold text-slate-900">Link Preview (OG Image)</h4>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
        >
          {expanded ? 'Hide Code' : 'Show Code'}
        </button>
      </div>

      {/* Social media preview showing the OG image */}
      <div className="mb-4">
        <div className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
          How it looks when shared
        </div>
        <div className="border-2 border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
          <div className="relative bg-slate-100 aspect-[1.91/1]">
            <img
              src={ogImageUrl}
              alt="OG Preview"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"%3E%3Crect fill="%23667eea" width="1200" height="630"/%3E%3Ctext fill="%23fff" x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="24"%3EOG Image Preview%3C/text%3E%3C/svg%3E'
              }}
            />
          </div>
          <div className="p-3 border-t-2 border-slate-100">
            <div className="text-sm font-bold text-slate-900 truncate mb-0.5">{title}</div>
            <div className="text-xs text-slate-500 truncate">{description}</div>
            <div className="text-xs text-slate-400 mt-1 truncate">{publicUrl}</div>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="relative mt-4">
          <div className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Meta Tags Code</div>
          <pre className="bg-slate-900 text-slate-300 p-4 rounded-xl text-xs overflow-x-auto font-mono max-h-64">
            {metaTags}
          </pre>
          <button
            onClick={() => copyToClipboard(metaTags)}
            className="absolute top-8 right-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-lg"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
      )}
    </div>
  )
}

interface BadgePreviewCardProps {
  projectSlug: string
  projectName: string
  score?: number
  grade?: string
  primaryColor?: string
  logoUrl?: string
}

export function BadgePreviewCard({ projectSlug, projectName, score, grade, primaryColor, logoUrl }: BadgePreviewCardProps) {
  const [copied, setCopied] = useState<string | null>(null)

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      setTimeout(() => setCopied(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const baseUrl = window.location.origin
  const badgeUrl = `${baseUrl}/badge/${projectSlug}`
  const profileUrl = `${baseUrl}/project/${projectSlug}`

  const markdownCode = `[![Uatu Audit Score](${badgeUrl})](${profileUrl})`
  const htmlCode = `<a href="${profileUrl}"><img src="${badgeUrl}" alt="Uatu Audit Score" /></a>`

  const displayScore = score !== undefined ? score : '---'
  const displayGrade = grade || '?'

  return (
    <div className="bg-white rounded-2xl border-2 border-slate-100 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Award size={18} className="text-indigo-600" />
        <h4 className="text-sm font-bold text-slate-900">Badge Preview & Embed</h4>
      </div>

      {/* Live Badge Preview - Clean horizontal badge */}
      <div className="mb-6 p-6 relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100">
        {/* Mascot watermark */}
        <div className="absolute right-0 top-0 opacity-[0.04] pointer-events-none">
          <img
            src="/mascot.png"
            alt=""
            className="w-32 h-32 object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        </div>

        <div className="relative z-10 flex justify-center">
          {/* The actual badge - horizontal design */}
          <div
            className="inline-flex items-center gap-4 px-6 py-4 rounded-2xl shadow-xl"
            style={{ backgroundColor: primaryColor || '#5C61FF' }}
          >
            {/* Left side - Logo */}
            <div className="flex items-center gap-2.5">
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm p-2 flex items-center justify-center">
                <img
                  src="/logo.svg"
                  alt="Uatu"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              </div>
              {logoUrl && (
                <>
                  <div className="text-white/30 text-xl font-black">×</div>
                  <div className="w-12 h-12 rounded-xl bg-white p-2 flex items-center justify-center">
                    <img src={logoUrl} alt="Project" className="w-full h-full object-contain" />
                  </div>
                </>
              )}
            </div>

            {/* Divider */}
            <div className="w-px h-14 bg-white/20"></div>

            {/* Right side - Score info */}
            <div className="text-left">
              <div className="text-white/90 text-xs font-bold uppercase tracking-wider mb-1">
                {projectName}
              </div>
              <div className="flex items-baseline gap-2">
                <div className="text-4xl font-black text-white">
                  {displayGrade}
                </div>
                <div className="text-xl font-bold text-white/90">
                  {typeof displayScore === 'number' ? `${displayScore}%` : displayScore}
                </div>
              </div>
              <div className="text-white/80 text-xs font-bold mt-0.5">
                Uatu Security Score
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Embed Codes */}
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-slate-700">Markdown</label>
            <button
              onClick={() => copyToClipboard(markdownCode, 'markdown')}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              {copied === 'markdown' ? (
                <>
                  <Check size={12} />
                  Copied
                </>
              ) : (
                <>
                  <Copy size={12} />
                  Copy
                </>
              )}
            </button>
          </div>
          <pre className="bg-slate-900 text-slate-300 p-3 rounded-lg text-xs overflow-x-auto font-mono">
            {markdownCode}
          </pre>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-slate-700">HTML</label>
            <button
              onClick={() => copyToClipboard(htmlCode, 'html')}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              {copied === 'html' ? (
                <>
                  <Check size={12} />
                  Copied
                </>
              ) : (
                <>
                  <Copy size={12} />
                  Copy
                </>
              )}
            </button>
          </div>
          <pre className="bg-slate-900 text-slate-300 p-3 rounded-lg text-xs overflow-x-auto font-mono">
            {htmlCode}
          </pre>
        </div>
      </div>
    </div>
  )
}

interface ComponentScore {
  library: string
  version?: string
  score: number
  grade: string
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  findingsCount: {
    critical: number
    high: number
    medium: number
    low: number
    info: number
  }
}

interface ComponentScoresCardProps {
  componentScores: ComponentScore[]
}

export function ComponentScoresCard({ componentScores }: ComponentScoresCardProps) {
  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200'
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default: return 'bg-green-100 text-green-800 border-green-200'
    }
  }

  const getGradeColor = (grade: string) => {
    if (grade.startsWith('A')) return 'text-green-600'
    if (grade.startsWith('B')) return 'text-blue-600'
    if (grade.startsWith('C')) return 'text-yellow-600'
    if (grade.startsWith('D')) return 'text-orange-600'
    return 'text-red-600'
  }

  if (!componentScores || componentScores.length === 0) {
    return (
      <div className="bg-white rounded-2xl border-2 border-slate-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={18} className="text-indigo-600" />
          <h4 className="text-sm font-bold text-slate-900">Component Scores</h4>
        </div>
        <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-4 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-200 mx-auto mb-3 flex items-center justify-center">
            <TrendingUp size={20} className="text-slate-500" />
          </div>
          <p className="text-sm text-slate-500 font-medium">No component scores available yet</p>
          <p className="text-xs text-slate-400 mt-1">Run an audit to see individual dependency scores</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border-2 border-slate-100 p-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={18} className="text-indigo-600" />
        <h4 className="text-sm font-bold text-slate-900">Component Scores</h4>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {componentScores.map((component, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between p-3 bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border-2 border-slate-100 hover:border-indigo-300 hover:shadow-md transition-all"
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-slate-900 truncate">
                {component.library}
              </div>
              {component.version && (
                <div className="text-xs text-slate-500 font-mono">v{component.version}</div>
              )}
              <div className="flex items-center gap-1.5 mt-2">
                {component.findingsCount.critical > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-md bg-red-100 text-red-800 font-bold border border-red-200">
                    {component.findingsCount.critical} C
                  </span>
                )}
                {component.findingsCount.high > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-md bg-orange-100 text-orange-800 font-bold border border-orange-200">
                    {component.findingsCount.high} H
                  </span>
                )}
                {component.findingsCount.medium > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-md bg-yellow-100 text-yellow-800 font-bold border border-yellow-200">
                    {component.findingsCount.medium} M
                  </span>
                )}
                {component.findingsCount.low > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-bold border border-blue-200">
                    {component.findingsCount.low} L
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 ml-3">
              <div className="text-right">
                <div className={`text-2xl font-black ${getGradeColor(component.grade)}`}>
                  {component.grade}
                </div>
                <div className="text-xs text-slate-500 font-bold">{component.score}%</div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border-2 uppercase ${getRiskColor(component.riskLevel)}`}>
                {component.riskLevel}
              </span>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-500 mt-4 text-center">
        Individual scores for each dependency analyzed in your audit
      </p>
    </div>
  )
}
