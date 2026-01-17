import { ShieldCheck, Calendar, Code2, Package, Globe, User } from 'lucide-react';
import DataRow from '../shared/DataRow';

interface AuditSummaryData {
  projectName?: string;
  contractAddress?: string;
  network?: string;
  framework?: string;
  auditDepth?: 'quick' | 'standard' | 'deep';
  startedAt?: string;
  completedAt?: string;
  duration?: string;
  auditScore?: number;
  totalFindings?: number;
  criticalCount?: number;
  highCount?: number;
  mediumCount?: number;
  lowCount?: number;
  infoCount?: number;
  linesOfCode?: number;
  contractCount?: number;
  deployerAddress?: string;
}

interface AuditSummaryCardProps {
  data: AuditSummaryData;
}

export default function AuditSummaryCard({ data }: AuditSummaryCardProps) {
  const getDepthBadgeColor = (depth?: string) => {
    if (depth === 'quick') return 'bg-blue-100 text-blue-800 border-blue-200';
    if (depth === 'standard') return 'bg-purple-100 text-purple-800 border-purple-200';
    if (depth === 'deep') return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getScoreColor = (score?: number) => {
    if (!score) return 'text-gray-500';
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    if (score >= 50) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreBadge = (score?: number) => {
    if (!score) return 'N/A';
    if (score >= 90) return '✅ Excellent';
    if (score >= 70) return '⚠️ Good';
    if (score >= 50) return '⚠️ Fair';
    return '🔴 Poor';
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <ShieldCheck className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {data.projectName || 'Smart Contract Audit'}
              </h2>
              <p className="text-sm text-gray-600">
                Comprehensive security analysis and vulnerability assessment
              </p>
            </div>
          </div>
          {data.auditDepth && (
            <span className={`px-3 py-1 text-sm font-medium rounded-full border ${getDepthBadgeColor(data.auditDepth)}`}>
              {data.auditDepth.charAt(0).toUpperCase() + data.auditDepth.slice(1)} Scan
            </span>
          )}
        </div>
      </div>

      {/* Content Grid */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
          {/* Contract Information */}
          {data.contractAddress && (
            <DataRow
              label="Contract Address"
              value={
                <span className="font-mono text-xs">
                  {data.contractAddress.slice(0, 10)}...{data.contractAddress.slice(-8)}
                </span>
              }
              copyable
            />
          )}

          {data.network && (
            <DataRow
              label="Network"
              value={
                <div className="flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  <span>{data.network.charAt(0).toUpperCase() + data.network.slice(1)}</span>
                </div>
              }
            />
          )}

          {data.framework && (
            <DataRow
              label="Framework"
              value={
                <div className="flex items-center gap-1">
                  <Package className="w-3 h-3" />
                  <span>{data.framework}</span>
                </div>
              }
            />
          )}

          {/* Code Metrics */}
          {data.linesOfCode !== undefined && (
            <DataRow
              label="Lines of Code"
              value={
                <div className="flex items-center gap-1">
                  <Code2 className="w-3 h-3" />
                  <span>{data.linesOfCode.toLocaleString()}</span>
                </div>
              }
            />
          )}

          {data.contractCount !== undefined && (
            <DataRow
              label="Contracts"
              value={`${data.contractCount} file${data.contractCount === 1 ? '' : 's'}`}
            />
          )}

          {/* Timeline */}
          {data.startedAt && (
            <DataRow
              label="Started"
              value={
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span className="text-xs">{formatDate(data.startedAt)}</span>
                </div>
              }
            />
          )}

          {data.completedAt && (
            <DataRow
              label="Completed"
              value={
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span className="text-xs">{formatDate(data.completedAt)}</span>
                </div>
              }
            />
          )}

          {data.duration && (
            <DataRow
              label="Duration"
              value={data.duration}
            />
          )}

          {/* Deployer */}
          {data.deployerAddress && (
            <DataRow
              label="Deployer"
              value={
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  <span className="font-mono text-xs">
                    {data.deployerAddress.slice(0, 6)}...{data.deployerAddress.slice(-4)}
                  </span>
                </div>
              }
              copyable
            />
          )}
        </div>

        {/* Score and Findings Summary */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Audit Score */}
            {data.auditScore !== undefined && (
              <div className="flex flex-col items-center p-4 bg-gray-50 rounded-lg">
                <div className="text-sm font-medium text-gray-600 mb-2">Audit Score</div>
                <div className={`text-4xl font-bold ${getScoreColor(data.auditScore)}`}>
                  {data.auditScore}/100
                </div>
                <div className="text-sm text-gray-600 mt-1">{getScoreBadge(data.auditScore)}</div>
              </div>
            )}

            {/* Findings Summary */}
            {data.totalFindings !== undefined && (
              <div className="flex flex-col items-center p-4 bg-gray-50 rounded-lg">
                <div className="text-sm font-medium text-gray-600 mb-2">Total Findings</div>
                <div className="text-4xl font-bold text-gray-900">{data.totalFindings}</div>
                <div className="flex items-center gap-2 mt-2 text-xs">
                  {data.criticalCount !== undefined && data.criticalCount > 0 && (
                    <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded">
                      {data.criticalCount} Critical
                    </span>
                  )}
                  {data.highCount !== undefined && data.highCount > 0 && (
                    <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded">
                      {data.highCount} High
                    </span>
                  )}
                  {data.mediumCount !== undefined && data.mediumCount > 0 && (
                    <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded">
                      {data.mediumCount} Medium
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
