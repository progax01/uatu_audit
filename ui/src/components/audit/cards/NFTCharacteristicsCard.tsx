import { Image } from 'lucide-react';
import CheckItem from '../shared/CheckItem';
import DataRow from '../shared/DataRow';

interface NFTCharacteristicsData {
  standard?: 'ERC721' | 'ERC1155' | 'ERC721A' | 'other';
  maxSupply?: string;
  supplyCapability?: 'capped' | 'unlimited';
  metadataStorage?: 'on-chain' | 'ipfs-pinned' | 'ipfs-unpinned' | 'arweave' | 'centralized';
  baseURI?: string;
  baseURIChangeable?: boolean;
  royaltiesSupported?: boolean;
  royaltyStandard?: 'ERC2981' | 'custom' | 'none';
  royaltyPercentage?: string;
  mintRestrictions?: string;
  burnCapability?: string;
  soulbound?: boolean;
  findings?: Array<{
    title: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    location?: { file: string; line: number };
  }>;
}

interface NFTCharacteristicsCardProps {
  data: NFTCharacteristicsData;
  preAuditAnswers?: Record<string, any>;
}

export default function NFTCharacteristicsCard({ data, preAuditAnswers }: NFTCharacteristicsCardProps) {
  const getStandardDisplay = () => {
    if (data.standard === 'ERC721') return '✅ ERC721 (standard)';
    if (data.standard === 'ERC1155') return '✅ ERC1155 (multi-token)';
    if (data.standard === 'ERC721A') return '✅ ERC721A (gas optimized)';
    return 'ℹ️ Custom implementation';
  };

  const getSupplyDisplay = () => {
    if (data.supplyCapability === 'capped') {
      return `✅ Capped at ${data.maxSupply || 'unknown'}`;
    }
    return '⚠️ Unlimited minting';
  };

  const getMetadataDisplay = () => {
    if (!data.metadataStorage) return 'ℹ️ Not detected';
    if (data.metadataStorage === 'on-chain') return '✅ On-chain (immutable)';
    if (data.metadataStorage === 'ipfs-pinned') return '✅ IPFS (pinned)';
    if (data.metadataStorage === 'ipfs-unpinned') return '⚠️ IPFS (unpinned)';
    if (data.metadataStorage === 'arweave') return '✅ Arweave (permanent)';
    return '🔴 Centralized server';
  };

  const getMetadataSeverity = (): 'safe' | 'medium' | 'high' => {
    if (data.metadataStorage === 'on-chain' || data.metadataStorage === 'arweave') return 'safe';
    if (data.metadataStorage === 'ipfs-pinned') return 'safe';
    if (data.metadataStorage === 'ipfs-unpinned') return 'medium';
    return 'high';
  };

  const getBaseURIDisplay = () => {
    if (!data.baseURIChangeable) return '✅ Immutable base URI';
    return '⚠️ Owner can change base URI';
  };

  const getRoyaltiesDisplay = () => {
    if (!data.royaltiesSupported) return 'ℹ️ No royalties';
    if (data.royaltyStandard === 'ERC2981') {
      return `✅ ERC2981${data.royaltyPercentage ? ` (${data.royaltyPercentage})` : ''}`;
    }
    if (data.royaltyStandard === 'custom') return '⚠️ Custom implementation';
    return '✅ Supported';
  };

  const getMintingDisplay = () => {
    if (!data.mintRestrictions) return 'ℹ️ Not detected';
    if (data.mintRestrictions.toLowerCase().includes('public')) return '⚠️ Public minting';
    if (data.mintRestrictions.toLowerCase().includes('owner')) return '✅ Owner only';
    if (data.mintRestrictions.toLowerCase().includes('whitelist')) return '✅ Whitelist only';
    return data.mintRestrictions;
  };

  const getBurningDisplay = () => {
    if (!data.burnCapability) return 'ℹ️ Not detected';
    if (data.burnCapability.toLowerCase().includes('owner')) return '✅ Owner can burn';
    if (data.burnCapability.toLowerCase().includes('none')) return '⚠️ No burning';
    return data.burnCapability;
  };

  const findingCount = data.findings?.length || 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <Image className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">NFT CHARACTERISTICS</h3>
              <p className="text-sm text-gray-600">Token standard, supply, and metadata properties</p>
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
        <DataRow
          label="Token Standard"
          value={getStandardDisplay()}
        />

        <CheckItem
          label="Max Supply"
          value={getSupplyDisplay()}
          severity={data.supplyCapability === 'capped' ? 'safe' : 'medium'}
          description={preAuditAnswers?.nft_max_supply}
        />

        <CheckItem
          label="Metadata Storage"
          value={getMetadataDisplay()}
          severity={getMetadataSeverity()}
          description={data.baseURI ? `Base URI: ${data.baseURI.substring(0, 50)}...` : undefined}
        />

        <CheckItem
          label="Base URI"
          value={getBaseURIDisplay()}
          severity={data.baseURIChangeable ? 'medium' : 'safe'}
        />

        <CheckItem
          label="Royalties"
          value={getRoyaltiesDisplay()}
          severity={data.royaltyStandard === 'ERC2981' ? 'safe' : 'info'}
          description={preAuditAnswers?.nft_royalties}
        />

        <CheckItem
          label="Minting Access"
          value={getMintingDisplay()}
          severity={data.mintRestrictions?.toLowerCase().includes('public') ? 'medium' : 'safe'}
        />

        <CheckItem
          label="Burning"
          value={getBurningDisplay()}
          severity="info"
        />

        {data.soulbound && (
          <CheckItem
            label="Soulbound"
            value="✅ Non-transferable (soulbound)"
            severity="info"
            description="Tokens cannot be transferred after minting"
          />
        )}

        {/* Findings Section */}
        {data.findings && data.findings.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">NFT-Specific Findings</h4>
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
