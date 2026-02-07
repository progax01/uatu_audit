/**
 * Neurons Payment Service (Backend)
 *
 * Handles token deductions using ERC-20 approval + transferFrom pattern:
 * 1. User approves Uatu operator address for spending
 * 2. Backend checks allowance
 * 3. Backend pulls exact amount when audit completes
 */

import { ethers } from 'ethers';
import log from '../utils/logger.js';
import {
  NEURONS_TOKEN_ADDRESS,
  NEURONS_TOKEN_ABI,
  NEURONS_CHAIN_ID,
  BNB_CHAIN_RPC_URL,
  UATU_OPERATOR_ADDRESS,
  UATU_TREASURY_ADDRESS,
  neuronsToWei,
  weiToNeurons,
} from '../constants/neuronsToken.js';

// Operator wallet for pulling tokens (needs private key in .env)
const OPERATOR_PRIVATE_KEY = process.env.UATU_OPERATOR_PRIVATE_KEY;

if (!OPERATOR_PRIVATE_KEY) {
  log.warn('UATU_OPERATOR_PRIVATE_KEY not set in environment - Neurons payment disabled');
}

/**
 * Get BNB Chain provider and operator wallet
 */
function getOperatorWallet(): ethers.Wallet {
  if (!OPERATOR_PRIVATE_KEY) {
    throw new Error('UATU_OPERATOR_PRIVATE_KEY not configured');
  }

  const provider = new ethers.JsonRpcProvider(BNB_CHAIN_RPC_URL);
  return new ethers.Wallet(OPERATOR_PRIVATE_KEY, provider);
}

/**
 * Check if user has approved sufficient Neurons for spending
 */
export async function checkUserAllowance(
  userAddress: string,
  requiredNeurons: number
): Promise<{
  hasAllowance: boolean;
  allowanceNeurons: number;
  requiredNeurons: number;
  shortfall: number;
}> {
  try {
    const provider = new ethers.JsonRpcProvider(BNB_CHAIN_RPC_URL);
    const contract = new ethers.Contract(
      NEURONS_TOKEN_ADDRESS,
      NEURONS_TOKEN_ABI,
      provider
    );

    const allowanceWei = await contract.allowance(userAddress, UATU_OPERATOR_ADDRESS);
    const allowanceNeurons = weiToNeurons(allowanceWei);

    const hasAllowance = allowanceNeurons >= requiredNeurons;
    const shortfall = hasAllowance ? 0 : requiredNeurons - allowanceNeurons;

    log.info('Checked user Neurons allowance', {
      userAddress,
      allowanceNeurons,
      requiredNeurons,
      hasAllowance,
      shortfall,
    });

    return {
      hasAllowance,
      allowanceNeurons,
      requiredNeurons,
      shortfall,
    };
  } catch (error: any) {
    log.error('Failed to check user allowance', {
      userAddress,
      requiredNeurons,
      error: error.message,
    });
    throw new Error(`Failed to check Neurons allowance: ${error.message}`);
  }
}

/**
 * Check user's Neurons balance on BNB Chain
 */
export async function checkUserBalance(
  userAddress: string
): Promise<number> {
  try {
    const provider = new ethers.JsonRpcProvider(BNB_CHAIN_RPC_URL);
    const contract = new ethers.Contract(
      NEURONS_TOKEN_ADDRESS,
      NEURONS_TOKEN_ABI,
      provider
    );

    const balanceWei = await contract.balanceOf(userAddress);
    const balanceNeurons = weiToNeurons(balanceWei);

    log.info('Checked user Neurons balance', {
      userAddress,
      balanceNeurons,
    });

    return balanceNeurons;
  } catch (error: any) {
    log.error('Failed to check user balance', {
      userAddress,
      error: error.message,
    });
    throw new Error(`Failed to check Neurons balance: ${error.message}`);
  }
}

/**
 * Pull Neurons from user to treasury (requires prior approval)
 * This is called after audit completes to collect payment
 */
