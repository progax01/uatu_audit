/**
 * REFERENCE IMPLEMENTATION
 *
 * This file demonstrates how to integrate the new modular audit components
 * into the AuditDetails page. Use this as a guide when refactoring.
 *
 * Integration Steps:
 * 1. Import all new card components at the top of AuditDetails.tsx
 * 2. Transform existing auditData into the expected format for each card
 * 3. Replace monolithic sections with modular card components
 * 4. Use AuditReportLayout for contract-specific sections
 */

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

// Import new modular components
import AuditReportLayout from './AuditReportLayout';
import AuditSummaryCard from './cards/AuditSummaryCard';
import SeverityGridCard from './cards/SeverityGridCard';
import ScoreCard from './cards/ScoreCard';
import ToolResultCard from './cards/ToolResultCard';

export default function AuditDetailsExample() {
  const { jobId } = useParams<{ jobId: string }>();
  const [auditData, setAuditData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch audit data from backend
    fetch(`/api/audit/${jobId}/results`)
      .then(res => res.json())
      .then(data => {
        setAuditData(data);
        setLoading(false);
      });
  }, [jobId]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!auditData) {
    return <div>No audit data found</div>;
  }

  // Transform backend data into card-compatible format
  const summaryData = {
    projectName: auditData.projectName,
    contractAddress: auditData.contractAddress,
    network: auditData.network,
    framework: auditData.framework,
    auditDepth: auditData.depth,
    startedAt: auditData.startedAt,
    completedAt: auditData.completedAt,
    duration: auditData.duration,
    auditScore: auditData.score,
    totalFindings: auditData.findings?.length || 0,
    criticalCount: auditData.findings?.filter((f: any) => f.severity === 'critical').length || 0,
    highCount: auditData.findings?.filter((f: any) => f.severity === 'high').length || 0,
    mediumCount: auditData.findings?.filter((f: any) => f.severity === 'medium').length || 0,
    lowCount: auditData.findings?.filter((f: any) => f.severity === 'low').length || 0,
    linesOfCode: auditData.sloc,
    contractCount: auditData.contractCount,
    deployerAddress: auditData.deployerAddress,
  };

  const scoreData = {
    overallScore: auditData.score || 0,
    previousScore: auditData.previousScore,
    breakdown: auditData.scoreBreakdown,
    recommendation: auditData.scoreRecommendation,
  };

  const findings = auditData.findings || [];

  const toolResults = auditData.toolResults || [];

  // Contract-specific data (populated from backend based on contract type)
  const adaptiveData = {
    contractClassification: auditData.contractClassification,
    tokenEconomics: auditData.tokenEconomics,
    nftCharacteristics: auditData.nftCharacteristics,
    defiRisk: auditData.defiRisk,
    governance: auditData.governance,
    proxySecurity: auditData.proxySecurity,
    preAuditAnswers: auditData.preAuditAnswers,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Use AuditReportLayout with universal and contract-specific sections */}
        <AuditReportLayout auditData={adaptiveData}>
          {/* Universal sections (passed as children) */}
          <AuditSummaryCard data={summaryData} />
          <ScoreCard data={scoreData} />
          <SeverityGridCard findings={findings} />
          {toolResults.length > 0 && <ToolResultCard results={toolResults} />}
        </AuditReportLayout>
      </div>
    </div>
  );
}

