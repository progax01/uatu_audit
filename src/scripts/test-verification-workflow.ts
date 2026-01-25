/**
 * Test Verification Workflow
 *
 * This script tests the complete clarification verification workflow:
 * 1. Fetch a finding from an audit job
 * 2. Submit test clarifications (good and bad)
 * 3. Verify Claude verification results
 * 4. Check database records
 * 5. Verify FAQ creation for accepted clarifications
 */

import 'dotenv/config';
import { db } from '../db/index.js';
import {
  auditJobs,
  auditResults,
  auditClarifications,
  clarificationVerifications,
  clarificationFaqs,
} from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import {
  verifyClarification,
  createFAQFromVerification,
  getVerificationStats,
  type FindingContext,
  type ClarificationInput,
} from '../services/clarificationVerificationService.js';

const TEST_JOB_ID = 'f0a9e7b1-d888-4ec1-8753-975dffaf1b9f';

async function testVerificationWorkflow() {
  try {
    console.log('🧪 Starting Verification Workflow Test\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Step 1: Fetch audit job and findings
    console.log('📋 Step 1: Fetching audit job and findings...\n');

    const [job] = await db
      .select()
      .from(auditJobs)
      .where(eq(auditJobs.id, TEST_JOB_ID))
      .limit(1);

    if (!job) {
      console.error('❌ Audit job not found:', TEST_JOB_ID);
      process.exit(1);
    }

    const [results] = await db
      .select()
      .from(auditResults)
      .where(eq(auditResults.jobId, TEST_JOB_ID))
      .limit(1);

    if (!results || !results.findings) {
      console.error('❌ No findings found for job:', TEST_JOB_ID);
      process.exit(1);
    }

    const findings = results.findings as any[];
    const criticalFindings = findings.filter(
      (f) => f.severity === 'critical' || f.severity === 'high'
    );

    if (criticalFindings.length === 0) {
      console.error('❌ No critical/high findings found');
      process.exit(1);
    }

    const testFinding = criticalFindings[0];

    console.log(`✅ Found ${findings.length} total findings`);
    console.log(`✅ Found ${criticalFindings.length} critical/high findings`);
    console.log(`\n📌 Testing with finding:`);
    console.log(`   Title: ${testFinding.title}`);
    console.log(`   Severity: ${testFinding.severity}`);
    console.log(`   Description: ${testFinding.description?.substring(0, 100)}...\n`);

    // Step 2: Test GOOD clarification (should be accepted)
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('✅ Step 2: Testing GOOD Clarification (Should Be Accepted)\n');

    const goodClarificationId = `test-good-${Date.now()}`;
    const goodFindingContext: FindingContext = {
      id: testFinding.id || testFinding.title,
      title: testFinding.title,
      severity: testFinding.severity,
      description: testFinding.description || '',
      location: testFinding.location,
      codeSnippet: testFinding.codeSnippet,
      recommendation: testFinding.recommendation,
    };

    const goodClarificationInput: ClarificationInput = {
      clarificationId: goodClarificationId,
      jobId: TEST_JOB_ID,
      findingId: testFinding.title,
      clarificationType: 'false_positive',
      explanation: `This is a false positive because the contract implements the Checks-Effects-Interactions (CEI) pattern correctly. The state variable is updated before any external calls are made, which prevents reentrancy attacks. Specifically, the balance is set to zero before the transfer occurs, ensuring that even if the external call attempts to reenter, the balance will already be zero and no additional funds can be withdrawn.`,
      evidenceUrl: 'https://docs.soliditylang.org/en/latest/security-considerations.html#reentrancy',
    };

    console.log('🤖 Calling Claude for verification...');
    console.log('⏳ This may take 30-60 seconds...\n');

    const goodResult = await verifyClarification(
      goodFindingContext,
      goodClarificationInput,
      job.repo || undefined
    );

    console.log('📊 Good Clarification Results:');
    console.log(`   Verified: ${goodResult.verified ? '✅ YES' : '❌ NO'}`);
    console.log(`   Recommendation: ${goodResult.recommendation.toUpperCase()}`);
    console.log(`   Confidence: ${goodResult.confidence.toUpperCase()}`);
    console.log(`   Reasoning: ${goodResult.reasoning.substring(0, 200)}...\n`);

    // Create FAQ if accepted
    if (goodResult.verified && goodResult.recommendation === 'accept') {
      console.log('📝 Creating FAQ entry for verified clarification...');
      await createFAQFromVerification(goodFindingContext, goodClarificationInput, goodResult);
      console.log('✅ FAQ entry created\n');
    }

    // Step 3: Test BAD clarification (should be rejected)
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('❌ Step 3: Testing BAD Clarification (Should Be Rejected)\n');

    const badClarificationId = `test-bad-${Date.now()}`;
    const badClarificationInput: ClarificationInput = {
      clarificationId: badClarificationId,
      jobId: TEST_JOB_ID,
      findingId: testFinding.title,
      clarificationType: 'false_positive',
      explanation: 'This is not an issue because we know what we are doing.',
      evidenceUrl: '',
    };

    console.log('🤖 Calling Claude for verification...');
    console.log('⏳ This may take 30-60 seconds...\n');

    const badResult = await verifyClarification(
      goodFindingContext,
      badClarificationInput,
      job.repo || undefined
    );

    console.log('📊 Bad Clarification Results:');
    console.log(`   Verified: ${badResult.verified ? '✅ YES' : '❌ NO'}`);
    console.log(`   Recommendation: ${badResult.recommendation.toUpperCase()}`);
    console.log(`   Confidence: ${badResult.confidence.toUpperCase()}`);
    console.log(`   Reasoning: ${badResult.reasoning.substring(0, 200)}...\n`);

    // Step 4: Check database records
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('🗄️  Step 4: Checking Database Records\n');

    const verifications = await db
      .select()
      .from(clarificationVerifications)
      .where(eq(clarificationVerifications.jobId, TEST_JOB_ID));

    console.log(`📋 Total verification records: ${verifications.length}`);

    const testVerifications = verifications.filter(
      (v) =>
        v.clarificationId === goodClarificationId ||
        v.clarificationId === badClarificationId
    );

    console.log(`📋 Test verification records: ${testVerifications.length}\n`);

    for (const verification of testVerifications) {
      console.log(`Verification ID: ${verification.id}`);
      console.log(`  Clarification ID: ${verification.clarificationId}`);
      console.log(`  Verified: ${verification.verified ? '✅' : '❌'}`);
      console.log(`  Recommendation: ${verification.recommendation}`);
      console.log(`  Confidence: ${verification.confidence}`);
      console.log(`  Finding: ${verification.findingTitle}`);
      console.log('');
    }

    // Check FAQ entries
    const faqs = await db
      .select()
      .from(clarificationFaqs)
      .where(eq(clarificationFaqs.jobId, TEST_JOB_ID));

    console.log(`📚 Total FAQ entries: ${faqs.length}`);

    const testFaqs = faqs.filter((f) => f.clarificationId === goodClarificationId);
    console.log(`📚 Test FAQ entries: ${testFaqs.length}\n`);

    if (testFaqs.length > 0) {
      console.log('FAQ Entry:');
      console.log(`  Question: ${testFaqs[0].question}`);
      console.log(`  Answer: ${testFaqs[0].answer?.substring(0, 150)}...`);
      console.log(`  Verified: ${testFaqs[0].verified ? '✅' : '❌'}`);
      console.log(`  Confidence: ${testFaqs[0].confidence}\n`);
    }

    // Step 5: Get verification stats
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('📊 Step 5: Verification Statistics\n');

    const stats = await getVerificationStats(TEST_JOB_ID);

    console.log(`Total Verifications: ${stats.total}`);
    console.log(`Accepted: ${stats.verified} (${((stats.verified / stats.total) * 100).toFixed(1)}%)`);
    console.log(`Rejected: ${stats.rejected} (${((stats.rejected / stats.total) * 100).toFixed(1)}%)`);
    console.log(`Manual Review: ${stats.manualReview} (${((stats.manualReview / stats.total) * 100).toFixed(1)}%)`);
    console.log(`Acceptance Rate: ${stats.acceptanceRate.toFixed(1)}%\n`);

    // Guardrail checks
    if (stats.rejected > stats.verified && stats.total >= 3) {
      console.log('⚠️  WARNING: High rejection rate detected!');
      console.log('   This may indicate gaming attempts.\n');
    }

    if (stats.acceptanceRate < 30 && stats.total >= 3) {
      console.log('🚨 CRITICAL: Very high rejection rate!');
      console.log('   Manual review required.\n');
    }

    // Summary
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('✅ Test Summary\n');

    console.log(`Good Clarification:`);
    console.log(`  Expected: Accept with high confidence`);
    console.log(`  Actual: ${goodResult.recommendation} with ${goodResult.confidence} confidence`);
    console.log(`  Status: ${goodResult.recommendation === 'accept' && goodResult.verified ? '✅ PASS' : '❌ FAIL'}\n`);

    console.log(`Bad Clarification:`);
    console.log(`  Expected: Reject with low confidence`);
    console.log(`  Actual: ${badResult.recommendation} with ${badResult.confidence} confidence`);
    console.log(`  Status: ${badResult.recommendation === 'reject' && !badResult.verified ? '✅ PASS' : '❌ FAIL'}\n`);

    console.log(`Database Records:`);
    console.log(`  Verification records created: ${testVerifications.length === 2 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  FAQ entry created for accepted: ${testFaqs.length > 0 ? '✅ PASS' : '❌ FAIL'}\n`);

    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('🎉 Verification Workflow Test Complete!\n');

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

testVerificationWorkflow();
