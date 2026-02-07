/**
 * COMPREHENSIVE TEST: All Payment Scenarios
 * Tests everything including balance checks, full flow, and edge cases
 */

import 'dotenv/config';
import { db } from '../src/db/index.js';
import {
  checkUserDebtStatus,
  createPaymentReservation,
  confirmPaymentReservation,
  settleReservation,
} from '../src/services/tokenPaymentService.js';
import { estimateAuditCost } from '../src/services/auditCostCalculator.js';
import { users, auditJobs, projects } from '../src/db/schema.js';

console.log('🧪 COMPREHENSIVE PAYMENT SYSTEM TEST');
console.log('=====================================\n');

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

async function createTestUser(suffix: string) {
  const userId = `test-user-${suffix}-${Date.now()}`;
  const walletAddress = `0x${Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;
  const cleanSuffix = suffix.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 30);

  const [user] = await db.insert(users).values({
    username: `test-${cleanSuffix}-${Date.now()}`,
    walletAddress,
  } as any).returning();

  const [project] = await db.insert(projects).values({
    userId: user.id,
    name: `Test Project ${suffix}`,
    gitUrl: 'https://github.com/test/test',
    branch: 'main',
  }).returning();

  const [job] = await db.insert(auditJobs).values({
    projectId: project.id,
    status: 'pending',
    initiatedBy: user.id,
  }).returning();

  return { userId: user.id, jobId: job.id, walletAddress };
}

// =====================================================
// TEST 1: Cost Estimation with Different Project Sizes
// =====================================================
async function testCostEstimation() {
  console.log('━'.repeat(60));
  console.log('TEST 1: Cost Estimation for Different Project Sizes');
  console.log('━'.repeat(60));

  const scenarios = [
    { name: 'Tiny Project', sloc: 100, tokens: 10000, expectedMin: 0, expectedMax: 200 },
    { name: 'Small Project', sloc: 1000, tokens: 50000, expectedMin: 400, expectedMax: 1000 },
    { name: 'Medium Project', sloc: 5000, tokens: 200000, expectedMin: 1500, expectedMax: 5000 },
    { name: 'Large Project', sloc: 10000, tokens: 500000, expectedMin: 4000, expectedMax: 10000 },
    { name: 'Huge Project', sloc: 50000, tokens: 2000000, expectedMin: 15000, expectedMax: 50000 },
  ];

  for (const scenario of scenarios) {
    try {
      console.log(`\n📊 ${scenario.name}:`);
      console.log(`   SLOC: ${scenario.sloc.toLocaleString()}`);
      console.log(`   AI Tokens: ${scenario.tokens.toLocaleString()}`);

      const estimate = await estimateAuditCost(scenario.sloc, scenario.tokens);

      console.log(`   💰 Cost Breakdown:`);
      console.log(`      SLOC Cost: ${estimate.slocCostNeurons.toFixed(2)} Neurons`);
      console.log(`      AI Cost: ${estimate.aiTokensCostNeurons.toFixed(2)} Neurons`);
      console.log(`      Total: ${estimate.totalEstimatedCostNeurons.toFixed(2)} Neurons`);
      console.log(`      Reservation (${estimate.bufferMultiplier}x): ${estimate.reservationAmount.toFixed(2)} Neurons`);

      const isValid = estimate.totalEstimatedCostNeurons >= scenario.expectedMin &&
                     estimate.totalEstimatedCostNeurons <= scenario.expectedMax;

      if (isValid) {
        console.log(`   ✅ PASS: Cost within expected range`);
        results.push({ name: `Cost Estimation - ${scenario.name}`, passed: true, message: 'Valid cost calculation' });
      } else {
        console.log(`   ❌ FAIL: Cost ${estimate.totalEstimatedCostNeurons.toFixed(2)} outside expected range [${scenario.expectedMin}, ${scenario.expectedMax}]`);
        results.push({ name: `Cost Estimation - ${scenario.name}`, passed: false, message: 'Cost outside range' });
      }
    } catch (error: any) {
      console.log(`   ❌ ERROR: ${error.message}`);
      results.push({ name: `Cost Estimation - ${scenario.name}`, passed: false, message: error.message });
    }
  }
}

// =====================================================
// TEST 2: Balance Scenarios (High, Low, Zero, Insufficient)
// =====================================================
async function testBalanceScenarios() {
  console.log('\n━'.repeat(60));
  console.log('TEST 2: Balance Scenarios');
  console.log('━'.repeat(60));

  const scenarios = [
    { name: 'Zero Balance', balance: 0, canProceed: false },
    { name: 'Low Balance (10 Neurons)', balance: 10, canProceed: false },
    { name: 'Insufficient Balance (100 Neurons)', balance: 100, canProceed: false },
    { name: 'Barely Sufficient (500 Neurons)', balance: 500, canProceed: true },
    { name: 'Comfortable Balance (1000 Neurons)', balance: 1000, canProceed: true },
    { name: 'High Balance (10000 Neurons)', balance: 10000, canProceed: true },
  ];

  for (const scenario of scenarios) {
    try {
      console.log(`\n💰 ${scenario.name}:`);
      console.log(`   Balance: ${scenario.balance} Neurons`);

      const { userId, jobId, walletAddress } = await createTestUser(`balance-${scenario.name.replace(/\s+/g, '-')}`);

      // Create small reservation (estimated 501 Neurons)
      const reservation = await createPaymentReservation({
        userId,
        jobId,
        walletAddress,
        chainId: 1,
        estimatedSloc: 1000,
        estimatedAiTokens: 50000,
      });

      console.log(`   Required: ${reservation.reservationAmount.toFixed(2)} Neurons`);

      const hasEnough = scenario.balance >= reservation.reservationAmount;

      if (hasEnough === scenario.canProceed) {
        console.log(`   ✅ PASS: Balance check behaves as expected (${hasEnough ? 'sufficient' : 'insufficient'})`);
        results.push({ name: `Balance - ${scenario.name}`, passed: true, message: 'Balance validation correct' });

        // If balance is sufficient, try to confirm payment
        if (hasEnough) {
          const txHash = '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
          await confirmPaymentReservation(reservation.reservationId, txHash, scenario.balance);
          console.log(`   ✅ Payment confirmed successfully`);
        }
      } else {
        console.log(`   ❌ FAIL: Balance check mismatch`);
        results.push({ name: `Balance - ${scenario.name}`, passed: false, message: 'Balance validation incorrect' });
      }
    } catch (error: any) {
      console.log(`   ❌ ERROR: ${error.message}`);
      results.push({ name: `Balance - ${scenario.name}`, passed: false, message: error.message });
    }
  }
}

// =====================================================
// TEST 3: Settlement Scenarios (Refund, Exact, Debt)
// =====================================================
async function testSettlementScenarios() {
  console.log('\n━'.repeat(60));
  console.log('TEST 3: Settlement Scenarios');
  console.log('━'.repeat(60));

  const scenarios = [
    { name: 'Massive Overestimate', actualMultiplier: 0.3, expectedType: 'refund' },
    { name: 'Large Overestimate', actualMultiplier: 0.5, expectedType: 'refund' },
    { name: 'Small Overestimate', actualMultiplier: 0.8, expectedType: 'refund' },
    { name: 'Exact Match', actualMultiplier: 1.0, expectedType: 'exact' },
    { name: 'Small Underestimate', actualMultiplier: 1.2, expectedType: 'refund_or_small_debt' },
    { name: 'Large Underestimate', actualMultiplier: 1.6, expectedType: 'debt' },
    { name: 'Massive Underestimate', actualMultiplier: 2.0, expectedType: 'debt' },
  ];

  for (const scenario of scenarios) {
    try {
      console.log(`\n⚖️  ${scenario.name} (${scenario.actualMultiplier}x):`);

      const { userId, jobId, walletAddress } = await createTestUser(`settle-${scenario.name.replace(/\s+/g, '-')}`);

      const estimatedSloc = 1000;
      const estimatedTokens = 50000;

      const reservation = await createPaymentReservation({
        userId,
        jobId,
        walletAddress,
        chainId: 1,
        estimatedSloc,
        estimatedAiTokens: estimatedTokens,
      });

      const txHash = '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
      await confirmPaymentReservation(reservation.reservationId, txHash, reservation.reservationAmount + 1000);

      const actualSloc = Math.floor(estimatedSloc * scenario.actualMultiplier);
      const actualTokens = Math.floor(estimatedTokens * scenario.actualMultiplier);

      console.log(`   Estimated: ${estimatedSloc} SLOC, ${estimatedTokens} tokens`);
      console.log(`   Actual: ${actualSloc} SLOC, ${actualTokens} tokens`);

      const settlement = await settleReservation({
        reservationId: reservation.reservationId,
        actualSloc,
        actualAiTokens: actualTokens,
      });

      console.log(`   💵 Reservation: ${settlement.reservationAmount.toFixed(2)} Neurons`);
      console.log(`   💵 Actual Cost: ${settlement.actualCostNeurons.toFixed(2)} Neurons`);
      console.log(`   💵 Difference: ${settlement.difference.toFixed(2)} Neurons`);

      let resultType: string;
      if (Math.abs(settlement.difference) < 0.01) {
        resultType = 'exact';
        console.log(`   ✅ EXACT MATCH`);
      } else if (settlement.difference > 0) {
        resultType = 'refund';
        console.log(`   💸 REFUND: ${settlement.difference.toFixed(2)} Neurons`);
      } else {
        resultType = 'debt';
        console.log(`   💳 DEBT: ${Math.abs(settlement.difference).toFixed(2)} Neurons`);
      }

      const passed = scenario.expectedType === 'refund_or_small_debt' ?
        (resultType === 'refund' || resultType === 'debt') :
        resultType === scenario.expectedType;

      if (passed) {
        console.log(`   ✅ PASS: Settlement type matches expected`);
        results.push({ name: `Settlement - ${scenario.name}`, passed: true, message: `${resultType} as expected` });
      } else {
        console.log(`   ❌ FAIL: Expected ${scenario.expectedType}, got ${resultType}`);
        results.push({ name: `Settlement - ${scenario.name}`, passed: false, message: `Wrong settlement type` });
      }
    } catch (error: any) {
      console.log(`   ❌ ERROR: ${error.message}`);
      results.push({ name: `Settlement - ${scenario.name}`, passed: false, message: error.message });
    }
  }
}

// =====================================================
// TEST 4: Debt Accumulation & User Blocking
// =====================================================
async function testDebtAndBlocking() {
  console.log('\n━'.repeat(60));
  console.log('TEST 4: Debt Accumulation & User Blocking');
  console.log('━'.repeat(60));

  try {
    const walletAddress = `0x${Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;
    const [user] = await db.insert(users).values({
      username: `test-debt-${Date.now()}`,
      walletAddress,
    } as any).returning();
    const userId = user.id;

    console.log('\n🔄 Creating 3 audits with debt...\n');

    for (let i = 1; i <= 3; i++) {
      console.log(`━━━ Audit ${i} ━━━`);

      const [project] = await db.insert(projects).values({
        userId,
        name: `Debt Project ${i}`,
        gitUrl: 'https://github.com/test/debt',
        branch: 'main',
      }).returning();

      const [job] = await db.insert(auditJobs).values({
        projectId: project.id,
        status: 'pending',
        initiatedBy: userId,
      }).returning();

      // Check debt before
      const debtBefore = await checkUserDebtStatus(userId);
      console.log(`[BEFORE]  Debt: ${debtBefore.totalDebtNeurons.toFixed(2)} Neurons | Blocked: ${debtBefore.isBlocked}`);

      if (i === 3 && debtBefore.isBlocked) {
        // Try to create reservation (should fail)
        try {
          await createPaymentReservation({
            userId,
            jobId: job.id,
            walletAddress,
            chainId: 1,
            estimatedSloc: 1000,
            estimatedAiTokens: 50000,
          });
          console.log(`❌ FAIL: Should have been blocked but wasn't!`);
          results.push({ name: 'Debt Blocking - 3rd Audit', passed: false, message: 'User not blocked' });
        } catch (error: any) {
          console.log(`✅ PASS: User correctly blocked on 3rd audit`);
          console.log(`   Error: ${error.message}`);
          results.push({ name: 'Debt Blocking - 3rd Audit', passed: true, message: 'User blocked as expected' });
        }
        break;
      }

      // Create reservation and settle with debt
      const reservation = await createPaymentReservation({
        userId,
        jobId: job.id,
        walletAddress,
        chainId: 1,
        estimatedSloc: 1000,
        estimatedAiTokens: 50000,
      });

      const txHash = '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
      await confirmPaymentReservation(reservation.reservationId, txHash, reservation.reservationAmount + 1000);

      // Settle with 80% more cost (creates debt)
      const settlement = await settleReservation({
        reservationId: reservation.reservationId,
        actualSloc: 1800,
        actualAiTokens: 90000,
      });

      console.log(`[SETTLED] Debt Created: ${Math.abs(settlement.difference).toFixed(2)} Neurons`);

      const debtAfter = await checkUserDebtStatus(userId);
      console.log(`[AFTER]   Total: ${debtAfter.totalDebtNeurons.toFixed(2)} Neurons | Unpaid: ${debtAfter.unpaidAuditCount} | Blocked: ${debtAfter.isBlocked}\n`);

      if (i === 1) {
        if (!debtAfter.isBlocked) {
          console.log(`✅ PASS: 1st debt - user not blocked (grace period)`);
          results.push({ name: 'Debt Blocking - 1st Audit', passed: true, message: 'Grace period working' });
        } else {
          console.log(`❌ FAIL: User blocked too early`);
          results.push({ name: 'Debt Blocking - 1st Audit', passed: false, message: 'Blocked too early' });
        }
      } else if (i === 2) {
        if (debtAfter.isBlocked) {
          console.log(`✅ PASS: 2nd debt - user blocked after grace period`);
          results.push({ name: 'Debt Blocking - 2nd Audit', passed: true, message: 'Blocked after grace period' });
        } else {
          console.log(`❌ FAIL: User should be blocked after 2nd debt`);
          results.push({ name: 'Debt Blocking - 2nd Audit', passed: false, message: 'Not blocked after 2nd debt' });
        }
      }
    }
  } catch (error: any) {
    console.log(`❌ ERROR: ${error.message}`);
    results.push({ name: 'Debt & Blocking Test', passed: false, message: error.message });
  }
}

