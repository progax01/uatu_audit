/**
 * Clarification Verification Service
 *
 * Uses Claude to verify user-submitted clarifications and prevent gaming the system.
 * Implements strict verification with code context analysis.
 */

import { db } from '../db/index.js';
import {
  clarificationVerifications,
  clarificationFaqs,
  auditClarifications,
  type NewClarificationVerification,
  type NewClarificationFaq,
} from '../db/schema.js';
import { logger } from '../utils/logger.js';
import { eq } from 'drizzle-orm';

const log = logger.child({ service: 'clarificationVerificationService' });

// ============================================================================
// TYPES
// ============================================================================

export interface FindingContext {
  id: string;
  title: string;
  severity: string;
  description: string;
  location?: {
    file?: string;
    line?: number;
  };
  codeSnippet?: string;
  recommendation?: string;
}

export interface ClarificationInput {
  clarificationId: string;
  jobId: string;
  findingId: string;
  clarificationType: 'false_positive' | 'mitigated' | 'accepted_risk' | 'already_fixed';
  explanation: string;
  evidenceUrl?: string;
  resolvedInCommit?: boolean;
  commitSha?: string;
}

export interface VerificationResult {
  verified: boolean;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  recommendation: 'accept' | 'reject' | 'manual_review';
}

export interface CodeContext {
  codeSnippet?: string;
  fileContext?: string;
  commitDiff?: string;
  commitMessage?: string;
}

// ============================================================================
// VERIFICATION PROMPT TEMPLATE
// ============================================================================

const VERIFICATION_PROMPT_VERSION = 'v1.0';

function buildVerificationPrompt(
  finding: FindingContext,
  clarification: ClarificationInput,
  codeContext: CodeContext
): string {
  return `You are an expert smart contract auditor reviewing a clarification submitted by the contract owner.

FINDING DETAILS:
- Title: ${finding.title}
- Severity: ${finding.severity}
- Description: ${finding.description}
- Location: ${finding.location?.file || 'Unknown'}${finding.location?.line ? `:${finding.location.line}` : ''}
- Recommendation: ${finding.recommendation || 'N/A'}

${codeContext.codeSnippet ? `CODE AT FINDING LOCATION:
\`\`\`solidity
${codeContext.codeSnippet}
\`\`\`
` : ''}

${codeContext.fileContext ? `FILE CONTEXT (surrounding code):
\`\`\`solidity
${codeContext.fileContext}
\`\`\`
` : ''}

${codeContext.commitDiff ? `COMMIT DIFF (changes made):
\`\`\`diff
${codeContext.commitDiff}
\`\`\`

Commit message: ${codeContext.commitMessage || 'N/A'}
` : ''}

USER'S CLARIFICATION:
- Type: ${clarification.clarificationType}
- Explanation: ${clarification.explanation}
${clarification.evidenceUrl ? `- Evidence URL: ${clarification.evidenceUrl}` : ''}
${clarification.resolvedInCommit ? `- Claims to be resolved in commit: ${clarification.commitSha || 'latest'}` : ''}

YOUR TASK:
Verify if this clarification is valid by:

1. **Analyzing the code context** - Does the code actually support their claim?
2. **Reviewing the finding's technical details** - Is the original finding accurate?
3. **Evaluating the user's explanation** - Is it technically sound and specific?
4. **Checking if this is legitimate** - False positive OR actual fix/mitigation?

BE EXTREMELY STRICT:
- ❌ REJECT if user just says "not an issue" without technical reasoning
- ❌ REJECT if explanation doesn't match the actual code
- ❌ REJECT if it's clearly an attempt to dismiss a real vulnerability
- ❌ REJECT if explanation is vague or generic
- ❌ REJECT if commit diff doesn't actually fix the issue
- ✅ ACCEPT only if the logic is sound, specific, and technically accurate
- ⚠️ MANUAL_REVIEW if explanation has some merit but needs human verification

