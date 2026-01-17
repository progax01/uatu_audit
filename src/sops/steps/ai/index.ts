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

  // Special handling for clarification generation - use deterministic service
  if (config.prompt === 'generate-clarification-questions') {
    return await generateClarificationsStep(step, config, context);
  }

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

  // Build step data based on what the step provides
  const stepData: Record<string, any> = {
    // Always include the generic findings field for backward compatibility
    [`${step.id.replace(/-/g, '')}Findings`]: findings,
    aiAnalysisRaw: response,
  };

  // Map AI results to expected step data fields based on step.provides
  if (step.provides && Array.isArray(step.provides)) {
    for (const providedField of step.provides) {
      // Map common AI output fields
      if (providedField === 'recommendations') {
        stepData.recommendations = findings;
      } else if (providedField === 'remediationPlan') {
        stepData.remediationPlan = findings.map((f: any) => ({
          issue: f.title,
          recommendation: f.recommendation,
          severity: f.severity,
        }));
      } else if (providedField === 'validatedFindings') {
        stepData.validatedFindings = findings;
      } else if (providedField === 'falsePositives') {
        stepData.falsePositives = [];
      } else if (providedField === 'adminFunctions' || providedField === 'privilegedOperations') {
        // For admin function identification steps
        stepData[providedField] = findings;
      } else if (providedField === 'accessControlFindings' || providedField === 'roleAnalysis') {
        // For access control analysis steps
        stepData[providedField] = findings;
      } else {
        // Default: provide the field with findings
        stepData[providedField] = findings;
      }
    }
  }

  return {
    success: true,
    findings,
    data: stepData,
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
    system: `OUTPUT FORMAT: JSON array only. NO explanations, NO markdown, NO text.

You are a smart contract security auditor. Identify all privileged/admin functions.

RESPONSE REQUIREMENTS:
1. Start your response with [
2. End your response with ]
3. Each finding must be a JSON object with: severity, title, description, file, line, recommendation
4. If no findings, return []
5. NO text before the [
6. NO text after the ]
7. NO markdown code blocks
8. NO explanations

VALID RESPONSE EXAMPLE:
[{"severity":"high","title":"Unrestricted admin function","description":"The setAdmin() function lacks access control","file":"MyContract.sol","line":42,"recommendation":"Add onlyOwner modifier"}]

INVALID RESPONSES (DO NOT DO THIS):
- "I found the following issues: [...]"
- Markdown code blocks with json
- "Here is the analysis... [...]"

YOUR RESPONSE MUST START WITH [ AND END WITH ]`,

    user: `Analyze the smart contract code and identify admin/privileged functions.
Output ONLY a JSON array starting with [ and ending with ]:

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
    system: `OUTPUT FORMAT: JSON array only. NO explanations, NO markdown, NO text.

You are a smart contract security auditor. Analyze access control vulnerabilities: missing modifiers, incorrect roles, centralization risks, missing multi-sig, improper initialization.

RESPONSE REQUIREMENTS:
1. Start with [
2. End with ]
3. Each finding: {"severity":"critical|high|medium|low|info","title":"...","description":"...","file":"...","line":123,"recommendation":"..."}
4. If no findings, return []
5. NO text outside the JSON array

YOUR RESPONSE MUST START WITH [ AND END WITH ]`,

    user: `Analyze access control in this smart contract.
Output ONLY a JSON array starting with [ and ending with ]:

{{contractCode}}

Admin functions: {{adminFunctions}}
Inheritance: {{inheritanceMap}}`,

    responseFormat: 'findings',
  },

  // Reentrancy Deep Check
  'check-reentrancy': {
    system: `OUTPUT FORMAT: JSON array only. NO explanations, NO markdown, NO text.

You are a smart contract security auditor. Analyze reentrancy vulnerabilities: cross-function, cross-contract, read-only, callbacks, state inconsistency during external calls.

RESPONSE REQUIREMENTS:
1. Start with [
2. End with ]
3. Each finding: {"severity":"critical|high|medium|low|info","title":"...","description":"...","file":"...","line":123,"recommendation":"..."}
4. If no findings, return []
5. NO text outside the JSON array

YOUR RESPONSE MUST START WITH [ AND END WITH ]`,

    user: `Analyze reentrancy vulnerabilities in this smart contract.
Output ONLY a JSON array starting with [ and ending with ]:

{{contractCode}}

External calls: {{externalCalls}}
Tool reentrancy findings: {{reentrancyFindings}}`,

    responseFormat: 'findings',
  },

  // Oracle Manipulation Check
  'check-oracle': {
    system: `OUTPUT FORMAT: JSON array only. NO explanations, NO markdown, NO text.

You are a smart contract security auditor. Analyze oracle manipulation vulnerabilities: flash loan attacks, price manipulation, stale prices, single oracle dependency, TWAP manipulation.

RESPONSE REQUIREMENTS:
1. Start with [
2. End with ]
3. Each finding: {"severity":"critical|high|medium|low|info","title":"...","description":"...","file":"...","line":123,"recommendation":"..."}
4. If no findings, return []
5. NO text outside the JSON array

YOUR RESPONSE MUST START WITH [ AND END WITH ]`,

    user: `Analyze oracle manipulation vulnerabilities in this smart contract.
Output ONLY a JSON array starting with [ and ending with ]:

{{contractCode}}

External dependencies: {{externalDependencies}}
Interfaces: {{implementedInterfaces}}`,

    responseFormat: 'findings',
  },

  // Business Logic Analysis
  'analyze-business-logic': {
    system: `OUTPUT FORMAT: JSON array only. NO explanations, NO markdown, NO text.

You are a smart contract security auditor. Analyze business logic vulnerabilities: incorrect state transitions, missing validation, edge cases, economic exploits, griefing vectors, front-running.

RESPONSE REQUIREMENTS:
1. Start with [
2. End with ]
3. Each finding: {"severity":"critical|high|medium|low|info","title":"...","description":"...","file":"...","line":123,"recommendation":"..."}
4. If no findings, return []
5. NO text outside the JSON array

YOUR RESPONSE MUST START WITH [ AND END WITH ]`,

    user: `Analyze business logic vulnerabilities in this smart contract.
Output ONLY a JSON array starting with [ and ending with ]:

{{contractCode}}

Function signatures: {{functionSignatures}}
SLOC: {{sloc}}`,

    responseFormat: 'findings',
  },

  // Finding Validation
  'validate-findings': {
    system: `OUTPUT FORMAT: JSON array only. NO explanations, NO markdown, NO text.

You are a smart contract security auditor reviewing tool-generated findings. For each: assess true/false positive, severity, exploitability, remediation.

RESPONSE REQUIREMENTS:
1. Start with [
2. End with ]
3. Each finding: {"severity":"critical|high|medium|low|info","title":"...","description":"...","file":"...","line":123,"recommendation":"..."}
4. If no findings, return []
5. NO text outside the JSON array

YOUR RESPONSE MUST START WITH [ AND END WITH ]`,

    user: `Review and validate these automated tool findings.
Output ONLY a JSON array starting with [ and ending with ]:

Tool findings: {{mergedFindings}}
Contract code: {{contractCode}}`,

    responseFormat: 'validation',
  },

  // Recommendations Generation
  'generate-recommendations': {
    system: `OUTPUT FORMAT: JSON array only. NO explanations, NO markdown, NO text.

You are a smart contract security auditor generating recommendations. Provide: prioritized steps, code examples, best practices, testing suggestions.

RESPONSE REQUIREMENTS:
1. Start with [
2. End with ]
3. Each recommendation: {"severity":"critical|high|medium|low|info","title":"...","description":"...","file":"...","line":123,"recommendation":"..."}
4. If no recommendations, return []
5. NO text outside the JSON array

YOUR RESPONSE MUST START WITH [ AND END WITH ]`,

    user: `Generate recommendations based on these audit findings.
Output ONLY a JSON array starting with [ and ending with ]:

Findings: {{finalFindings}}
Framework: {{framework}}
Language: {{language}}
Dependencies: {{dependencies}}
Score: {{auditScore}}/100`,

    responseFormat: 'recommendations',
  },

  // Quick Review (for Quick scans without compilation)
  'quick-review': {
    system: `OUTPUT FORMAT: JSON array only. NO explanations, NO markdown, NO text.

You are a smart contract security auditor performing a quick pattern-based review. Focus on obvious security issues that can be detected without compilation: hardcoded addresses, unprotected functions, missing validation, dangerous patterns.

RESPONSE REQUIREMENTS:
1. Start with [
2. End with ]
3. Each finding: {"severity":"critical|high|medium|low|info","title":"...","description":"...","file":"...","line":123,"recommendation":"..."}
4. If no findings, return []
5. NO text outside the JSON array

YOUR RESPONSE MUST START WITH [ AND END WITH ]`,

    user: `Perform a quick security review of this smart contract code.
Output ONLY a JSON array starting with [ and ending with ]:

{{contractCode}}

Previous tool findings: {{mergedFindings}}`,

    responseFormat: 'findings',
  },

  // Generate Clarification Questions (for Deep scans)
  'generate-clarification-questions': {
    system: `OUTPUT FORMAT: JSON array only. NO explanations, NO markdown, NO text.

You are a smart contract security auditor. Based on the findings, generate clarification questions for the developer. Focus on: ambiguous access control, unclear business logic, suspicious patterns that might be intentional.

RESPONSE REQUIREMENTS:
1. Start with [
2. End with ]
3. Each question: {"severity":"high|medium|low","title":"Question title","description":"Question details","recommendation":"What to ask"}
4. If no questions needed, return []
5. NO text outside the JSON array

YOUR RESPONSE MUST START WITH [ AND END WITH ]`,

    user: `Based on these findings, generate clarification questions for the developer.
Output ONLY a JSON array starting with [ and ending with ]:

Findings: {{mergedFindings}}
Contract code: {{contractCode}}`,

    responseFormat: 'findings',
  },

  // Business Logic Deep Analysis (with user context)
  'analyze-business-logic-deep': {
    system: `OUTPUT FORMAT: JSON array only. NO explanations, NO markdown, NO text.

You are a smart contract security auditor performing deep business logic analysis with developer context. Analyze: state transitions, economic exploits, edge cases, invariant violations, flash loan vectors, MEV opportunities.

RESPONSE REQUIREMENTS:
1. Start with [
2. End with ]
3. Each finding: {"severity":"critical|high|medium|low|info","title":"...","description":"...","file":"...","line":123,"recommendation":"..."}
4. If no findings, return []
5. NO text outside the JSON array

YOUR RESPONSE MUST START WITH [ AND END WITH ]`,

    user: `Perform deep business logic analysis with developer context.
Output ONLY a JSON array starting with [ and ending with ]:

{{contractCode}}

Function signatures: {{functionSignatures}}
User context from questionnaire: {{preAuditAnswers}}
Clarification answers: {{clarificationAnswers}}`,

    responseFormat: 'findings',
  },

  // Token Economics Analysis (for DeFi/Token contracts)
  'analyze-token-economics': {
    system: `OUTPUT FORMAT: JSON array only. NO explanations, NO markdown, NO text.

You are a smart contract security auditor analyzing token economics. Focus on: supply manipulation, inflation/deflation mechanisms, fee models, mint/burn patterns, transfer restrictions, economic attack vectors.

RESPONSE REQUIREMENTS:
1. Start with [
2. End with ]
3. Each finding: {"severity":"critical|high|medium|low|info","title":"...","description":"...","file":"...","line":123,"recommendation":"..."}
4. If no findings, return []
5. NO text outside the JSON array

YOUR RESPONSE MUST START WITH [ AND END WITH ]`,

    user: `Analyze token economics and economic security.
Output ONLY a JSON array starting with [ and ending with ]:

{{contractCode}}

User context: {{preAuditAnswers}}
Detected interfaces: {{implementedInterfaces}}`,

    responseFormat: 'findings',
  },

  // Custom Recommendations (with user context)
  'generate-custom-recommendations': {
    system: `OUTPUT FORMAT: JSON array only. NO explanations, NO markdown, NO text.

You are a smart contract security auditor generating context-aware recommendations based on developer input. Provide specific, actionable advice tailored to their use case.

RESPONSE REQUIREMENTS:
1. Start with [
2. End with ]
3. Each recommendation: {"severity":"critical|high|medium|low|info","title":"...","description":"...","file":"...","line":123,"recommendation":"..."}
4. If no recommendations, return []
5. NO text outside the JSON array

YOUR RESPONSE MUST START WITH [ AND END WITH ]`,

    user: `Generate custom recommendations based on findings and developer context.
Output ONLY a JSON array starting with [ and ending with ]:

Findings: {{finalFindings}}
Score: {{auditScore}}/100
User context: {{preAuditAnswers}}
Clarifications: {{clarificationAnswers}}
Framework: {{framework}}
Dependencies: {{dependencies}}`,

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
    // New context variables for Deep scans
    '{{preAuditAnswers}}': JSON.stringify(context.data.preAuditAnswers || {}, null, 2),
    '{{clarificationAnswers}}': JSON.stringify(context.data.clarificationAnswers || {}, null, 2),
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
  // Try to use simpleClaudeExecutor directly
  try {
    const { executeStreamingClaude } = await import('../../../services/ai/simpleClaudeExecutor.js');

    // Build full prompt - system prompts now have explicit JSON formatting requirements
    const fullPrompt = `${prompt.system}

${prompt.user}`;

    // Execute with Claude CLI
    const result = await executeStreamingClaude(fullPrompt, {
      timeout: (config.maxTokens || 4096) * 100, // ~100ms per token
      model: 'claude-sonnet-4-5-20250929', // Use Sonnet for AI steps
      cwd: context.projectPath,
    });

    return result.output || '';
  } catch (error: any) {
    log.error('Claude execution failed', { error: error.message });

    // Fallback to mock
    log.warn('Using mock AI response - Claude executor not available');
    return JSON.stringify({
      findings: [],
      summary: 'AI analysis would be performed here in production',
    });
  }
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

    // Step 1: Try direct parse (for well-formatted responses)
    try {
      parsed = JSON.parse(response.trim());
    } catch {
      // Step 2: Extract JSON from various formats
      const patterns = [
        // Markdown code blocks
        /```json\s*([\s\S]*?)```/,
        /```\s*([\s\S]*?)```/,
        // JSON arrays with surrounding text
        /\[\s*\{[\s\S]*?\}\s*\]/,
        // Look for arrays after common prefixes
        /(?:findings|results|issues|array)[\s:]*(\[\s*\{[\s\S]*?\}\s*\])/i,
        // Find any JSON-like array structure
        /(\[\s*\{[^[\]]*"severity"[^[\]]*\}\s*(?:,\s*\{[^[\]]*"severity"[^[\]]*\}\s*)*\])/,
      ];

      let jsonText = response.trim();

      for (const pattern of patterns) {
        const match = response.match(pattern);
        if (match) {
          jsonText = match[1] || match[0];
          // Remove markdown and common artifacts
          jsonText = jsonText
            .replace(/^```json?\s*/, '')
            .replace(/```\s*$/, '')
            .replace(/^[^[]*\[/, '[')  // Remove text before first [
            .replace(/\][^[\]]*$/, ']')  // Remove text after last ]
            .trim();

          try {
            parsed = JSON.parse(jsonText);
            break;
          } catch {
            // Try next pattern
            continue;
          }
        }
      }

      // If still not parsed, throw to fall through to text extraction
      if (!parsed) {
        throw new Error('No valid JSON found in response');
      }
    }

    // Successfully parsed JSON - now extract findings
    if (!parsed) {
      throw new Error('Failed to parse any JSON');
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
    log.warn('Failed to parse AI response as JSON, attempting text extraction', {
      error: (error as Error).message,
      responsePreview: response.slice(0, 200)
    });
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

// ============================================================================
// Clarification Generation Step
// ============================================================================

/**
 * Generate clarification questions using the deterministic service
 */
async function generateClarificationsStep(
  step: StepDefinition,
  config: AIPromptStepConfig,
  context: StepContext
): Promise<StepResult> {
  await context.onProgress?.(10, 'Analyzing findings for clarifications...');

  try {
    // Import clarification generator service
    const { generateClarificationQuestions } = await import('../../../services/clarificationGeneratorService.js');

    const mergedFindings = context.data.mergedFindings || [];
    const contractCategory = context.data.contractCategory;
    const jobId = context.job.id || '';

    await context.onProgress?.(50, 'Generating questions...');

    // Generate clarification questions
    const result = generateClarificationQuestions(jobId, mergedFindings, contractCategory);

    await context.onProgress?.(80, 'Storing clarifications...');

    // Store clarification requests in database
    if (result.questions.length > 0) {
      const { storeClarificationRequests } = await import('../../../repositories/auditJobRepository.js');
      await storeClarificationRequests(jobId, result.questions);
    }

    await context.onProgress?.(100, `Generated ${result.questions.length} questions`);

    log.info('Clarification questions generated', {
      jobId,
      totalQuestions: result.totalQuestions,
      blockingQuestions: result.blockingQuestions,
    });

    return {
      success: true,
      findings: [],
      data: {
        clarificationRequests: result.questions,
        clarificationCount: result.totalQuestions,
        blockingClarifications: result.blockingQuestions,
      },
    };
  } catch (error: any) {
    log.error('Clarification generation failed', { error: error.message });

    return {
      success: true, // Don't fail the audit if clarification generation fails
      findings: [],
      data: {
        clarificationRequests: [],
        clarificationCount: 0,
        blockingClarifications: 0,
      },
      error: `Clarification generation failed: ${error.message}`,
    };
  }
}