/**
 * INTEGRATION GUIDE FOR EXISTING AuditDetails.tsx
 *
 * Step 1: Add imports at the top of AuditDetails.tsx
 * ------------------------------------------------
 * import AuditReportLayout from '../components/audit/AuditReportLayout';
 * import AuditSummaryCard from '../components/audit/cards/AuditSummaryCard';
 * import SeverityGridCard from '../components/audit/cards/SeverityGridCard';
 * import ScoreCard from '../components/audit/cards/ScoreCard';
 * import ToolResultCard from '../components/audit/cards/ToolResultCard';
 *
 *
 * Step 2: Transform existing data into card format
 * ------------------------------------------------
 * In the existing useEffect where you fetch auditData, add transformations:
 *
 * const summaryData = {
 *   projectName: auditData.project_name || auditData.projectName,
 *   contractAddress: auditData.contract_address || auditData.contractAddress,
 *   network: auditData.network,
 *   framework: auditData.framework,
 *   auditDepth: auditData.depth || auditData.audit_depth,
 *   startedAt: auditData.started_at || auditData.createdAt,
 *   completedAt: auditData.completed_at || auditData.completedAt,
 *   duration: calculateDuration(auditData.started_at, auditData.completed_at),
 *   auditScore: auditData.score,
 *   totalFindings: auditData.vulnerabilities?.length || 0,
 *   criticalCount: countBySeverity(auditData.vulnerabilities, 'critical'),
 *   highCount: countBySeverity(auditData.vulnerabilities, 'high'),
 *   mediumCount: countBySeverity(auditData.vulnerabilities, 'medium'),
 *   lowCount: countBySeverity(auditData.vulnerabilities, 'low'),
 *   linesOfCode: auditData.sloc || auditData.lines_of_code,
 *   contractCount: auditData.contract_count,
 *   deployerAddress: auditData.deployer_address,
 * };
 *
 *
 * Step 3: Replace monolithic sections with cards
 * ----------------------------------------------
 * Find the section that renders the audit report (likely under activeTab === 'report')
 *
 * BEFORE:
 * {activeTab === 'report' && (
 *   <div className="space-y-8">
 *     {/* Massive monolithic sections */}
 *     <div className="bg-white rounded-lg p-6">
 *       ... hundreds of lines of mixed UI ...
 *     </div>
 *   </div>
 * )}
 *
 * AFTER:
 * {activeTab === 'report' && (
 *   <AuditReportLayout auditData={adaptiveData}>
 *     <AuditSummaryCard data={summaryData} />
 *     <ScoreCard data={scoreData} />
 *     <SeverityGridCard findings={transformedFindings} />
 *     {toolResults.length > 0 && <ToolResultCard results={toolResults} />}
 *   </AuditReportLayout>
 * )}
 *
 *
 * Step 4: Transform findings data
 * -------------------------------
 * The existing vulnerabilities array needs to match the Finding interface:
 *
 * const transformedFindings = (auditData.vulnerabilities || []).map((vuln: any) => ({
 *   id: vuln.id,
 *   title: vuln.title || vuln.name,
 *   severity: vuln.severity?.toLowerCase(),
 *   description: vuln.description,
 *   category: vuln.category || vuln.type,
 *   location: vuln.location ? {
 *     file: vuln.location.file || vuln.location.contract,
 *     line: vuln.location.line,
 *     column: vuln.location.column,
 *   } : undefined,
 *   recommendation: vuln.recommendation || vuln.remediation,
 *   codeSnippet: vuln.code_snippet || vuln.snippet,
 * }));
 *
 *
 * Step 5: Transform tool results
 * ------------------------------
 * If you have tool execution results (Slither, Mythril, Semgrep):
 *
 * const toolResults = [
 *   {
 *     toolName: 'Slither',
 *     version: auditData.slitherVersion,
 *     status: auditData.slitherStatus === 'completed' ? 'success' : 'error',
 *     executionTime: auditData.slitherExecutionTime,
 *     findings: auditData.slitherFindings,
 *     summary: `Found ${auditData.slitherFindings?.length || 0} issues`,
 *   },
 *   {
 *     toolName: 'Mythril',
 *     version: auditData.mythrilVersion,
 *     status: auditData.mythrilStatus === 'completed' ? 'success' : 'error',
 *     executionTime: auditData.mythrilExecutionTime,
 *     findings: auditData.mythrilFindings,
 *   },
 *   // ... other tools
 * ];
 *
 *
 * Step 6: Prepare contract-specific data
 * --------------------------------------
 * For the adaptive layout to show contract-specific cards, prepare:
 *
 * const adaptiveData = {
 *   contractClassification: auditData.contract_classification || {
 *     category: detectContractType(auditData), // fallback if not provided
 *     interfaces: auditData.detected_interfaces || [],
 *     patterns: auditData.detected_patterns || [],
 *     confidence: auditData.classification_confidence || 0.8,
 *   },
 *
 *   // Token Economics (for ERC20)
 *   tokenEconomics: auditData.token_analysis ? {
 *     supplyType: auditData.token_analysis.supply_type,
 *     maxSupply: auditData.token_analysis.max_supply,
 *     mintingRestrictions: auditData.token_analysis.minting_restrictions,
 *     burningCapability: auditData.token_analysis.burning_capability,
 *     transferRestrictions: auditData.token_analysis.transfer_restrictions,
 *     transferFee: auditData.token_analysis.transfer_fee,
 *     maxFeePercentage: auditData.token_analysis.max_fee_percentage,
 *     pauseMechanism: auditData.token_analysis.pause_mechanism,
 *     findings: auditData.token_analysis.findings,
 *   } : undefined,
 *
 *   // NFT Characteristics (for ERC721/ERC1155)
 *   nftCharacteristics: auditData.nft_analysis ? {
 *     standard: auditData.nft_analysis.standard,
 *     maxSupply: auditData.nft_analysis.max_supply,
 *     supplyCapability: auditData.nft_analysis.supply_capability,
 *     metadataStorage: auditData.nft_analysis.metadata_storage,
 *     baseURI: auditData.nft_analysis.base_uri,
 *     baseURIChangeable: auditData.nft_analysis.base_uri_changeable,
 *     royaltiesSupported: auditData.nft_analysis.royalties_supported,
 *     royaltyStandard: auditData.nft_analysis.royalty_standard,
 *     findings: auditData.nft_analysis.findings,
 *   } : undefined,
 *
 *   // DeFi Risk (for AMM/Lending/Staking)
 *   defiRisk: auditData.defi_analysis ? {
 *     oracleProvider: auditData.defi_analysis.oracle_provider,
 *     oracleTWAP: auditData.defi_analysis.oracle_twap,
 *     flashLoanProtection: auditData.defi_analysis.flash_loan_protection,
 *     flashLoanProtectionMechanism: auditData.defi_analysis.flash_loan_protection_mechanism,
 *     slippageProtection: auditData.defi_analysis.slippage_protection,
 *     mevProtection: auditData.defi_analysis.mev_protection,
 *     reentrancyGuards: auditData.defi_analysis.reentrancy_guards,
 *     ceiPattern: auditData.defi_analysis.cei_pattern,
 *     priceManipulationRisk: auditData.defi_analysis.price_manipulation_risk,
 *     frontrunningRisk: auditData.defi_analysis.frontrunning_risk,
 *     findings: auditData.defi_analysis.findings,
 *   } : undefined,
 *
 *   // Governance (for governance contracts)
 *   governance: auditData.governance_analysis ? {
 *     voteWeightMechanism: auditData.governance_analysis.vote_weight_mechanism,
 *     quorumThreshold: auditData.governance_analysis.quorum_threshold,
 *     quorumType: auditData.governance_analysis.quorum_type,
 *     votingPeriod: auditData.governance_analysis.voting_period,
 *     timelockDuration: auditData.governance_analysis.timelock_duration,
 *     timelockEnabled: auditData.governance_analysis.timelock_enabled,
 *     flashLoanVulnerable: auditData.governance_analysis.flash_loan_vulnerable,
 *     snapshotMechanism: auditData.governance_analysis.snapshot_mechanism,
 *     findings: auditData.governance_analysis.findings,
 *   } : undefined,
 *
 *   // Proxy Security (for upgradeable contracts)
 *   proxySecurity: auditData.proxy_analysis ? {
 *     proxyPattern: auditData.proxy_analysis.proxy_pattern,
 *     upgradeAuthority: auditData.proxy_analysis.upgrade_authority,
 *     timelockProtection: auditData.proxy_analysis.timelock_protection,
 *     timelockDuration: auditData.proxy_analysis.timelock_duration,
 *     multiSigRequired: auditData.proxy_analysis.multisig_required,
 *     storageCollisionRisk: auditData.proxy_analysis.storage_collision_risk,
 *     initializerProtected: auditData.proxy_analysis.initializer_protected,
 *     upgradeability: auditData.proxy_analysis.upgradeability,
 *     findings: auditData.proxy_analysis.findings,
 *   } : undefined,
 *
 *   // Pre-audit questionnaire answers
 *   preAuditAnswers: auditData.pre_audit_answers || auditData.preAuditAnswers,
 * };
 *
 *
 * Step 7: Keep existing tabs and features
 * ---------------------------------------
 * The new cards are designed to work alongside existing features:
 * - Keep the tab system (report, triage, faq, testcases)
 * - Keep the claim ownership modal
 * - Keep the liability triage component
 * - Keep the milestone tracker
 * - Just replace the monolithic report section with modular cards
 *
 *
 * Step 8: Styling consistency
 * --------------------------
 * All new cards use Tailwind classes that match the existing design:
 * - rounded-2xl for card borders
 * - gradient backgrounds from-X-50 to-Y-50
 * - shadow-sm for subtle shadows
 * - Consistent spacing: p-6, space-y-6
 * - Color palette matches existing severity colors
 *
 *
 * Example helper functions to add:
 * -------------------------------
 */