EXAMPLES OF WHAT TO REJECT:
- "This is not an issue because we know what we're doing"
- "The auditor doesn't understand our code"
- "This is a false positive" (without technical explanation)
- "We'll fix it later" (for false_positive claims)
- Generic statements without code references

EXAMPLES OF WHAT TO ACCEPT:
- "This is a false positive because the contract uses Checks-Effects-Interactions pattern. State is updated at line 45 before the external call at line 52."
- "This finding is mitigated by the onlyOwner modifier on line 23, which restricts access to trusted addresses only."
- "The reentrancy guard at line 15 prevents this attack vector. The nonReentrant modifier ensures the function cannot be called recursively."

Respond with ONLY valid JSON (no markdown, no explanations):
{
  "verified": true/false,
  "confidence": "high/medium/low",
  "reasoning": "technical explanation of why you accepted or rejected this",
  "recommendation": "accept/reject/manual_review"
}`;
}

// ============================================================================
// CODE CONTEXT EXTRACTION
// ============================================================================

/**
 * Extract code context for verification
 */
export async function extractCodeContext(
  finding: FindingContext,
  clarification: ClarificationInput,
  repoPath?: string
): Promise<CodeContext> {
  const context: CodeContext = {};

  // Extract code snippet from finding (if available)
  if (finding.codeSnippet) {
    context.codeSnippet = finding.codeSnippet;
  }

  // If resolved in commit, get commit diff
  if (clarification.resolvedInCommit && clarification.commitSha && repoPath) {
    try {
      log.info('Extracting commit context', { commitSha: clarification.commitSha });
      const { getCommitDiff, getCommitInfo } = await import('./gitService.js');

      // Get commit diff
      const diff = await getCommitDiff(repoPath, clarification.commitSha);
      if (diff) {
        context.commitDiff = diff;
        log.info('✅ Commit diff extracted', { diffLength: diff.length });
      } else {
        log.warn('⚠️  No commit diff found', { commitSha: clarification.commitSha });
      }

      // Get commit message
      const commitInfo = await getCommitInfo(repoPath, clarification.commitSha);
      if (commitInfo) {
        context.commitMessage = commitInfo.message;
        log.info('✅ Commit message extracted');
      }
    } catch (error: any) {
      log.warn('⚠️  Failed to extract commit context', {
        error: error.message,
        commitSha: clarification.commitSha,
      });
    }
  }

  // Extract file context if we have file location
  if (finding.location?.file && repoPath) {
    try {
      const { getFileContext } = await import('./gitService.js');
      const fileContext = await getFileContext(
        repoPath,
        finding.location.file,
        finding.location.line || 0
      );
      if (fileContext) {
        context.fileContext = fileContext;
      }
    } catch (error: any) {
      log.warn('Failed to extract file context', {
        error: error.message,
        file: finding.location.file,
      });
    }
  }

  return context;
}

// ============================================================================
// CLAUDE VERIFICATION
// ============================================================================

/**
 * Call Claude to verify the clarification
 * Uses same spawn method as deep analysis - NO PTY bullshit
 */
async function callClaudeVerification(
  prompt: string
): Promise<VerificationResult> {
  const { spawn } = await import('child_process');

  return new Promise((resolve, reject) => {
    const args = [
      '--dangerously-skip-permissions',
      '-p', prompt,
      '--output-format', 'json',
      '--model', 'opus'
    ];

    log.info('Spawning Claude CLI for verification', { promptLength: prompt.length });

    const proc = spawn('claude', args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CLAUDE_CODE_ENTRYPOINT: 'cli'
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    proc.stdin?.end();

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        log.error('Claude verification failed', { code, stderr: stderr.substring(0, 500) });
        reject(new Error(`Claude exited with code ${code}`));
        return;
      }

      try {
        // Parse JSON response
        const jsonMatch = stdout.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          log.error('Failed to parse Claude response', { response: stdout.substring(0, 500) });
          reject(new Error('Invalid response format from Claude'));
          return;
        }

        const result = JSON.parse(jsonMatch[0]);

        // Validate response structure
        if (
          typeof result.verified !== 'boolean' ||
          !['high', 'medium', 'low'].includes(result.confidence) ||
          !['accept', 'reject', 'manual_review'].includes(result.recommendation) ||
          typeof result.reasoning !== 'string'
        ) {
          log.error('Invalid Claude response structure', { result });
          reject(new Error('Invalid response structure from Claude'));
          return;
        }

        resolve(result);
      } catch (error: any) {
        log.error('Failed to parse verification response', { error: error.message });
        reject(error);
      }
    });

    proc.on('error', (error) => {
      log.error('Failed to spawn Claude CLI', { error: error.message });
      reject(error);
    });
  });
}

// ============================================================================
// MAIN VERIFICATION FUNCTION
// ============================================================================

/**
 * Verify a clarification using Claude
 */
export async function verifyClarification(
  finding: FindingContext,
  clarification: ClarificationInput,
  repoPath?: string
): Promise<VerificationResult> {
  log.info('🔍 STEP 1: Starting clarification verification', {
    jobId: clarification.jobId,
    findingId: clarification.findingId,
    clarificationType: clarification.clarificationType,
  });

  // Extract code context
  log.info('📝 STEP 2: Extracting code context...', {
    hasRepoPath: !!repoPath,
    hasCommit: !!clarification.commitSha,
  });

  const codeContext = await extractCodeContext(finding, clarification, repoPath);

  log.info('✅ Code context extracted', {
    hasCodeSnippet: !!codeContext.codeSnippet,
    hasFileContext: !!codeContext.fileContext,
    hasCommitDiff: !!codeContext.commitDiff,
  });

  // Build verification prompt
  const prompt = buildVerificationPrompt(finding, clarification, codeContext);

  // Call Claude for verification
  log.info('🤖 STEP 3: Calling Claude for verification...', {
    promptLength: prompt.length,
  });

  const result = await callClaudeVerification(prompt);

  log.info(`✅ STEP 4: Verification ${result.verified ? 'PASSED' : 'FAILED'}`, {
    jobId: clarification.jobId,
    findingId: clarification.findingId,
    verified: result.verified,
    recommendation: result.recommendation,
    confidence: result.confidence,
  });

  // Store verification result in database
  log.info('💾 STEP 5: Storing verification result in database...');
  await storeVerificationResult(finding, clarification, codeContext, result);
  log.info('✅ Verification result stored');

  return result;
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

/**
 * Store verification result in database
 */
async function storeVerificationResult(
  finding: FindingContext,
  clarification: ClarificationInput,
  codeContext: CodeContext,
  result: VerificationResult
): Promise<void> {
  const verificationData: NewClarificationVerification = {
    jobId: clarification.jobId,
    clarificationId: clarification.clarificationId,
    findingId: clarification.findingId,
    findingTitle: finding.title,
    findingSeverity: finding.severity,
    findingDescription: finding.description,
    clarificationType: clarification.clarificationType,
    userExplanation: clarification.explanation,
    evidenceUrl: clarification.evidenceUrl || null,
    resolvedInCommit: clarification.resolvedInCommit || false,
    commitSha: clarification.commitSha || null,
    commitDiff: codeContext.commitDiff || null,
    commitMessage: codeContext.commitMessage || null,
    codeSnippet: codeContext.codeSnippet || null,
    fileContext: codeContext.fileContext || null,
    verified: result.verified,
    confidence: result.confidence,
    recommendation: result.recommendation,
    reasoning: result.reasoning,
    verifiedBy: 'claude-verifier',
    verificationModel: 'claude-opus-4-20250514',
    verificationPromptVersion: VERIFICATION_PROMPT_VERSION,
  };

  await db.insert(clarificationVerifications).values(verificationData);

  log.info('Verification result stored', {
    clarificationId: clarification.clarificationId,
    verified: result.verified,
  });
}

/**
 * Create FAQ entry for verified clarifications
 */
export async function createFAQFromVerification(
  finding: FindingContext,
  clarification: ClarificationInput,
  verification: VerificationResult
): Promise<void> {
  if (!verification.verified || verification.recommendation !== 'accept') {
    log.info('⏭️  Skipping FAQ creation - clarification not accepted', {
      clarificationId: clarification.clarificationId,
      verified: verification.verified,
      recommendation: verification.recommendation,
    });
    return;
  }

  log.info('📚 Creating FAQ entry for verified clarification...');

  const faqData: NewClarificationFaq = {
    jobId: clarification.jobId,
    clarificationId: clarification.clarificationId,
    findingId: clarification.findingId,
    findingTitle: finding.title,
    question: `Why was "${finding.title}" marked as ${clarification.clarificationType.replace('_', ' ')}?`,
    answer: `${clarification.explanation}\n\n**Verification:** ${verification.reasoning}`,
    category: clarification.clarificationType as any,
    verified: true,
    verifiedBy: 'claude-verifier',
    verificationReasoning: verification.reasoning,
    confidence: verification.confidence,
  };

  await db.insert(clarificationFaqs).values(faqData);

  log.info('✅ FAQ entry created successfully', {
    jobId: clarification.jobId,
    findingId: clarification.findingId,
  });
}

/**
 * Get verification result for a clarification
 */
export async function getVerificationForClarification(
  clarificationId: string
): Promise<VerificationResult | null> {
  const [verification] = await db
    .select()
    .from(clarificationVerifications)
    .where(eq(clarificationVerifications.clarificationId, clarificationId))
    .limit(1);

  if (!verification) {
    return null;
  }

  return {
    verified: verification.verified,
    confidence: verification.confidence as 'high' | 'medium' | 'low',
    reasoning: verification.reasoning,
    recommendation: verification.recommendation as 'accept' | 'reject' | 'manual_review',
  };
}

/**
 * Get verification stats for a job
 */
export async function getVerificationStats(jobId: string): Promise<{
  total: number;
  verified: number;
  rejected: number;
  manualReview: number;
  acceptanceRate: number;
}> {
  const verifications = await db
    .select()
    .from(clarificationVerifications)
    .where(eq(clarificationVerifications.jobId, jobId));

  const total = verifications.length;
  const verified = verifications.filter((v) => v.verified && v.recommendation === 'accept').length;
  const rejected = verifications.filter((v) => v.recommendation === 'reject').length;
  const manualReview = verifications.filter((v) => v.recommendation === 'manual_review').length;
  const acceptanceRate = total > 0 ? (verified / total) * 100 : 0;

  return {
    total,
    verified,
    rejected,
    manualReview,
    acceptanceRate,
  };
}

/**
 * Build batch verification prompt for ALL clarifications at once
 */
function buildBatchVerificationPrompt(
  clarificationsData: Array<{
    index: number;
    findingId: string;
    findingTitle: string;
    findingSeverity: string;
    findingDescription: string;
    location?: { file?: string; line?: number };
    codeSnippet?: string;
    recommendation?: string;
    clarificationType: string;
    explanation: string;
    evidenceUrl?: string;
    resolvedInCommit?: boolean;
    commitSha?: string;
  }>,
  sourcePath?: string | null
): string {
  const sourcePathInfo = sourcePath
    ? `\n\nSOURCE CODE LOCATION:\nThe smart contract source files are located at: ${sourcePath}\nYou can read files from this directory to verify contracts and functions exist.`
    : `\n\nNOTE: Source code path not provided. Base verification on code snippets and descriptions only.`;

  return `You are an expert smart contract auditor reviewing multiple clarifications submitted by the contract owner.

