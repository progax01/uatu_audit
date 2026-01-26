/**
 * Vault Security Panel Component
 *
 * Specialized UI for DeFi vault audit results.
 * Displays:
 * - Share Math Verification
 * - Reentrancy Risk Matrix
 * - Oracle Dependency Graph
 * - Admin Privilege Analysis
 */

import React, { useState } from 'react';
import {
  Shield, AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronRight,
  Lock, Unlock, TrendingUp, Clock, Activity
} from 'lucide-react';

import { formatLocation } from '../../utils/pathUtils';
interface VaultAnalysis {
  isVault: boolean;
  vaultType: 'ERC4626' | 'custom';
  hasSharesAccounting: boolean;
  hasReentrancyGuards: boolean;
  adminFunctions: string[];
  oracleDependencies: OracleDependency[];
  inflationRisk: 'high' | 'medium' | 'low' | 'none';
  shareMathFindings?: Finding[];
  reentrancyFindings?: ReentrancyFinding[];
}

interface OracleDependency {
  name: string;
  address: string | null;
  hasStalenessFallback: boolean;
  hasFallback: boolean;
}

interface Finding {
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  location: string;
  recommendation: string;
}

interface ReentrancyFinding {
  function: string;
  severity: 'critical' | 'high' | 'medium';
  externalCalls: string[];
  stateChangesAfterCall: boolean;
  canReenter: boolean;
  reentrancyPath: string;
}

interface VaultSecurityPanelProps {
  vaultAnalysis: VaultAnalysis;
}