// Helper to count findings by severity
function countBySeverity(findings: any[], severity: string): number {
  if (!findings) return 0;
  return findings.filter(f => f.severity?.toLowerCase() === severity).length;
}

// Helper to calculate duration
function calculateDuration(start?: string, end?: string): string {
  if (!start || !end) return 'N/A';
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  const diffMs = endTime - startTime;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 60) return `${diffMins} minutes`;
  const diffHours = Math.floor(diffMins / 60);
  const remainingMins = diffMins % 60;
  return `${diffHours}h ${remainingMins}m`;
}

// Fallback contract type detection (if backend doesn't provide classification)
function detectContractType(auditData: any): string {
  const interfaces = auditData.detected_interfaces || [];
  const code = auditData.source_code || '';

  if (interfaces.includes('IERC20')) return 'erc20-token';
  if (interfaces.includes('IERC721')) return 'erc721-nft';
  if (interfaces.includes('IERC1155')) return 'erc1155-multi';
  if (code.includes('function vote(') && code.includes('function propose(')) return 'governance';
  if (code.includes('upgradeTo') || code.includes('_implementation')) return 'proxy-upgradeable';
  if (code.includes('addLiquidity') || code.includes('swap')) return 'defi-amm';
  if (code.includes('borrow') || code.includes('liquidate')) return 'defi-lending';
  if (code.includes('stake') || code.includes('unstake')) return 'defi-staking';

  return 'generic';
}
