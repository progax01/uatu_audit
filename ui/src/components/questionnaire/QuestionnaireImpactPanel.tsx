/**
 * QuestionnaireImpactPanel.tsx
 *
 * Visualizes how user's questionnaire answers influenced the audit
 * Shows: which steps used each answer, what findings were surfaced, impact metrics
 */

import React, { useState } from 'react';
import {
  ClipboardCheck,
  ArrowRight,
  FileSearch,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Eye,
  ChevronDown,
import { formatLocation } from '../../utils/pathUtils';
  ChevronUp,
  Info,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export interface QuestionnaireAnswer {
  questionId: string;
  question: string;
  answer: string;
  category: string;
}

export interface StepImpact {
  stepId: string;
  stepName: string;
  stepType: 'ai' | 'deterministic';
  howUsed: string; // Description of how the answer influenced this step
  findingsGenerated: number;
}

export interface FindingImpact {
  findingId: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  location: string;
  triggeredBy: string[]; // Question IDs that contributed to surfacing this finding
}

export interface QuestionnaireImpact {
  answer: QuestionnaireAnswer;
  stepsInfluenced: StepImpact[];
  findingsGenerated: FindingImpact[];
  impactScore: number; // 0-100: how much this answer influenced the audit
}

interface QuestionnaireImpactPanelProps {
  impacts: QuestionnaireImpact[];
  totalSteps: number;
  totalFindings: number;
}

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

function ImpactScoreMeter({ score }: { score: number }) {
  const getColor = (score: number) => {
    if (score >= 80) return { bg: 'bg-green-500', text: 'text-green-700', border: 'border-green-300' };
    if (score >= 50) return { bg: 'bg-blue-500', text: 'text-blue-700', border: 'border-blue-300' };
    if (score >= 25) return { bg: 'bg-yellow-500', text: 'text-yellow-700', border: 'border-yellow-300' };
    return { bg: 'bg-slate-400', text: 'text-slate-700', border: 'border-slate-300' };
  };

  const { bg, text, border } = getColor(score);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700">Impact Score</span>
        <span className={`text-sm font-bold ${text}`}>{score}/100</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${bg}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function StepCard({ step }: { step: StepImpact }) {
  return (
    <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <Target className="text-blue-600 flex-shrink-0 mt-1" size={20} />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-sm font-bold text-blue-900">{step.stepName}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              step.stepType === 'ai'
                ? 'bg-purple-100 text-purple-700 border border-purple-300'
                : 'bg-slate-100 text-slate-700 border border-slate-300'
            }`}>
              {step.stepType === 'ai' ? '🤖 AI' : '⚙️ Deterministic'}
            </span>
          </div>
          <p className="text-xs text-blue-800 mb-2">{step.howUsed}</p>
          {step.findingsGenerated > 0 && (
            <div className="flex items-center gap-2 text-xs text-blue-700">
              <Sparkles size={12} />
              Generated {step.findingsGenerated} finding{step.findingsGenerated !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FindingCard({ finding }: { finding: FindingImpact }) {
  const severityColors = {
    critical: 'border-red-500 bg-red-50',
    high: 'border-orange-500 bg-orange-50',
    medium: 'border-yellow-500 bg-yellow-50',
    low: 'border-blue-500 bg-blue-50',
  };

  const severityBadges = {
    critical: 'bg-red-600 text-white',
    high: 'bg-orange-500 text-white',
    medium: 'bg-yellow-500 text-white',
    low: 'bg-blue-500 text-white',
  };

  return (
    <div className={`border-l-4 rounded-lg p-4 ${severityColors[finding.severity]}`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className="text-red-600 flex-shrink-0 mt-1" size={20} />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs px-2 py-1 rounded font-bold uppercase ${severityBadges[finding.severity]}`}>
              {finding.severity}
            </span>
            <p className="text-sm font-bold text-slate-900">{finding.title}</p>
          </div>
          <p className="text-xs text-slate-700 mb-2">{finding.description}</p>
          <p className="text-xs text-slate-500">📍 {formatLocation(finding.location)}</p>
        </div>
      </div>
    </div>
  );
}