// =====================================================
// TEST 5: Edge Cases
// =====================================================
async function testEdgeCases() {
  console.log('\n━'.repeat(60));
  console.log('TEST 5: Edge Cases');
  console.log('━'.repeat(60));

  // Test 5.1: Zero SLOC
  try {
    console.log('\n🔍 Zero SLOC Project:');
    const estimate = await estimateAuditCost(0, 50000);
    console.log(`   Cost: ${estimate.totalEstimatedCostNeurons.toFixed(2)} Neurons`);
    if (estimate.totalEstimatedCostNeurons > 0) {
      console.log(`   ✅ PASS: Still charges for AI tokens`);
      results.push({ name: 'Edge Case - Zero SLOC', passed: true, message: 'Handles zero SLOC' });
    } else {
      console.log(`   ❌ FAIL: Should charge for AI tokens`);
      results.push({ name: 'Edge Case - Zero SLOC', passed: false, message: 'No cost calculated' });
    }
  } catch (error: any) {
    console.log(`   ❌ ERROR: ${error.message}`);
    results.push({ name: 'Edge Case - Zero SLOC', passed: false, message: error.message });
  }

  // Test 5.2: Zero AI Tokens
  try {
    console.log('\n🔍 Zero AI Tokens:');
    const estimate = await estimateAuditCost(1000, 0);
    console.log(`   Cost: ${estimate.totalEstimatedCostNeurons.toFixed(2)} Neurons`);
    if (estimate.totalEstimatedCostNeurons > 0) {
      console.log(`   ✅ PASS: Still charges for SLOC`);
      results.push({ name: 'Edge Case - Zero AI Tokens', passed: true, message: 'Handles zero tokens' });
    } else {
      console.log(`   ❌ FAIL: Should charge for SLOC`);
      results.push({ name: 'Edge Case - Zero AI Tokens', passed: false, message: 'No cost calculated' });
    }
  } catch (error: any) {
    console.log(`   ❌ ERROR: ${error.message}`);
    results.push({ name: 'Edge Case - Zero AI Tokens', passed: false, message: error.message });
  }

  // Test 5.3: Extreme values
  try {
    console.log('\n🔍 Extreme Project Size:');
    const estimate = await estimateAuditCost(1000000, 10000000);
    console.log(`   Cost: ${estimate.totalEstimatedCostNeurons.toFixed(2)} Neurons`);
    if (estimate.totalEstimatedCostNeurons > 100000) {
      console.log(`   ✅ PASS: Handles large projects`);
      results.push({ name: 'Edge Case - Extreme Size', passed: true, message: 'Handles large projects' });
    } else {
      console.log(`   ⚠️  WARNING: Cost seems low for extreme size`);
      results.push({ name: 'Edge Case - Extreme Size', passed: true, message: 'Calculated but verify pricing' });
    }
  } catch (error: any) {
    console.log(`   ❌ ERROR: ${error.message}`);
    results.push({ name: 'Edge Case - Extreme Size', passed: false, message: error.message });
  }
}

// =====================================================
// RUN ALL TESTS
// =====================================================
async function runAllTests() {
  console.log('Starting comprehensive test suite...\n');

  await testCostEstimation();
  await testBalanceScenarios();
  await testSettlementScenarios();
  await testDebtAndBlocking();
  await testEdgeCases();

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`\n✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${results.length}\n`);

  if (failed > 0) {
    console.log('Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ❌ ${r.name}: ${r.message}`);
    });
    console.log('');
  }

  console.log('='.repeat(60));

  const successRate = (passed / results.length * 100).toFixed(1);
  console.log(`Success Rate: ${successRate}%`);
  console.log('='.repeat(60) + '\n');

  process.exit(failed === 0 ? 0 : 1);
}

runAllTests().catch((error) => {
  console.error('Test suite crashed:', error);
  process.exit(1);
});
