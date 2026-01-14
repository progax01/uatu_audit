/**
 * AI Prompt Step Executors
 *
 * Executes steps that require AI analysis using Claude.
 * Builds context-aware prompts and parses structured responses.
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import type {
  StepDefinition,
  StepContext,
  StepResult,
  AIPromptStepConfig,
  StepFinding,
} from '../../definitions/types';
import { logger } from '../../../utils/logger';

const log = logger.child({ module: 'ai-steps' });

// ============================================================================
// Main Executor
// ============================================================================

/**
 * Execute an AI prompt step
 */
export async function executeAIPromptStep(
  step: StepDefinition,
  config: AIPromptStepConfig,
  context: StepContext
): Promise<StepResult> {
  log.debug('Executing AI step', {
    stepId: step.id,
    prompt: config.prompt,
  });

  await context.onProgress?.(5, 'Building prompt...');

  // Get the prompt template
  const promptTemplate = AI_PROMPTS[config.prompt];
  if (!promptTemplate) {
    return {
      success: false,
      error: `Unknown prompt template: ${config.prompt}`,
      findings: [],
    };
  }

  // Build the prompt with context
  const prompt = await buildPrompt(promptTemplate, config, context);

  await context.onProgress?.(10, 'Analyzing with AI...');

  // Execute AI analysis
  // Note: In production, this would call the Claude API
  // For now, we'll use a mock implementation that can be replaced
  const response = await executeAIAnalysis(prompt, config, context);

  await context.onProgress?.(90, 'Processing results...');

  // Parse the response
  const findings = parseAIResponse(response, step.id, config);

  await context.onProgress?.(100, `Found ${findings.length} issues`);

  return {
    success: true,
    findings,
    data: {
      [`${step.id.replace(/-/g, '')}Findings`]: findings,
      aiAnalysisRaw: response,
    },
  };
}

// ============================================================================
// Prompt Templates
// ============================================================================

interface PromptTemplate {
  system: string;
  user: string;
  responseFormat: 'findings' | 'recommendations' | 'validation' | 'text';
}

const AI_PROMPTS: Record<string, PromptTemplate> = {
  // Admin Function Identification
  'identify-admin-functions': {
    system: `You are an expert smart contract security auditor specializing in access control analysis.
Your task is to identify all privileged/admin functions in the provided smart contract code.

For each admin function found, provide:
1. Function name and signature
2. File location
3. Access control mechanism used (onlyOwner, role-based, etc.)
4. Potential risks if compromised
5. Severity assessment`,

    user: `Analyze the following smart contract code and identify all admin/privileged functions:

{{contractCode}}

Previous analysis found these external calls that may indicate privileged operations:
{{externalCalls}}

The contract implements these interfaces:
{{implementedInterfaces}}

Respond in JSON format with an array of findings.`,

    responseFormat: 'findings',
  },

  // Access Control Analysis
  'analyze-access-control': {
    system: `You are an expert smart contract security auditor specializing in access control patterns.
Analyze the provided code for access control vulnerabilities including:
- Missing access modifiers on sensitive functions
- Incorrect role hierarchy
- Centralization risks
- Missing multi-sig requirements for critical operations
- Improper initialization of access control`,

    user: `Analyze the access control implementation in this smart contract:

{{contractCode}}

Admin functions identified:
{{adminFunctions}}

Inheritance hierarchy:
{{inheritanceMap}}

Provide findings for any access control issues found.`,

    responseFormat: 'findings',
  },

  // Reentrancy Deep Check
  'check-reentrancy': {
    system: `You are an expert smart contract security auditor specializing in reentrancy vulnerabilities.
Perform a deep analysis of potential reentrancy attack vectors including:
- Cross-function reentrancy
- Cross-contract reentrancy
- Read-only reentrancy
- Reentrancy via callbacks
- State inconsistency during external calls`,

    user: `Analyze the following code for reentrancy vulnerabilities:

{{contractCode}}

External calls identified:
{{externalCalls}}

Tool findings related to reentrancy:
{{reentrancyFindings}}

Provide detailed findings for any reentrancy risks.`,

    responseFormat: 'findings',
  },

  // Oracle Manipulation Check
  'check-oracle': {
    system: `You are an expert smart contract security auditor specializing in oracle and price feed security.
Analyze for oracle manipulation vulnerabilities including:
- Flash loan attack vectors
- Price manipulation via liquidity
- Stale price data
- Single oracle dependency
- TWAP manipulation`,

    user: `Analyze the following code for oracle manipulation vulnerabilities:

{{contractCode}}

External dependencies:
{{externalDependencies}}

Identified interfaces:
{{implementedInterfaces}}

Provide findings for any oracle-related risks.`,

    responseFormat: 'findings',
  },

  // Business Logic Analysis
  'analyze-business-logic': {
    system: `You are an expert smart contract security auditor specializing in business logic vulnerabilities.
Analyze for logic flaws including:
- Incorrect state transitions
- Missing validation
- Edge case handling
- Economic exploits
- Griefing vectors
- Front-running opportunities`,

    user: `Analyze the business logic of this smart contract:

{{contractCode}}

Function signatures:
{{functionSignatures}}

SLOC statistics:
{{sloc}}

Provide findings for any business logic issues.`,

    responseFormat: 'findings',
  },

  // Finding Validation
  'validate-findings': {
    system: `You are an expert smart contract security auditor reviewing tool-generated findings.
For each finding, assess:
1. Is this a true positive or false positive?
2. What is the actual severity given the contract context?
3. What is the exploitability?
4. Provide concrete remediation steps`,

    user: `Review and validate these automated tool findings:

{{mergedFindings}}

Contract code for context:
{{contractCode}}

Mark each finding as confirmed, likely false positive, or needs manual review.`,

    responseFormat: 'validation',
  },

  // Recommendations Generation
  'generate-recommendations': {
    system: `You are an expert smart contract security auditor generating actionable recommendations.
Based on the audit findings, provide:
1. Prioritized remediation steps
2. Code examples for fixes where applicable
3. Best practice recommendations
4. Testing suggestions`,

    user: `Generate recommendations based on these audit findings:

{{finalFindings}}

Contract context:
- Framework: {{framework}}
- Language: {{language}}
- Dependencies: {{dependencies}}

Score: {{auditScore}}/100

Provide actionable recommendations.`,

    responseFormat: 'recommendations',
  },
};

