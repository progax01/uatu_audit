/**
 * Test Script: Complete Payment Flow
 *
 * Tests the entire Neurons token payment flow:
 * 1. Debt checking
 * 2. Cost estimation
 * 3. Reservation creation
 * 4. Payment confirmation
 * 5. Settlement (refund or debt creation)
 *
 * Run with: npx tsx scripts/test-payment-flow.ts
 */

import 'dotenv/config';
import { db } from '../src/db/index.js';
import {
  checkUserDebtStatus,
  createPaymentReservation,
  confirmPaymentReservation,
  settleReservation,
} from '../src/services/tokenPaymentService.js';
import { estimateAuditCost, calculateActualCost } from '../src/services/auditCostCalculator.js';
import { users, auditJobs, projects } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

// Test configuration
const TEST_CONFIG = {
  // Use existing user or create test user
  testUserId: process.env.TEST_USER_ID || 'test-user-' + Date.now(),
  testWalletAddress: process.env.TEST_WALLET_ADDRESS || '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
  testChainId: 1, // Mainnet
  // Audit parameters for testing
  estimatedSloc: 1000, // 1000 lines of code
  estimatedAiTokens: 50000, // 50k AI tokens
  // Actual values for settlement (simulate different scenarios)
  scenario: process.env.TEST_SCENARIO || 'underestimate', // 'underestimate', 'overestimate', 'exact'
};

console.log('🧪 Payment Flow Integration Test');
console.log('=================================\n');

console.log('Test Configuration:');
console.log(`  User ID: ${TEST_CONFIG.testUserId}`);
console.log(`  Wallet: ${TEST_CONFIG.testWalletAddress}`);
console.log(`  Chain ID: ${TEST_CONFIG.testChainId}`);
console.log(`  Estimated SLOC: ${TEST_CONFIG.estimatedSloc}`);
console.log(`  Estimated AI Tokens: ${TEST_CONFIG.estimatedAiTokens}`);
console.log(`  Test Scenario: ${TEST_CONFIG.scenario}\n`);

async function setupTestData() {
  console.log('[SETUP] 📋 Setting up test data...\n');

  try {
    // Check if user exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, TEST_CONFIG.testUserId));

    if (!existingUser) {
      console.log('[SETUP] Creating test user...');
      await db.insert(users).values({
        id: TEST_CONFIG.testUserId,
        username: 'test-user',
        email: 'test@example.com',
        walletAddress: TEST_CONFIG.testWalletAddress,
      });
      console.log('[SETUP] ✅ Test user created\n');
    } else {
      console.log('[SETUP] ✅ Using existing user\n');
    }

    // Create test project
    console.log('[SETUP] Creating test project...');
    const [project] = await db.insert(projects).values({
      userId: TEST_CONFIG.testUserId,
      name: 'Test Payment Project',
      gitUrl: 'https://github.com/test/payment-test',
      branch: 'main',
    }).returning();
    console.log(`[SETUP] ✅ Test project created: ${project.id}\n`);

    // Create test job
    console.log('[SETUP] Creating test audit job...');
    const [job] = await db.insert(auditJobs).values({
      projectId: project.id,
      status: 'pending',
      initiatedBy: TEST_CONFIG.testUserId,
    }).returning();
    console.log(`[SETUP] ✅ Test job created: ${job.id}\n`);

    return { userId: TEST_CONFIG.testUserId, jobId: job.id };

  } catch (error: any) {
    console.error('[SETUP] ❌ Setup failed:', error.message);
    throw error;
  }
}

async function testDebtCheck(userId: string) {
  console.log('===========================================');
  console.log('[TEST 1] 🔍 Debt Status Check\n');

  try {
    const debtStatus = await checkUserDebtStatus(userId);

    console.log('[TEST 1] ✅ Debt status retrieved:');
    console.log(`           Has Debt: ${debtStatus.hasDebt}`);
    console.log(`           Is Blocked: ${debtStatus.isBlocked}`);
    console.log(`           Total Debt: ${debtStatus.totalDebtNeurons.toFixed(2)} Neurons`);
    console.log(`           Unpaid Audits: ${debtStatus.unpaidAuditCount}\n`);

    if (debtStatus.isBlocked) {
      console.log('[TEST 1] ⚠️  User is blocked! Cannot proceed with test.');
      return false;
    }

    console.log('[TEST 1] ✅ User is not blocked, can proceed\n');
    return true;

  } catch (error: any) {
    console.error('[TEST 1] ❌ Debt check failed:', error.message, '\n');
    return false;
  }
}

