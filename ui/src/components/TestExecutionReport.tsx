/**
 * Test Execution Report Component
 *
 * Displays test execution status with clear explanations when tests don't run.
 * Shows actionable next steps based on the failure reason.
 */

import React from 'react';
import { AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';

interface TestExecutionReportProps {
  report?: {
    executed: boolean;
    reason: string;
    stats?: {
      total: number;
      passed: number;
      failed: number;
      skipped: number;
    };
    duration?: number;
    framework?: string;
  };
}

export function TestExecutionReport({ report }: TestExecutionReportProps) {
  if (!report) {
    return (
      <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <Clock className="text-gray-400 flex-shrink-0" size={24} />
          <div>
            <h3 className="font-bold text-gray-700 mb-2">Test Status Unknown</h3>
            <p className="text-gray-600">No test execution information available for this audit.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!report.executed) {
    // Tests didn't run - show reason and next steps
    return (
      <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <AlertTriangle className="text-amber-600 flex-shrink-0" size={24} />
          <div className="flex-1">
            <h3 className="font-bold text-amber-900 mb-2">Tests Not Executed</h3>
            <p className="text-amber-800 mb-4">{report.reason}</p>

            {/* Show specific next steps based on reason */}
            {report.reason.includes('Compilation failed') && (
              <div className="mt-4 p-4 bg-amber-100 rounded-lg">
                <p className="text-sm font-bold text-amber-900 mb-2">Next Steps:</p>
                <ul className="text-sm text-amber-800 list-disc ml-5 space-y-1">
                  <li>Review compilation errors in the Findings tab</li>
                  <li>Fix syntax errors and type issues</li>
                  <li>Re-run the audit to execute tests</li>
                </ul>
              </div>
            )}

            {report.reason.includes('No test files') && (
              <div className="mt-4 p-4 bg-amber-100 rounded-lg">
                <p className="text-sm font-bold text-amber-900 mb-2">Recommendation:</p>
                <p className="text-sm text-amber-800 mb-2">
                  Add unit tests to verify contract behavior and catch regressions. Tests should be placed in:
                </p>
                <ul className="text-sm text-amber-800 list-disc ml-5 space-y-1">
                  <li><code className="bg-amber-200 px-2 py-0.5 rounded">test/</code> or <code className="bg-amber-200 px-2 py-0.5 rounded">tests/</code> directory</li>
                  <li>Files matching <code className="bg-amber-200 px-2 py-0.5 rounded">*.t.sol</code> (Foundry)</li>
                  <li>Files matching <code className="bg-amber-200 px-2 py-0.5 rounded">*.test.js</code> or <code className="bg-amber-200 px-2 py-0.5 rounded">*.test.ts</code> (Hardhat)</li>
                </ul>
              </div>
            )}

            {report.reason.includes('Quick scan') && (
              <div className="mt-4 p-4 bg-amber-100 rounded-lg">
                <p className="text-sm font-bold text-amber-900 mb-2">Upgrade Audit Depth:</p>
                <p className="text-sm text-amber-800">
                  Quick scans skip test execution for faster results. Use <strong>Standard</strong> or <strong>Deep</strong> scan to run tests.
                </p>
              </div>
            )}

            {report.reason.includes('Missing required data') && (
              <div className="mt-4 p-4 bg-amber-100 rounded-lg">
                <p className="text-sm font-bold text-amber-900 mb-2">Technical Issue:</p>
                <p className="text-sm text-amber-800">
                  Test step was skipped due to missing dependencies. This may indicate a problem with the audit workflow.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Tests executed successfully - show stats
  const { stats } = report;
  if (!stats) {
    return (
      <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <CheckCircle className="text-green-600 flex-shrink-0" size={24} />
          <div>
            <h3 className="font-bold text-green-900 mb-2">Tests Executed</h3>
            <p className="text-green-800">{report.reason}</p>
          </div>
        </div>
      </div>
    );
  }

  const passRate = stats.total > 0 ? ((stats.passed / stats.total) * 100).toFixed(1) : '0';
  const hasFailures = stats.failed > 0;

  return (
    <div className={`border-2 rounded-xl p-6 ${hasFailures ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
      <div className="flex items-start gap-4">
        {hasFailures ? (
          <XCircle className="text-red-600 flex-shrink-0" size={24} />
        ) : (
          <CheckCircle className="text-green-600 flex-shrink-0" size={24} />
        )}
        <div className="flex-1">
          <h3 className={`font-bold mb-4 ${hasFailures ? 'text-red-900' : 'text-green-900'}`}>
            Test Execution Complete
          </h3>

          {/* Test Statistics Grid */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            <StatCard label="Total" value={stats.total} color="slate" />
            <StatCard label="Passed" value={stats.passed} color="green" />
            <StatCard label="Failed" value={stats.failed} color="red" />
            <StatCard label="Skipped" value={stats.skipped} color="yellow" />
          </div>

          {/* Pass Rate Bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-gray-700">Pass Rate</span>
              <span className={`text-sm font-bold ${hasFailures ? 'text-red-700' : 'text-green-700'}`}>
                {passRate}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${hasFailures ? 'bg-red-600' : 'bg-green-600'}`}
                style={{ width: `${passRate}%` }}
              />
            </div>
          </div>

          {/* Duration */}
          {report.duration && (
            <div className="mt-4 text-sm text-gray-600">
              <Clock className="inline mr-1" size={14} />
              Execution time: {formatDuration(report.duration)}
            </div>
          )}

          {/* Framework Badge */}
          {report.framework && (
            <div className="mt-2">
              <span className="inline-block px-3 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">
                {report.framework.toUpperCase()}
              </span>
            </div>
          )}

          {/* Failure Alert */}
          {hasFailures && (
            <div className="mt-4 p-4 bg-red-100 rounded-lg">
              <p className="text-sm font-bold text-red-900 mb-2">Test Failures Detected</p>
              <p className="text-sm text-red-800">
                {stats.failed} test{stats.failed > 1 ? 's' : ''} failed. Review the test output to identify issues with contract behavior.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
interface StatCardProps {
  label: string;
  value: number;
  color: 'slate' | 'green' | 'red' | 'yellow';
}

function StatCard({ label, value, color }: StatCardProps) {
  const colorClasses: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    green: 'bg-green-100 text-green-700 border-green-200',
    red: 'bg-red-100 text-red-700 border-red-200',
    yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  };

  return (
    <div className={`border-2 rounded-lg p-3 text-center ${colorClasses[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs uppercase tracking-wide">{label}</div>
    </div>
  );
}

// Format duration helper
function formatDuration(durationMs: number): string {
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  const seconds = Math.floor(durationMs / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}
