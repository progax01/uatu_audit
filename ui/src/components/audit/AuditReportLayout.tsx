import { ReactNode } from 'react';
import TokenEconomicsCard from './cards/TokenEconomicsCard';
import NFTCharacteristicsCard from './cards/NFTCharacteristicsCard';
import DeFiRiskCard from './cards/DeFiRiskCard';
import GovernanceCard from './cards/GovernanceCard';
import ProxySecurityCard from './cards/ProxySecurityCard';

type ContractCategory =
  | 'erc20-token'
  | 'erc721-nft'
  | 'erc1155-multi'
  | 'defi-amm'
  | 'defi-lending'
  | 'defi-staking'
  | 'governance'
  | 'bridge'
  | 'proxy-upgradeable'
  | 'multisig-wallet'
  | 'generic';

interface ContractClassification {
  category: ContractCategory;
  subCategory?: string;
  interfaces: string[];
  patterns: string[];
  confidence: number;
}

interface AuditData {
  contractClassification?: ContractClassification;
  tokenEconomics?: any;
  nftCharacteristics?: any;
  defiRisk?: any;
  governance?: any;
  proxySecurity?: any;
  preAuditAnswers?: Record<string, any>;
  [key: string]: any;
}

interface AuditReportLayoutProps {
  auditData: AuditData;
  children?: ReactNode;
}

/**
 * Adaptive layout component that renders contract-type aware sections
 * Based on detected contract category, displays relevant analysis cards
 */
export default function AuditReportLayout({ auditData, children }: AuditReportLayoutProps) {
  const contractClass = auditData.contractClassification;
  const category = contractClass?.category || 'generic';

  /**
   * Renders contract-specific analysis sections based on detected category
   * Each category gets tailored cards that match its security concerns
   */
  const renderContractSpecificSections = () => {
    const sections: ReactNode[] = [];

    // ERC20 Token Analysis
    if (category === 'erc20-token' && auditData.tokenEconomics) {
      sections.push(
        <TokenEconomicsCard
          key="token-economics"
          data={auditData.tokenEconomics}
          preAuditAnswers={auditData.preAuditAnswers}
        />
      );
    }

    // NFT Analysis (ERC721 & ERC1155)
    if ((category === 'erc721-nft' || category === 'erc1155-multi') && auditData.nftCharacteristics) {
      sections.push(
        <NFTCharacteristicsCard
          key="nft-characteristics"
          data={auditData.nftCharacteristics}
          preAuditAnswers={auditData.preAuditAnswers}
        />
      );
    }

    // DeFi Protocol Analysis (AMM, Lending, Staking)
    if (
      (category === 'defi-amm' || category === 'defi-lending' || category === 'defi-staking') &&
      auditData.defiRisk
    ) {
      sections.push(
        <DeFiRiskCard
          key="defi-risk"
          data={auditData.defiRisk}
          preAuditAnswers={auditData.preAuditAnswers}
        />
      );
    }

    // Governance Analysis
    if (category === 'governance' && auditData.governance) {
      sections.push(
        <GovernanceCard
          key="governance"
          data={auditData.governance}
          preAuditAnswers={auditData.preAuditAnswers}
        />
      );
    }

    // Proxy/Upgradeable Analysis
    if (category === 'proxy-upgradeable' && auditData.proxySecurity) {
      sections.push(
        <ProxySecurityCard
          key="proxy-security"
          data={auditData.proxySecurity}
          preAuditAnswers={auditData.preAuditAnswers}
        />
      );
    }

    // Bridge contracts often have special characteristics
    if (category === 'bridge') {
      // Bridge-specific analysis can be added here
      // For now, check if it has proxy characteristics
      if (auditData.proxySecurity) {
        sections.push(
          <ProxySecurityCard
            key="proxy-security"
            data={auditData.proxySecurity}
            preAuditAnswers={auditData.preAuditAnswers}
          />
        );
      }
    }

    // Multi-interface contracts (e.g., ERC20 + upgradeable)
    // Handle contracts implementing multiple patterns
    if (contractClass?.interfaces) {
      const interfaces = contractClass.interfaces;

      // Has token + proxy
      if (
        interfaces.includes('IERC20') &&
        interfaces.includes('Initializable') &&
        !sections.find((s) => s && typeof s === 'object' && 'key' in s && s.key === 'token-economics')
      ) {
        if (auditData.tokenEconomics) {
          sections.push(
            <TokenEconomicsCard
              key="token-economics-multi"
              data={auditData.tokenEconomics}
              preAuditAnswers={auditData.preAuditAnswers}
            />
          );
        }
        if (auditData.proxySecurity) {
          sections.push(
            <ProxySecurityCard
              key="proxy-security-multi"
              data={auditData.proxySecurity}
              preAuditAnswers={auditData.preAuditAnswers}
            />
          );
        }
      }

      // Has NFT + proxy
      if (
        (interfaces.includes('IERC721') || interfaces.includes('IERC1155')) &&
        interfaces.includes('Initializable') &&
        !sections.find((s) => s && typeof s === 'object' && 'key' in s && s.key === 'nft-characteristics')
      ) {
        if (auditData.nftCharacteristics) {
          sections.push(
            <NFTCharacteristicsCard
              key="nft-characteristics-multi"
              data={auditData.nftCharacteristics}
              preAuditAnswers={auditData.preAuditAnswers}
            />
          );
        }
        if (auditData.proxySecurity) {
          sections.push(
            <ProxySecurityCard
              key="proxy-security-nft"
              data={auditData.proxySecurity}
              preAuditAnswers={auditData.preAuditAnswers}
            />
          );
        }
      }
    }

    return sections;
  };

  const contractSpecificSections = renderContractSpecificSections();

  return (
    <div className="space-y-6">
      {/* Universal sections passed as children (summary, severity grid, etc.) */}
      {children}

      {/* Contract-specific sections based on detected category */}
      {contractSpecificSections.length > 0 && (
        <div className="space-y-6">
          {/* Optional divider if universal sections exist */}
          {children && (
            <div className="border-t border-gray-200 pt-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Contract-Specific Analysis
              </h2>
              {contractClass && (
                <div className="flex items-center gap-2 mb-6">
                  <span className="text-sm text-gray-600">Detected as:</span>
                  <span className="px-3 py-1 bg-indigo-100 text-indigo-800 text-sm font-medium rounded-full">
                    {category.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                  </span>
                  {contractClass.confidence !== undefined && (
                    <span className="text-xs text-gray-500">
                      ({Math.round(contractClass.confidence * 100)}% confidence)
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Render contract-specific cards */}
          {contractSpecificSections}
        </div>
      )}
    </div>
  );
}
