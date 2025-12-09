import { useState } from 'react'
import { ChevronDown, ChevronRight, Brain, CheckCircle, AlertTriangle, Info } from 'lucide-react'

interface CoTStep {
  step: string
  observation: string
  hypothesis: string
  validation: string | string[]
  conclusion: string
  confidence?: number
  confidence_factors?: string[]
  related_finding?: string
}

interface CoTReasoningProps {
  reasoning: CoTStep[]
  metadata?: {
    total_steps: number
    avg_confidence: number
    reasoning_quality: 'high' | 'medium' | 'low'
  }
}

export default function CoTReasoning({ reasoning, metadata }: CoTReasoningProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set([0])) // First step expanded by default

  const toggleStep = (index: number) => {
    const newExpanded = new Set(expandedSteps)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedSteps(newExpanded)
  }

  const expandAll = () => {
    setExpandedSteps(new Set(reasoning.map((_, i) => i)))
  }

  const collapseAll = () => {
    setExpandedSteps(new Set())
  }

  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return 'text-gray-500'
    if (confidence >= 0.9) return 'text-green-600'
    if (confidence >= 0.75) return 'text-blue-600'
    if (confidence >= 0.5) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getConfidenceBgColor = (confidence?: number) => {
    if (!confidence) return 'bg-gray-100'
    if (confidence >= 0.9) return 'bg-green-50'
    if (confidence >= 0.75) return 'bg-blue-50'
    if (confidence >= 0.5) return 'bg-yellow-50'
    return 'bg-red-50'
  }

  const getQualityBadge = (quality?: 'high' | 'medium' | 'low') => {
    if (!quality) return null

    const config = {
      high: { bg: 'bg-green-100', text: 'text-green-700', label: 'High Quality' },
      medium: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Medium Quality' },
      low: { bg: 'bg-red-100', text: 'text-red-700', label: 'Low Quality' }
    }

    const c = config[quality]
    return (
      <span className={`${c.bg} ${c.text} px-2 py-1 rounded text-xs font-medium`}>
        {c.label}
      </span>
    )
  }

  if (!reasoning || reasoning.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <Brain className="w-6 h-6 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900">Chain-of-Thought Reasoning</h3>
        </div>
        <p className="text-gray-500 text-sm">
          No reasoning steps available yet. AI reasoning will appear here as the audit progresses.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Brain className="w-6 h-6 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900">Chain-of-Thought Reasoning</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="text-sm text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="text-sm text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Metadata Summary */}
      {metadata && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-gray-500 mb-1">Total Steps</div>
              <div className="text-2xl font-bold text-gray-900">{metadata.total_steps}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Avg Confidence</div>
              <div className={`text-2xl font-bold ${getConfidenceColor(metadata.avg_confidence)}`}>
                {(metadata.avg_confidence * 100).toFixed(0)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Quality</div>
              <div className="text-sm font-medium">
                {getQualityBadge(metadata.reasoning_quality)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reasoning Steps */}
      <div className="space-y-3">
        {reasoning.map((step, index) => {
          const isExpanded = expandedSteps.has(index)
          const validation = Array.isArray(step.validation) ? step.validation : [step.validation]

          return (
            <div
              key={index}
              className={`border rounded-lg transition-all ${
                isExpanded ? 'border-purple-200 shadow-sm' : 'border-gray-200'
              }`}
            >
              {/* Header */}
              <button
                onClick={() => toggleStep(index)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-500" />
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-purple-600">Step {index + 1}</span>
                    <span className="text-sm text-gray-700 font-medium">{step.step}</span>
                  </div>
                </div>

                {/* Confidence Badge */}
                {step.confidence !== undefined && (
                  <div className={`${getConfidenceBgColor(step.confidence)} px-3 py-1 rounded-full`}>
                    <span className={`text-xs font-semibold ${getConfidenceColor(step.confidence)}`}>
                      {(step.confidence * 100).toFixed(0)}% confidence
                    </span>
                  </div>
                )}
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-4 border-t border-gray-100">
                  {/* Observation */}
                  <div className="mt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Info className="w-4 h-4 text-blue-500" />
                      <h4 className="text-sm font-semibold text-gray-700">Observation</h4>
                    </div>
                    <p className="text-sm text-gray-600 pl-6 leading-relaxed">
                      {step.observation}
                    </p>
                  </div>

                  {/* Hypothesis */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Brain className="w-4 h-4 text-purple-500" />
                      <h4 className="text-sm font-semibold text-gray-700">Hypothesis</h4>
                    </div>
                    <p className="text-sm text-gray-600 pl-6 leading-relaxed">
                      {step.hypothesis}
                    </p>
                  </div>

                  {/* Validation */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <h4 className="text-sm font-semibold text-gray-700">Validation</h4>
                    </div>
                    {validation.length > 1 ? (
                      <ul className="space-y-1 pl-6">
                        {validation.map((v, i) => (
                          <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                            <span className="text-green-500 mt-1">•</span>
                            <span className="flex-1">{v}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-600 pl-6 leading-relaxed">
                        {validation[0]}
                      </p>
                    )}
                  </div>

                  {/* Conclusion */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                      <h4 className="text-sm font-semibold text-gray-700">Conclusion</h4>
                    </div>
                    <p className="text-sm text-gray-600 pl-6 leading-relaxed font-medium">
                      {step.conclusion}
                    </p>
                  </div>

                  {/* Confidence Factors */}
                  {step.confidence_factors && step.confidence_factors.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-4 h-4 text-blue-500" />
                        <h4 className="text-sm font-semibold text-gray-700">Confidence Factors</h4>
                      </div>
                      <div className="pl-6 flex flex-wrap gap-2">
                        {step.confidence_factors.map((factor, i) => (
                          <span
                            key={i}
                            className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded"
                          >
                            {factor}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Related Finding */}
                  {step.related_finding && (
                    <div className="pt-2 border-t border-gray-100">
                      <span className="text-xs text-gray-500">
                        Related to finding:{' '}
                        <span className="font-mono text-purple-600">{step.related_finding}</span>
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Insights Summary */}
      {reasoning.some(r => r.conclusion) && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Key Insights</h4>
          <ul className="space-y-2">
            {reasoning
              .filter(r => r.conclusion && r.conclusion.length > 20)
              .slice(0, 3)
              .map((r, i) => (
                <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                  <span className="text-purple-500 mt-1">→</span>
                  <span className="flex-1">{r.conclusion}</span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  )
}
