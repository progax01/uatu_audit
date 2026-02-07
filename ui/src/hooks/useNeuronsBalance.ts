/**
 * Neurons Token Balance Hook
 *
 * Fetches and monitors user's Neurons ERC-20 token balance
 */

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import {
  NEURONS_TOKEN_ADDRESS,
  NEURONS_TOKEN_ABI,
  NEURONS_CHAIN_ID,
  BNB_CHAIN_RPC_URL,
  weiToNeurons,
  formatNeurons,
} from '../../../src/constants/neuronsToken';

// Re-export constants for convenience
export { NEURONS_CHAIN_ID, BNB_CHAIN_RPC_URL };

interface UseNeuronsBalanceReturn {
  balance: number | null; // Balance in Neurons (human-readable)
  balanceRaw: bigint | null; // Balance in wei
  balanceFormatted: string; // Formatted for display
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useNeuronsBalance(
  address: string | null,
  provider: ethers.BrowserProvider | null
): UseNeuronsBalanceReturn {
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceRaw, setBalanceRaw] = useState<bigint | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!address) {
      setBalance(null);
      setBalanceRaw(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Use read-only provider with public BNB Chain RPC
      // This allows checking balance regardless of user's connected network
      const bnbProvider = new ethers.JsonRpcProvider(BNB_CHAIN_RPC_URL);

      // Create contract instance using read-only BNB Chain provider
      const contract = new ethers.Contract(
        NEURONS_TOKEN_ADDRESS,
        NEURONS_TOKEN_ABI,
        bnbProvider
      );

      // Fetch balance from BNB Chain
      const balanceWei = await contract.balanceOf(address);
      const balanceNeurons = weiToNeurons(balanceWei);

      setBalanceRaw(balanceWei);
      setBalance(balanceNeurons);
    } catch (err: any) {
      console.error('Failed to fetch Neurons balance:', err);
      setError(err.message || 'Failed to fetch balance');
      setBalance(null);
      setBalanceRaw(null);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  // Fetch balance on mount and when address/provider changes
  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  // Poll balance every 30 seconds
  useEffect(() => {
    if (!address) return;

    const interval = setInterval(() => {
      fetchBalance();
    }, 30000);

    return () => clearInterval(interval);
  }, [address, fetchBalance]);

  // Listen for Transfer events affecting this address on BNB Chain
  useEffect(() => {
    if (!address) return;

    // Use read-only BNB Chain provider for event listening
    const bnbProvider = new ethers.JsonRpcProvider(BNB_CHAIN_RPC_URL);
    const contract = new ethers.Contract(
      NEURONS_TOKEN_ADDRESS,
      NEURONS_TOKEN_ABI,
      bnbProvider
    );

    // Filter for transfers to or from this address
    const filterTo = contract.filters.Transfer(null, address);
    const filterFrom = contract.filters.Transfer(address, null);

    const handleTransfer = () => {
      fetchBalance();
    };

    contract.on(filterTo, handleTransfer);
    contract.on(filterFrom, handleTransfer);

    return () => {
      contract.off(filterTo, handleTransfer);
      contract.off(filterFrom, handleTransfer);
    };
  }, [address, fetchBalance]);

  const balanceFormatted = balance !== null ? formatNeurons(balance) : '0';

  return {
    balance,
    balanceRaw,
    balanceFormatted,
    isLoading,
    error,
    refetch: fetchBalance,
  };
}

/**
 * Check if user has sufficient balance for a transaction
 */
export function hasSufficientBalance(
  userBalance: number | null,
  requiredAmount: number
): boolean {
  if (userBalance === null) return false;
  return userBalance >= requiredAmount;
}

/**
 * Check if user is on BNB Chain before write operations
 * Automatically prompts MetaMask to switch networks if needed
 */
export async function ensureBNBChain(provider: ethers.BrowserProvider): Promise<void> {
  const network = await provider.getNetwork();
  const currentChainId = Number(network.chainId);

  if (currentChainId !== NEURONS_CHAIN_ID) {
    // Prompt user to switch to BNB Chain
    try {
      await (window as any).ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${NEURONS_CHAIN_ID.toString(16)}` }], // 0x38 = 56
      });
    } catch (switchError: any) {
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        try {
          await (window as any).ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: `0x${NEURONS_CHAIN_ID.toString(16)}`,
                chainName: 'BNB Smart Chain',
                nativeCurrency: {
                  name: 'BNB',
                  symbol: 'BNB',
                  decimals: 18,
                },
                rpcUrls: [BNB_CHAIN_RPC_URL],
                blockExplorerUrls: ['https://bscscan.com'],
              },
            ],
          });
        } catch (addError) {
          throw new Error('Failed to add BNB Chain to your wallet. Please add it manually.');
        }
      } else {
        throw new Error('Please switch to BNB Chain in your wallet to continue.');
      }
    }
  }
}

/**
 * Approve Neurons tokens for spending (ERC-20 approval)
 * Requires user to be on BNB Chain
 */
export async function approveNeurons(
  signer: ethers.JsonRpcSigner,
  spenderAddress: string,
  amount: bigint
): Promise<string> {
  // Check network before write operation
  await ensureBNBChain(signer.provider as ethers.BrowserProvider);

  const contract = new ethers.Contract(
    NEURONS_TOKEN_ADDRESS,
    NEURONS_TOKEN_ABI,
    signer
  );

  const tx = await contract.approve(spenderAddress, amount);
  const receipt = await tx.wait();

  return receipt.hash;
}

/**
 * Transfer Neurons tokens
 * Requires user to be on BNB Chain
 */
export async function transferNeurons(
  signer: ethers.JsonRpcSigner,
  toAddress: string,
  amount: bigint
): Promise<string> {
  // Check network before write operation
  await ensureBNBChain(signer.provider as ethers.BrowserProvider);

  const contract = new ethers.Contract(
    NEURONS_TOKEN_ADDRESS,
    NEURONS_TOKEN_ABI,
    signer
  );

  const tx = await contract.transfer(toAddress, amount);
  const receipt = await tx.wait();

  return receipt.hash;
}

/**
 * Check allowance (how much spender can spend on behalf of owner)
 * This is a read-only operation, uses public BNB Chain RPC
 */
export async function checkAllowance(
  ownerAddress: string,
  spenderAddress: string
): Promise<bigint> {
  // Use read-only BNB Chain provider
  const bnbProvider = new ethers.JsonRpcProvider(BNB_CHAIN_RPC_URL);

  const contract = new ethers.Contract(
    NEURONS_TOKEN_ADDRESS,
    NEURONS_TOKEN_ABI,
    bnbProvider
  );

  const allowance = await contract.allowance(ownerAddress, spenderAddress);
  return allowance;
}