YOUR TASK:
Review ALL ${clarificationsData.length} clarifications below and verify each one independently.${sourcePathInfo}

BE STRICT BUT REASONABLE:
- ❌ REJECT if user just says "not an issue" without technical reasoning
- ⚠️ If you cannot find the contract/function referenced, check if the code snippet shows it exists - if so, the issue is with file access, NOT the clarification
- ❌ REJECT if explanation is clearly wrong or dismissive of a real vulnerability
- ❌ REJECT if explanation is vague or generic
- ✅ ACCEPT if the logic is sound and technically accurate, even if you can't access files to verify
- ✅ ACCEPT if the clarification type is "accepted_risk" with valid business justification
- ⚠️ MANUAL_REVIEW if explanation has some merit but needs human verification

IMPORTANT: If the finding includes a code snippet or location that proves the code exists, DO NOT reject just because you cannot access the file. The audit already found and analyzed this code.

CLARIFICATIONS TO VERIFY:
${JSON.stringify(clarificationsData, null, 2)}

RESPOND WITH A JSON ARRAY (one result per clarification, in the same order):
[
  {
    "index": 0,
    "findingId": "...",
    "verified": true/false,
    "confidence": "high/medium/low",
    "reasoning": "technical explanation of why you accepted or rejected this",
    "recommendation": "accept/reject/manual_review"
  },
  {
    "index": 1,
    "findingId": "...",
    "verified": true/false,
    "confidence": "high/medium/low",
    "reasoning": "...",
    "recommendation": "accept/reject/manual_review"
  }
  // ... one for each clarification
]