// ============================================================================
// Prompt Building
// ============================================================================

async function buildPrompt(
  template: PromptTemplate,
  config: AIPromptStepConfig,
  context: StepContext
): Promise<{ system: string; user: string }> {
  let userPrompt = template.user;

  // Replace template variables with context data
  const replacements: Record<string, string> = {
    '{{contractCode}}': await getContractCode(context),
    '{{externalCalls}}': JSON.stringify(context.data.externalCalls || [], null, 2),
    '{{implementedInterfaces}}': JSON.stringify(context.data.implementedInterfaces || {}, null, 2),
    '{{adminFunctions}}': JSON.stringify(context.data.adminFunctions || [], null, 2),
    '{{inheritanceMap}}': JSON.stringify(context.data.inheritanceMap || {}, null, 2),
    '{{reentrancyFindings}}': JSON.stringify(
      (context.data.mergedFindings || []).filter((f: any) =>
        f.title?.toLowerCase().includes('reentrancy')
      ),
      null,
      2
    ),
    '{{externalDependencies}}': JSON.stringify(context.data.externalDependencies || [], null, 2),
    '{{functionSignatures}}': JSON.stringify(context.data.functionSignatures || {}, null, 2),
    '{{sloc}}': JSON.stringify(context.data.sloc || {}, null, 2),
    '{{mergedFindings}}': JSON.stringify(context.data.mergedFindings || [], null, 2),
    '{{finalFindings}}': JSON.stringify(context.data.finalFindings || [], null, 2),
    '{{framework}}': context.data.detectedFramework || 'unknown',
    '{{language}}': context.data.detectedLanguage || 'unknown',
    '{{dependencies}}': JSON.stringify(context.data.identifiedDependencies || [], null, 2),
    '{{auditScore}}': String(context.data.auditScore || 0),
  };

  for (const [key, value] of Object.entries(replacements)) {
    userPrompt = userPrompt.replace(new RegExp(key, 'g'), value);
  }

  return {
    system: template.system,
    user: userPrompt,
  };
}

async function getContractCode(context: StepContext): Promise<string> {
  const mainContracts = context.data.mainContracts || [];
  const codeSnippets: string[] = [];

  // Limit to top 5 contracts by size to avoid token limits
  const topContracts = mainContracts
    .sort((a: any, b: any) => (b.size || 0) - (a.size || 0))
    .slice(0, 5);

  for (const contract of topContracts) {
    const fullPath = path.join(context.projectPath, contract.path);

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      codeSnippets.push(`// File: ${contract.path}\n${content}`);
    } catch {
      // Skip files that can't be read
    }
  }

  return codeSnippets.join('\n\n// ================\n\n');
}

// ============================================================================
// AI Execution
// ============================================================================