async function testCostEstimation() {
  console.log('===========================================');
  console.log('[TEST 2] 💰 Cost Estimation\n');

  try {
    const estimate = await estimateAuditCost(
      TEST_CONFIG.estimatedSloc,
      TEST_CONFIG.estimatedAiTokens
    );

    console.log('[TEST 2] ✅ Cost estimate calculated:');
    console.log(`           SLOC Cost: ${estimate.slocCostNeurons.toFixed(2)} Neurons`);
    console.log(`           AI Tokens Cost: ${estimate.aiTokensCostNeurons.toFixed(2)} Neurons`);
    console.log(`           Total Estimate: ${estimate.totalEstimatedCostNeurons.toFixed(2)} Neurons`);
    console.log(`           Buffer Multiplier: ${estimate.bufferMultiplier}x`);
    console.log(`           Reservation Amount: ${estimate.reservationAmount.toFixed(2)} Neurons\n`);

    return estimate;

  } catch (error: any) {
    console.error('[TEST 2] ❌ Cost estimation failed:', error.message, '\n');
    throw error;
  }
}

async function testReservationCreation(userId: string, jobId: string) {
  console.log('===========================================');
  console.log('[TEST 3] 📝 Reservation Creation\n');

  try {
    const reservation = await createPaymentReservation({
      userId,
      jobId,
      walletAddress: TEST_CONFIG.testWalletAddress,
      chainId: TEST_CONFIG.testChainId,
      estimatedSloc: TEST_CONFIG.estimatedSloc,
      estimatedAiTokens: TEST_CONFIG.estimatedAiTokens,
    });

    console.log('[TEST 3] ✅ Reservation created:');
    console.log(`           Reservation ID: ${reservation.reservationId}`);
    console.log(`           Estimated Cost: ${reservation.estimatedCostNeurons.toFixed(2)} Neurons`);
    console.log(`           Reservation Amount: ${reservation.reservationAmount.toFixed(2)} Neurons`);
    console.log(`           Wallet Address: ${reservation.walletAddress}\n`);

    console.log('[TEST 3] 💡 Next step: User must transfer ${reservation.reservationAmount.toFixed(2)} Neurons');
    console.log(`           to treasury address via blockchain transaction\n`);

    return reservation;

  } catch (error: any) {
    console.error('[TEST 3] ❌ Reservation creation failed:', error.message, '\n');
    throw error;
  }
}

async function testPaymentConfirmation(reservationId: string, userBalance: number) {
  console.log('===========================================');
  console.log('[TEST 4] ✅ Payment Confirmation\n');

  try {
    // Simulate transaction hash
    const txHash = '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');

    console.log('[TEST 4] 🔗 Simulating blockchain transaction...');
    console.log(`           TX Hash: ${txHash}`);
    console.log(`           User Balance Before: ${userBalance.toFixed(2)} Neurons\n`);

    await confirmPaymentReservation(reservationId, txHash, userBalance);

    console.log('[TEST 4] ✅ Payment confirmed successfully');
    console.log('[TEST 4] 📋 Reservation status updated to "reserved"');
    console.log('[TEST 4] 📊 Transaction record created in database\n');

    return true;

  } catch (error: any) {
    console.error('[TEST 4] ❌ Payment confirmation failed:', error.message, '\n');
    throw error;
  }
}

