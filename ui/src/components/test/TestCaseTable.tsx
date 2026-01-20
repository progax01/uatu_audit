/**
 * TestCaseTable.tsx
 *
 * Displays parsed test cases in a filterable, sortable table
 * Shows: test name, status, duration, gas usage, severity (for failed tests)
 */

import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Zap,
  Filter,
  Search,
  ChevronDown,
  ChevronUp,
  FileText,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export interface TestCase {
  id: string;
  name: string;
  contract: string;
  function: string;
  type: 'behavioral' | 'stride' | 'owasp' | 'fuzzing' | 'unit';
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  gasUsed?: number;
  error?: string;
  severity?: 'critical' | 'high' | 'medium';
}

export interface TestExecutionStats {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  totalDuration: number;
  avgGasUsed?: number;
}

interface TestCaseTableProps {
  testCases: TestCase[];
  stats: TestExecutionStats;
}

type SortField = 'name' | 'status' | 'duration' | 'gasUsed' | 'severity';
type SortDirection = 'asc' | 'desc';

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

function StatusBadge({ status }: { status: TestCase['status'] }) {
  const badges = {
    passed: { icon: CheckCircle2, color: 'bg-green-100 text-green-700 border-green-300', label: 'Passed' },
    failed: { icon: XCircle, color: 'bg-red-100 text-red-700 border-red-300', label: 'Failed' },
    skipped: { icon: AlertCircle, color: 'bg-yellow-100 text-yellow-700 border-yellow-300', label: 'Skipped' },
  };

  const { icon: Icon, color, label } = badges[status];

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${color}`}>
      <Icon size={14} />
      {label}
    </span>
  );
}

function TypeBadge({ type }: { type: TestCase['type'] }) {
  const badges = {
    behavioral: { color: 'bg-blue-100 text-blue-700 border-blue-300', label: 'Behavioral' },
    stride: { color: 'bg-purple-100 text-purple-700 border-purple-300', label: 'STRIDE' },
    owasp: { color: 'bg-orange-100 text-orange-700 border-orange-300', label: 'OWASP' },
    fuzzing: { color: 'bg-pink-100 text-pink-700 border-pink-300', label: 'Fuzzing' },
    unit: { color: 'bg-slate-100 text-slate-700 border-slate-300', label: 'Unit' },
  };

  const { color, label } = badges[type];

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${color}`}>
      {label}
    </span>
  );
}