async function executeAIAnalysis(
  prompt: { system: string; user: string },
  config: AIPromptStepConfig,
  context: StepContext
): Promise<string> {
  // In production, this would call the Claude API
  // For now, we implement a mock that can be replaced with the actual API call

  // Check if we have a Claude executor service available
  const claudeExecutor = (global as any).claudeExecutor;

  if (claudeExecutor && typeof claudeExecutor.execute === 'function') {
    try {
      const result = await claudeExecutor.execute({
        systemPrompt: prompt.system,
        userPrompt: prompt.user,
        maxTokens: config.maxTokens || 4096,
        temperature: config.temperature || 0.3,
      });

      return result.response || '';
    } catch (error: any) {
      log.error('Claude execution failed', { error: error.message });
      throw error;
    }
  }

  // Mock implementation for development/testing
  log.warn('Using mock AI response - Claude executor not available');

  return JSON.stringify({
    findings: [],
    summary: 'AI analysis would be performed here in production',
  });
}

// ============================================================================
// Response Parsing
// ============================================================================

function parseAIResponse(
  response: string,
  stepId: string,
  config: AIPromptStepConfig
): StepFinding[] {
  const findings: StepFinding[] = [];

  try {
    // Try to parse as JSON first
    let parsed: any;

    // Extract JSON from markdown code blocks if present
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[1]);
    } else {
      parsed = JSON.parse(response);
    }

    // Handle different response formats
    if (Array.isArray(parsed)) {
      // Direct array of findings
      for (const item of parsed) {
        findings.push(normalizeAIFinding(item, stepId));
      }
    } else if (parsed.findings && Array.isArray(parsed.findings)) {
      // Object with findings array
      for (const item of parsed.findings) {
        findings.push(normalizeAIFinding(item, stepId));
      }
    } else if (parsed.issues && Array.isArray(parsed.issues)) {
      // Object with issues array
      for (const item of parsed.issues) {
        findings.push(normalizeAIFinding(item, stepId));
      }
    }
  } catch (error) {
    // If JSON parsing fails, try to extract findings from text
    log.warn('Failed to parse AI response as JSON, attempting text extraction');
    const textFindings = extractFindingsFromText(response, stepId);
    findings.push(...textFindings);
  }

  return findings;
}

function normalizeAIFinding(item: any, stepId: string): StepFinding {
  return {
    stepId,
    tool: 'ai-analysis',
    findingId: `ai-${stepId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    severity: normalizeSeverity(item.severity),
    title: item.title || item.name || 'AI Finding',
    description: item.description || item.message || item.details || '',
    confidence: item.confidence || 0.7,
    location: item.location || item.file ? {
      file: item.location?.file || item.file || '',
      line: item.location?.line || item.line,
    } : undefined,
    recommendation: item.recommendation || item.remediation || item.fix || '',
    rawOutput: item,
  };
}

function normalizeSeverity(severity: any): StepFinding['severity'] {
  if (!severity) return 'medium';

  const s = String(severity).toLowerCase();

  if (s.includes('critical')) return 'critical';
  if (s.includes('high')) return 'high';
  if (s.includes('medium') || s.includes('moderate')) return 'medium';
  if (s.includes('low') || s.includes('minor')) return 'low';
  if (s.includes('info') || s.includes('note') || s.includes('gas')) return 'info';

  return 'medium';
}

function extractFindingsFromText(text: string, stepId: string): StepFinding[] {
  const findings: StepFinding[] = [];

  // Try to extract findings from structured text
  // Look for patterns like "Issue:", "Vulnerability:", "Finding:"
  const patterns = [
    /(?:Issue|Vulnerability|Finding|Problem|Risk)\s*(?:\d+)?[:\-]\s*(.+?)(?=(?:Issue|Vulnerability|Finding|Problem|Risk|$))/gis,
    /(?:\*{1,2}|#{1,3})\s*(.+?)\s*(?:\*{1,2}|#{1,3})?[:\-]?\s*([\s\S]+?)(?=(?:\*{1,2}|#{1,3})|$)/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match[1] && match[1].length > 10) {
        findings.push({
          stepId,
          tool: 'ai-analysis',
          findingId: `ai-text-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          severity: inferSeverityFromText(match[0]),
          title: match[1].substring(0, 100).trim(),
          description: match[2]?.trim() || match[1].trim(),
          confidence: 0.5, // Lower confidence for text-extracted findings
        });
      }
    }
  }

  return findings;
}

function inferSeverityFromText(text: string): StepFinding['severity'] {
  const lower = text.toLowerCase();

  if (lower.includes('critical') || lower.includes('severe')) return 'critical';
  if (lower.includes('high') || lower.includes('serious')) return 'high';
  if (lower.includes('medium') || lower.includes('moderate')) return 'medium';
  if (lower.includes('low') || lower.includes('minor')) return 'low';
  if (lower.includes('info') || lower.includes('note')) return 'info';

  return 'medium';
}
