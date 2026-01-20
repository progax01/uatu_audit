/**
 * Triage Verification Agent
 *
 * AI-powered agent that verifies user's Liability Triage explanations
 * by reading actual code and checking if claims are accurate.
 *
 * Prevents users from dismissing real issues with false explanations.
 */

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';

const log = logger.child({ service: 'triage-verification' });

// ============================================================================
// TYPES
// ============================================================================

export interface Finding {
  findingId: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  location: {
    file: string;
    line?: number;
    column?: number;
  };
  codeSnippet?: string;
  recommendation?: string;
}

export interface TriageExplanation {
  findingId: string;
  userExplanation: string;
  claimedReason: 'false_positive' | 'intentional_design' | 'mitigated_elsewhere' | 'not_applicable' | 'acknowledged';
  userProvidedEvidence?: string; // Optional code snippet or reference
}

export interface VerificationResult {
  findingId: string;
  isAccurate: boolean;
  confidence: 'high' | 'medium' | 'low';
  verificationStatus: 'accurate' | 'misleading' | 'insufficient' | 'needs_human_review';
  reasoning: string;
  suggestedSeverity?: 'critical' | 'high' | 'medium' | 'low' | 'info' | 'dismissed';
  additionalEvidence?: string[]; // Links to code that supports or refutes the claim
  recommendations: string[];
}

// ============================================================================
// VERIFICATION AGENT
// ============================================================================

export class TriageVerificationAgent {
  private anthropic: Anthropic;
  private model: string;

  constructor(apiKey?: string, model: string = 'claude-sonnet-4-5-20250929') {
    this.anthropic = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
    this.model = model;
  }

  /**
   * Verify a user's triage explanation against actual code
   */
  async verifyTriageExplanation(
    finding: Finding,
    triage: TriageExplanation,
    projectPath: string
  ): Promise<VerificationResult> {
    log.info('Starting triage verification', {
      findingId: finding.findingId,
      claimedReason: triage.claimedReason,
    });

    try {
      // Read actual code from file
      const codeContext = await this.readCodeContext(
        projectPath,
        finding.location.file,
        finding.location.line
      );

      // Build verification prompt
      const prompt = this.buildVerificationPrompt(finding, triage, codeContext);

      // Call Claude for verification
      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 4000,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      // Parse response
      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      const result = this.parseVerificationResponse(content.text, finding.findingId);

      log.info('Triage verification complete', {
        findingId: finding.findingId,
        verificationStatus: result.verificationStatus,
        confidence: result.confidence,
      });

      return result;
    } catch (error: any) {
      log.error('Triage verification failed', {
        findingId: finding.findingId,
        error: error.message,
      });

      return {
        findingId: finding.findingId,
        isAccurate: false,
        confidence: 'low',
        verificationStatus: 'needs_human_review',
        reasoning: `Verification failed due to error: ${error.message}`,
        recommendations: ['Manual review required due to verification error'],
      };
    }
  }