function ImpactFlowDiagram({ impact }: { impact: QuestionnaireImpact }) {
  return (
    <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl p-6 border-2 border-slate-200">
      <div className="space-y-4">
        {/* Answer Node */}
        <div className="flex items-center gap-4">
          <div className="bg-green-100 border-2 border-green-400 rounded-lg p-4 flex-shrink-0 shadow-sm">
            <ClipboardCheck className="text-green-600" size={24} />
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Your Answer</p>
            <p className="text-sm font-bold text-slate-900">{impact.answer.question}</p>
            <p className="text-xs text-green-700 mt-1 bg-green-50 border border-green-200 rounded px-2 py-1 inline-block">
              {impact.answer.answer}
            </p>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <ArrowRight className="text-slate-400" size={24} />
        </div>

        {/* Steps Node */}
        <div className="flex items-center gap-4">
          <div className="bg-blue-100 border-2 border-blue-400 rounded-lg p-4 flex-shrink-0 shadow-sm">
            <FileSearch className="text-blue-600" size={24} />
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Influenced Steps</p>
            <p className="text-2xl font-bold text-blue-900">{impact.stepsInfluenced.length}</p>
            <p className="text-xs text-slate-600">audit steps used this information</p>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <ArrowRight className="text-slate-400" size={24} />
        </div>

        {/* Findings Node */}
        <div className="flex items-center gap-4">
          <div className="bg-orange-100 border-2 border-orange-400 rounded-lg p-4 flex-shrink-0 shadow-sm">
            <AlertTriangle className="text-orange-600" size={24} />
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Findings Surfaced</p>
            <p className="text-2xl font-bold text-orange-900">{impact.findingsGenerated.length}</p>
            <p className="text-xs text-slate-600">security issues discovered</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function QuestionnaireImpactPanel({ impacts, totalSteps, totalFindings }: QuestionnaireImpactPanelProps) {
  const [expandedImpact, setExpandedImpact] = useState<string | null>(null);

  const totalStepsInfluenced = impacts.reduce((sum, impact) => sum + impact.stepsInfluenced.length, 0);
  const totalFindingsGenerated = impacts.reduce((sum, impact) => sum + impact.findingsGenerated.length, 0);
  const avgImpactScore = impacts.length > 0
    ? Math.round(impacts.reduce((sum, impact) => sum + impact.impactScore, 0) / impacts.length)
    : 0;

  if (impacts.length === 0) {
    return (
      <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-12 text-center">
        <Info className="mx-auto text-slate-400 mb-4" size={48} />
        <h3 className="text-lg font-bold text-slate-700 mb-2">No Questionnaire Data</h3>
        <p className="text-sm text-slate-600">
          This audit did not use questionnaire answers. Impact tracking is only available for audits with completed questionnaires.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl p-6 shadow-lg">
        <div className="flex items-center gap-4 mb-4">
          <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
            <Eye size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Questionnaire Impact Analysis</h2>
            <p className="text-purple-100">
              See how your answers shaped this audit
            </p>
          </div>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border-2 border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardCheck className="text-green-600" size={20} />
            <span className="text-xs font-bold text-green-700 uppercase">Answers Used</span>
          </div>
          <p className="text-2xl font-bold text-green-900">{impacts.length}</p>
        </div>

        <div className="bg-white border-2 border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileSearch className="text-blue-600" size={20} />
            <span className="text-xs font-bold text-blue-700 uppercase">Steps Influenced</span>
          </div>
          <p className="text-2xl font-bold text-blue-900">{totalStepsInfluenced}</p>
          <p className="text-xs text-slate-600">{((totalStepsInfluenced / totalSteps) * 100).toFixed(0)}% of all steps</p>
        </div>

        <div className="bg-white border-2 border-orange-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="text-orange-600" size={20} />
            <span className="text-xs font-bold text-orange-700 uppercase">Findings Surfaced</span>
          </div>
          <p className="text-2xl font-bold text-orange-900">{totalFindingsGenerated}</p>
          <p className="text-xs text-slate-600">{((totalFindingsGenerated / totalFindings) * 100).toFixed(0)}% of all findings</p>
        </div>

        <div className="bg-white border-2 border-purple-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="text-purple-600" size={20} />
            <span className="text-xs font-bold text-purple-700 uppercase">Avg Impact</span>
          </div>
          <p className="text-2xl font-bold text-purple-900">{avgImpactScore}/100</p>
        </div>
      </div>

      {/* Impact Cards */}
      <div className="space-y-4">
        {impacts.map((impact) => {
          const isExpanded = expandedImpact === impact.answer.questionId;

          return (
            <div
              key={impact.answer.questionId}
              className="bg-white rounded-xl border-2 border-slate-200 shadow-sm overflow-hidden"
            >
              {/* Header */}
              <button
                onClick={() => setExpandedImpact(isExpanded ? null : impact.answer.questionId)}
                className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-slate-50 to-purple-50 hover:from-slate-100 hover:to-purple-100 transition-all"
              >
                <div className="flex items-center gap-4 flex-1 text-left">
                  <div className="bg-purple-100 border-2 border-purple-300 rounded-lg p-2">
                    <ClipboardCheck className="text-purple-600" size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-900 mb-1">{impact.answer.question}</p>
                    <div className="flex items-center gap-3">
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full border border-purple-300 font-bold">
                        {impact.answer.category}
                      </span>
                      <span className="text-xs text-slate-600">
                        Answer: <span className="font-bold text-green-700">{impact.answer.answer}</span>
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-600 mb-1">Impact Score</p>
                    <p className="text-2xl font-bold text-purple-900">{impact.impactScore}</p>
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronUp className="text-slate-400 ml-4" size={20} />
                ) : (
                  <ChevronDown className="text-slate-400 ml-4" size={20} />
                )}
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="p-6 space-y-6 bg-slate-50">
                  {/* Impact Score Meter */}
                  <div>
                    <ImpactScoreMeter score={impact.impactScore} />
                  </div>

                  {/* Flow Diagram */}
                  <ImpactFlowDiagram impact={impact} />

                  {/* Steps Influenced */}
                  {impact.stepsInfluenced.length > 0 && (
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                        <FileSearch size={16} className="text-blue-600" />
                        Steps That Used This Answer
                      </h4>
                      <div className="space-y-3">
                        {impact.stepsInfluenced.map((step) => (
                          <StepCard key={step.stepId} step={step} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Findings Generated */}
                  {impact.findingsGenerated.length > 0 && (
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                        <AlertTriangle size={16} className="text-orange-600" />
                        Findings Discovered Because of This Answer
                      </h4>
                      <div className="space-y-3">
                        {impact.findingsGenerated.map((finding) => (
                          <FindingCard key={finding.findingId} finding={finding} />
                        ))}
                      </div>
                    </div>
                  )}

                  {impact.findingsGenerated.length === 0 && impact.stepsInfluenced.length === 0 && (
                    <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
                      <div className="flex items-start gap-3">
                        <Info className="text-yellow-600 flex-shrink-0 mt-1" size={20} />
                        <div>
                          <p className="text-sm font-bold text-yellow-900">No Direct Impact</p>
                          <p className="text-xs text-yellow-800 mt-1">
                            This answer was recorded but did not directly influence any audit steps or findings.
                            It may have been used for context or future reference.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary Footer */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border-2 border-purple-200 p-6">
        <div className="flex items-start gap-4">
          <CheckCircle2 className="text-purple-600 flex-shrink-0 mt-1" size={24} />
          <div>
            <h3 className="text-lg font-bold text-purple-900 mb-2">Impact Summary</h3>
            <p className="text-sm text-purple-800 mb-3">
              Your questionnaire answers provided valuable context that helped tailor {totalStepsInfluenced} audit steps
              and surface {totalFindingsGenerated} security findings that might have been missed otherwise.
            </p>
            <p className="text-xs text-purple-700">
              💡 <span className="font-bold">Tip:</span> More detailed questionnaire answers lead to more targeted and accurate audits.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
