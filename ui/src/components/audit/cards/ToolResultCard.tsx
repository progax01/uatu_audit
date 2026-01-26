import { useState } from 'react';
import { Wrench, ChevronDown, ChevronUp, CheckCircle, XCircle, Clock } from 'lucide-react';
import StatusIndicator from '../shared/StatusIndicator';
import { formatLocation } from '../../../utils/pathUtils';

interface ToolFinding {
  title: string;
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
  description?: string;
  location?: {
    file?: string;
    line?: number;
  };
  impact?: string;
  confidence?: 'high' | 'medium' | 'low';
}

interface ToolResult {
  toolName: string;
  version?: string;
  status: 'success' | 'error' | 'warning' | 'pending';
  executionTime?: string;
  findings?: ToolFinding[];
  errorMessage?: string;
  summary?: string;
  raw?: string;
}

interface ToolResultCardProps {
  results: ToolResult[];
}

export default function ToolResultCard({ results }: ToolResultCardProps) {
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const [showRawOutput, setShowRawOutput] = useState<Record<string, boolean>>({});

  const toggleTool = (toolName: string) => {
    setExpandedTools((prev) => {
      const next = new Set(prev);
      if (next.has(toolName)) {
        next.delete(toolName);
      } else {
        next.add(toolName);
      }
      return next;
    });
  };

  const toggleRawOutput = (toolName: string) => {
    setShowRawOutput((prev) => ({
      ...prev,
      [toolName]: !prev[toolName],
    }));
  };

  const getToolIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <Clock className="w-5 h-5 text-orange-600" />;
      default:
        return <Wrench className="w-5 h-5 text-gray-600" />;
    }
  };

  const getConfidenceBadge = (confidence?: string) => {
    if (!confidence) return null;

    const config = {
      high: 'bg-red-100 text-red-700',
      medium: 'bg-yellow-100 text-yellow-700',
      low: 'bg-blue-100 text-blue-700',
    };

    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded ${config[confidence as keyof typeof config]}`}>
        {confidence} confidence
      </span>
    );
  };

  const getSeverityBadge = (severity?: string) => {
    if (!severity) return null;

    const config = {
      critical: 'bg-red-100 text-red-800',
      high: 'bg-orange-100 text-orange-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-blue-100 text-blue-800',
      info: 'bg-gray-100 text-gray-700',
    };

    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded ${config[severity as keyof typeof config]}`}>
        {severity}
      </span>
    );
  };

  if (results.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-cyan-50 to-blue-50 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white rounded-lg shadow-sm">
            <Wrench className="w-5 h-5 text-cyan-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">SECURITY TOOLS</h3>
            <p className="text-sm text-gray-600">
              Results from {results.length} security {results.length === 1 ? 'tool' : 'tools'}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
        {results.map((tool) => {
          const isExpanded = expandedTools.has(tool.toolName);
          const hasFindings = tool.findings && tool.findings.length > 0;

          return (
            <div key={tool.toolName} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Tool Header */}
              <button
                onClick={() => toggleTool(tool.toolName)}
                className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  {getToolIcon(tool.status)}
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{tool.toolName}</span>
                      {tool.version && (
                        <span className="text-xs text-gray-500">v{tool.version}</span>
                      )}
                    </div>
                    {tool.executionTime && (
                      <div className="text-xs text-gray-500">Executed in {tool.executionTime}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusIndicator status={tool.status} size="sm" />
                  {hasFindings && (
                    <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                      {tool.findings!.length} {tool.findings!.length === 1 ? 'finding' : 'findings'}
                    </span>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>

              {/* Tool Details */}
              {isExpanded && (
                <div className="p-4 bg-white border-t border-gray-200">
                  {/* Summary */}
                  {tool.summary && (
                    <div className="mb-4">
                      <div className="text-xs font-semibold text-gray-700 uppercase mb-1">Summary</div>
                      <div className="text-sm text-gray-700">{tool.summary}</div>
                    </div>
                  )}

                  {/* Error Message */}
                  {tool.status === 'error' && tool.errorMessage && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
                      <div className="text-xs font-semibold text-red-700 uppercase mb-1">Error</div>
                      <div className="text-sm text-red-700">{tool.errorMessage}</div>
                    </div>
                  )}

                  {/* Findings */}
                  {hasFindings && (
                    <div className="mb-4">
                      <div className="text-xs font-semibold text-gray-700 uppercase mb-2">Findings</div>
                      <div className="space-y-2">
                        {tool.findings!.map((finding, idx) => (
                          <div
                            key={idx}
                            className="p-3 bg-gray-50 border border-gray-200 rounded text-sm"
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="font-medium text-gray-900 flex-grow">{finding.title}</div>
                              <div className="flex items-center gap-1">
                                {getSeverityBadge(finding.severity)}
                                {getConfidenceBadge(finding.confidence)}
                              </div>
                            </div>

                            {finding.description && (
                              <div className="text-gray-700 mb-2">{finding.description}</div>
                            )}

                            {finding.location && (
                              <div className="text-xs text-gray-500 font-mono">
                                {formatLocation(finding.location)}
                              </div>
                            )}

                            {finding.impact && (
                              <div className="mt-2 text-xs">
                                <span className="font-semibold text-gray-700">Impact: </span>
                                <span className="text-gray-600">{finding.impact}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Raw Output Toggle */}
                  {tool.raw && (
                    <div>
                      <button
                        onClick={() => toggleRawOutput(tool.toolName)}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium mb-2"
                      >
                        {showRawOutput[tool.toolName] ? 'Hide' : 'Show'} raw output
                      </button>
                      {showRawOutput[tool.toolName] && (
                        <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto max-h-96">
                          <code>{tool.raw}</code>
                        </pre>
                      )}
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
}
