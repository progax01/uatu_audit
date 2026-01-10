import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    MessageCircleQuestion,
    AlertTriangle,
    CheckCircle,
    ChevronDown,
    ChevronUp,
    Clock,
    Send,
    SkipForward,
    Loader2,
    FileCode,
    Scale
} from 'lucide-react'
import logo from '../assets/logo.svg'

// ============================================================================
// TYPES
// ============================================================================

type ClarificationPhase = 'pre_audit' | 'post_audit'
type ClarificationStatus = 'pending' | 'answered' | 'skipped' | 'resolved'

interface ClarificationOption {
    label: string
    value: string
    risk: 'low' | 'medium' | 'high' | 'critical'
    scoreImpact?: number
    description?: string
}

interface ClarificationContext {
    file?: string
    line?: number
    findingId?: string
    snippet?: string
    category?: string
}

interface Clarification {
    id: string
    phase: ClarificationPhase
    questionKey: string
    questionText: string
    questionType: 'text' | 'select' | 'confirm' | 'multiselect'
    options?: ClarificationOption[]
    context?: ClarificationContext
    status: ClarificationStatus
    answerValue?: unknown
    scoreImpact?: { before: number; after: number; section: string }
    answeredAt?: string
    createdAt: string
}

interface ClarificationCounts {
    pending: number
    answered: number
    skipped: number
    total: number
}

interface AuditClarificationsProps {
    jobId: string
    projectName: string
    phase?: ClarificationPhase
    onComplete: () => void
    onBack: () => void
    onHomeClick: () => void
}

// ============================================================================
// CONSTANTS
// ============================================================================

const RISK_COLORS: Record<string, string> = {
    low: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    high: 'bg-orange-100 text-orange-700 border-orange-200',
    critical: 'bg-rose-100 text-rose-700 border-rose-200'
}

