/**
 * Payment Service
 *
 * Handles USDT transaction verification on supported chains.
 * Supports Ethereum, Polygon, and Arbitrum.
 */

import { logger } from '../utils/logger.js';

const log = logger.child({ service: 'payment-service' });

// USDT contract addresses by chain
export const USDT_CONTRACTS: Record<number, string> = {
  1: '0xdAC17F958D2ee523a2206206994597C13D831ec7',     // Ethereum Mainnet
  137: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',   // Polygon
  42161: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', // Arbitrum
};

// RPC endpoints by chain (use environment variables in production)
export const RPC_ENDPOINTS: Record<number, string> = {
  1: process.env.ETH_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/demo',
  137: process.env.POLYGON_RPC_URL || 'https://polygon-mainnet.g.alchemy.com/v2/demo',
  42161: process.env.ARBITRUM_RPC_URL || 'https://arb-mainnet.g.alchemy.com/v2/demo',
};

// Block explorer API endpoints
export const EXPLORER_API: Record<number, string> = {
  1: 'https://api.etherscan.io/api',
  137: 'https://api.polygonscan.com/api',
  42161: 'https://api.arbiscan.io/api',
};

// ERC20 Transfer event signature
const TRANSFER_EVENT_SIGNATURE = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

export interface TransactionVerificationResult {
  verified: boolean;
  from: string;
  to: string;
  amount: bigint;
  blockNumber: number;
  blockTimestamp: number;
  error?: string;
}

/**
 * Verify a USDT transfer transaction on-chain
 */
export async function verifyUsdtTransfer(
  txHash: string,
  chainId: number,
  expectedReceiver: string,
  expectedAmount: number // In USDT (not cents)
): Promise<TransactionVerificationResult> {
  const usdtContract = USDT_CONTRACTS[chainId];
  if (!usdtContract) {
    return {
      verified: false,
      from: '',
      to: '',
      amount: 0n,
      blockNumber: 0,
      blockTimestamp: 0,
      error: `Unsupported chain: ${chainId}`,
    };
  }

  const rpcUrl = RPC_ENDPOINTS[chainId];

  try {
    // Fetch transaction receipt
    const receiptResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getTransactionReceipt',
        params: [txHash],
        id: 1,
      }),
    });

    const receiptData = await receiptResponse.json() as { result?: any; error?: { message: string } };

    if (!receiptData.result) {
      return {
        verified: false,
        from: '',
        to: '',
        amount: 0n,
        blockNumber: 0,
        blockTimestamp: 0,
        error: 'Transaction not found or not yet confirmed',
      };
    }

    const receipt = receiptData.result;

    // Check if transaction was successful
    if (receipt.status !== '0x1') {
      return {
        verified: false,
        from: receipt.from || '',
        to: '',
        amount: 0n,
        blockNumber: parseInt(receipt.blockNumber, 16),
        blockTimestamp: 0,
        error: 'Transaction failed',
      };
    }

    // Check if the transaction interacted with USDT contract
    const toAddress = receipt.to?.toLowerCase();
    if (toAddress !== usdtContract.toLowerCase()) {
      return {
        verified: false,
        from: receipt.from || '',
        to: '',
        amount: 0n,
        blockNumber: parseInt(receipt.blockNumber, 16),
        blockTimestamp: 0,
        error: 'Transaction not sent to USDT contract',
      };
    }

    // Find Transfer event in logs
    const transferLog = receipt.logs?.find((log: any) => {
      return (
        log.address?.toLowerCase() === usdtContract.toLowerCase() &&
        log.topics?.[0] === TRANSFER_EVENT_SIGNATURE
      );
    });

    if (!transferLog) {
      return {
        verified: false,
        from: receipt.from || '',
        to: '',
        amount: 0n,
        blockNumber: parseInt(receipt.blockNumber, 16),
        blockTimestamp: 0,
        error: 'No USDT Transfer event found',
      };
    }

    // Decode Transfer event
    // topics[1] = from address (padded to 32 bytes)
    // topics[2] = to address (padded to 32 bytes)
    // data = amount
    const fromAddress = '0x' + transferLog.topics[1].slice(26);
    const toAddress2 = '0x' + transferLog.topics[2].slice(26);
    const amount = BigInt(transferLog.data);

    // Verify receiver matches expected
    if (toAddress2.toLowerCase() !== expectedReceiver.toLowerCase()) {
      return {
        verified: false,
        from: fromAddress,
        to: toAddress2,
        amount,
        blockNumber: parseInt(receipt.blockNumber, 16),
        blockTimestamp: 0,
        error: `Wrong receiver: expected ${expectedReceiver}, got ${toAddress2}`,
      };
    }

    // Verify amount (USDT has 6 decimals)
    const expectedAmountWei = BigInt(expectedAmount) * 1000000n;
    if (amount < expectedAmountWei) {
      return {
        verified: false,
        from: fromAddress,
        to: toAddress2,
        amount,
        blockNumber: parseInt(receipt.blockNumber, 16),
        blockTimestamp: 0,
        error: `Insufficient amount: expected ${expectedAmountWei}, got ${amount}`,
      };
    }

    // Get block timestamp
    const blockResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getBlockByNumber',
        params: [receipt.blockNumber, false],
        id: 2,
      }),
    });

    const blockData = await blockResponse.json() as { result?: { timestamp?: string } };
    const blockTimestamp = blockData.result?.timestamp
      ? parseInt(blockData.result.timestamp, 16)
      : 0;

    log.info('USDT transfer verified', {
      txHash,
      chainId,
      from: fromAddress,
      to: toAddress2,
      amount: amount.toString(),
      blockNumber: parseInt(receipt.blockNumber, 16),
    });

    return {
      verified: true,
      from: fromAddress,
      to: toAddress2,
      amount,
      blockNumber: parseInt(receipt.blockNumber, 16),
      blockTimestamp,
    };
  } catch (error) {
    log.error('Failed to verify USDT transfer', {
      error,
      txHash,
      chainId,
    });

    return {
      verified: false,
      from: '',
      to: '',
      amount: 0n,
      blockNumber: 0,
      blockTimestamp: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if a transaction hash has already been processed
 */
export function isValidTxHash(txHash: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(txHash);
}

/**
 * Get chain name from chain ID
 */
export function getChainName(chainId: number): string {
  const chains: Record<number, string> = {
    1: 'Ethereum',
    137: 'Polygon',
    42161: 'Arbitrum',
  };
  return chains[chainId] || `Chain ${chainId}`;
}

/**
 * Get block explorer URL for a transaction
 */
export function getExplorerUrl(txHash: string, chainId: number): string {
  const explorers: Record<number, string> = {
    1: 'https://etherscan.io',
    137: 'https://polygonscan.com',
    42161: 'https://arbiscan.io',
  };
  const explorer = explorers[chainId] || 'https://etherscan.io';
  return `${explorer}/tx/${txHash}`;
}