  /**
   * Batch verify multiple triage explanations
   */
  async verifyBatch(
    findings: Finding[],
    triages: TriageExplanation[],
    projectPath: string
  ): Promise<VerificationResult[]> {
    log.info('Starting batch triage verification', { count: triages.length });

    const results: VerificationResult[] = [];

    for (const triage of triages) {
      const finding = findings.find((f) => f.findingId === triage.findingId);
      if (!finding) {
        log.warn('Finding not found for triage', { findingId: triage.findingId });
        continue;
      }

      const result = await this.verifyTriageExplanation(finding, triage, projectPath);
      results.push(result);

      // Rate limiting: wait 1 second between requests
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    log.info('Batch verification complete', {
      total: results.length,
      accurate: results.filter((r) => r.verificationStatus === 'accurate').length,
      misleading: results.filter((r) => r.verificationStatus === 'misleading').length,
      insufficient: results.filter((r) => r.verificationStatus === 'insufficient').length,
    });

    return results;
  }

  /**
   * Read code context around the finding location
   */
  private async readCodeContext(
    projectPath: string,
    filePath: string,
    lineNumber?: number
  ): Promise<string> {
    try {
      const fullPath = path.join(projectPath, filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      const lines = content.split('\n');

      if (!lineNumber) {
        // Return entire file if no line number
        return content;
      }

      // Return context: 10 lines before and after
      const startLine = Math.max(0, lineNumber - 11);
      const endLine = Math.min(lines.length, lineNumber + 10);
      const contextLines = lines.slice(startLine, endLine);

      return contextLines
        .map((line, idx) => {
          const actualLine = startLine + idx + 1;
          const marker = actualLine === lineNumber ? '>>> ' : '    ';
          return `${marker}${actualLine}: ${line}`;
        })
        .join('\n');
    } catch (error: any) {
      log.warn('Failed to read code context', { filePath, error: error.message });
      return `// Unable to read code: ${error.message}`;
    }
  }

  /**
   * Build verification prompt for Claude
   */
  private buildVerificationPrompt(
    finding: Finding,
    triage: TriageExplanation,
    codeContext: string
  ): string {
    return `You are a security auditor verifying whether a user's explanation for dismissing a security finding is accurate.

# YOUR TASK
Analyze the code and determine if the user's explanation is:
1. **Accurate**: The explanation is correct and the finding should be dismissed or downgraded
2. **Misleading**: The explanation is incorrect or incomplete, the finding is real
3. **Insufficient**: Not enough information to verify, needs more evidence
4. **Needs Human Review**: Complex case requiring expert judgment

# SECURITY FINDING

**Title**: ${finding.title}
**Severity**: ${finding.severity}
**Description**: ${finding.description}
**Location**: ${finding.location.file}${finding.location.line ? `:${finding.location.line}` : ''}

${finding.recommendation ? `**Recommendation**: ${finding.recommendation}` : ''}

${finding.codeSnippet ? `**Code Snippet from Finding**:\n\`\`\`solidity\n${finding.codeSnippet}\n\`\`\`` : ''}

# USER'S TRIAGE EXPLANATION

**Claimed Reason**: ${triage.claimedReason}
**Explanation**: ${triage.userExplanation}

${triage.userProvidedEvidence ? `**User-Provided Evidence**:\n${triage.userProvidedEvidence}` : ''}

# ACTUAL CODE CONTEXT

\`\`\`solidity
${codeContext}
\`\`\`

# ANALYSIS INSTRUCTIONS

1. **Read the actual code carefully** - Does it match the finding description?
2. **Evaluate the user's explanation** - Is it accurate based on the code?
3. **Check for common dismissal tactics**:
   - "This is intentional" → Verify if design makes sense or if it's a real vulnerability
   - "Mitigated elsewhere" → Check if mitigation actually exists and is sufficient
   - "False positive" → Verify if the tool made a mistake
   - "Not applicable" → Check if context truly makes this not an issue

4. **Look for red flags**:
   - Generic explanations without specific code references
   - Claims about code that isn't visible in the context
   - Misunderstanding of the vulnerability
   - Dismissing critical issues too easily

5. **Provide specific evidence** - Quote exact lines that support or refute the claim

# OUTPUT FORMAT

Return JSON only:

\`\`\`json
{
  "isAccurate": boolean,
  "confidence": "high" | "medium" | "low",
  "verificationStatus": "accurate" | "misleading" | "insufficient" | "needs_human_review",
  "reasoning": "Detailed explanation with code references",
  "suggestedSeverity": "critical" | "high" | "medium" | "low" | "info" | "dismissed",
  "additionalEvidence": ["line X shows...", "function Y proves..."],
  "recommendations": ["what should be done"]
}
\`\`\`

# EXAMPLES

**Example 1: Accurate Dismissal**
Finding: "Reentrancy vulnerability in withdraw()"
User: "False positive - function has nonReentrant modifier from OpenZeppelin"
Code shows: \`function withdraw() external nonReentrant { ... }\`
→ Status: accurate, suggestedSeverity: dismissed

**Example 2: Misleading Dismissal**
Finding: "Unchecked return value from external call"
User: "Intentional design, we don't care about return values"
Code shows: External call can fail silently, funds could be lost
→ Status: misleading, suggestedSeverity: high (keep original severity)

**Example 3: Insufficient Evidence**
Finding: "Integer overflow in calculation"
User: "Mitigated in the parent contract"
Code context: Only shows current contract, parent not visible
→ Status: insufficient, recommendations: ["Provide parent contract code"]

Be strict: Only mark as "accurate" if the code clearly supports the user's claim.
When in doubt, err on the side of keeping the finding.`;
  }

  /**
   * Parse Claude's verification response
   */
  private parseVerificationResponse(responseText: string, findingId: string): VerificationResult {
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonText = jsonMatch ? jsonMatch[1] : responseText;

      const parsed = JSON.parse(jsonText);

      return {
        findingId,
        isAccurate: parsed.isAccurate || false,
        confidence: parsed.confidence || 'low',
        verificationStatus: parsed.verificationStatus || 'needs_human_review',
        reasoning: parsed.reasoning || 'No reasoning provided',
        suggestedSeverity: parsed.suggestedSeverity,
        additionalEvidence: parsed.additionalEvidence || [],
        recommendations: parsed.recommendations || [],
      };
    } catch (error: any) {
      log.error('Failed to parse verification response', {
        error: error.message,
        responseText: responseText.substring(0, 500),
      });

      return {
        findingId,
        isAccurate: false,
        confidence: 'low',
        verificationStatus: 'needs_human_review',
        reasoning: `Failed to parse verification response: ${error.message}`,
        recommendations: ['Manual review required'],
      };
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export function createTriageVerificationAgent(apiKey?: string): TriageVerificationAgent {
  return new TriageVerificationAgent(apiKey);
}