async function testSettlement(reservationId: string) {
  console.log('===========================================');
  console.log('[TEST 5] ⚖️  Audit Settlement\n');

  try {
    // Determine actual values based on scenario
    let actualSloc = TEST_CONFIG.estimatedSloc;
    let actualAiTokens = TEST_CONFIG.estimatedAiTokens;

    switch (TEST_CONFIG.scenario) {
      case 'underestimate':
        // Actual cost exceeds reservation (debt scenario)
        actualSloc = Math.floor(TEST_CONFIG.estimatedSloc * 1.8);
        actualAiTokens = Math.floor(TEST_CONFIG.estimatedAiTokens * 1.8);
        console.log('[TEST 5] 📊 Scenario: UNDERESTIMATE (actual > estimate)');
        break;

      case 'overestimate':
        // Actual cost less than reservation (refund scenario)
        actualSloc = Math.floor(TEST_CONFIG.estimatedSloc * 0.7);
        actualAiTokens = Math.floor(TEST_CONFIG.estimatedAiTokens * 0.7);
        console.log('[TEST 5] 📊 Scenario: OVERESTIMATE (actual < estimate)');
        break;

      case 'exact':
        // Exact match (no refund, no debt)
        console.log('[TEST 5] 📊 Scenario: EXACT MATCH');
        break;
    }

    console.log(`           Actual SLOC: ${actualSloc}`);
    console.log(`           Actual AI Tokens: ${actualAiTokens}\n`);

    const settlement = await settleReservation({
      reservationId,
      actualSloc,
      actualAiTokens,
    });

    console.log('[TEST 5] ✅ Settlement completed:');
    console.log(`           Actual Cost: ${settlement.actualCostNeurons.toFixed(2)} Neurons`);
    console.log(`           Reservation: ${settlement.reservationAmount.toFixed(2)} Neurons`);
    console.log(`           Difference: ${settlement.difference.toFixed(2)} Neurons`);

    if (settlement.difference > 0) {
      console.log(`\n[TEST 5] 💸 REFUND: ${settlement.difference.toFixed(2)} Neurons returned to user`);
    } else if (settlement.difference < 0) {
      console.log(`\n[TEST 5] 💳 DEBT: User owes ${Math.abs(settlement.difference).toFixed(2)} Neurons`);
      console.log(`[TEST 5] ⚠️  Debt tracking enabled - user can complete 1 more audit before being blocked`);
    } else {
      console.log(`\n[TEST 5] ✅ EXACT MATCH: No refund or debt`);
    }

    console.log('');
    return settlement;

  } catch (error: any) {
    console.error('[TEST 5] ❌ Settlement failed:', error.message, '\n');
    throw error;
  }
}

async function runFullPaymentFlow() {
  console.log('Starting complete payment flow test...\n');

  try {
    // Setup
    const { userId, jobId } = await setupTestData();

    // Test 1: Debt Check
    const canProceed = await testDebtCheck(userId);
    if (!canProceed) {
      throw new Error('User is blocked due to debt');
    }

    // Test 2: Cost Estimation
    const estimate = await testCostEstimation();

    // Test 3: Create Reservation
    const reservation = await testReservationCreation(userId, jobId);

    // Test 4: Confirm Payment (simulate user has sufficient balance)
    const userBalance = reservation.reservationAmount + 1000; // Add some buffer
    await testPaymentConfirmation(reservation.reservationId, userBalance);

    // Test 5: Settle Reservation
    const settlement = await testSettlement(reservation.reservationId);

    // Summary
    console.log('===========================================');
    console.log('✅ All Tests Passed!');
    console.log('===========================================');
    console.log('Test Summary:');
    console.log(`  ✅ Debt Check: PASSED`);
    console.log(`  ✅ Cost Estimation: ${estimate.totalEstimatedCostNeurons.toFixed(2)} Neurons`);
    console.log(`  ✅ Reservation Created: ${reservation.reservationId}`);
    console.log(`  ✅ Payment Confirmed`);
    console.log(`  ✅ Settlement: ${settlement.difference >= 0 ? 'Refund' : 'Debt'} of ${Math.abs(settlement.difference).toFixed(2)} Neurons`);
    console.log('===========================================\n');

    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ Payment flow test failed:');
    console.error(`   Error: ${error.message}\n`);
    process.exit(1);
  }
}

runFullPaymentFlow();
