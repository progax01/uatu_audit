/**
 * Neurons ERC-20 Token Configuration
 *
 * Neurons is the payment token for Uatu audit services.
 * Users pay based on lines of code (SLOC) analyzed and AI tokens consumed.
 */

// Neurons Token Contract Address (ERC-20)
export const NEURONS_TOKEN_ADDRESS = '0xE5251763988DcF2065cc67f085f9E131E2f81918';

// Neurons token is deployed on BNB Chain
export const NEURONS_CHAIN_ID = 56; // BNB Chain (BSC Mainnet)

// Public BNB Chain RPC for read-only operations (balance checks)
// This allows checking balance regardless of user's connected network
export const BNB_CHAIN_RPC_URL = 'https://bsc-dataseed.binance.org/';

// Supported chain IDs
export const SUPPORTED_CHAINS = {
  BNB: 56, // BNB Chain (BSC) - WHERE NEURONS TOKEN IS DEPLOYED
  ETHEREUM: 1,
  GOERLI: 5,
  SEPOLIA: 11155111,
  BNB_TESTNET: 97, // BSC Testnet
} as const;

export type SupportedChainId = typeof SUPPORTED_CHAINS[keyof typeof SUPPORTED_CHAINS];

// Default pricing (can be overridden by database config)
export const DEFAULT_PRICING = {
  NEURONS_PER_LOC: 0.001,           // 0.001 Neurons per line of code
  NEURONS_PER_1K_AI_TOKENS: 10,     // 10 Neurons per 1,000 AI tokens
  RESERVATION_BUFFER: 1.5,          // Reserve 150% of estimate (safety margin)
  GRACE_PERIOD_AUDITS: 1,           // Allow 1 audit to go into debt before blocking
} as const;

// Minimum amounts (prevent spam/abuse)
export const MINIMUM_AMOUNTS = {
  SLOC: 10,                         // Minimum 10 lines of code
  NEURONS_RESERVATION: 1,           // Minimum 1 Neuron reservation
  NEURONS_BALANCE: 0.1,             // Minimum balance to start audit
} as const;

// Token decimals (ERC-20 standard)
export const NEURONS_DECIMALS = 18;

// Calculate Neurons from human-readable amount
export function neuronsToWei(neurons: number): bigint {
  return BigInt(Math.floor(neurons * Math.pow(10, NEURONS_DECIMALS)));
}

// Calculate human-readable amount from Neurons wei
export function weiToNeurons(wei: bigint): number {
  return Number(wei) / Math.pow(10, NEURONS_DECIMALS);
}

// Format Neurons for display
export function formatNeurons(amount: number | bigint): string {
  const neurons = typeof amount === 'bigint' ? weiToNeurons(amount) : amount;

  if (neurons < 1) {
    return neurons.toFixed(4);
  } else if (neurons < 1000) {
    return neurons.toFixed(2);
  } else if (neurons < 1000000) {
    return `${(neurons / 1000).toFixed(2)}k`;
  } else {
    return `${(neurons / 1000000).toFixed(2)}M`;
  }
}

// ERC-20 Standard ABI (minimal - only functions we need)
export const NEURONS_TOKEN_ABI = [
  // Read functions
  {
    "constant": true,
    "inputs": [{ "name": "owner", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "name": "", "type": "uint256" }],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "decimals",
    "outputs": [{ "name": "", "type": "uint8" }],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "symbol",
    "outputs": [{ "name": "", "type": "string" }],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "name",
    "outputs": [{ "name": "", "type": "string" }],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      { "name": "owner", "type": "address" },
      { "name": "spender", "type": "address" }
    ],
    "name": "allowance",
    "outputs": [{ "name": "", "type": "uint256" }],
    "type": "function"
  },
  // Write functions
  {
    "constant": false,
    "inputs": [
      { "name": "spender", "type": "address" },
      { "name": "value", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [{ "name": "", "type": "bool" }],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      { "name": "to", "type": "address" },
      { "name": "value", "type": "uint256" }
    ],
    "name": "transfer",
    "outputs": [{ "name": "", "type": "bool" }],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      { "name": "from", "type": "address" },
      { "name": "to", "type": "address" },
      { "name": "value", "type": "uint256" }
    ],
    "name": "transferFrom",
    "outputs": [{ "name": "", "type": "bool" }],
    "type": "function"
  },
  // Events
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "name": "from", "type": "address" },
      { "indexed": true, "name": "to", "type": "address" },
      { "indexed": false, "name": "value", "type": "uint256" }
    ],
    "name": "Transfer",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "name": "owner", "type": "address" },
      { "indexed": true, "name": "spender", "type": "address" },
      { "indexed": false, "name": "value", "type": "uint256" }
    ],
    "name": "Approval",
    "type": "event"
  }
] as const;

// Platform wallet addresses
// OPERATOR WALLET: Backend uses this to pull tokens via transferFrom()
// Set UATU_OPERATOR_PRIVATE_KEY in .env (needs BNB for gas only)
export const UATU_OPERATOR_ADDRESS = process.env.UATU_OPERATOR_ADDRESS || '0x0000000000000000000000000000000000000000';

// TREASURY WALLET: Where revenue is sent (cold storage/multisig recommended)
export const UATU_TREASURY_ADDRESS = process.env.UATU_TREASURY_ADDRESS || '0x0000000000000000000000000000000000000000';

// Gas limits for token operations
export const GAS_LIMITS = {
  APPROVE: 100000n,
  TRANSFER: 65000n,
  TRANSFER_FROM: 100000n,
} as const;
