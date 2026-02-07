/**
 * Test Script: Settlement & Cutting Mechanism
 *
 * Tests various settlement scenarios:
 * - Overestimation (refund scenario)
 * - Underestimation (debt scenario)
 * - Exact match
 * - Debt accumulation
 * - User blocking after grace period
 *
 * Run with: npx tsx scripts/test-settlement-scenarios.ts
 */

import 'dotenv/config';
import { db } from '../src/db/index.js';
import {
  createPaymentReservation,
  confirmPaymentReservation,
  settleReservation,
  checkUserDebtStatus,
} from '../src/services/tokenPaymentService.js';
import { users, auditJobs, projects, userTokenDebt } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

console.log('🧪 Settlement & Cutting Mechanism Test');
console.log('========================================\n');

interface TestScenario {
  name: string;
  description: string;
  estimatedSloc: number;
  estimatedAiTokens: number;
  actualSloc: number;
  actualAiTokens: number;
  expectedOutcome: 'refund' | 'debt' | 'exact';
}

const SCENARIOS: TestScenario[] = [
  {
    name: 'Perfect Estimation',
    description: 'Actual cost matches reservation exactly',
    estimatedSloc: 1000,
    estimatedAiTokens: 50000,
    actualSloc: 1000,
    actualAiTokens: 50000,
    expectedOutcome: 'exact',
  },
  {
    name: 'Overestimation (Small)',
    description: 'User estimated high, 10% refund',
    estimatedSloc: 1000,
    estimatedAiTokens: 50000,
    actualSloc: 900,
    actualAiTokens: 45000,
    expectedOutcome: 'refund',
  },
  {
    name: 'Overestimation (Large)',
    description: 'User estimated very high, 30% refund',
    estimatedSloc: 1000,
    estimatedAiTokens: 50000,
    actualSloc: 700,
    actualAiTokens: 35000,
    expectedOutcome: 'refund',
  },
  {
    name: 'Underestimation (Small)',
    description: 'Actual exceeded by 10%, debt within buffer',
    estimatedSloc: 1000,
    estimatedAiTokens: 50000,
    actualSloc: 1100,
    actualAiTokens: 55000,
    expectedOutcome: 'debt',
  },
  {
    name: 'Underestimation (Large)',
    description: 'Actual exceeded by 60%, debt created',
    estimatedSloc: 1000,
    estimatedAiTokens: 50000,
    actualSloc: 1600,
    actualAiTokens: 80000,
    expectedOutcome: 'debt',
  },
];