export function VaultSecurityPanel({ vaultAnalysis }: VaultSecurityPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview']));

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  if (!vaultAnalysis.isVault) {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-xl p-6 mb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center">
          <Shield className="text-white" size={24} />
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-black text-purple-900">DeFi Vault Security Analysis</h2>
          <p className="text-sm text-purple-700 mt-1">
            Specialized audit for {vaultAnalysis.vaultType} vault contract
          </p>
        </div>
        <VaultRiskBadge risk={vaultAnalysis.inflationRisk} />
      </div>

      {/* Overview Section */}
      <Section
        title="Vault Overview"
        id="overview"
        expanded={expandedSections.has('overview')}
        onToggle={toggleSection}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Vault Type"
            value={vaultAnalysis.vaultType}
            icon={<Shield size={16} />}
            color="purple"
          />
          <StatCard
            label="Shares Accounting"
            value={vaultAnalysis.hasSharesAccounting ? 'Yes' : 'No'}
            icon={<TrendingUp size={16} />}
            color={vaultAnalysis.hasSharesAccounting ? 'green' : 'amber'}
          />
          <StatCard
            label="Reentrancy Guards"
            value={vaultAnalysis.hasReentrancyGuards ? 'Protected' : 'Missing'}
            icon={vaultAnalysis.hasReentrancyGuards ? <Lock size={16} /> : <Unlock size={16} />}
            color={vaultAnalysis.hasReentrancyGuards ? 'green' : 'red'}
          />
          <StatCard
            label="Admin Functions"
            value={vaultAnalysis.adminFunctions.length.toString()}
            icon={<Activity size={16} />}
            color={vaultAnalysis.adminFunctions.length > 5 ? 'amber' : 'slate'}
          />
        </div>
      </Section>

      {/* Share Calculation Section */}
      <Section
        title="Share Accounting Verification"
        id="share-math"
        expanded={expandedSections.has('share-math')}
        onToggle={toggleSection}
      >
        <div className="bg-white rounded-lg p-4">
          <h4 className="font-bold text-sm mb-3 text-slate-700 uppercase tracking-wide">
            Share Math Checks
          </h4>

          {vaultAnalysis.shareMathFindings && vaultAnalysis.shareMathFindings.length > 0 ? (
            <div className="space-y-3">
              {vaultAnalysis.shareMathFindings.map((finding, idx) => (
                <FindingCard key={idx} finding={finding} />
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="text-green-600" size={20} />
              <div>
                <p className="font-bold text-sm text-green-900">Share Math Verified</p>
                <p className="text-xs text-green-700 mt-1">
                  No issues detected in share calculation logic
                </p>
              </div>
            </div>
          )}

          {/* Inflation Attack Protection */}
          <div className="mt-4 p-4 bg-slate-50 rounded-lg">
            <h5 className="font-bold text-xs text-slate-700 mb-2 uppercase tracking-wide">
              Inflation Attack Protection
            </h5>
            <InflationRiskIndicator risk={vaultAnalysis.inflationRisk} />
          </div>
        </div>
      </Section>

      {/* Reentrancy Risk Matrix */}
      <Section
        title="Reentrancy Protection"
        id="reentrancy"
        expanded={expandedSections.has('reentrancy')}
        onToggle={toggleSection}
      >
        <div className="bg-white rounded-lg p-4">
          <h4 className="font-bold text-sm mb-3 text-slate-700 uppercase tracking-wide">
            Function-Level Risk Analysis
          </h4>

          {vaultAnalysis.reentrancyFindings && vaultAnalysis.reentrancyFindings.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-3 font-bold text-slate-700">Function</th>
                    <th className="text-center py-2 px-3 font-bold text-slate-700">External Calls</th>
                    <th className="text-center py-2 px-3 font-bold text-slate-700">State After Call</th>
                    <th className="text-center py-2 px-3 font-bold text-slate-700">Can Reenter</th>
                    <th className="text-center py-2 px-3 font-bold text-slate-700">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {vaultAnalysis.reentrancyFindings.map((finding, idx) => (
                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono text-slate-900">{finding.function}</td>
                      <td className="text-center py-2 px-3">
                        <span className="text-slate-600">{finding.externalCalls.length}</span>
                      </td>
                      <td className="text-center py-2 px-3">
                        {finding.stateChangesAfterCall ? (
                          <span className="text-red-600 font-bold">⚠️ Yes</span>
                        ) : (
                          <span className="text-green-600">✓ No</span>
                        )}
                      </td>
                      <td className="text-center py-2 px-3">
                        {finding.canReenter ? (
                          <XCircle className="text-red-600 inline" size={16} />
                        ) : (
                          <CheckCircle className="text-green-600 inline" size={16} />
                        )}
                      </td>
                      <td className="text-center py-2 px-3">
                        <SeverityBadge severity={finding.severity} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="text-green-600" size={20} />
              <div>
                <p className="font-bold text-sm text-green-900">No Reentrancy Risks Detected</p>
                <p className="text-xs text-green-700 mt-1">
                  All vault functions follow proper CEI (Checks-Effects-Interactions) pattern
                </p>
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* Oracle Dependencies */}
      <Section
        title="Oracle Dependencies"
        id="oracles"
        expanded={expandedSections.has('oracles')}
        onToggle={toggleSection}
      >
        <div className="bg-white rounded-lg p-4">
          <h4 className="font-bold text-sm mb-3 text-slate-700 uppercase tracking-wide">
            Price Oracle Configuration
          </h4>

          {vaultAnalysis.oracleDependencies.length > 0 ? (
            <div className="space-y-3">
              {vaultAnalysis.oracleDependencies.map((oracle, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex-1">
                    <p className="font-bold text-sm text-slate-900">{oracle.name}</p>
                    {oracle.address && (
                      <p className="text-xs text-slate-500 font-mono mt-1">{oracle.address}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <OracleCheck
                      label="Staleness"
                      passed={oracle.hasStalenessFallback}
                    />
                    <OracleCheck
                      label="Fallback"
                      passed={oracle.hasFallback}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <AlertTriangle className="text-blue-600" size={20} />
              <p className="text-sm text-blue-900">No oracle dependencies detected</p>
            </div>
          )}
        </div>
      </Section>

      {/* Admin Controls */}
      <Section
        title="Admin Privilege Analysis"
        id="admin"
        expanded={expandedSections.has('admin')}
        onToggle={toggleSection}
      >
        <div className="bg-white rounded-lg p-4">
          <h4 className="font-bold text-sm mb-3 text-slate-700 uppercase tracking-wide">
            Privileged Functions ({vaultAnalysis.adminFunctions.length})
          </h4>

          {vaultAnalysis.adminFunctions.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {vaultAnalysis.adminFunctions.map((func, idx) => (
                <div key={idx} className="p-2 bg-amber-50 border border-amber-200 rounded text-xs font-mono text-amber-900">
                  {func}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-600">No admin functions detected</p>
          )}

          {vaultAnalysis.adminFunctions.length > 5 && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={16} />
                <div>
                  <p className="text-xs font-bold text-amber-900">High Centralization Risk</p>
                  <p className="text-xs text-amber-800 mt-1">
                    Multiple admin functions detected. Consider timelock, multisig, or governance controls.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

function Section({ title, id, expanded, onToggle, children }: any) {
  return (
    <div className="mb-4">
      <button
        onClick={() => onToggle(id)}
        className="w-full flex items-center justify-between p-4 bg-white rounded-lg border-2 border-purple-100 hover:border-purple-300 transition-colors"
      >
        <h3 className="font-bold text-purple-900">{title}</h3>
        {expanded ? (
          <ChevronDown className="text-purple-600" size={20} />
        ) : (
          <ChevronRight className="text-purple-600" size={20} />
        )}
      </button>
      {expanded && (
        <div className="mt-2">
          {children}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color }: any) {
  const colorClasses: Record<string, string> = {
    purple: 'bg-purple-50 border-purple-200 text-purple-900',
    green: 'bg-green-50 border-green-200 text-green-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    red: 'bg-red-50 border-red-200 text-red-900',
    slate: 'bg-slate-50 border-slate-200 text-slate-900',
  };

  return (
    <div className={`p-4 rounded-lg border-2 ${colorClasses[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-bold uppercase tracking-wide opacity-70">{label}</span>
      </div>
      <div className="text-lg font-black">{value}</div>
    </div>
  );
}

function VaultRiskBadge({ risk }: { risk: string }) {
  const config: Record<string, { label: string; classes: string }> = {
    high: { label: 'HIGH RISK', classes: 'bg-red-600 text-white' },
    medium: { label: 'MEDIUM RISK', classes: 'bg-amber-500 text-white' },
    low: { label: 'LOW RISK', classes: 'bg-green-500 text-white' },
    none: { label: 'SECURE', classes: 'bg-emerald-600 text-white' },
  };

  const { label, classes } = config[risk] || config.none;

  return (
    <span className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wide ${classes}`}>
      {label}
    </span>
  );
}

function FindingCard({ finding }: { finding: Finding }) {
  const severityColors: Record<string, string> = {
    critical: 'bg-red-50 border-red-300 text-red-900',
    high: 'bg-orange-50 border-orange-300 text-orange-900',
    medium: 'bg-yellow-50 border-yellow-300 text-yellow-900',
    low: 'bg-blue-50 border-blue-300 text-blue-900',
  };

  return (
    <div className={`p-3 border-2 rounded-lg ${severityColors[finding.severity]}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="font-bold text-sm">{finding.title}</p>
        <SeverityBadge severity={finding.severity} />
      </div>
      <p className="text-xs mb-2">{finding.description}</p>
      <p className="text-xs font-mono bg-black/5 p-2 rounded">{formatLocation(finding.location)}</p>
      <div className="mt-2 pt-2 border-t border-current border-opacity-20">
        <p className="text-xs font-bold">Recommendation:</p>
        <p className="text-xs mt-1">{finding.recommendation}</p>
      </div>
    </div>
  );
}

function InflationRiskIndicator({ risk }: { risk: string }) {
  const config: Record<string, { text: string; icon: any; classes: string }> = {
    high: {
      text: 'Vulnerable to inflation attacks - First depositor protection missing',
      icon: <XCircle size={20} />,
      classes: 'bg-red-50 border-red-200 text-red-900',
    },
    medium: {
      text: 'Some protection exists but could be improved',
      icon: <AlertTriangle size={20} />,
      classes: 'bg-amber-50 border-amber-200 text-amber-900',
    },
    low: {
      text: 'Good protection against inflation attacks',
      icon: <CheckCircle size={20} />,
      classes: 'bg-green-50 border-green-200 text-green-900',
    },
    none: {
      text: 'Excellent protection - Multiple safeguards in place',
      icon: <CheckCircle size={20} />,
      classes: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    },
  };

  const { text, icon, classes } = config[risk] || config.none;

  return (
    <div className={`flex items-center gap-3 p-3 border rounded-lg ${classes}`}>
      {icon}
      <p className="text-xs font-bold">{text}</p>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const config: Record<string, { label: string; classes: string }> = {
    critical: { label: 'CRITICAL', classes: 'bg-red-600 text-white' },
    high: { label: 'HIGH', classes: 'bg-orange-500 text-white' },
    medium: { label: 'MEDIUM', classes: 'bg-yellow-500 text-white' },
    low: { label: 'LOW', classes: 'bg-blue-500 text-white' },
  };

  const { label, classes } = config[severity] || config.low;

  return (
    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-wide ${classes}`}>
      {label}
    </span>
  );
}

function OracleCheck({ label, passed }: { label: string; passed: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
        passed ? 'bg-green-100' : 'bg-red-100'
      }`}>
        {passed ? (
          <CheckCircle className="text-green-600" size={14} />
        ) : (
          <XCircle className="text-red-600" size={14} />
        )}
      </div>
      <span className="text-[10px] font-bold text-slate-600 mt-1">{label}</span>
    </div>
  );
}

export default VaultSecurityPanel;