export async function collectPayment(
  userAddress: string,
  amountNeurons: number,
  jobId: string
): Promise<{
  success: boolean;
  txHash: string;
  amountNeurons: number;
  gasUsed: bigint;
}> {
  try {
    log.info('Collecting Neurons payment', {
      userAddress,
      amountNeurons,
      jobId,
      operator: UATU_OPERATOR_ADDRESS,
      treasury: UATU_TREASURY_ADDRESS,
    });

    // Get operator wallet
    const operatorWallet = getOperatorWallet();

    // Create contract instance with operator as signer
    const contract = new ethers.Contract(
      NEURONS_TOKEN_ADDRESS,
      NEURONS_TOKEN_ABI,
      operatorWallet
    );

    // Convert amount to wei
    const amountWei = neuronsToWei(amountNeurons);

    // Check allowance first
    const allowanceWei = await contract.allowance(userAddress, UATU_OPERATOR_ADDRESS);
    if (allowanceWei < amountWei) {
      throw new Error(
        `Insufficient allowance. Required: ${amountNeurons} Neurons, Approved: ${weiToNeurons(allowanceWei)} Neurons`
      );
    }

    // Pull tokens from user to treasury
    const tx = await contract.transferFrom(
      userAddress,
      UATU_TREASURY_ADDRESS,
      amountWei
    );

    log.info('Payment transaction sent', {
      txHash: tx.hash,
      userAddress,
      amountNeurons,
      jobId,
    });

    // Wait for confirmation
    const receipt = await tx.wait();

    log.info('Payment collected successfully', {
      txHash: receipt.hash,
      userAddress,
      amountNeurons,
      jobId,
      gasUsed: receipt.gasUsed.toString(),
      blockNumber: receipt.blockNumber,
    });

    return {
      success: true,
      txHash: receipt.hash,
      amountNeurons,
      gasUsed: receipt.gasUsed,
    };
  } catch (error: any) {
    log.error('Failed to collect payment', {
      userAddress,
      amountNeurons,
      jobId,
      error: error.message,
      errorCode: error.code,
    });
    throw new Error(`Payment collection failed: ${error.message}`);
  }
}

/**
 * Estimate gas cost for payment collection (in BNB)
 */
export async function estimateGasCost(
  userAddress: string,
  amountNeurons: number
): Promise<{
  gasLimit: bigint;
  gasPriceGwei: number;
  estimatedCostBNB: number;
}> {
  try {
    const operatorWallet = getOperatorWallet();
    const contract = new ethers.Contract(
      NEURONS_TOKEN_ADDRESS,
      NEURONS_TOKEN_ABI,
      operatorWallet
    );

    const amountWei = neuronsToWei(amountNeurons);

    // Estimate gas
    const gasLimit = await contract.transferFrom.estimateGas(
      userAddress,
      UATU_TREASURY_ADDRESS,
      amountWei
    );

    // Get current gas price
    const provider = operatorWallet.provider;
    if (!provider) throw new Error('Provider not available');

    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || 0n;
    const gasPriceGwei = Number(gasPrice) / 1e9;

    // Calculate cost in BNB
    const costWei = gasLimit * gasPrice;
    const estimatedCostBNB = Number(costWei) / 1e18;

    log.info('Estimated gas cost for payment', {
      gasLimit: gasLimit.toString(),
      gasPriceGwei,
      estimatedCostBNB,
    });

    return {
      gasLimit,
      gasPriceGwei,
      estimatedCostBNB,
    };
  } catch (error: any) {
    log.error('Failed to estimate gas cost', {
      error: error.message,
    });
    throw new Error(`Gas estimation failed: ${error.message}`);
  }
}

/**
 * Check operator wallet BNB balance (for gas)
 */
export async function checkOperatorGasBalance(): Promise<{
  balanceBNB: number;
  isLow: boolean;
}> {
  try {
    const operatorWallet = getOperatorWallet();
    const provider = operatorWallet.provider;
    if (!provider) throw new Error('Provider not available');

    const balanceWei = await provider.getBalance(operatorWallet.address);
    const balanceBNB = Number(balanceWei) / 1e18;

    const MIN_BNB_BALANCE = 0.01; // Warn if below 0.01 BNB
    const isLow = balanceBNB < MIN_BNB_BALANCE;

    if (isLow) {
      log.warn('Operator wallet BNB balance low', {
        operatorAddress: operatorWallet.address,
        balanceBNB,
        threshold: MIN_BNB_BALANCE,
      });
    }

    return {
      balanceBNB,
      isLow,
    };
  } catch (error: any) {
    log.error('Failed to check operator gas balance', {
      error: error.message,
    });
    throw new Error(`Failed to check operator balance: ${error.message}`);
  }
}
