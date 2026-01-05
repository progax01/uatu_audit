import { useState, useEffect } from 'react'
import {
  ArrowLeft,
  Shield,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  SkipForward
} from 'lucide-react'
import logo from '../assets/logo.svg'

type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

interface QuestionOption {
  value: string
  label: string
  risk: RiskLevel
  description?: string
}

interface PreAuditQuestion {
  id: string
  category: string
  componentId: string
  componentLabel: string
  question: string
  options?: QuestionOption[]
  freeform?: boolean
  suggestedScope: 'INTERNAL' | 'EXTERNAL'
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
  evidence: string
}

interface PreAuditAnswer {
  questionId: string
  selectedOption?: string
  freeformResponse?: string
  scopeOverride?: 'INTERNAL' | 'EXTERNAL'
  notes?: string
  answeredAt: string
}

interface Questionnaire {
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED'
  questions: PreAuditQuestion[]
  answers: PreAuditAnswer[]
}

interface PreAuditQuestionnaireProps {
  jobId?: number
  projectName: string
  onComplete: () => void
  onSkip: () => void
  onBack: () => void
  onHomeClick: () => void
}

const CATEGORY_ICONS: Record<string, { icon: any; color: string }> = {
  ADMIN_CUSTODY: { icon: Shield, color: 'text-purple-600 bg-purple-100' },
  ORACLE_TRUST: { icon: AlertTriangle, color: 'text-orange-600 bg-orange-100' },
  THIRD_PARTY_DEPS: { icon: AlertCircle, color: 'text-blue-600 bg-blue-100' },
  EXTERNAL_INTEGRATION: { icon: ExternalLink, color: 'text-green-600 bg-green-100' },
  MISSING_SOURCE: { icon: AlertCircle, color: 'text-red-600 bg-red-100' },
  CROSS_CHAIN: { icon: AlertTriangle, color: 'text-yellow-600 bg-yellow-100' }
}

const RISK_COLORS: Record<RiskLevel, string> = {
  LOW: 'bg-green-100 text-green-700 border-green-200',
  MEDIUM: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  HIGH: 'bg-orange-100 text-orange-700 border-orange-200',
  CRITICAL: 'bg-red-100 text-red-700 border-red-200'
}