function SeverityBadge({ severity }: { severity?: 'critical' | 'high' | 'medium' }) {
  if (!severity) return null;

  const badges = {
    critical: 'bg-red-600 text-white',
    high: 'bg-orange-500 text-white',
    medium: 'bg-yellow-500 text-white',
  };

  return (
    <span className={`inline-block px-2 py-1 rounded text-xs font-bold uppercase ${badges[severity]}`}>
      {severity}
    </span>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: any;
  color: string;
}) {
  return (
    <div className={`${color} rounded-lg p-4 border-2`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={20} />
        <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function TestCaseTable({ testCases, stats }: TestCaseTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TestCase['status'] | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<TestCase['type'] | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<'critical' | 'high' | 'medium' | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('status');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Filtering
  const filteredTests = useMemo(() => {
    return testCases.filter((test) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !test.name.toLowerCase().includes(query) &&
          !test.contract.toLowerCase().includes(query) &&
          !test.function.toLowerCase().includes(query)
        ) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'all' && test.status !== statusFilter) {
        return false;
      }

      // Type filter
      if (typeFilter !== 'all' && test.type !== typeFilter) {
        return false;
      }

      // Severity filter (only for failed tests)
      if (severityFilter !== 'all') {
        if (!test.severity || test.severity !== severityFilter) {
          return false;
        }
      }

      return true;
    });
  }, [testCases, searchQuery, statusFilter, typeFilter, severityFilter]);

  // Sorting
  const sortedTests = useMemo(() => {
    return [...filteredTests].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'status':
          const statusOrder = { failed: 0, skipped: 1, passed: 2 };
          comparison = statusOrder[a.status] - statusOrder[b.status];
          break;
        case 'duration':
          comparison = a.duration - b.duration;
          break;
        case 'gasUsed':
          comparison = (a.gasUsed || 0) - (b.gasUsed || 0);
          break;
        case 'severity':
          const severityOrder = { critical: 0, high: 1, medium: 2 };
          const aSev = a.severity ? severityOrder[a.severity] : 999;
          const bSev = b.severity ? severityOrder[b.severity] : 999;
          comparison = aSev - bSev;
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredTests, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const passRate = stats.total > 0 ? ((stats.passed / stats.total) * 100).toFixed(1) : '0';
  const avgDuration = stats.total > 0 ? (stats.totalDuration / stats.total).toFixed(0) : '0';

  return (
    <div className="space-y-6">
      {/* Statistics Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          label="Total Tests"
          value={stats.total}
          icon={FileText}
          color="bg-slate-50 text-slate-700 border-slate-200"
        />
        <StatCard
          label="Passed"
          value={stats.passed}
          icon={CheckCircle2}
          color="bg-green-50 text-green-700 border-green-200"
        />
        <StatCard
          label="Failed"
          value={stats.failed}
          icon={XCircle}
          color="bg-red-50 text-red-700 border-red-200"
        />
        <StatCard
          label="Skipped"
          value={stats.skipped}
          icon={AlertCircle}
          color="bg-yellow-50 text-yellow-700 border-yellow-200"
        />
        <StatCard
          label="Pass Rate"
          value={`${passRate}%`}
          icon={TrendingUp}
          color={
            Number(passRate) >= 90
              ? 'bg-green-50 text-green-700 border-green-200'
              : Number(passRate) >= 70
              ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
              : 'bg-red-50 text-red-700 border-red-200'
          }
        />
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-xl border-2 border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <Filter className="text-slate-600" size={20} />
          <h3 className="text-lg font-bold text-slate-900">Filters</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search tests..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
          >
            <option value="all">All Statuses</option>
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
            <option value="skipped">Skipped</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
          >
            <option value="all">All Types</option>
            <option value="behavioral">Behavioral</option>
            <option value="stride">STRIDE</option>
            <option value="owasp">OWASP</option>
            <option value="fuzzing">Fuzzing</option>
            <option value="unit">Unit</option>
          </select>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as any)}
            className="px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
          </select>
        </div>

        <div className="mt-3 text-sm text-slate-600">
          Showing <span className="font-bold text-slate-900">{sortedTests.length}</span> of{' '}
          <span className="font-bold text-slate-900">{testCases.length}</span> tests
        </div>
      </div>

      {/* Test Cases Table */}
      <div className="bg-white rounded-xl border-2 border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b-2 border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort('name')}
                    className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wide hover:text-slate-900"
                  >
                    Test Name
                    {sortField === 'name' &&
                      (sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Type</span>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort('status')}
                    className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wide hover:text-slate-900"
                  >
                    Status
                    {sortField === 'status' &&
                      (sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort('severity')}
                    className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wide hover:text-slate-900"
                  >
                    Severity
                    {sortField === 'severity' &&
                      (sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort('duration')}
                    className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wide hover:text-slate-900 ml-auto"
                  >
                    Duration
                    {sortField === 'duration' &&
                      (sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort('gasUsed')}
                    className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wide hover:text-slate-900 ml-auto"
                  >
                    Gas Used
                    {sortField === 'gasUsed' &&
                      (sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                  </button>
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sortedTests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    No tests match the current filters
                  </td>
                </tr>
              ) : (
                sortedTests.map((test) => (
                  <React.Fragment key={test.id}>
                    <tr
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => setExpandedRow(expandedRow === test.id ? null : test.id)}
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-bold text-slate-900">{test.function}</p>
                          <p className="text-xs text-slate-500">{test.contract}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <TypeBadge type={test.type} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={test.status} />
                      </td>
                      <td className="px-4 py-3">
                        <SeverityBadge severity={test.severity} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2 text-sm text-slate-700">
                          <Clock size={14} className="text-slate-400" />
                          {test.duration}ms
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {test.gasUsed ? (
                          <div className="flex items-center justify-end gap-2 text-sm text-slate-700">
                            <Zap size={14} className="text-slate-400" />
                            {test.gasUsed.toLocaleString()}
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {expandedRow === test.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </td>
                    </tr>
                    {expandedRow === test.id && (
                      <tr>
                        <td colSpan={7} className="px-4 py-4 bg-slate-50">
                          <div className="space-y-3">
                            <div>
                              <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Full Test Name</p>
                              <p className="text-sm text-slate-900 font-mono">{test.name}</p>
                            </div>
                            {test.error && (
                              <div>
                                <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-1 flex items-center gap-2">
                                  <AlertTriangle size={14} />
                                  Error Message
                                </p>
                                <pre className="text-xs text-red-900 bg-red-50 border border-red-200 rounded p-3 overflow-x-auto">
                                  {test.error}
                                </pre>
                              </div>
                            )}
                            {test.status === 'passed' && (
                              <div className="bg-green-50 border-l-4 border-green-500 p-3 rounded">
                                <p className="text-xs text-green-800">
                                  ✓ This test passed successfully, validating the expected behavior.
                                </p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Performance Summary */}
      {stats.avgGasUsed && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200 p-6">
          <h3 className="text-lg font-bold text-blue-900 mb-4">Performance Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-1">Avg Duration</p>
              <p className="text-2xl font-bold text-blue-900">{avgDuration}ms</p>
            </div>
            <div>
              <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-1">Avg Gas</p>
              <p className="text-2xl font-bold text-blue-900">{stats.avgGasUsed.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-1">Total Duration</p>
              <p className="text-2xl font-bold text-blue-900">{(stats.totalDuration / 1000).toFixed(2)}s</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
