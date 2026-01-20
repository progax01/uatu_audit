/**
 * RescoringComparisonPanel.tsx
 *
 * Displays before/after comparison of audit scores after triage verification
 * Shows: score change, grade change, verified dismissals, rejected dismissals
 */

import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Sparkles,
  Shield,
  Eye,
  FileText,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export interface RescoringResult {
  originalScore: number;
  newScore: number;
  originalGrade: string;
  newGrade: string;
  findingsRemoved: number;
  findingsKept: number;
  findingsDowngraded: number;
  scoreImprovement: number;
  breakdown: Array<{
    category: string;
    count: number;
    severityChanges: Array<{
      findingId: string;
      oldSeverity: string;
      newSeverity: string;
      reason: string;
    }>;
  }>;
}

export interface VerificationResult {
  findingId: string;
  isAccurate: boolean;
  confidence: 'high' | 'medium' | 'low';
  verificationStatus: 'accurate' | 'misleading' | 'insufficient' | 'needs_human_review';
  reasoning: string;
  suggestedSeverity?: 'critical' | 'high' | 'medium' | 'low' | 'info' | 'dismissed';
  additionalEvidence?: string[];
  recommendations: string[];
}

interface RescoringComparisonPanelProps {
  rescoring: RescoringResult;
  verifications: VerificationResult[];
  onApply?: () => void;
  onCancel?: () => void;
}

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

