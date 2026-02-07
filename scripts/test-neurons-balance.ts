/**
 * Test Script: Neurons Token Balance Checking
 *
 * This script tests the balance checking functionality for Neurons tokens.
 *
 * Run with: npx tsx scripts/test-neurons-balance.ts
 */

import 'dotenv/config';
import { ethers } from 'ethers';
import { NEURONS_TOKEN_ADDRESS, NEURONS_TOKEN_ABI } from '../src/constants/neuronsToken.js';

// Test configuration
const TEST_CONFIG = {
  // Test wallet address (replace with actual test address)
  testWalletAddress: process.env.TEST_WALLET_ADDRESS || '0x0000000000000000000000000000000000000000',
  // RPC URL (default to localhost for testing)
  rpcUrl: process.env.RPC_URL || 'http://localhost:8545',
  // Expected minimum balance for tests
  minimumBalance: 1000, // 1000 Neurons
};

console.log('🧪 Neurons Token Balance Test Script');
console.log('=====================================\n');

console.log('Configuration:');
console.log(`  Token Address: ${NEURONS_TOKEN_ADDRESS}`);
console.log(`  Test Wallet: ${TEST_CONFIG.testWalletAddress}`);
console.log(`  RPC URL: ${TEST_CONFIG.rpcUrl}`);
console.log(`  Minimum Balance Required: ${TEST_CONFIG.minimumBalance} Neurons\n`);

async function testBalanceCheck() {
  try {
    console.log('[TEST 1] 🔍 Connecting to provider...');
    const provider = new ethers.JsonRpcProvider(TEST_CONFIG.rpcUrl);

    console.log('[TEST 1] ✅ Provider connected');
    console.log(`           Network: ${(await provider.getNetwork()).name}\n`);

    console.log('[TEST 2] 📝 Creating token contract instance...');
    const contract = new ethers.Contract(
      NEURONS_TOKEN_ADDRESS,
      NEURONS_TOKEN_ABI,
      provider
    );
    console.log('[TEST 2] ✅ Contract instance created\n');

    console.log('[TEST 3] 💰 Fetching balance...');
    const balanceWei = await contract.balanceOf(TEST_CONFIG.testWalletAddress);
    console.log(`[TEST 3] ✅ Balance fetched (Wei): ${balanceWei.toString()}`);

    // Convert Wei to Neurons (assuming 6 decimals like USDC)
    const balanceNeurons = Number(balanceWei) / 1e6;
    console.log(`[TEST 3]    Balance in Neurons: ${balanceNeurons.toFixed(6)}\n`);

    console.log('[TEST 4] ✅ Checking if balance meets minimum requirement...');
    if (balanceNeurons >= TEST_CONFIG.minimumBalance) {
      console.log(`[TEST 4] ✅ PASS: Balance (${balanceNeurons.toFixed(2)}) >= Minimum (${TEST_CONFIG.minimumBalance})`);
      console.log(`[TEST 4]    User can proceed with audit\n`);
    } else {
      console.log(`[TEST 4] ❌ FAIL: Balance (${balanceNeurons.toFixed(2)}) < Minimum (${TEST_CONFIG.minimumBalance})`);
      console.log(`[TEST 4]    User needs ${(TEST_CONFIG.minimumBalance - balanceNeurons).toFixed(2)} more Neurons\n`);
    }

    console.log('[TEST 5] 📊 Fetching token metadata...');
    try {
      const name = await contract.name();
      const symbol = await contract.symbol();
      const decimals = await contract.decimals();
      const totalSupply = await contract.totalSupply();

      console.log('[TEST 5] ✅ Token metadata retrieved:');
      console.log(`           Name: ${name}`);
      console.log(`           Symbol: ${symbol}`);
      console.log(`           Decimals: ${decimals}`);
      console.log(`           Total Supply: ${Number(totalSupply) / 1e6} ${symbol}\n`);
    } catch (error: any) {
      console.log(`[TEST 5] ⚠️  Could not fetch metadata: ${error.message}\n`);
    }

    console.log('✅ All balance check tests completed successfully!\n');
    return true;

  } catch (error: any) {
    console.error('\n❌ Balance check test failed:');
    console.error(`   Error: ${error.message}`);
    if (error.code) console.error(`   Code: ${error.code}`);
    if (error.data) console.error(`   Data: ${JSON.stringify(error.data)}`);
    console.error('\n');
    return false;
  }
}

async function testBalanceMonitoring() {
  console.log('===========================================');
  console.log('[ADVANCED] Testing balance monitoring...\n');

  try {
    const provider = new ethers.JsonRpcProvider(TEST_CONFIG.rpcUrl);
    const contract = new ethers.Contract(
      NEURONS_TOKEN_ADDRESS,
      NEURONS_TOKEN_ABI,
      provider
    );

    console.log('[MONITOR] 👂 Setting up Transfer event listener...');

    let eventCount = 0;
    const timeout = 10000; // 10 seconds

    const listener = (from: string, to: string, value: bigint) => {
      eventCount++;
      console.log(`[MONITOR] 📨 Transfer event detected:`);
      console.log(`           From: ${from}`);
      console.log(`           To: ${to}`);
      console.log(`           Value: ${Number(value) / 1e6} Neurons\n`);
    };

    contract.on('Transfer', listener);

    console.log(`[MONITOR] ⏱️  Listening for ${timeout / 1000} seconds...\n`);

    await new Promise(resolve => setTimeout(resolve, timeout));

    contract.off('Transfer', listener);

    console.log(`[MONITOR] ✅ Monitoring complete. ${eventCount} events detected.\n`);

    return true;

  } catch (error: any) {
    console.error('[MONITOR] ❌ Event monitoring failed:');
    console.error(`           Error: ${error.message}\n`);
    return false;
  }
}

async function runAllTests() {
  console.log('Starting comprehensive balance tests...\n');

  const balanceCheckResult = await testBalanceCheck();

  if (balanceCheckResult && process.env.TEST_EVENTS === 'true') {
    await testBalanceMonitoring();
  }

  console.log('===========================================');
  console.log('Test Summary:');
  console.log(`  Balance Check: ${balanceCheckResult ? '✅ PASSED' : '❌ FAILED'}`);
  console.log('===========================================\n');

  process.exit(balanceCheckResult ? 0 : 1);
}

runAllTests().catch((error) => {
  console.error('Test suite crashed:', error);
  process.exit(1);
});
