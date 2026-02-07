/**
 * Web3 Wallet Connection Hook
 *
 * Provides wallet connection functionality for MetaMask and other Web3 wallets.
 * Handles account changes, network changes, and disconnection.
 */

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { SUPPORTED_CHAINS, SupportedChainId } from '../../../src/constants/neuronsToken';

interface WalletState {
  isConnected: boolean;
  address: string | null;
  chainId: number | null;
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
  isConnecting: boolean;
  error: string | null;
}

interface UseWalletReturn extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => void;
  switchNetwork: (chainId: SupportedChainId) => Promise<void>;
}

declare global {
  interface Window {
    ethereum?: any;
  }
}

export function useWallet(): UseWalletReturn {
  const [state, setState] = useState<WalletState>({
    isConnected: false,
    address: null,
    chainId: null,
    provider: null,
    signer: null,
    isConnecting: false,
    error: null,
  });

  // Check if wallet is already connected
  useEffect(() => {
    const checkConnection = async () => {
      if (typeof window.ethereum !== 'undefined') {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const accounts = await provider.listAccounts();

          if (accounts.length > 0) {
            const signer = await provider.getSigner();
            const address = await signer.getAddress();
            const network = await provider.getNetwork();

            setState({
              isConnected: true,
              address,
              chainId: Number(network.chainId),
              provider,
              signer,
              isConnecting: false,
              error: null,
            });
          }
        } catch (error: any) {
          console.error('Failed to check wallet connection:', error);
        }
      }
    };

    checkConnection();
  }, []);

  // Listen for account changes
  useEffect(() => {
    if (typeof window.ethereum === 'undefined') return;

    const handleAccountsChanged = async (accounts: string[]) => {
      if (accounts.length === 0) {
        // User disconnected wallet
        setState({
          isConnected: false,
          address: null,
          chainId: null,
          provider: null,
          signer: null,
          isConnecting: false,
          error: null,
        });
      } else {
        // User switched accounts
        try {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();
          const address = await signer.getAddress();
          const network = await provider.getNetwork();

          setState(prev => ({
            ...prev,
            address,
            chainId: Number(network.chainId),
            provider,
            signer,
          }));
        } catch (error: any) {
          console.error('Failed to handle account change:', error);
        }
      }
    };

    const handleChainChanged = (chainId: string) => {
      // Reload page on chain change (recommended by MetaMask)
      window.location.reload();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      if (window.ethereum.removeListener) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, []);

  // Connect wallet
  const connect = useCallback(async () => {
    if (typeof window.ethereum === 'undefined') {
      setState(prev => ({
        ...prev,
        error: 'Please install MetaMask or another Web3 wallet',
      }));
      return;
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      // Request account access
      await window.ethereum.request({ method: 'eth_requestAccounts' });

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();

      setState({
        isConnected: true,
        address,
        chainId: Number(network.chainId),
        provider,
        signer,
        isConnecting: false,
        error: null,
      });
    } catch (error: any) {
      console.error('Failed to connect wallet:', error);
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: error.message || 'Failed to connect wallet',
      }));
    }
  }, []);

  // Disconnect wallet (clear state only - can't force disconnect from wallet)
  const disconnect = useCallback(() => {
    setState({
      isConnected: false,
      address: null,
      chainId: null,
      provider: null,
      signer: null,
      isConnecting: false,
      error: null,
    });
  }, []);

  // Switch network
  const switchNetwork = useCallback(async (targetChainId: SupportedChainId) => {
    if (typeof window.ethereum === 'undefined') {
      setState(prev => ({
        ...prev,
        error: 'Please install MetaMask to switch networks',
      }));
      return;
    }

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: ethers.toQuantity(targetChainId) }],
      });
    } catch (error: any) {
      // Error code 4902: chain not added to wallet
      if (error.code === 4902) {
        // Try to add BNB Chain if that's the target
        if (targetChainId === 56) {
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: ethers.toQuantity(56),
                chainName: 'BNB Smart Chain',
                nativeCurrency: {
                  name: 'BNB',
                  symbol: 'BNB',
                  decimals: 18
                },
                rpcUrls: ['https://bsc-dataseed.binance.org/'],
                blockExplorerUrls: ['https://bscscan.com/']
              }]
            });
          } catch (addError: any) {
            console.error('Failed to add BNB Chain:', addError);
            setState(prev => ({
              ...prev,
              error: 'Failed to add BNB Chain to wallet',
            }));
          }
        } else {
          setState(prev => ({
            ...prev,
            error: `Please add network ${targetChainId} to your wallet first`,
          }));
        }
      } else {
        console.error('Failed to switch network:', error);
        setState(prev => ({
          ...prev,
          error: error.message || 'Failed to switch network',
        }));
      }
    }
  }, []);

  return {
    ...state,
    connect,
    disconnect,
    switchNetwork,
  };
}

/**
 * Format address for display (0x1234...5678)
 */
export function formatAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Check if wallet is on supported network
 */
export function isSupportedNetwork(chainId: number | null): boolean {
  if (!chainId) return false;
  return Object.values(SUPPORTED_CHAINS).includes(chainId as SupportedChainId);
}

/**
 * Get network name
 */
export function getNetworkName(chainId: number | null): string {
  if (!chainId) return 'Unknown';

  const networks: Record<number, string> = {
    1: 'Ethereum Mainnet',
    5: 'Goerli Testnet',
    11155111: 'Sepolia Testnet',
    56: 'BNB Mainnet',
    97: 'BNB Testnet',
  };

  return networks[chainId] || `Chain ${chainId}`;
}