function ScoreComparison({ original, updated }: { original: number; updated: number }) {
  const improvement = updated - original;
  const isImproved = improvement > 0;

  return (
    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-6 border-2 border-purple-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-purple-900">Score Comparison</h3>
        {isImproved ? (
          <TrendingUp className="text-green-600" size={24} />
        ) : improvement < 0 ? (
          <TrendingDown className="text-red-600" size={24} />
        ) : (
          <Info className="text-slate-400" size={24} />
        )}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Original Score */}
        <div className="text-center">
          <p className="text-xs font-bold text-slate-600 uppercase mb-2">Original</p>
          <div className="bg-white rounded-lg p-4 border-2 border-slate-200">
            <p className="text-4xl font-bold text-slate-900">{original}</p>
            <p className="text-sm text-slate-600 mt-1">out of 100</p>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex items-center justify-center">
          <ArrowRight className="text-purple-400" size={32} />
        </div>

        {/* New Score */}
        <div className="text-center">
          <p className="text-xs font-bold text-green-600 uppercase mb-2">After Triage</p>
          <div className={`bg-white rounded-lg p-4 border-2 ${isImproved ? 'border-green-300 shadow-lg shadow-green-100' : 'border-slate-200'}`}>
            <p className={`text-4xl font-bold ${isImproved ? 'text-green-700' : 'text-slate-900'}`}>{updated}</p>
            <p className="text-sm text-slate-600 mt-1">out of 100</p>
            {improvement !== 0 && (
              <p className={`text-sm font-bold mt-2 ${isImproved ? 'text-green-600' : 'text-red-600'}`}>
                {improvement > 0 ? '+' : ''}{improvement} points
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function GradeComparison({ original, updated }: { original: string; updated: string }) {
  const isImproved = gradeToNumber(updated) > gradeToNumber(original);

  return (
    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 border-2 border-blue-200">
      <h3 className="text-lg font-bold text-blue-900 mb-4">Grade Comparison</h3>
      <div className="flex items-center justify-center gap-8">
        <div className="text-center">
          <p className="text-xs font-bold text-slate-600 uppercase mb-2">Original</p>
          <div className="bg-white rounded-lg px-6 py-4 border-2 border-slate-200">
            <p className="text-5xl font-bold text-slate-900">{original}</p>
          </div>
        </div>

        <ArrowRight className="text-blue-400" size={32} />

        <div className="text-center">
          <p className="text-xs font-bold text-blue-600 uppercase mb-2">New Grade</p>
          <div className={`bg-white rounded-lg px-6 py-4 border-2 ${isImproved ? 'border-green-300 shadow-lg shadow-green-100' : 'border-slate-200'}`}>
            <p className={`text-5xl font-bold ${isImproved ? 'text-green-700' : 'text-slate-900'}`}>{updated}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function gradeToNumber(grade: string): number {
  const gradeMap: Record<string, number> = {
    'A+': 13, 'A': 12, 'A-': 11,
    'B+': 10, 'B': 9, 'B-': 8,
    'C+': 7, 'C': 6, 'C-': 5,
    'D+': 4, 'D': 3, 'D-': 2,
    'F': 1,
  };
  return gradeMap[grade] || 0;
}

function SummaryStats({ rescoring }: { rescoring: RescoringResult }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle2 className="text-green-600" size={20} />
          <span className="text-xs font-bold text-green-700 uppercase">Verified Dismissals</span>
        </div>
        <p className="text-3xl font-bold text-green-900">{rescoring.findingsRemoved}</p>
        <p className="text-xs text-green-700 mt-1">findings removed</p>
      </div>

      <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="text-yellow-600" size={20} />
          <span className="text-xs font-bold text-yellow-700 uppercase">Severity Changes</span>
        </div>
        <p className="text-3xl font-bold text-yellow-900">{rescoring.findingsDowngraded}</p>
        <p className="text-xs text-yellow-700 mt-1">findings downgraded</p>
      </div>

      <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <XCircle className="text-red-600" size={20} />
          <span className="text-xs font-bold text-red-700 uppercase">Rejected Dismissals</span>
        </div>
        <p className="text-3xl font-bold text-red-900">{rescoring.findingsKept}</p>
        <p className="text-xs text-red-700 mt-1">findings kept</p>
      </div>
    </div>
  );
}

function VerificationCard({ verification }: { verification: VerificationResult }) {
  const [expanded, setExpanded] = useState(false);

  const statusConfig = {
    accurate: {
      icon: CheckCircle2,
      color: 'border-green-500 bg-green-50',
      textColor: 'text-green-900',
      badgeColor: 'bg-green-100 text-green-700 border-green-300',
      label: 'Verified Dismissal',
    },
    misleading: {
      icon: XCircle,
      color: 'border-red-500 bg-red-50',
      textColor: 'text-red-900',
      badgeColor: 'bg-red-100 text-red-700 border-red-300',
      label: 'Rejected Dismissal',
    },
    insufficient: {
      icon: Info,
      color: 'border-yellow-500 bg-yellow-50',
      textColor: 'text-yellow-900',
      badgeColor: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      label: 'Insufficient Evidence',
    },
    needs_human_review: {
      icon: Eye,
      color: 'border-orange-500 bg-orange-50',
      textColor: 'text-orange-900',
      badgeColor: 'bg-orange-100 text-orange-700 border-orange-300',
      label: 'Needs Review',
    },
  };

  const config = statusConfig[verification.verificationStatus];
  const Icon = config.icon;

  const confidenceBadges = {
    high: 'bg-green-100 text-green-700 border-green-300',
    medium: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    low: 'bg-red-100 text-red-700 border-red-300',
  };

  return (
    <div className={`border-l-4 rounded-lg ${config.color}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-black/5 transition-colors"
      >
        <div className="flex items-center gap-3 flex-1 text-left">
          <Icon className={config.textColor} size={20} />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs px-2 py-1 rounded-full border font-bold ${config.badgeColor}`}>
                {config.label}
              </span>
              <span className={`text-xs px-2 py-1 rounded-full border font-bold ${confidenceBadges[verification.confidence]}`}>
                {verification.confidence.toUpperCase()} confidence
              </span>
              {verification.suggestedSeverity && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full border border-purple-300 font-bold">
                  → {verification.suggestedSeverity.toUpperCase()}
                </span>
              )}
            </div>
            <p className={`text-sm ${config.textColor}`}>{verification.findingId}</p>
          </div>
        </div>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {expanded && (
        <div className="px-4 py-3 border-t space-y-3">
          <div>
            <p className="text-xs font-bold text-slate-700 uppercase mb-1">Reasoning</p>
            <p className="text-sm text-slate-800">{verification.reasoning}</p>
          </div>

          {verification.additionalEvidence && verification.additionalEvidence.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-700 uppercase mb-1">Evidence</p>
              <ul className="text-xs text-slate-700 list-disc ml-4 space-y-1">
                {verification.additionalEvidence.map((evidence, idx) => (
                  <li key={idx}>{evidence}</li>
                ))}
              </ul>
            </div>
          )}

          {verification.recommendations.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-700 uppercase mb-1">Recommendations</p>
              <ul className="text-xs text-slate-700 list-disc ml-4 space-y-1">
                {verification.recommendations.map((rec, idx) => (
                  <li key={idx}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function RescoringComparisonPanel({
  rescoring,
  verifications,
  onApply,
  onCancel,
}: RescoringComparisonPanelProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'verifications'>('overview');

  const isImprovement = rescoring.scoreImprovement > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`bg-gradient-to-r ${isImprovement ? 'from-green-500 to-emerald-500' : 'from-purple-500 to-indigo-500'} text-white rounded-xl p-6 shadow-lg`}>
        <div className="flex items-center gap-4 mb-4">
          <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
            <Sparkles size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Triage Verification Results</h2>
            <p className={isImprovement ? 'text-green-100' : 'text-purple-100'}>
              {isImprovement
                ? `Score improved by ${rescoring.scoreImprovement} points!`
                : rescoring.scoreImprovement < 0
                ? `Score decreased by ${Math.abs(rescoring.scoreImprovement)} points`
                : 'No score change'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b-2 border-slate-200">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 font-bold transition-colors ${
            activeTab === 'overview'
              ? 'text-purple-700 border-b-2 border-purple-700 -mb-0.5'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('verifications')}
          className={`px-4 py-2 font-bold transition-colors ${
            activeTab === 'verifications'
              ? 'text-purple-700 border-b-2 border-purple-700 -mb-0.5'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Verification Details ({verifications.length})
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ScoreComparison original={rescoring.originalScore} updated={rescoring.newScore} />
            <GradeComparison original={rescoring.originalGrade} updated={rescoring.newGrade} />
          </div>

          <SummaryStats rescoring={rescoring} />

          {/* Breakdown */}
          {rescoring.breakdown.length > 0 && (
            <div className="bg-white rounded-xl border-2 border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <FileText size={20} className="text-purple-600" />
                Detailed Breakdown
              </h3>
              <div className="space-y-4">
                {rescoring.breakdown.map((category, idx) => (
                  <div key={idx} className="border-l-4 border-purple-500 bg-purple-50 rounded-lg p-4">
                    <h4 className="text-sm font-bold text-purple-900 mb-2">
                      {category.category} ({category.count})
                    </h4>
                    <div className="space-y-2">
                      {category.severityChanges.slice(0, 3).map((change, changeIdx) => (
                        <div key={changeIdx} className="text-xs bg-white rounded p-2 border border-purple-200">
                          <p className="font-bold text-slate-900">{change.findingId}</p>
                          <p className="text-slate-600">
                            <span className="font-bold">{change.oldSeverity}</span> →{' '}
                            <span className="font-bold text-purple-700">{change.newSeverity}</span>
                          </p>
                          <p className="text-slate-700 mt-1">{change.reason}</p>
                        </div>
                      ))}
                      {category.severityChanges.length > 3 && (
                        <p className="text-xs text-slate-500 italic">
                          +{category.severityChanges.length - 3} more changes
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Verifications Tab */}
      {activeTab === 'verifications' && (
        <div className="space-y-3">
          {verifications.map((verification, idx) => (
            <VerificationCard key={idx} verification={verification} />
          ))}
        </div>
      )}

      {/* Action Buttons */}
      {(onApply || onCancel) && (
        <div className="flex gap-4 justify-end border-t-2 border-slate-200 pt-6">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-6 py-3 bg-slate-100 text-slate-700 rounded-lg font-bold hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
          )}
          {onApply && (
            <button
              onClick={onApply}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-bold hover:from-purple-700 hover:to-indigo-700 transition-colors shadow-lg"
            >
              Apply Rescored Results
            </button>
          )}
        </div>
      )}
    </div>
  );
}
