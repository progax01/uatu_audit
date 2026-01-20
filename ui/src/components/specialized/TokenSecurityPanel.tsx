/**
 * TokenSecurityPanel.tsx
 *
 * Specialized UI component for displaying token contract security analysis
 * Focuses on: Tax mechanisms, Honeypot detection, Ownership centralization
 */

import React, { useState } from 'react';
import {
  Coins,
  AlertTriangle,
  ShieldAlert,
  Lock,
  Unlock,
  TrendingUp,
  Users,
  Ban,
  Zap,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Info,
  DollarSign,
  UserX,
  Clock,
  Shield,
  Key,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface TokenAnalysis {
  isToken: boolean;
  standard: string; // "ERC20" | "ERC721" | "ERC1155"
  hasTaxMechanism: boolean;
  taxRates: {
    buy: number;
    sell: number;
    transfer: number;
  };
  canMint: boolean;
  canBurn: boolean;
  canPause: boolean;
  canChangeTax: boolean;
  ownershipRenounced: boolean;
  hasBlacklist: boolean;
  hasCooldown: boolean;
  honeypotIndicators?: HoneypotIndicator[];
  centralizationRisks?: CentralizationRisk[];
  safeguards?: Safeguard[];
}

interface HoneypotIndicator {
  type: 'hidden_mint' | 'sell_restriction' | 'blacklist' | 'tax_manipulation' | 'ownership_backdoor' | 'cooldown';
  severity: 'critical' | 'high' | 'medium';
  description: string;
  location: string;
  evidence: string;
}

interface CentralizationRisk {
  type: 'unlimited_mint' | 'pause_control' | 'tax_manipulation' | 'blacklist' | 'fund_extraction';
  severity: 'critical' | 'high' | 'medium';
  description: string;
  impact: string;
  mitigations: string[];
  hasTimelockProtection: boolean;
}

interface Safeguard {
  type: 'max_tax_limit' | 'timelock' | 'ownership_renounced' | 'multisig' | 'governance';
  present: boolean;
  description: string;
}

interface TokenSecurityPanelProps {
  tokenAnalysis: TokenAnalysis;
}

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

function Section({
  title,
  icon: Icon,
  children,
  defaultExpanded = true
}: {
  title: string;
  icon: any;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="bg-white rounded-xl border-2 border-emerald-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 transition-all"
      >
        <div className="flex items-center gap-3">
          <Icon className="text-emerald-600" size={24} />
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        </div>
        {expanded ? (
          <ChevronUp className="text-slate-400" size={20} />
        ) : (
          <ChevronDown className="text-slate-400" size={20} />
        )}
      </button>
      {expanded && <div className="p-6">{children}</div>}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color
}: {
  label: string;
  value: string | number;
  icon: any;
  color: 'green' | 'red' | 'yellow' | 'blue' | 'slate';
}) {
  const colorClasses = {
    green: 'bg-green-50 text-green-700 border-green-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
  };

  return (
    <div className={`border-2 rounded-lg p-4 ${colorClasses[color]}`}>
      <div className="flex items-center gap-3 mb-2">
        <Icon size={20} />
        <span className="text-sm font-bold">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function TokenRiskBadge({ risk }: { risk: 'critical' | 'high' | 'medium' | 'low' | 'none' }) {
  const badges = {
    critical: 'bg-red-100 text-red-800 border-red-300',
    high: 'bg-orange-100 text-orange-800 border-orange-300',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    low: 'bg-blue-100 text-blue-800 border-blue-300',
    none: 'bg-green-100 text-green-800 border-green-300',
  };

  const labels = {
    critical: 'CRITICAL RISK',
    high: 'High Risk',
    medium: 'Medium Risk',
    low: 'Low Risk',
    none: 'No Risk',
  };

  return (
    <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold border-2 ${badges[risk]}`}>
      {labels[risk]}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: 'critical' | 'high' | 'medium' | 'low' }) {
  const badges = {
    critical: 'bg-red-600 text-white',
    high: 'bg-orange-500 text-white',
    medium: 'bg-yellow-500 text-white',
    low: 'bg-blue-500 text-white',
  };

  return (
    <span className={`inline-block px-2 py-1 rounded text-xs font-bold uppercase ${badges[severity]}`}>
      {severity}
    </span>
  );
}

function TaxRateBar({ label, rate, color }: { label: string; rate: number; color: string }) {
  const percentage = Math.min(rate, 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-slate-700">{label}</span>
        <span className="text-sm font-bold" style={{ color }}>{rate}%</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
        <div
          className="h-3 rounded-full transition-all duration-500"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
      {rate > 10 && (
        <p className="text-xs text-orange-600 flex items-center gap-1">
          <AlertTriangle size={12} />
          High tax rate may deter trading
        </p>
      )}
    </div>
  );
}

function HoneypotCard({ indicator }: { indicator: HoneypotIndicator }) {
  const icons = {
    hidden_mint: Zap,
    sell_restriction: Ban,
    blacklist: UserX,
    tax_manipulation: DollarSign,
    ownership_backdoor: Key,
    cooldown: Clock,
  };

  const Icon = icons[indicator.type];

  return (
    <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <Icon className="text-red-600 flex-shrink-0 mt-1" size={20} />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <SeverityBadge severity={indicator.severity} />
            <span className="text-sm font-bold text-red-900">
              {indicator.type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
            </span>
          </div>
          <p className="text-sm text-red-800 mb-2">{indicator.description}</p>
          {indicator.evidence && (
            <pre className="bg-red-100 text-red-900 text-xs p-2 rounded overflow-x-auto">
              {indicator.evidence}
            </pre>
          )}
          <p className="text-xs text-red-600 mt-2">📍 {indicator.location}</p>
        </div>
      </div>
    </div>
  );
}

function CentralizationCard({ risk }: { risk: CentralizationRisk }) {
  return (
    <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="text-orange-600 flex-shrink-0 mt-1" size={20} />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <SeverityBadge severity={risk.severity} />
            <span className="text-sm font-bold text-orange-900">
              {risk.type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
            </span>
            {risk.hasTimelockProtection && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full border border-green-300">
                ⏱️ Timelock Protected
              </span>
            )}
          </div>
          <p className="text-sm text-orange-800 mb-2">{risk.description}</p>
          <div className="bg-orange-100 rounded p-2 mb-2">
            <p className="text-xs font-bold text-orange-900 mb-1">Impact:</p>
            <p className="text-xs text-orange-800">{risk.impact}</p>
          </div>
          {risk.mitigations.length > 0 && (
            <div>
              <p className="text-xs font-bold text-orange-900 mb-1">Mitigations:</p>
              <ul className="text-xs text-orange-800 list-disc ml-4 space-y-1">
                {risk.mitigations.map((mitigation, idx) => (
                  <li key={idx}>{mitigation}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SafeguardCheck({ safeguard }: { safeguard: Safeguard }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
      {safeguard.present ? (
        <CheckCircle2 className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
      ) : (
        <XCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
      )}
      <div>
        <p className="text-sm font-bold text-slate-900">
          {safeguard.type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
        </p>
        <p className="text-xs text-slate-600">{safeguard.description}</p>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function TokenSecurityPanel({ tokenAnalysis }: TokenSecurityPanelProps) {
  if (!tokenAnalysis?.isToken) {
    return null;
  }

  const isHoneypot = (tokenAnalysis.honeypotIndicators?.length || 0) > 0;
  const hasCriticalHoneypot = tokenAnalysis.honeypotIndicators?.some(i => i.severity === 'critical');
  const hasCentralizationRisk = (tokenAnalysis.centralizationRisks?.length || 0) > 0;
  const overallRisk = hasCriticalHoneypot ? 'critical' : isHoneypot ? 'high' : hasCentralizationRisk ? 'medium' : 'low';

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl p-6 shadow-lg">
        <div className="flex items-center gap-4 mb-4">
          <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
            <Coins size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Token Security Analysis</h2>
            <p className="text-emerald-100">
              {tokenAnalysis.standard} Token Contract
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <TokenRiskBadge risk={overallRisk} />
          {isHoneypot && (
            <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2">
              <ShieldAlert size={16} />
              HONEYPOT DETECTED
            </span>
          )}
        </div>
      </div>

      {/* Token Overview */}
      <Section title="Token Overview" icon={Info} defaultExpanded={true}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Standard"
            value={tokenAnalysis.standard}
            icon={Shield}
            color="blue"
          />
          <StatCard
            label="Tax Mechanism"
            value={tokenAnalysis.hasTaxMechanism ? 'Yes' : 'No'}
            icon={DollarSign}
            color={tokenAnalysis.hasTaxMechanism ? 'yellow' : 'green'}
          />
          <StatCard
            label="Ownership"
            value={tokenAnalysis.ownershipRenounced ? 'Renounced' : 'Active'}
            icon={tokenAnalysis.ownershipRenounced ? Lock : Unlock}
            color={tokenAnalysis.ownershipRenounced ? 'green' : 'red'}
          />
          <StatCard
            label="Honeypot Risk"
            value={isHoneypot ? 'YES' : 'NO'}
            icon={isHoneypot ? ShieldAlert : Shield}
            color={isHoneypot ? 'red' : 'green'}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
          <div className={`p-3 rounded-lg border-2 ${tokenAnalysis.canMint ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
            <div className="flex items-center gap-2 mb-1">
              <Zap size={16} className={tokenAnalysis.canMint ? 'text-red-600' : 'text-green-600'} />
              <span className="text-xs font-bold">Can Mint</span>
            </div>
            <p className={`text-sm font-bold ${tokenAnalysis.canMint ? 'text-red-700' : 'text-green-700'}`}>
              {tokenAnalysis.canMint ? 'Yes' : 'No'}
            </p>
          </div>
          <div className={`p-3 rounded-lg border-2 ${tokenAnalysis.canBurn ? 'bg-yellow-50 border-yellow-200' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-1">
              <Zap size={16} className={tokenAnalysis.canBurn ? 'text-yellow-600' : 'text-slate-600'} />
              <span className="text-xs font-bold">Can Burn</span>
            </div>
            <p className={`text-sm font-bold ${tokenAnalysis.canBurn ? 'text-yellow-700' : 'text-slate-700'}`}>
              {tokenAnalysis.canBurn ? 'Yes' : 'No'}
            </p>
          </div>
          <div className={`p-3 rounded-lg border-2 ${tokenAnalysis.canPause ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
            <div className="flex items-center gap-2 mb-1">
              <Ban size={16} className={tokenAnalysis.canPause ? 'text-red-600' : 'text-green-600'} />
              <span className="text-xs font-bold">Can Pause</span>
            </div>
            <p className={`text-sm font-bold ${tokenAnalysis.canPause ? 'text-red-700' : 'text-green-700'}`}>
              {tokenAnalysis.canPause ? 'Yes' : 'No'}
            </p>
          </div>
          <div className={`p-3 rounded-lg border-2 ${tokenAnalysis.hasBlacklist ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
            <div className="flex items-center gap-2 mb-1">
              <UserX size={16} className={tokenAnalysis.hasBlacklist ? 'text-red-600' : 'text-green-600'} />
              <span className="text-xs font-bold">Blacklist</span>
            </div>
            <p className={`text-sm font-bold ${tokenAnalysis.hasBlacklist ? 'text-red-700' : 'text-green-700'}`}>
              {tokenAnalysis.hasBlacklist ? 'Yes' : 'No'}
            </p>
          </div>
          <div className={`p-3 rounded-lg border-2 ${tokenAnalysis.hasCooldown ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
            <div className="flex items-center gap-2 mb-1">
              <Clock size={16} className={tokenAnalysis.hasCooldown ? 'text-orange-600' : 'text-green-600'} />
              <span className="text-xs font-bold">Cooldown</span>
            </div>
            <p className={`text-sm font-bold ${tokenAnalysis.hasCooldown ? 'text-orange-700' : 'text-green-700'}`}>
              {tokenAnalysis.hasCooldown ? 'Yes' : 'No'}
            </p>
          </div>
        </div>
      </Section>

      {/* Tax Structure */}
      {tokenAnalysis.hasTaxMechanism && (
        <Section title="Tax Structure" icon={DollarSign} defaultExpanded={true}>
          <div className="space-y-4">
            <TaxRateBar label="Buy Tax" rate={tokenAnalysis.taxRates.buy} color="#10b981" />
            <TaxRateBar label="Sell Tax" rate={tokenAnalysis.taxRates.sell} color="#f59e0b" />
            <TaxRateBar label="Transfer Tax" rate={tokenAnalysis.taxRates.transfer} color="#3b82f6" />
          </div>

          {tokenAnalysis.canChangeTax && (
            <div className="mt-4 bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
              <div className="flex items-start gap-3">
                <AlertTriangle className="text-yellow-600 flex-shrink-0 mt-1" size={20} />
                <div>
                  <p className="text-sm font-bold text-yellow-900">Configurable Tax Rates</p>
                  <p className="text-xs text-yellow-800 mt-1">
                    Owner can modify tax rates. Verify maximum limits exist to prevent confiscatory taxation.
                  </p>
                </div>
              </div>
            </div>
          )}
        </Section>
      )}

      {/* Honeypot Detection */}
      {isHoneypot && (
        <Section title="Honeypot Detection" icon={ShieldAlert} defaultExpanded={true}>
          <div className="bg-red-100 border-l-4 border-red-600 p-4 rounded mb-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="text-red-600 flex-shrink-0 mt-1" size={24} />
              <div>
                <p className="text-sm font-bold text-red-900">
                  {hasCriticalHoneypot ? 'CRITICAL: ' : ''}HONEYPOT PATTERNS DETECTED
                </p>
                <p className="text-xs text-red-800 mt-1">
                  This token contains mechanisms that may trap investors and prevent selling. Exercise extreme caution.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {tokenAnalysis.honeypotIndicators?.map((indicator, idx) => (
              <HoneypotCard key={idx} indicator={indicator} />
            ))}
          </div>
        </Section>
      )}

      {/* Centralization Risks */}
      {hasCentralizationRisk && (
        <Section title="Ownership & Centralization" icon={Users} defaultExpanded={true}>
          <div className="mb-4">
            {tokenAnalysis.ownershipRenounced ? (
              <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
                <div className="flex items-center gap-3">
                  <Lock className="text-green-600" size={20} />
                  <div>
                    <p className="text-sm font-bold text-green-900">Ownership Renounced</p>
                    <p className="text-xs text-green-800 mt-1">
                      Contract ownership has been renounced. Admin functions cannot be called.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded">
                <div className="flex items-center gap-3">
                  <Unlock className="text-orange-600" size={20} />
                  <div>
                    <p className="text-sm font-bold text-orange-900">Active Ownership</p>
                    <p className="text-xs text-orange-800 mt-1">
                      Contract has an active owner with privileged functions. Review centralization risks below.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {tokenAnalysis.centralizationRisks?.map((risk, idx) => (
              <CentralizationCard key={idx} risk={risk} />
            ))}
          </div>
        </Section>
      )}

      {/* Safeguards */}
      {tokenAnalysis.safeguards && tokenAnalysis.safeguards.length > 0 && (
        <Section title="Security Safeguards" icon={Shield} defaultExpanded={true}>
          <div className="space-y-3">
            {tokenAnalysis.safeguards.map((safeguard, idx) => (
              <SafeguardCheck key={idx} safeguard={safeguard} />
            ))}
          </div>

          {tokenAnalysis.safeguards.every(s => s.present) && (
            <div className="mt-4 bg-green-50 border-l-4 border-green-500 p-4 rounded">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="text-green-600" size={20} />
                <p className="text-sm text-green-900">
                  <span className="font-bold">Well Protected:</span> All recommended safeguards are in place.
                </p>
              </div>
            </div>
          )}
        </Section>
      )}

      {/* Summary & Recommendations */}
      <Section title="Summary & Recommendations" icon={TrendingUp} defaultExpanded={false}>
        <div className="space-y-4">
          {isHoneypot && (
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
              <p className="text-sm font-bold text-red-900 mb-2">⚠️ Honeypot Risk</p>
              <p className="text-xs text-red-800">
                This token exhibits honeypot characteristics. Do not invest until issues are resolved.
              </p>
            </div>
          )}

          {tokenAnalysis.hasTaxMechanism && (
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
              <p className="text-sm font-bold text-yellow-900 mb-2">💰 Tax Mechanism</p>
              <p className="text-xs text-yellow-800">
                Buy: {tokenAnalysis.taxRates.buy}% | Sell: {tokenAnalysis.taxRates.sell}% | Transfer: {tokenAnalysis.taxRates.transfer}%
              </p>
              <p className="text-xs text-yellow-800 mt-2">
                Verify tax rates are reasonable and cannot be arbitrarily increased.
              </p>
            </div>
          )}

          {!tokenAnalysis.ownershipRenounced && (
            <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4">
              <p className="text-sm font-bold text-orange-900 mb-2">🔑 Active Ownership</p>
              <p className="text-xs text-orange-800">
                Owner retains control over critical functions. Ensure timelock delays and multi-sig protections are in place.
              </p>
            </div>
          )}

          {!isHoneypot && !hasCentralizationRisk && tokenAnalysis.ownershipRenounced && (
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
              <p className="text-sm font-bold text-green-900 mb-2">✅ Low Risk</p>
              <p className="text-xs text-green-800">
                No critical honeypot indicators or centralization risks detected. Standard precautions apply.
              </p>
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}