export default function PreAuditQuestionnaire({
  jobId,
  projectName,
  onComplete,
  onSkip,
  onBack,
  onHomeClick
}: PreAuditQuestionnaireProps) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'submitting' | 'error' | 'waiting'>('loading')
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null)
  const [answers, setAnswers] = useState<Map<string, PreAuditAnswer>>(new Map())
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [showSkipConfirm, setShowSkipConfirm] = useState(false)

  useEffect(() => {
    if (jobId) {
      loadQuestionnaire()
    }
  }, [jobId])

  const loadQuestionnaire = async () => {
    setStatus('loading')
    setError(null)

    try {
      const res = await fetch(`/preaudit/questions/${jobId}`)
      const data = await res.json()

      if (data.status === 'pending' || data.status === 'generating') {
        // Questions still being generated, poll again
        setStatus('waiting')
        setTimeout(loadQuestionnaire, 3000)
        return
      }

      if (!data.questions || data.questions.length === 0) {
        // No questions needed, proceed directly
        onComplete()
        return
      }

      setQuestionnaire(data)

      // Load existing answers
      const answerMap = new Map<string, PreAuditAnswer>()
      for (const a of data.answers || []) {
        answerMap.set(a.questionId, a)
      }
      setAnswers(answerMap)

      // Expand first unanswered question
      const firstUnanswered = data.questions.find((q: PreAuditQuestion) => !answerMap.has(q.id))
      if (firstUnanswered) {
        setExpandedQuestions(new Set([firstUnanswered.id]))
      }

      setStatus('ready')
    } catch (err: any) {
      setError(err.message || 'Failed to load questionnaire')
      setStatus('error')
    }
  }

  const handleAnswer = (questionId: string, option: string) => {
    const newAnswer: PreAuditAnswer = {
      questionId,
      selectedOption: option,
      answeredAt: new Date().toISOString()
    }
    const newAnswers = new Map(answers)
    newAnswers.set(questionId, newAnswer)
    setAnswers(newAnswers)

    // Expand next question
    if (questionnaire) {
      const currentIndex = questionnaire.questions.findIndex(q => q.id === questionId)
      if (currentIndex < questionnaire.questions.length - 1) {
        const nextQuestion = questionnaire.questions[currentIndex + 1]
        setExpandedQuestions(new Set([nextQuestion.id]))
      }
    }
  }

  const handleScopeOverride = (questionId: string, scope: 'INTERNAL' | 'EXTERNAL') => {
    const existing = answers.get(questionId) || {
      questionId,
      answeredAt: new Date().toISOString()
    }
    const newAnswers = new Map(answers)
    newAnswers.set(questionId, { ...existing, scopeOverride: scope })
    setAnswers(newAnswers)
  }

  const handleNotes = (questionId: string, notes: string) => {
    const existing = answers.get(questionId) || {
      questionId,
      answeredAt: new Date().toISOString()
    }
    const newAnswers = new Map(answers)
    newAnswers.set(questionId, { ...existing, notes })
    setAnswers(newAnswers)
  }

  const toggleQuestion = (questionId: string) => {
    const newExpanded = new Set(expandedQuestions)
    if (newExpanded.has(questionId)) {
      newExpanded.delete(questionId)
    } else {
      newExpanded.add(questionId)
    }
    setExpandedQuestions(newExpanded)
  }

  const handleSubmit = async () => {
    if (!jobId) return

    setStatus('submitting')
    setError(null)

    try {
      const res = await fetch(`/preaudit/answers/${jobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: Array.from(answers.values())
        })
      })

      if (!res.ok) throw new Error('Failed to submit answers')

      onComplete()
    } catch (err: any) {
      setError(err.message || 'Failed to submit answers')
      setStatus('ready')
    }
  }

  const handleSkip = async () => {
    if (!jobId) return

    try {
      await fetch(`/preaudit/skip/${jobId}`, { method: 'POST' })
      onSkip()
    } catch {
      setError('Failed to skip questionnaire')
    }
  }

  const answeredCount = answers.size
  const totalCount = questionnaire?.questions.length || 0
  const highPriorityQuestions = questionnaire?.questions.filter(q => q.priority === 'HIGH') || []
  const answeredHighPriority = highPriorityQuestions.filter(q => answers.has(q.id)).length
  const canSubmit = answeredHighPriority >= highPriorityQuestions.length

  // Group questions by priority
  const groupedQuestions = questionnaire?.questions.reduce((acc, q) => {
    if (!acc[q.priority]) acc[q.priority] = []
    acc[q.priority].push(q)
    return acc
  }, {} as Record<string, PreAuditQuestion[]>) || {}

  if (status === 'loading' || status === 'waiting') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#0F3F62] animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            {status === 'waiting' ? 'Generating Questions...' : 'Loading...'}
          </h2>
          <p className="text-gray-500">
            {status === 'waiting'
              ? 'Analyzing your code to generate relevant questions'
              : 'Please wait'}
          </p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Error</h2>
          <p className="text-gray-500 mb-4">{error}</p>
          <button
            onClick={loadQuestionnaire}
            className="bg-[#0F3F62] text-white px-6 py-2 rounded-lg hover:bg-[#1a5a8a] transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-white relative overflow-hidden">
      {/* Tech Grid Background */}
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div
          className="w-full h-full"
          style={{
            backgroundImage: `
              linear-gradient(rgba(15, 63, 98, 0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(15, 63, 98, 0.03) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px'
          }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={onHomeClick}
            className="flex items-center hover:opacity-80 transition-opacity cursor-pointer bg-transparent border-none p-0"
          >
            <img src={logo} alt="Uatu Logo" className="h-10" />
          </button>

          {/* Progress Bar */}
          <div className="flex items-center gap-4">
            <div className="text-sm font-medium text-gray-600">
              {answeredCount}/{totalCount} answered
            </div>
            <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#0F3F62] transition-all duration-300"
                style={{ width: `${(answeredCount / Math.max(totalCount, 1)) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-8">
        {/* Back Button */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-500 hover:text-[#0F3F62] transition-colors mb-6 group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Back to Dashboard</span>
        </button>

        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#0F3F62] mb-2">
            Pre-Audit Questionnaire
          </h1>
          <p className="text-gray-500">
            Answer these questions to help us understand your project's risk profile for "{projectName}"
          </p>
          {highPriorityQuestions.length > 0 && (
            <p className="mt-2 text-sm text-amber-600">
              {highPriorityQuestions.length} required question{highPriorityQuestions.length !== 1 ? 's' : ''} must be answered before proceeding
            </p>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Questions by Priority */}
        {['HIGH', 'MEDIUM', 'LOW'].map(priority => {
          const questions = groupedQuestions[priority] || []
          if (questions.length === 0) return null

          return (
            <div key={priority} className="mb-8">
              <h2 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${
                priority === 'HIGH' ? 'text-red-700' :
                priority === 'MEDIUM' ? 'text-amber-700' : 'text-gray-600'
              }`}>
                {priority === 'HIGH' && <AlertTriangle className="w-5 h-5" />}
                {priority} Priority
                {priority === 'HIGH' && <span className="text-sm font-normal">(Required)</span>}
              </h2>

              <div className="space-y-4">
                {questions.map(question => {
                  const isExpanded = expandedQuestions.has(question.id)
                  const answer = answers.get(question.id)
                  const categoryConfig = CATEGORY_ICONS[question.category] || CATEGORY_ICONS.EXTERNAL_INTEGRATION
                  const CategoryIcon = categoryConfig.icon

                  return (
                    <div
                      key={question.id}
                      className={`border rounded-xl overflow-hidden transition-all ${
                        answer ? 'border-green-200 bg-green-50/30' : 'border-gray-200 bg-white'
                      }`}
                    >
                      {/* Question Header */}
                      <button
                        onClick={() => toggleQuestion(question.id)}
                        className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${categoryConfig.color}`}>
                            <CategoryIcon className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                                {question.category.replace(/_/g, ' ')}
                              </span>
                              {question.priority === 'HIGH' && (
                                <span className="text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                                  Required
                                </span>
                              )}
                            </div>
                            <h3 className="font-semibold text-gray-800">{question.question}</h3>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {answer && (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          )}
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </button>

                      {/* Question Content */}
                      {isExpanded && (
                        <div className="px-5 pb-5 pt-2 border-t border-gray-100">
                          {/* Component Label */}
                          <p className="text-sm text-gray-500 mb-4">
                            Related to: <span className="font-mono text-gray-700">{question.componentLabel}</span>
                          </p>

                          {/* Options */}
                          {question.options && (
                            <div className="space-y-2 mb-4">
                              {question.options.map(option => (
                                <button
                                  key={option.value}
                                  onClick={() => handleAnswer(question.id, option.value)}
                                  className={`w-full flex items-center justify-between p-4 rounded-lg border-2 transition-all text-left ${
                                    answer?.selectedOption === option.value
                                      ? 'border-[#0F3F62] bg-[#0F3F62]/5'
                                      : 'border-gray-200 hover:border-gray-300 bg-white'
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                      answer?.selectedOption === option.value
                                        ? 'border-[#0F3F62] bg-[#0F3F62]'
                                        : 'border-gray-300'
                                    }`}>
                                      {answer?.selectedOption === option.value && (
                                        <div className="w-2 h-2 rounded-full bg-white" />
                                      )}
                                    </div>
                                    <span className="font-medium text-gray-800">{option.label}</span>
                                  </div>
                                  <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${RISK_COLORS[option.risk]}`}>
                                    {option.risk}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Scope Override */}
                          <div className="flex items-center gap-4 mb-4">
                            <span className="text-sm font-medium text-gray-600">Scope:</span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleScopeOverride(question.id, 'INTERNAL')}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                  (answer?.scopeOverride || question.suggestedScope) === 'INTERNAL'
                                    ? 'bg-[#0F3F62] text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                              >
                                Internal
                              </button>
                              <button
                                onClick={() => handleScopeOverride(question.id, 'EXTERNAL')}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                  (answer?.scopeOverride || question.suggestedScope) === 'EXTERNAL'
                                    ? 'bg-[#0F3F62] text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                              >
                                External
                              </button>
                            </div>
                          </div>

                          {/* Notes */}
                          <div className="mb-4">
                            <label className="text-sm font-medium text-gray-600 mb-2 block">
                              Additional Notes (optional)
                            </label>
                            <textarea
                              value={answer?.notes || ''}
                              onChange={(e) => handleNotes(question.id, e.target.value)}
                              placeholder="Any additional context..."
                              rows={2}
                              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-[#0F3F62] focus:ring-2 focus:ring-[#0F3F62]/20 resize-none"
                            />
                          </div>

                          {/* Evidence */}
                          <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Evidence</p>
                            <p className="text-sm text-gray-600">{question.evidence}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-8 border-t border-gray-200 mt-8">
          <button
            onClick={() => setShowSkipConfirm(true)}
            className="flex items-center gap-2 text-gray-500 hover:text-red-600 font-medium transition-colors"
          >
            <SkipForward className="w-5 h-5" />
            Skip All Questions
          </button>

          <button
            onClick={handleSubmit}
            disabled={!canSubmit || status === 'submitting'}
            className={`
              flex items-center gap-2 px-8 py-3 rounded-lg font-semibold text-lg transition-all duration-200
              ${canSubmit && status !== 'submitting'
                ? 'bg-[#0F3F62] text-white hover:bg-[#1a5a8a] shadow-lg shadow-[#0F3F62]/30'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }
            `}
          >
            {status === 'submitting' ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                Save & Start Audit
                <CheckCircle className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Skip Confirmation Modal */}
      {showSkipConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-xl font-bold text-gray-800 mb-2">Skip All Questions?</h3>
            <p className="text-gray-600 mb-6">
              Skipping the questionnaire means the audit will proceed with default assumptions.
              This may affect the accuracy of liability attribution.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSkipConfirm(false)}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={handleSkip}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
              >
                Skip & Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
