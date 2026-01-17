import { TrendingUp, Shield, AlertTriangle } from 'lucide-react';
import CheckItem from '../shared/CheckItem';

interface DeFiRiskData {
  oracleProvider?: string[];
  oracleTWAP?: boolean;
  flashLoanProtection?: boolean;
  flashLoanProtectionMechanism?: string;
  slippageProtection?: boolean;
  maxSlippage?: string;
  mevProtection?: boolean;
  reentrancyGuards?: boolean;
  ceiPattern?: boolean;
  liquidationThreshold?: string;
  collateralRatio?: string;
  priceManipulationRisk?: 'low' | 'medium' | 'high';
  frontrunningRisk?: 'low' | 'medium' | 'high';
  findings?: Array<{
    title: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    location?: { file: string; line: number };
  }>;
}

interface DeFiRiskCardProps {
  data: DeFiRiskData;
  preAuditAnswers?: Record<string, any>;
}

export default function DeFiRiskCard({ data, preAuditAnswers }: DeFiRiskCardProps) {
  const getOracleDisplay = () => {
    if (!data.oracleProvider || data.oracleProvider.length === 0) return '🔴 No oracle detected';
    const oracleList = data.oracleProvider.join(', ');
    if (oracleList.toLowerCase().includes('chainlink')) return `✅ ${oracleList}`;
    if (oracleList.toLowerCase().includes('twap')) return `✅ ${oracleList}`;
    if (oracleList.toLowerCase().includes('pyth')) return `✅ ${oracleList}`;
    return `⚠️ ${oracleList}`;
  };

  const getOracleSeverity = (): 'safe' | 'medium' | 'high' => {
    if (!data.oracleProvider || data.oracleProvider.length === 0) return 'high';
    const oracleList = data.oracleProvider.join(', ').toLowerCase();
    if (oracleList.includes('chainlink') || oracleList.includes('pyth') || data.oracleTWAP) return 'safe';
    return 'medium';
  };

  const getFlashLoanDisplay = () => {
    if (data.flashLoanProtection) {
      return `✅ Protected${data.flashLoanProtectionMechanism ? ` (${data.flashLoanProtectionMechanism})` : ''}`;
    }
    return '🔴 No flash loan protection';
  };

  const getSlippageDisplay = () => {
    if (data.slippageProtection) {
      return `✅ Implemented${data.maxSlippage ? ` (max ${data.maxSlippage})` : ''}`;
    }
    return '⚠️ No slippage protection';
  };

  const getMEVDisplay = () => {
    if (data.mevProtection) return '✅ MEV protection implemented';
    return '🔴 No MEV protection';
  };

  const getReentrancyDisplay = () => {
    if (data.reentrancyGuards && data.ceiPattern) return '✅ Guards + CEI pattern';
    if (data.reentrancyGuards) return '✅ ReentrancyGuard used';
    if (data.ceiPattern) return '⚠️ CEI pattern only';
    return '🔴 No protection detected';
  };

  const getReentrancySeverity = (): 'safe' | 'medium' | 'high' => {
    if (data.reentrancyGuards && data.ceiPattern) return 'safe';
    if (data.reentrancyGuards || data.ceiPattern) return 'medium';
    return 'high';
  };

  const getRiskLevel = (risk?: 'low' | 'medium' | 'high'): 'safe' | 'medium' | 'high' => {
    if (risk === 'low') return 'safe';
    if (risk === 'medium') return 'medium';
    return 'high';
  };

  const getRiskDisplay = (risk?: 'low' | 'medium' | 'high') => {
    if (risk === 'low') return '✅ Low risk';
    if (risk === 'medium') return '⚠️ Medium risk';
    return '🔴 High risk';
  };

  const findingCount = data.findings?.length || 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-cyan-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">DEFI RISK ANALYSIS</h3>
              <p className="text-sm text-gray-600">Oracle reliability, flash loans, and MEV protection</p>
            </div>
          </div>
          {findingCount > 0 && (
            <span className="px-3 py-1 bg-red-100 text-red-700 text-sm font-medium rounded-full">
              {findingCount} {findingCount === 1 ? 'Finding' : 'Findings'}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Oracle & Pricing Section */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-gray-600" />
            <h4 className="text-sm font-semibold text-gray-700 uppercase">Oracle & Pricing</h4>
          </div>
          <div className="space-y-3">
            <CheckItem
              label="Oracle Provider"
              value={getOracleDisplay()}
              severity={getOracleSeverity()}
              description={preAuditAnswers?.defi_oracle_provider}
            />

            {data.oracleTWAP && (
              <CheckItem
                label="TWAP Protection"
                value="✅ Time-weighted average pricing"
                severity="safe"
                description="Resistant to single-block manipulation"
              />
            )}

            <CheckItem
              label="Price Manipulation Risk"
              value={getRiskDisplay(data.priceManipulationRisk)}
              severity={getRiskLevel(data.priceManipulationRisk)}
            />
          </div>
        </div>

        {/* Flash Loan & Exploit Protection Section */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-gray-600" />
            <h4 className="text-sm font-semibold text-gray-700 uppercase">Flash Loan & Exploit Protection</h4>
          </div>
          <div className="space-y-3">
            <CheckItem
              label="Flash Loan Protection"
              value={getFlashLoanDisplay()}
              severity={data.flashLoanProtection ? 'safe' : 'high'}
              description={preAuditAnswers?.defi_flash_loan_protection}
            />

            <CheckItem
              label="Slippage Protection"
              value={getSlippageDisplay()}
              severity={data.slippageProtection ? 'safe' : 'medium'}
            />

            <CheckItem
              label="MEV Protection"
              value={getMEVDisplay()}
              severity={data.mevProtection ? 'safe' : 'medium'}
              description="Frontrunning and sandwich attack protection"
            />

            <CheckItem
              label="Frontrunning Risk"
              value={getRiskDisplay(data.frontrunningRisk)}
              severity={getRiskLevel(data.frontrunningRisk)}
            />
          </div>
        </div>

        {/* Reentrancy Protection Section */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-gray-600" />
            <h4 className="text-sm font-semibold text-gray-700 uppercase">Reentrancy Protection</h4>
          </div>
          <div className="space-y-3">
            <CheckItem
              label="Protection Mechanisms"
              value={getReentrancyDisplay()}
              severity={getReentrancySeverity()}
              description="Check-Effects-Interactions pattern and/or ReentrancyGuard"
            />
          </div>
        </div>

        {/* Liquidation Parameters (if applicable) */}
        {(data.liquidationThreshold || data.collateralRatio) && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-gray-600" />
              <h4 className="text-sm font-semibold text-gray-700 uppercase">Liquidation Parameters</h4>
            </div>
            <div className="space-y-3">
              {data.liquidationThreshold && (
                <CheckItem
                  label="Liquidation Threshold"
                  value={data.liquidationThreshold}
                  severity="info"
                />
              )}
              {data.collateralRatio && (
                <CheckItem
                  label="Collateral Ratio"
                  value={data.collateralRatio}
                  severity="info"
                />
              )}
            </div>
          </div>
        )}

        {/* Findings Section */}
        {data.findings && data.findings.length > 0 && (
          <div className="pt-4 border-t border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">DeFi Security Findings</h4>
            <div className="space-y-2">
              {data.findings.map((finding, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg text-sm"
                >
                  <span className={`
                    px-2 py-0.5 rounded text-xs font-medium
                    ${finding.severity === 'critical' ? 'bg-red-100 text-red-700' :
                      finding.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                      finding.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-blue-100 text-blue-700'}
                  `}>
                    {finding.severity.toUpperCase()}
                  </span>
                  <div className="flex-grow">
                    <div className="font-medium text-gray-900">{finding.title}</div>
                    {finding.location && (
                      <div className="text-xs text-gray-500 font-mono mt-1">
                        {finding.location.file}:{finding.location.line}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
