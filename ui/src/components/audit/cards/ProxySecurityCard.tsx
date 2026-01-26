import { RefreshCw, Lock, AlertTriangle } from 'lucide-react';
import CheckItem from '../shared/CheckItem';
import DataRow from '../shared/DataRow';

interface ProxySecurityData {
  proxyPattern?: 'transparent' | 'uups' | 'beacon' | 'diamond' | 'custom';
  upgradeAuthority?: string;
  timelockProtection?: boolean;
  timelockDuration?: string;
  multiSigRequired?: boolean;
  multiSigThreshold?: string;
  storageCollisionRisk?: boolean;
  initializerProtected?: boolean;
  upgradeability?: 'fully-upgradeable' | 'partially-upgradeable' | 'immutable';
  adminSeparation?: boolean;
  emergencyPause?: boolean;
  upgradeHistory?: number;
  lastUpgradeDate?: string;
  findings?: Array<{
    title: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    location?: { file: string; line: number };
  }>;
}

interface ProxySecurityCardProps {
  data: ProxySecurityData;
  preAuditAnswers?: Record<string, any>;
}

export default function ProxySecurityCard({ data, preAuditAnswers }: ProxySecurityCardProps) {
  const getProxyPatternDisplay = () => {
    if (!data.proxyPattern) return 'ℹ️ Not detected';
    if (data.proxyPattern === 'transparent') return '✅ Transparent Proxy (OpenZeppelin)';
    if (data.proxyPattern === 'uups') return '✅ UUPS Proxy (EIP-1822)';
    if (data.proxyPattern === 'beacon') return '✅ Beacon Proxy';
    if (data.proxyPattern === 'diamond') return '⚠️ Diamond Proxy (EIP-2535)';
    return '⚠️ Custom proxy pattern';
  };

  const getProxyPatternSeverity = (): 'safe' | 'medium' | 'high' => {
    if (!data.proxyPattern) return 'medium';
    if (data.proxyPattern === 'transparent' || data.proxyPattern === 'uups' || data.proxyPattern === 'beacon') return 'safe';
    return 'medium';
  };

  const getUpgradeAuthorityDisplay = () => {
    if (!data.upgradeAuthority) return '🔴 Authority not identified';
    const authority = data.upgradeAuthority.toLowerCase();

    if (authority.includes('multisig')) {
      return `✅ MultiSig${data.multiSigThreshold ? ` (${data.multiSigThreshold})` : ''}`;
    }
    if (authority.includes('timelock')) return '✅ Timelock contract';
    if (authority.includes('governance')) return '✅ Governance DAO';
    if (authority.includes('owner') || authority.includes('admin')) return '⚠️ Single owner/admin';
    return `⚠️ ${data.upgradeAuthority}`;
  };

  const getUpgradeAuthoritySeverity = (): 'safe' | 'medium' | 'high' => {
    if (!data.upgradeAuthority) return 'high';
    const authority = data.upgradeAuthority.toLowerCase();

    if (authority.includes('multisig') || authority.includes('governance')) return 'safe';
    if (authority.includes('timelock')) return 'safe';
    return 'medium';
  };

  const getTimelockDisplay = () => {
    if (!data.timelockProtection) return '🔴 No timelock';
    if (data.timelockDuration) {
      const duration = data.timelockDuration.toLowerCase();
      if (duration.includes('day') || duration.includes('week')) {
        return `✅ ${data.timelockDuration} timelock`;
      }
      return `⚠️ Short timelock (${data.timelockDuration})`;
    }
    return '✅ Timelock enabled';
  };

  const getTimelockSeverity = (): 'safe' | 'medium' | 'high' => {
    if (!data.timelockProtection) return 'high';
    if (!data.timelockDuration) return 'medium';

    const duration = data.timelockDuration.toLowerCase();
    if (duration.includes('hour') || duration.includes('minute')) return 'medium';
    return 'safe';
  };

  const getStorageCollisionDisplay = () => {
    if (data.storageCollisionRisk) return '🔴 Storage collision risk detected';
    return '✅ No storage collision detected';
  };

  const getInitializerDisplay = () => {
    if (data.initializerProtected) return '✅ Initializer protected';
    return '🔴 Initializer not protected';
  };

  const getUpgradeabilityDisplay = () => {
    if (!data.upgradeability) return 'ℹ️ Not determined';
    if (data.upgradeability === 'immutable') return '✅ Immutable (cannot upgrade)';
    if (data.upgradeability === 'fully-upgradeable') return '⚠️ Fully upgradeable';
    return '⚠️ Partially upgradeable';
  };

  const getAdminSeparationDisplay = () => {
    if (data.adminSeparation) return '✅ Admin logic separated';
    return '⚠️ Admin logic not separated';
  };

  const findingCount = data.findings?.length || 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <RefreshCw className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">PROXY & UPGRADEABILITY</h3>
              <p className="text-sm text-gray-600">Upgrade mechanism, access control, and storage safety</p>
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
        {/* Proxy Pattern Section */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <RefreshCw className="w-4 h-4 text-gray-600" />
            <h4 className="text-sm font-semibold text-gray-700 uppercase">Proxy Pattern</h4>
          </div>
          <div className="space-y-3">
            <CheckItem
              label="Proxy Implementation"
              value={getProxyPatternDisplay()}
              severity={getProxyPatternSeverity()}
              description={preAuditAnswers?.proxy_pattern}
            />

            <CheckItem
              label="Upgradeability Status"
              value={getUpgradeabilityDisplay()}
              severity={data.upgradeability === 'immutable' ? 'safe' : 'medium'}
            />

            {data.upgradeHistory !== undefined && (
              <DataRow
                label="Upgrade History"
                value={`${data.upgradeHistory} upgrade${data.upgradeHistory === 1 ? '' : 's'}`}
              />
            )}

            {data.lastUpgradeDate && (
              <DataRow
                label="Last Upgrade"
                value={data.lastUpgradeDate}
              />
            )}
          </div>
        </div>

        {/* Access Control Section */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Lock className="w-4 h-4 text-gray-600" />
            <h4 className="text-sm font-semibold text-gray-700 uppercase">Upgrade Access Control</h4>
          </div>
          <div className="space-y-3">
            <CheckItem
              label="Upgrade Authority"
              value={getUpgradeAuthorityDisplay()}
              severity={getUpgradeAuthoritySeverity()}
              description={preAuditAnswers?.proxy_upgrade_authority}
            />

            <CheckItem
              label="Timelock Protection"
              value={getTimelockDisplay()}
              severity={getTimelockSeverity()}
              description="Delay between upgrade proposal and execution"
            />

            {data.multiSigRequired && (
              <CheckItem
                label="Multi-Signature"
                value={`✅ Required${data.multiSigThreshold ? ` (${data.multiSigThreshold})` : ''}`}
                severity="safe"
              />
            )}

            <CheckItem
              label="Admin Separation"
              value={getAdminSeparationDisplay()}
              severity={data.adminSeparation ? 'safe' : 'medium'}
              description="Proxy admin logic separated from implementation"
            />
          </div>
        </div>

        {/* Storage Safety Section */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-gray-600" />
            <h4 className="text-sm font-semibold text-gray-700 uppercase">Storage Safety</h4>
          </div>
          <div className="space-y-3">
            <CheckItem
              label="Storage Layout"
              value={getStorageCollisionDisplay()}
              severity={data.storageCollisionRisk ? 'high' : 'safe'}
              description="Check for storage slot collision between proxy and implementation"
            />

            <CheckItem
              label="Initializer Protection"
              value={getInitializerDisplay()}
              severity={data.initializerProtected ? 'safe' : 'high'}
              description="Prevents re-initialization attacks"
            />
          </div>
        </div>

        {/* Emergency Controls */}
        {data.emergencyPause && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Lock className="w-4 h-4 text-gray-600" />
              <h4 className="text-sm font-semibold text-gray-700 uppercase">Emergency Controls</h4>
            </div>
            <CheckItem
              label="Emergency Pause"
              value="✅ Emergency pause mechanism"
              severity="safe"
              description="Contract can be paused in case of emergency"
            />
          </div>
        )}

        {/* Findings Section */}
        {data.findings && data.findings.length > 0 && (
          <div className="pt-4 border-t border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Proxy Security Findings</h4>
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
                        {formatLocation(finding.location)}
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
