import { Coins } from 'lucide-react';
import CheckItem from '../shared/CheckItem';

interface TokenEconomicsData {
  supplyType?: 'capped' | 'mintable' | 'unlimited';
  maxSupply?: string;
  mintingRestrictions?: string;
  burningCapability?: string;
  transferRestrictions?: string[];
  transferFee?: boolean;
  maxFeePercentage?: string;
  pauseMechanism?: boolean;
  findings?: Array<{
    title: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    location?: { file: string; line: number };
  }>;
}

interface TokenEconomicsCardProps {
  data: TokenEconomicsData;
  preAuditAnswers?: Record<string, any>;
}

export default function TokenEconomicsCard({ data, preAuditAnswers }: TokenEconomicsCardProps) {
  const getSeverityFromSupplyType = (type?: string): 'safe' | 'medium' | 'high' => {
    if (type === 'capped') return 'safe';
    if (type === 'mintable') return 'medium';
    return 'high';
  };

  const getSupplyDisplay = () => {
    if (data.supplyType === 'capped') return '✅ Capped (fixed supply)';
    if (data.supplyType === 'mintable') return '⚠️ Mintable';
    return '🔴 Unlimited minting';
  };

  const getMintingDisplay = () => {
    if (!data.mintingRestrictions) return 'ℹ️ Not detected';
    if (data.mintingRestrictions.toLowerCase().includes('owner')) return '⚠️ Owner can mint';
    if (data.mintingRestrictions.toLowerCase().includes('none')) return '✅ No minting (fixed supply)';
    return data.mintingRestrictions;
  };

  const getBurningDisplay = () => {
    if (!data.burningCapability) return 'ℹ️ Not detected';
    if (data.burningCapability.toLowerCase().includes('holders')) return '✅ Public burn (by holders)';
    if (data.burningCapability.toLowerCase().includes('none')) return '⚠️ No burning mechanism';
    return data.burningCapability;
  };

  const findingCount = data.findings?.length || 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-yellow-50 to-orange-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <Coins className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">TOKEN ECONOMICS</h3>
              <p className="text-sm text-gray-600">Supply, minting, burning, and transfer mechanics</p>
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
      <div className="p-6 space-y-4">
        <CheckItem
          label="Total Supply"
          value={getSupplyDisplay()}
          severity={getSeverityFromSupplyType(data.supplyType)}
          description={data.maxSupply ? `Max supply: ${data.maxSupply}` : undefined}
        />

        <CheckItem
          label="Minting"
          value={getMintingDisplay()}
          severity={data.supplyType === 'capped' ? 'safe' : 'medium'}
          description={preAuditAnswers?.token_minting_restrictions}
        />

        <CheckItem
          label="Burning"
          value={getBurningDisplay()}
          severity={data.burningCapability ? 'safe' : 'info'}
        />

        {data.transferRestrictions && data.transferRestrictions.length > 0 && (
          <CheckItem
            label="Transfer Restrictions"
            value={data.transferRestrictions.join(', ')}
            severity="medium"
          />
        )}

        <CheckItem
          label="Transfer Tax/Fee"
          value={data.transferFee ? `🔴 Yes${data.maxFeePercentage ? ` (max ${data.maxFeePercentage})` : ' (no limits)'}` : '✅ No transfer fees'}
          severity={data.transferFee ? 'high' : 'safe'}
        />

        <CheckItem
          label="Pause Mechanism"
          value={data.pauseMechanism ? '✅ Implemented' : 'ℹ️ No pause mechanism'}
          severity={data.pauseMechanism ? 'safe' : 'info'}
        />

        {/* Findings Section */}
        {data.findings && data.findings.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Token Economics Findings</h4>
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
