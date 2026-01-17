import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import SeverityBadge from '../shared/SeverityBadge';

interface Finding {
  id?: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  description?: string;
  category?: string;
  location?: {
    file?: string;
    line?: number;
    column?: number;
  };
  recommendation?: string;
  codeSnippet?: string;
}

interface SeverityGridCardProps {
  findings: Finding[];
}

export default function SeverityGridCard({ findings }: SeverityGridCardProps) {
  const [expandedFindings, setExpandedFindings] = useState<Set<string>>(new Set());

  // Group findings by severity
  const groupedFindings = findings.reduce((acc, finding, index) => {
    const severity = finding.severity || 'info';
    if (!acc[severity]) {
      acc[severity] = [];
    }
    acc[severity].push({ ...finding, index: index.toString() });
    return acc;
  }, {} as Record<string, (Finding & { index: string })[]>);

  const toggleFinding = (id: string) => {
    setExpandedFindings((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const severityOrder: Array<'critical' | 'high' | 'medium' | 'low' | 'info'> = [
    'critical',
    'high',
    'medium',
    'low',
    'info',
  ];

  const getSeverityConfig = (severity: string) => {
    switch (severity) {
      case 'critical':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          text: 'text-red-800',
          icon: '🔴',
        };
      case 'high':
        return {
          bg: 'bg-orange-50',
          border: 'border-orange-200',
          text: 'text-orange-800',
          icon: '⚠️',
        };
      case 'medium':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          text: 'text-yellow-800',
          icon: '⚠️',
        };
      case 'low':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          text: 'text-blue-800',
          icon: 'ℹ️',
        };
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          text: 'text-gray-800',
          icon: 'ℹ️',
        };
    }
  };

  const totalFindings = findings.length;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-red-50 to-orange-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">SECURITY FINDINGS</h3>
              <p className="text-sm text-gray-600">
                {totalFindings} {totalFindings === 1 ? 'issue' : 'issues'} identified across all severity levels
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {totalFindings === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">✅</div>
            <div className="text-lg font-medium">No security issues detected</div>
            <div className="text-sm">The audit completed without identifying any vulnerabilities</div>
          </div>
        ) : (
          <div className="space-y-4">
            {severityOrder.map((severity) => {
              const severityFindings = groupedFindings[severity] || [];
              if (severityFindings.length === 0) return null;

              const config = getSeverityConfig(severity);

              return (
                <div key={severity} className={`border rounded-lg ${config.border} ${config.bg}`}>
                  {/* Severity Header */}
                  <div className="px-4 py-3 border-b" style={{ borderColor: 'inherit' }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{config.icon}</span>
                        <span className={`text-sm font-bold uppercase ${config.text}`}>
                          {severity}
                        </span>
                        <span className={`text-xs font-medium ${config.text}`}>
                          ({severityFindings.length} {severityFindings.length === 1 ? 'finding' : 'findings'})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Findings List */}
                  <div className="divide-y" style={{ borderColor: 'inherit' }}>
                    {severityFindings.map((finding) => {
                      const findingId = finding.id || `finding-${finding.index}`;
                      const isExpanded = expandedFindings.has(findingId);

                      return (
                        <div key={findingId} className="p-4">
                          <button
                            onClick={() => toggleFinding(findingId)}
                            className="w-full text-left flex items-start justify-between gap-3 group"
                          >
                            <div className="flex-grow min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <SeverityBadge severity={finding.severity} size="sm" />
                                {finding.category && (
                                  <span className="text-xs text-gray-500 uppercase tracking-wide">
                                    {finding.category}
                                  </span>
                                )}
                              </div>
                              <div className="font-medium text-gray-900 group-hover:text-indigo-600 transition-colors">
                                {finding.title}
                              </div>
                              {finding.location && (
                                <div className="text-xs text-gray-500 font-mono mt-1">
                                  {finding.location.file}
                                  {finding.location.line && `:${finding.location.line}`}
                                  {finding.location.column && `:${finding.location.column}`}
                                </div>
                              )}
                            </div>
                            <div className="flex-shrink-0 text-gray-400 group-hover:text-indigo-600 transition-colors">
                              {isExpanded ? (
                                <ChevronUp className="w-5 h-5" />
                              ) : (
                                <ChevronDown className="w-5 h-5" />
                              )}
                            </div>
                          </button>

                          {/* Expanded Details */}
                          {isExpanded && (
                            <div className="mt-4 space-y-3 pl-2 border-l-2 border-gray-300">
                              {finding.description && (
                                <div className="pl-3">
                                  <div className="text-xs font-semibold text-gray-700 uppercase mb-1">
                                    Description
                                  </div>
                                  <div className="text-sm text-gray-700 whitespace-pre-wrap">
                                    {finding.description}
                                  </div>
                                </div>
                              )}

                              {finding.codeSnippet && (
                                <div className="pl-3">
                                  <div className="text-xs font-semibold text-gray-700 uppercase mb-1">
                                    Code Snippet
                                  </div>
                                  <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto">
                                    <code>{finding.codeSnippet}</code>
                                  </pre>
                                </div>
                              )}

                              {finding.recommendation && (
                                <div className="pl-3">
                                  <div className="text-xs font-semibold text-gray-700 uppercase mb-1">
                                    Recommendation
                                  </div>
                                  <div className="text-sm text-gray-700 whitespace-pre-wrap">
                                    {finding.recommendation}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
