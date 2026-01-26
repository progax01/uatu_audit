import { Vote } from 'lucide-react';
import CheckItem from '../shared/CheckItem';
import DataRow from '../shared/DataRow';

interface GovernanceData {
  voteWeightMechanism?: 'linear' | 'quadratic' | 'delegation' | 'custom';
  quorumThreshold?: string;
  quorumType?: 'percentage' | 'absolute';
  votingPeriod?: string;
  timelockDuration?: string;
  timelockEnabled?: boolean;
  proposalThreshold?: string;
  flashLoanVulnerable?: boolean;
  snapshotMechanism?: boolean;
  delegationSupported?: boolean;
  vetoMechanism?: boolean;
  vetoAuthority?: string;
  executionDelay?: string;
  findings?: Array<{
    title: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    location?: { file: string; line: number };
  }>;
}

interface GovernanceCardProps {
  data: GovernanceData;
  preAuditAnswers?: Record<string, any>;
}

export default function GovernanceCard({ data, preAuditAnswers }: GovernanceCardProps) {
  const getVoteWeightDisplay = () => {
    if (!data.voteWeightMechanism) return 'ℹ️ Not detected';
    if (data.voteWeightMechanism === 'linear') return '✅ Linear (1 token = 1 vote)';
    if (data.voteWeightMechanism === 'quadratic') return '✅ Quadratic (sybil-resistant)';
    if (data.voteWeightMechanism === 'delegation') return '✅ Delegation-based';
    return '⚠️ Custom mechanism';
  };

  const getQuorumDisplay = () => {
    if (!data.quorumThreshold) return 'ℹ️ Not detected';
    const value = data.quorumThreshold;
    const type = data.quorumType || 'percentage';

    if (type === 'percentage') {
      const percent = parseFloat(value);
      if (percent < 5) return `🔴 Very low quorum (${value})`;
      if (percent < 10) return `⚠️ Low quorum (${value})`;
      return `✅ ${value} quorum`;
    }
    return `✅ ${value} votes required`;
  };

  const getQuorumSeverity = (): 'safe' | 'medium' | 'high' => {
    if (!data.quorumThreshold) return 'medium';
    if (data.quorumType === 'percentage') {
      const percent = parseFloat(data.quorumThreshold);
      if (percent < 5) return 'high';
      if (percent < 10) return 'medium';
    }
    return 'safe';
  };

  const getTimelockDisplay = () => {
    if (!data.timelockEnabled) return '🔴 No timelock';
    if (!data.timelockDuration) return '✅ Timelock enabled';

    const duration = data.timelockDuration.toLowerCase();
    if (duration.includes('hour') || duration.includes('minute')) {
      return `⚠️ Short timelock (${data.timelockDuration})`;
    }
    return `✅ ${data.timelockDuration} timelock`;
  };

  const getTimelockSeverity = (): 'safe' | 'medium' | 'high' => {
    if (!data.timelockEnabled) return 'high';
    if (!data.timelockDuration) return 'safe';

    const duration = data.timelockDuration.toLowerCase();
    if (duration.includes('hour') || duration.includes('minute')) return 'medium';
    return 'safe';
  };

  const getFlashLoanDisplay = () => {
    if (data.flashLoanVulnerable) return '🔴 Vulnerable to flash loan attacks';
    if (data.snapshotMechanism) return '✅ Protected (snapshot mechanism)';
    return '✅ Not vulnerable';
  };

  const getFlashLoanSeverity = (): 'safe' | 'medium' | 'high' => {
    if (data.flashLoanVulnerable) return 'high';
    return 'safe';
  };

  const getDelegationDisplay = () => {
    if (data.delegationSupported) return '✅ Delegation supported';
    return 'ℹ️ No delegation';
  };

  const getVetoDisplay = () => {
    if (!data.vetoMechanism) return 'ℹ️ No veto mechanism';
    if (data.vetoAuthority) return `⚠️ Veto by ${data.vetoAuthority}`;
    return '⚠️ Veto mechanism exists';
  };

  const findingCount = data.findings?.length || 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <Vote className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">GOVERNANCE MECHANISM</h3>
              <p className="text-sm text-gray-600">Voting, quorum, timelock, and execution controls</p>
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
          label="Vote Weight Mechanism"
          value={getVoteWeightDisplay()}
          severity={data.voteWeightMechanism === 'quadratic' ? 'safe' : 'info'}
          description={preAuditAnswers?.governance_vote_weight}
        />

        <CheckItem
          label="Quorum Threshold"
          value={getQuorumDisplay()}
          severity={getQuorumSeverity()}
          description={preAuditAnswers?.governance_quorum}
        />

        {data.votingPeriod && (
          <DataRow
            label="Voting Period"
            value={data.votingPeriod}
          />
        )}

        {data.proposalThreshold && (
          <DataRow
            label="Proposal Threshold"
            value={data.proposalThreshold}
          />
        )}

        <CheckItem
          label="Timelock Protection"
          value={getTimelockDisplay()}
          severity={getTimelockSeverity()}
          description={data.timelockEnabled ? 'Delay before proposal execution' : 'Proposals execute immediately'}
        />

        {data.executionDelay && (
          <DataRow
            label="Execution Delay"
            value={data.executionDelay}
          />
        )}

        <CheckItem
          label="Flash Loan Attack Risk"
          value={getFlashLoanDisplay()}
          severity={getFlashLoanSeverity()}
          description={data.snapshotMechanism ? 'Voting power snapshotted at proposal creation' : 'Check for flash loan voting manipulation'}
        />

        <CheckItem
          label="Vote Delegation"
          value={getDelegationDisplay()}
          severity="info"
        />

        {data.vetoMechanism && (
          <CheckItem
            label="Veto Mechanism"
            value={getVetoDisplay()}
            severity="medium"
            description="Centralized veto authority can block proposals"
          />
        )}

        {/* Findings Section */}
        {data.findings && data.findings.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Governance Findings</h4>
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