const PHASE_CONFIG = {
    pre_audit: {
        title: 'Pre-Audit Clarifications',
        subtitle: 'Help us understand your project before scoring',
        icon: MessageCircleQuestion,
        color: 'indigo'
    },
    post_audit: {
        title: 'Challenge Findings',
        subtitle: 'Dispute or provide context for audit findings',
        icon: Scale,
        color: 'amber'
    }
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function AuditClarifications({
    jobId,
    projectName,
    phase = 'pre_audit',
    onComplete,
    onBack: _onBack,
    onHomeClick
}: AuditClarificationsProps) {
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState<string | null>(null)
    const [clarifications, setClarifications] = useState<Clarification[]>([])
    const [counts, setCounts] = useState<ClarificationCounts>({ pending: 0, answered: 0, skipped: 0, total: 0 })
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [answers, setAnswers] = useState<Map<string, unknown>>(new Map())
    const [error, setError] = useState<string | null>(null)

    const config = PHASE_CONFIG[phase]

    // ─────────────────────────────────────────────────────────────────────────
    // FETCH CLARIFICATIONS
    // ─────────────────────────────────────────────────────────────────────────

    useEffect(() => {
        fetchClarifications()
    }, [jobId, phase])

    const fetchClarifications = async () => {
        setLoading(true)
        setError(null)

        try {
            const res = await fetch(`/jobs/${jobId}/clarifications?phase=${phase}`)
            const data = await res.json()

            if (data.ok) {
                setClarifications(data.clarifications || [])
                setCounts(data.counts || { pending: 0, answered: 0, skipped: 0, total: 0 })

                // Expand first pending
                const firstPending = data.clarifications?.find((c: Clarification) => c.status === 'pending')
                if (firstPending) setExpandedId(firstPending.id)
            } else {
                setError(data.error || 'Failed to load clarifications')
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load clarifications')
        } finally {
            setLoading(false)
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ACTIONS
    // ─────────────────────────────────────────────────────────────────────────

    const handleAnswer = (clarificationId: string, value: unknown) => {
        setAnswers(prev => new Map(prev).set(clarificationId, value))
    }

    const submitAnswer = async (clarificationId: string) => {
        const answer = answers.get(clarificationId)
        if (answer === undefined) return

        setSubmitting(clarificationId)
        setError(null)

        try {
            const res = await fetch(`/jobs/${jobId}/clarifications/${clarificationId}/answer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ answer })
            })

            const data = await res.json()
            if (data.ok) {
                setCounts(data.counts)
                setClarifications(prev =>
                    prev.map(c => c.id === clarificationId ? data.clarification : c)
                )

                // Move to next pending
                const next = clarifications.find(c => c.status === 'pending' && c.id !== clarificationId)
                setExpandedId(next?.id || null)

                // Check if all done
                if (data.counts.pending === 0) {
                    setTimeout(onComplete, 500)
                }
            } else {
                setError(data.error)
            }
        } catch (err: any) {
            setError(err.message)
        } finally {
            setSubmitting(null)
        }
    }

    const skipClarification = async (clarificationId: string) => {
        setSubmitting(clarificationId)

        try {
            const res = await fetch(`/jobs/${jobId}/clarifications/${clarificationId}/skip`, {
                method: 'POST'
            })

            const data = await res.json()
            if (data.ok) {
                setCounts(data.counts)
                setClarifications(prev =>
                    prev.map(c => c.id === clarificationId ? data.clarification : c)
                )

                const next = clarifications.find(c => c.status === 'pending' && c.id !== clarificationId)
                setExpandedId(next?.id || null)
            }
        } catch (err: any) {
            setError(err.message)
        } finally {
            setSubmitting(null)
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center">
                <Loader2 className="w-12 h-12 text-slate-400 animate-spin mb-4" />
                <p className="text-slate-500 font-semibold">Loading clarifications...</p>
            </div>
        )
    }

    if (clarifications.length === 0) {
        return (
            <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center text-center px-6">
                <CheckCircle className="w-16 h-16 text-emerald-500 mb-6" />
                <h2 className="text-2xl font-bold text-slate-900 mb-2">No Clarifications Needed</h2>
                <p className="text-slate-500 mb-8 max-w-md">
                    Your project analysis is complete. No additional information is required at this time.
                </p>
                <button
                    onClick={onComplete}
                    className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors"
                >
                    Continue
                </button>
            </div>
        )
    }

    const pendingClarifications = clarifications.filter(c => c.status === 'pending')
    const answeredClarifications = clarifications.filter(c => c.status !== 'pending')

    return (
        <div className="min-h-screen bg-[#F8FAFC]">
            {/* Header */}
            <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-50">
                <div className="flex items-center gap-6">
                    <button onClick={onHomeClick} className="hover:opacity-80 transition-opacity">
                        <img src={logo} alt="Uatu" className="h-8" />
                    </button>
                    <div className="h-6 w-px bg-slate-200" />
                    <div>
                        <h1 className="text-lg font-bold text-slate-900">{projectName}</h1>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{config.title}</p>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Progress</p>
                        <p className="text-lg font-bold text-slate-900">
                            {counts.answered + counts.skipped} / {counts.total}
                        </p>
                    </div>
                    <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-emerald-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${((counts.answered + counts.skipped) / Math.max(counts.total, 1)) * 100}%` }}
                        />
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 py-12">
                {/* Intro */}
                <div className="mb-10">
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-${config.color}-50 text-${config.color}-600 mb-4`}>
                        <config.icon className="w-4 h-4" />
                        <span className="text-sm font-bold">{phase === 'pre_audit' ? 'Pre-Audit' : 'Post-Audit'}</span>
                    </div>
                    <h2 className="text-3xl font-bold text-slate-900 mb-2">{config.title}</h2>
                    <p className="text-slate-500">{config.subtitle}</p>
                </div>

                {/* Error */}
                {error && (
                    <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                        {error}
                    </div>
                )}

                {/* Pending Clarifications */}
                {pendingClarifications.length > 0 && (
                    <section className="mb-12">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            Pending ({pendingClarifications.length})
                        </h3>

                        <div className="space-y-4">
                            {pendingClarifications.map(clarification => (
                                <ClarificationCard
                                    key={clarification.id}
                                    clarification={clarification}
                                    isExpanded={expandedId === clarification.id}
                                    onToggle={() => setExpandedId(expandedId === clarification.id ? null : clarification.id)}
                                    currentAnswer={answers.get(clarification.id)}
                                    onAnswer={(value) => handleAnswer(clarification.id, value)}
                                    onSubmit={() => submitAnswer(clarification.id)}
                                    onSkip={() => skipClarification(clarification.id)}
                                    isSubmitting={submitting === clarification.id}
                                />
                            ))}
                        </div>
                    </section>
                )}

                {/* Answered Clarifications */}
                {answeredClarifications.length > 0 && (
                    <section>
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <CheckCircle className="w-4 h-4" />
                            Completed ({answeredClarifications.length})
                        </h3>

                        <div className="space-y-3">
                            {answeredClarifications.map(clarification => (
                                <div
                                    key={clarification.id}
                                    className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-4">
                                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                                        <div>
                                            <p className="font-semibold text-slate-900">{clarification.questionText}</p>
                                            <p className="text-sm text-slate-500">
                                                {clarification.status === 'skipped' ? 'Skipped' : `Answered: ${JSON.stringify(clarification.answerValue)}`}
                                            </p>
                                        </div>
                                    </div>
                                    {clarification.scoreImpact && (
                                        <div className="text-right">
                                            <p className="text-xs font-semibold text-slate-400 uppercase">Score Impact</p>
                                            <p className={`font-bold ${clarification.scoreImpact.after > clarification.scoreImpact.before ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {clarification.scoreImpact.after - clarification.scoreImpact.before > 0 ? '+' : ''}
                                                {clarification.scoreImpact.after - clarification.scoreImpact.before}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* All Done */}
                {counts.pending === 0 && (
                    <div className="mt-12 text-center">
                        <button
                            onClick={onComplete}
                            className="bg-slate-900 text-white px-10 py-4 rounded-xl font-bold text-lg hover:bg-slate-800 transition-colors inline-flex items-center gap-3"
                        >
                            Continue to Results
                            <CheckCircle className="w-5 h-5" />
                        </button>
                    </div>
                )}
            </main>
        </div>
    )
}

// ============================================================================
// CLARIFICATION CARD COMPONENT
// ============================================================================

interface ClarificationCardProps {
    clarification: Clarification
    isExpanded: boolean
    onToggle: () => void
    currentAnswer: unknown
    onAnswer: (value: unknown) => void
    onSubmit: () => void
    onSkip: () => void
    isSubmitting: boolean
}

function ClarificationCard({
    clarification,
    isExpanded,
    onToggle,
    currentAnswer,
    onAnswer,
    onSubmit,
    onSkip,
    isSubmitting
}: ClarificationCardProps) {
    const hasAnswer = currentAnswer !== undefined

    return (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            {/* Header */}
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50 transition-colors"
            >
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                        <MessageCircleQuestion className="w-5 h-5" />
                    </div>
                    <div>
                        {clarification.context?.category && (
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                                {clarification.context.category.replace(/_/g, ' ')}
                            </p>
                        )}
                        <p className="font-semibold text-slate-900">{clarification.questionText}</p>
                    </div>
                </div>
                {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                )}
            </button>

            {/* Content */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="px-6 pb-6 border-t border-slate-100 pt-4">
                            {/* Context */}
                            {clarification.context?.file && (
                                <div className="mb-4 flex items-center gap-2 text-sm text-slate-500">
                                    <FileCode className="w-4 h-4" />
                                    <span className="font-mono">{clarification.context.file}</span>
                                    {clarification.context.line && (
                                        <span className="text-slate-400">:L{clarification.context.line}</span>
                                    )}
                                </div>
                            )}

                            {clarification.context?.snippet && (
                                <pre className="mb-4 p-4 bg-slate-900 text-slate-100 rounded-xl text-sm overflow-x-auto">
                                    <code>{clarification.context.snippet}</code>
                                </pre>
                            )}

                            {/* Options */}
                            {clarification.options && clarification.options.length > 0 && (
                                <div className="space-y-2 mb-6">
                                    {clarification.options.map(option => (
                                        <button
                                            key={option.value}
                                            onClick={() => onAnswer(option.value)}
                                            className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left ${currentAnswer === option.value
                                                ? 'border-indigo-500 bg-indigo-50'
                                                : 'border-slate-200 hover:border-slate-300'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${currentAnswer === option.value
                                                    ? 'border-indigo-500 bg-indigo-500'
                                                    : 'border-slate-300'
                                                    }`}>
                                                    {currentAnswer === option.value && (
                                                        <div className="w-2 h-2 rounded-full bg-white" />
                                                    )}
                                                </div>
                                                <span className="font-medium text-slate-900">{option.label}</span>
                                            </div>
                                            <span className={`text-xs font-bold uppercase px-2 py-1 rounded border ${RISK_COLORS[option.risk]}`}>
                                                {option.risk}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Text Input */}
                            {clarification.questionType === 'text' && !clarification.options && (
                                <textarea
                                    value={(currentAnswer as string) || ''}
                                    onChange={(e) => onAnswer(e.target.value)}
                                    placeholder="Type your response..."
                                    rows={3}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 resize-none mb-4"
                                />
                            )}

                            {/* Actions */}
                            <div className="flex items-center justify-between">
                                <button
                                    onClick={onSkip}
                                    disabled={isSubmitting}
                                    className="flex items-center gap-2 text-slate-400 hover:text-slate-600 font-medium transition-colors"
                                >
                                    <SkipForward className="w-4 h-4" />
                                    Skip
                                </button>

                                <button
                                    onClick={onSubmit}
                                    disabled={!hasAnswer || isSubmitting}
                                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-colors ${hasAnswer && !isSubmitting
                                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                        }`}
                                >
                                    {isSubmitting ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Send className="w-4 h-4" />
                                    )}
                                    Submit
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
