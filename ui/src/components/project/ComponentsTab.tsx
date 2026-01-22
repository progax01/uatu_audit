import { useState, useEffect } from 'react'
import { Loader2, Package, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { authFetch } from '../../services/authService'

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

interface ComponentsTabProps {
    projectId: string
}

export default function ComponentsTab({ projectId }: ComponentsTabProps) {
    const [componentScores, setComponentScores] = useState<ComponentScore[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetchComponentScores()
    }, [projectId])

    const fetchComponentScores = async () => {
        setLoading(true)
        setError(null)
        try {
            // Fetch latest completed audit
            const res = await authFetch(`/api/projects/${projectId}/audits`)
            if (res.ok) {
                const data = await res.json()
                const completedAudits = (data.audits || []).filter((a: any) => a.status === 'completed')

                if (completedAudits.length > 0) {
                    const latestAudit = completedAudits[0]

                    // Extract component scores from metadata
                    if (latestAudit.metadata?.dependencyScores) {
                        setComponentScores(latestAudit.metadata.dependencyScores)
                    } else {
                        setError('No component scores available for the latest audit')
                    }
                } else {
                    setError('No completed audits found. Run an audit to see component scores.')
                }
            } else {
                setError('Failed to fetch audits')
            }
        } catch (err) {
            console.error('Failed to fetch component scores:', err)
            setError('An error occurred while fetching component scores')
        } finally {
            setLoading(false)
        }
    }

    const getGradeColor = (grade: string) => {
        const gradeUpper = grade.toUpperCase()
        if (gradeUpper.startsWith('A')) return 'text-emerald-600 bg-emerald-50 border-emerald-200'
        if (gradeUpper.startsWith('B')) return 'text-blue-600 bg-blue-50 border-blue-200'
        if (gradeUpper.startsWith('C')) return 'text-amber-600 bg-amber-50 border-amber-200'
        if (gradeUpper.startsWith('D')) return 'text-orange-600 bg-orange-50 border-orange-200'
        return 'text-rose-600 bg-rose-50 border-rose-200' // F
    }

    const getRiskLevelBadge = (riskLevel: string) => {
        const config = {
            low: { color: 'text-emerald-700 bg-emerald-100 border-emerald-200', label: 'Low Risk' },
            medium: { color: 'text-amber-700 bg-amber-100 border-amber-200', label: 'Medium Risk' },
            high: { color: 'text-orange-700 bg-orange-100 border-orange-200', label: 'High Risk' },
            critical: { color: 'text-rose-700 bg-rose-100 border-rose-200', label: 'Critical Risk' }
        }

        return config[riskLevel as keyof typeof config] || config.medium
    }

    const getTrendIcon = (score: number) => {
        if (score >= 80) return <TrendingUp size={16} className="text-emerald-600" />
        if (score >= 60) return <Minus size={16} className="text-amber-600" />
        return <TrendingDown size={16} className="text-rose-600" />
    }

    if (loading) {
        return (
            <div className="bg-white rounded-2xl border-2 border-slate-100 p-12 text-center">
                <Loader2 size={40} className="animate-spin text-indigo-600 mx-auto mb-4" />
                <p className="text-sm text-slate-500">Loading component scores...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="bg-white rounded-2xl border-2 border-slate-100 p-12 text-center">
                <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                    <Package size={32} className="text-slate-300" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">No Component Scores</h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto">{error}</p>
            </div>
        )
    }

    if (componentScores.length === 0) {
        return (
            <div className="bg-white rounded-2xl border-2 border-slate-100 p-12 text-center">
                <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                    <Package size={32} className="text-slate-300" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">No Components Analyzed</h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto">
                    Complete an audit to see individual component security scores
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-2xl border-2 border-slate-100 p-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                        <Package className="text-purple-600" size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">Component Security Scores</h3>
                        <p className="text-sm text-slate-500">Individual security analysis for each component</p>
                    </div>
                </div>
                <div className="mt-4 flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                        <span className="text-slate-600">A-B Grade: Low Risk</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                        <span className="text-slate-600">C Grade: Medium Risk</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                        <span className="text-slate-600">D-F Grade: High Risk</span>
                    </div>
                </div>
            </div>

            {/* Components Grid */}
            <div className="grid gap-4">
                {componentScores.map((component, index) => {
                    const riskBadge = getRiskLevelBadge(component.riskLevel)
                    const totalFindings =
                        component.findingsCount.critical +
                        component.findingsCount.high +
                        component.findingsCount.medium +
                        component.findingsCount.low +
                        component.findingsCount.info

                    return (
                        <div key={index} className="bg-white rounded-2xl border-2 border-slate-100 p-6 hover:border-indigo-200 transition-colors">
                            <div className="flex items-start justify-between mb-4">
                                {/* Component Name */}
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h4 className="text-base font-bold text-slate-900">{component.library}</h4>
                                        {component.version && (
                                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-mono rounded">
                                                v{component.version}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-wider border rounded ${riskBadge.color}`}>
                                            {riskBadge.label}
                                        </span>
                                    </div>
                                </div>

                                {/* Score */}
                                <div className="text-right">
                                    <div className="flex items-center gap-2 mb-1">
                                        {getTrendIcon(component.score)}
                                        <span className={`text-3xl font-black ${getGradeColor(component.grade).split(' ')[0]}`}>
                                            {component.grade}
                                        </span>
                                    </div>
                                    <span className="text-sm font-bold text-slate-500">{component.score}%</span>
                                </div>
                            </div>

                            {/* Findings Breakdown */}
                            <div className="border-t border-slate-100 pt-4">
                                <div className="flex items-center justify-between text-xs mb-2">
                                    <span className="font-bold text-slate-600">Findings Breakdown</span>
                                    <span className="font-bold text-slate-900">{totalFindings} total</span>
                                </div>
                                <div className="grid grid-cols-5 gap-2">
                                    {component.findingsCount.critical > 0 && (
                                        <div className="bg-rose-50 border border-rose-200 rounded-lg p-2 text-center">
                                            <div className="text-lg font-black text-rose-700">{component.findingsCount.critical}</div>
                                            <div className="text-[10px] font-bold text-rose-600 uppercase">Critical</div>
                                        </div>
                                    )}
                                    {component.findingsCount.high > 0 && (
                                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-2 text-center">
                                            <div className="text-lg font-black text-orange-700">{component.findingsCount.high}</div>
                                            <div className="text-[10px] font-bold text-orange-600 uppercase">High</div>
                                        </div>
                                    )}
                                    {component.findingsCount.medium > 0 && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-center">
                                            <div className="text-lg font-black text-amber-700">{component.findingsCount.medium}</div>
                                            <div className="text-[10px] font-bold text-amber-600 uppercase">Medium</div>
                                        </div>
                                    )}
                                    {component.findingsCount.low > 0 && (
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-center">
                                            <div className="text-lg font-black text-blue-700">{component.findingsCount.low}</div>
                                            <div className="text-[10px] font-bold text-blue-600 uppercase">Low</div>
                                        </div>
                                    )}
                                    {component.findingsCount.info > 0 && (
                                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-center">
                                            <div className="text-lg font-black text-slate-700">{component.findingsCount.info}</div>
                                            <div className="text-[10px] font-bold text-slate-600 uppercase">Info</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
