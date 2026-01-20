/**
 * Dependency Finding Card Component
 *
 * Displays findings from third-party dependencies (node_modules, OpenZeppelin, etc.)
 * Distinguished from project findings to help prioritize remediation.
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Package, AlertCircle } from 'lucide-react';

interface DependencyFinding {
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  library: string;
  file: string;
  rec: string;
  affectedVersion?: string;
}

interface DependencyFindingCardProps {
  finding: DependencyFinding;
  index?: number;
}

export function DependencyFindingCard({ finding, index }: DependencyFindingCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const severityColors: Record<string, { bg: string; text: string; border: string }> = {
    critical: { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-300' },
    high: { bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-300' },
    medium: { bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-yellow-300' },
    low: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-300' },
  };

  const colors = severityColors[finding.severity] || severityColors.low;

  return (
    <div className={`border-2 ${colors.border} ${colors.bg} rounded-lg overflow-hidden hover:shadow-md transition-shadow`}>
      {/* Header - Always Visible */}
      <div
        className="p-4 cursor-pointer flex items-start gap-3"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex-shrink-0 mt-1">
          {isExpanded ? (
            <ChevronDown className={colors.text} size={20} />
          ) : (
            <ChevronRight className={colors.text} size={20} />
          )}
        </div>

        <div className="flex-shrink-0 mt-0.5">
          <Package className={colors.text} size={20} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4 mb-2">
            <h3 className={`font-bold ${colors.text} text-lg leading-tight`}>
              {finding.title}
            </h3>
            <SeverityBadge severity={finding.severity} />
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
            <span className="font-semibold">{finding.library}</span>
            {finding.affectedVersion && (
              <>
                <span>•</span>
                <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">{finding.affectedVersion}</span>
              </>
            )}
          </div>

          <div className="text-xs text-gray-500 truncate">
            {finding.file}
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t-2 border-gray-200 bg-white p-4 space-y-4">
          {/* File Location */}
          <div>
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
              File Location
            </h4>
            <code className="block p-2 bg-gray-100 rounded text-xs text-gray-800 break-all">
              {finding.file}
            </code>
          </div>

          {/* Recommendation */}
          <div>
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
              Recommendation
            </h4>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-gray-700">{finding.rec}</p>
            </div>
          </div>

          {/* Dependency-Specific Guidance */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" size={16} />
              <div className="text-xs text-amber-800">
                <p className="font-bold mb-1">Third-Party Dependency Issue</p>
                <p>
                  This issue is in <strong>{finding.library}</strong>, not your project code.
                  {finding.severity === 'critical' || finding.severity === 'high' ? (
                    <> Consider updating to a patched version or finding an alternative library.</>
                  ) : (
                    <> Monitor for updates or accept the risk if the functionality is not critical.</>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Action Items */}
          <div>
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
              Action Items
            </h4>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">1.</span>
                <span>Check if a newer version of <code className="bg-gray-200 px-1 rounded">{finding.library}</code> fixes this issue</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">2.</span>
                <span>Review the library's security advisories and changelogs</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">3.</span>
                <span>
                  {finding.severity === 'critical' || finding.severity === 'high'
                    ? 'Update immediately or find an alternative library'
                    : 'Consider updating in the next maintenance cycle'}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">4.</span>
                <span>Test thoroughly after updating dependencies</span>
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// Severity Badge Component
interface SeverityBadgeProps {
  severity: string;
}

function SeverityBadge({ severity }: SeverityBadgeProps) {
  const severityConfig: Record<string, { label: string; classes: string }> = {
    critical: { label: 'CRITICAL', classes: 'bg-red-600 text-white' },
    high: { label: 'HIGH', classes: 'bg-orange-500 text-white' },
    medium: { label: 'MEDIUM', classes: 'bg-yellow-500 text-white' },
    low: { label: 'LOW', classes: 'bg-blue-500 text-white' },
  };

  const config = severityConfig[severity] || severityConfig.low;

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold ${config.classes} uppercase tracking-wide flex-shrink-0`}>
      {config.label}
    </span>
  );
}

// Grouped Dependency Findings Component
interface GroupedDependencyFindingsProps {
  findings: DependencyFinding[];
}

export function GroupedDependencyFindings({ findings }: GroupedDependencyFindingsProps) {
  // Group by library
  const grouped = findings.reduce((acc, finding) => {
    const lib = finding.library;
    if (!acc[lib]) {
      acc[lib] = [];
    }
    acc[lib].push(finding);
    return acc;
  }, {} as Record<string, DependencyFinding[]>);

  // Sort libraries by highest severity
  const sortedLibraries = Object.keys(grouped).sort((a, b) => {
    const aMaxSev = Math.min(...grouped[a].map(f => getSeverityOrder(f.severity)));
    const bMaxSev = Math.min(...grouped[b].map(f => getSeverityOrder(f.severity)));
    return aMaxSev - bMaxSev;
  });

  return (
    <div className="space-y-6">
      {sortedLibraries.map(library => (
        <div key={library} className="space-y-3">
          <div className="flex items-center gap-3 mb-3">
            <Package className="text-gray-600" size={20} />
            <h3 className="text-lg font-bold text-gray-800">{library}</h3>
            <span className="text-sm text-gray-500">
              ({grouped[library].length} issue{grouped[library].length > 1 ? 's' : ''})
            </span>
          </div>

          <div className="space-y-3 ml-8">
            {grouped[library].map((finding, idx) => (
              <DependencyFindingCard key={idx} finding={finding} index={idx} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function getSeverityOrder(severity: string): number {
  const order: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  return order[severity] || 999;
}