async function setupTestUser(scenarioIndex: number) {
  const userId = `test-user-settlement-${scenarioIndex}-${Date.now()}`;
  const walletAddress = `0x${Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;

  // Create user
  await db.insert(users).values({
    id: userId,
    username: `test-settlement-${scenarioIndex}`,
    email: `test-settlement-${scenarioIndex}@example.com`,
    walletAddress,
  });

  // Create project
  const [project] = await db.insert(projects).values({
    userId,
    name: `Test Settlement Project ${scenarioIndex}`,
    gitUrl: 'https://github.com/test/settlement-test',
    branch: 'main',
  }).returning();

  // Create job
  const [job] = await db.insert(auditJobs).values({
    projectId: project.id,
    status: 'pending',
    initiatedBy: userId,
  }).returning();

  return { userId, jobId: job.id, walletAddress };
}

async function testScenario(scenario: TestScenario, index: number) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`SCENARIO ${index + 1}: ${scenario.name}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Description: ${scenario.description}`);
  console.log(`Expected Outcome: ${scenario.expectedOutcome.toUpperCase()}\n`);

  try {
    // Setup
    console.log('[STEP 1] 📋 Setting up test data...');
    const { userId, jobId, walletAddress } = await setupTestUser(index);
    console.log(`         User ID: ${userId}`);
    console.log(`         Job ID: ${jobId}\n`);

    // Create reservation
    console.log('[STEP 2] 📝 Creating payment reservation...');
    console.log(`         Estimated SLOC: ${scenario.estimatedSloc}`);
    console.log(`         Estimated AI Tokens: ${scenario.estimatedAiTokens}`);

    const reservation = await createPaymentReservation({
      userId,
      jobId,
      walletAddress,
      chainId: 1,
      estimatedSloc: scenario.estimatedSloc,
      estimatedAiTokens: scenario.estimatedAiTokens,
    });

    console.log(`         ✅ Reservation Created`);
    console.log(`         Estimated Cost: ${reservation.estimatedCostNeurons.toFixed(2)} Neurons`);
    console.log(`         Reservation Amount: ${reservation.reservationAmount.toFixed(2)} Neurons\n`);

    // Confirm payment
    console.log('[STEP 3] ✅ Confirming payment...');
    const txHash = '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
    const userBalance = reservation.reservationAmount + 1000;

    await confirmPaymentReservation(reservation.reservationId, txHash, userBalance);
    console.log(`         ✅ Payment Confirmed\n`);

    // Settle with actual values
    console.log('[STEP 4] ⚖️  Settling reservation...');
    console.log(`         Actual SLOC: ${scenario.actualSloc}`);
    console.log(`         Actual AI Tokens: ${scenario.actualAiTokens}`);

    const settlement = await settleReservation({
      reservationId: reservation.reservationId,
      actualSloc: scenario.actualSloc,
      actualAiTokens: scenario.actualAiTokens,
    });

    console.log(`         ✅ Settlement Complete`);
    console.log(`         Actual Cost: ${settlement.actualCostNeurons.toFixed(2)} Neurons`);
    console.log(`         Reservation: ${settlement.reservationAmount.toFixed(2)} Neurons`);
    console.log(`         Difference: ${settlement.difference.toFixed(2)} Neurons\n`);

    // Verify outcome
    console.log('[STEP 5] 🔍 Verifying outcome...');

    let actualOutcome: 'refund' | 'debt' | 'exact';
    if (settlement.difference > 0.01) {
      actualOutcome = 'refund';
      console.log(`         💸 REFUND: ${settlement.difference.toFixed(2)} Neurons`);
    } else if (settlement.difference < -0.01) {
      actualOutcome = 'debt';
      console.log(`         💳 DEBT: ${Math.abs(settlement.difference).toFixed(2)} Neurons`);

      // Check debt status
      const debtStatus = await checkUserDebtStatus(userId);
      console.log(`         📊 Debt Status:`);
      console.log(`            Total Debt: ${debtStatus.totalDebtNeurons.toFixed(2)} Neurons`);
      console.log(`            Unpaid Audits: ${debtStatus.unpaidAuditCount}`);
      console.log(`            Blocked: ${debtStatus.isBlocked ? 'YES' : 'NO'}`);
    } else {
      actualOutcome = 'exact';
      console.log(`         ✅ EXACT MATCH: No refund or debt`);
    }

    // Validate
    if (actualOutcome === scenario.expectedOutcome) {
      console.log(`\n         ✅ TEST PASSED: Outcome matches expected (${scenario.expectedOutcome})`);
      return true;
    } else {
      console.log(`\n         ❌ TEST FAILED: Expected ${scenario.expectedOutcome}, got ${actualOutcome}`);
      return false;
    }

  } catch (error: any) {
    console.error(`\n         ❌ ERROR: ${error.message}`);
    return false;
  }
}

async function testDebtAccumulation() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('SPECIAL TEST: Debt Accumulation & Blocking');
  console.log(`${'='.repeat(60)}\n`);

  try {
    const userId = `test-user-debt-${Date.now()}`;
    const walletAddress = `0x${Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;

    // Create user
    await db.insert(users).values({
      id: userId,
      username: 'test-debt-accumulation',
      email: 'test-debt@example.com',
      walletAddress,
    });

    console.log('[TEST] Creating 2 audits that go into debt...\n');

    for (let i = 1; i <= 2; i++) {
      console.log(`\n--- Audit ${i} ---`);

      // Create project and job
      const [project] = await db.insert(projects).values({
        userId,
        name: `Debt Test Project ${i}`,
        gitUrl: 'https://github.com/test/debt-test',
        branch: 'main',
      }).returning();

      const [job] = await db.insert(auditJobs).values({
        projectId: project.id,
        status: 'pending',
        initiatedBy: userId,
      }).returning();

      // Check debt before
      const debtBefore = await checkUserDebtStatus(userId);
      console.log(`[BEFORE] Debt: ${debtBefore.totalDebtNeurons.toFixed(2)} Neurons, Blocked: ${debtBefore.isBlocked}`);

      // Create reservation
      const reservation = await createPaymentReservation({
        userId,
        jobId: job.id,
        walletAddress,
        chainId: 1,
        estimatedSloc: 1000,
        estimatedAiTokens: 50000,
      });

      // Confirm payment
      const txHash = '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
      await confirmPaymentReservation(reservation.reservationId, txHash, reservation.reservationAmount + 1000);

      // Settle with higher actual cost (create debt)
      const settlement = await settleReservation({
        reservationId: reservation.reservationId,
        actualSloc: 1800, // 80% more
        actualAiTokens: 90000, // 80% more
      });

      console.log(`[SETTLE] Debt created: ${Math.abs(settlement.difference).toFixed(2)} Neurons`);

      // Check debt after
      const debtAfter = await checkUserDebtStatus(userId);
      console.log(`[AFTER]  Total Debt: ${debtAfter.totalDebtNeurons.toFixed(2)} Neurons`);
      console.log(`[AFTER]  Unpaid Audits: ${debtAfter.unpaidAuditCount}`);
      console.log(`[AFTER]  Blocked: ${debtAfter.isBlocked}`);

      if (i === 1) {
        console.log(`\n✅ First audit: User can still proceed (grace period)`);
      } else if (i === 2) {
        console.log(`\n${debtAfter.isBlocked ? '🛑' : '⚠️'} Second audit: User should be blocked`);

        if (debtAfter.isBlocked) {
          console.log(`✅ TEST PASSED: User correctly blocked after exceeding grace period`);

          // Try to create another reservation (should fail)
          console.log(`\n[TEST] Attempting to create 3rd reservation (should fail)...`);

          try {
            const [project3] = await db.insert(projects).values({
              userId,
              name: `Debt Test Project 3`,
              gitUrl: 'https://github.com/test/debt-test',
              branch: 'main',
            }).returning();

            const [job3] = await db.insert(auditJobs).values({
              projectId: project3.id,
              status: 'pending',
              initiatedBy: userId,
            }).returning();

            await createPaymentReservation({
              userId,
              jobId: job3.id,
              walletAddress,
              chainId: 1,
              estimatedSloc: 1000,
              estimatedAiTokens: 50000,
            });

            console.log(`❌ TEST FAILED: Reservation should have been blocked!`);
            return false;
          } catch (error: any) {
            console.log(`✅ TEST PASSED: Reservation correctly blocked`);
            console.log(`   Error: ${error.message}\n`);
          }
        } else {
          console.log(`❌ TEST FAILED: User should be blocked but isn't`);
          return false;
        }
      }
    }

    return true;

  } catch (error: any) {
    console.error(`\n❌ Debt accumulation test failed: ${error.message}`);
    return false;
  }
}

async function runAllTests() {
  console.log('Starting settlement scenarios test suite...\n');

  const results: boolean[] = [];

  // Test all settlement scenarios
  for (let i = 0; i < SCENARIOS.length; i++) {
    const result = await testScenario(SCENARIOS[i], i);
    results.push(result);
  }

  // Test debt accumulation
  const debtResult = await testDebtAccumulation();
  results.push(debtResult);

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('TEST SUITE SUMMARY');
  console.log(`${'='.repeat(60)}`);

  SCENARIOS.forEach((scenario, i) => {
    console.log(`  ${results[i] ? '✅' : '❌'} ${scenario.name}`);
  });
  console.log(`  ${results[results.length - 1] ? '✅' : '❌'} Debt Accumulation & Blocking`);

  const passCount = results.filter(r => r).length;
  const totalCount = results.length;

  console.log(`\n  Total: ${passCount}/${totalCount} tests passed`);
  console.log(`${'='.repeat(60)}\n`);

  process.exit(passCount === totalCount ? 0 : 1);
}

runAllTests().catch((error) => {
  console.error('Test suite crashed:', error);
  process.exit(1);
});