CRITICAL: Respond with ONLY the JSON array, no markdown, no explanations outside the JSON.`;
}

/**
 * Batch verify multiple clarifications in ONE Claude session
 * Called when user triggers re-analysis with pending clarifications
 */
export async function batchVerifyClarifications(
  jobId: string,
  pendingVerifications: Array<{ clarification: any; finding: any; findingId: string }>,
  allFindings: any[],
  sourcePath?: string | null
): Promise<void> {
  log.info('🚀 Starting batch verification with SINGLE Claude session', {
    jobId,
    count: pendingVerifications.length,
  });

  // Step 1: Build comprehensive data structure for batch prompt
  const clarificationsData = pendingVerifications.map(({ clarification, finding, findingId }, index) => {
    const answerValue = clarification.answerValue as any;
    const context = clarification.context as any;

    return {
      index,
      clarificationId: clarification.id,
      findingId,
      findingTitle: finding.title,
      findingSeverity: finding.severity || finding.adjustedSeverity || finding.originalSeverity,
      findingDescription: finding.description || '',
      location: finding.location,
      codeSnippet: finding.codeSnippet,
      recommendation: finding.recommendation,
      clarificationType: answerValue?.clarificationType || context?.clarificationType,
      explanation: answerValue?.explanation || context?.explanation || '',
      evidenceUrl: answerValue?.evidenceUrl,
      resolvedInCommit: answerValue?.resolvedInCommit || false,
      commitSha: answerValue?.commitSha,
    };
  });

  // Step 2: Build single batch verification prompt with source path
  log.info('📝 Building batch verification prompt with all clarifications...');
  const batchPrompt = buildBatchVerificationPrompt(clarificationsData, sourcePath);

  // Step 3: Call Claude ONCE with batch prompt
  log.info('🤖 Calling Claude ONCE for batch verification...', {
    promptLength: batchPrompt.length,
    clarificationCount: clarificationsData.length,
    hasSourcePath: !!sourcePath,
  });

  let batchResults: Array<{
    index: number;
    findingId: string;
    verified: boolean;
    confidence: 'high' | 'medium' | 'low';
    reasoning: string;
    recommendation: 'accept' | 'reject' | 'manual_review';
  }>;

  // Use same spawn method as deep analysis
  const { spawn } = await import('child_process');

  const responseText = await new Promise<string>((resolve, reject) => {
    const args = [
      '--dangerously-skip-permissions',
      '-p', batchPrompt,
      '--output-format', 'json',
      '--model', 'opus'
    ];

    const proc = spawn('claude', args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CLAUDE_CODE_ENTRYPOINT: 'cli'
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    proc.stdin?.end();

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        log.error('Claude batch verification failed', { code, stderr: stderr.substring(0, 500) });
        reject(new Error(`Claude exited with code ${code}`));
        return;
      }

      resolve(stdout);
    });

    proc.on('error', (error) => {
      log.error('Failed to spawn Claude CLI for batch verification', { error: error.message });
      reject(error);
    });
  });

  log.info('✅ Claude batch verification response received', {
    responseLength: responseText.length,
  });

  // Parse Claude CLI JSON wrapper first
  try {
    const cliResponse = JSON.parse(responseText);

    // Extract the actual result from Claude's response
    const actualResponse = cliResponse.result || responseText;

    log.info('Extracted result from CLI wrapper', {
      resultLength: actualResponse.length,
      resultPreview: actualResponse.substring(0, 200)
    });

    // Now parse the actual JSON array
    const jsonMatch = actualResponse.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      log.error('Failed to find JSON array in response', {
        response: actualResponse.substring(0, 500)
      });
      throw new Error('Invalid batch response format from Claude');
    }

    batchResults = JSON.parse(jsonMatch[0]);
  } catch (parseError: any) {
    log.error('Failed to parse Claude response', {
      error: parseError.message,
      response: responseText.substring(0, 1000)
    });
    throw parseError;
  }

  // Validate response
  if (!Array.isArray(batchResults) || batchResults.length !== pendingVerifications.length) {
    log.error('Invalid batch response length', {
      expected: pendingVerifications.length,
      received: batchResults.length,
    });
    throw new Error('Batch response length mismatch');
  }

  log.info('✅ Batch response parsed successfully', {
    resultCount: batchResults.length,
  });

  // Step 4: Save all verification results to database
  log.info('💾 Saving all verification results to database...');

  let successCount = 0;
  let failCount = 0;

  for (const result of batchResults) {
    try {
      const clarificationData = clarificationsData[result.index];
      const { clarification, finding } = pendingVerifications[result.index];

      // Store verification result
      const verificationData: NewClarificationVerification = {
        jobId,
        clarificationId: clarificationData.clarificationId,
        findingId: clarificationData.findingId,
        findingTitle: clarificationData.findingTitle,
        findingSeverity: clarificationData.findingSeverity,
        findingDescription: clarificationData.findingDescription,
        clarificationType: clarificationData.clarificationType as any,
        userExplanation: clarificationData.explanation,
        evidenceUrl: clarificationData.evidenceUrl || null,
        resolvedInCommit: clarificationData.resolvedInCommit || false,
        commitSha: clarificationData.commitSha || null,
        commitDiff: null, // Not extracted in batch mode
        commitMessage: null, // Not extracted in batch mode
        codeSnippet: clarificationData.codeSnippet || null,
        fileContext: null, // Not extracted in batch mode
        verified: result.verified,
        confidence: result.confidence,
        recommendation: result.recommendation,
        reasoning: result.reasoning,
        verifiedBy: 'claude-verifier-batch',
        verificationModel: 'claude-opus-4-20250514',
        verificationPromptVersion: VERIFICATION_PROMPT_VERSION,
      };

      await db.insert(clarificationVerifications).values(verificationData);

      // Update clarification status to 'resolved' so it doesn't show as "Ready to Process"
      await db
        .update(auditClarifications)
        .set({ status: 'resolved' })
        .where(eq(auditClarifications.id, clarificationData.clarificationId));

      log.info(`✅ Updated clarification status to 'resolved'`, {
        clarificationId: clarificationData.clarificationId,
        findingId: clarificationData.findingId.substring(0, 50),
      });

      successCount++;
      log.info(`✅ Saved verification ${successCount}/${batchResults.length}`, {
        findingId: clarificationData.findingId.substring(0, 50),
        verified: result.verified,
        recommendation: result.recommendation,
      });
    } catch (error: any) {
      failCount++;
      log.error(`❌ Failed to save verification ${successCount + failCount}/${batchResults.length}`, {
        error: error.message,
      });
    }
  }

  log.info('🎉 Batch verification complete', {
    jobId,
    total: pendingVerifications.length,
    success: successCount,
    failed: failCount,
    accepted: batchResults.filter(r => r.recommendation === 'accept').length,
    rejected: batchResults.filter(r => r.recommendation === 'reject').length,
    manualReview: batchResults.filter(r => r.recommendation === 'manual_review').length,
  });
}
