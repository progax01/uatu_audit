import { logger } from '../utils/logger';

const log = logger.child({ service: 'cot-parser' });

/**
 * Chain-of-Thought (CoT) Parser
 * Parses and validates CoT reasoning from AI output
 */

export interface CoTReasoning {
  step: string;
  observation: string;
  hypothesis: string;
  validation: string | string[];
  conclusion: string;
  confidence?: number;
  confidence_factors?: string[];
  related_finding?: string;
}

export interface CoTOutput {
  reasoning: CoTReasoning[];
  findings: any[];
  metadata?: {
    total_steps: number;
    avg_confidence: number;
    reasoning_quality: 'high' | 'medium' | 'low';
  };
}

export class CoTParser {
  /**
   * Parse CoT reasoning from AI output
   */
  parseOutput(output: string): CoTOutput {
    log.debug('Parsing Chain-of-Thought output...');

    const reasoning: CoTReasoning[] = [];
    const findings: any[] = [];

    try {
      // Try to parse as JSON first
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        // Extract reasoning
        if (parsed.reasoning) {
          if (Array.isArray(parsed.reasoning)) {
            reasoning.push(...parsed.reasoning);
          } else {
            reasoning.push(parsed.reasoning);
          }
        }

        // Extract findings
        if (parsed.findings) {
          if (Array.isArray(parsed.findings)) {
            findings.push(...parsed.findings);
          } else {
            findings.push(parsed.findings);
          }
        }

        // Also check for reasoning field in each finding
        if (parsed.findings && Array.isArray(parsed.findings)) {
          for (const finding of parsed.findings) {
            if (finding.reasoning) {
              const reasoningWithFinding = {
                ...finding.reasoning,
                related_finding: finding.id
              };
              reasoning.push(reasoningWithFinding);
            }
          }
        }
      }

      log.info(`Parsed ${reasoning.length} reasoning steps and ${findings.length} findings`);

      return {
        reasoning: reasoning.map(r => this.validateReasoning(r)),
        findings,
        metadata: this.calculateMetadata(reasoning)
      };
    } catch (error) {
      log.error('Failed to parse CoT output:', error);
      return {
        reasoning: [],
        findings: [],
        metadata: {
          total_steps: 0,
          avg_confidence: 0,
          reasoning_quality: 'low'
        }
      };
    }
  }

  /**
   * Validate and normalize a reasoning step
   */
  private validateReasoning(reasoning: any): CoTReasoning {
    return {
      step: reasoning.step || 'Unknown step',
      observation: reasoning.observation || '',
      hypothesis: reasoning.hypothesis || '',
      validation: reasoning.validation || '',
      conclusion: reasoning.conclusion || '',
      confidence: reasoning.confidence || this.estimateConfidence(reasoning),
      confidence_factors: reasoning.confidence_factors || [],
      related_finding: reasoning.related_finding
    };
  }

  /**
   * Estimate confidence if not provided
   */
  private estimateConfidence(reasoning: any): number {
    let confidence = 0.5;

    // Higher confidence if validation is detailed
    if (reasoning.validation) {
      const validationLength = Array.isArray(reasoning.validation)
        ? reasoning.validation.join('').length
        : reasoning.validation.length;

      if (validationLength > 200) confidence += 0.2;
      else if (validationLength > 100) confidence += 0.1;
    }

    // Higher confidence if observation is detailed
    if (reasoning.observation && reasoning.observation.length > 100) {
      confidence += 0.1;
    }

    // Higher confidence if conclusion is clear
    if (reasoning.conclusion && reasoning.conclusion.length > 50) {
      confidence += 0.1;
    }

    return Math.min(1.0, confidence);
  }

  /**
   * Calculate metadata about reasoning quality
   */
  private calculateMetadata(reasoning: CoTReasoning[]): {
    total_steps: number;
    avg_confidence: number;
    reasoning_quality: 'high' | 'medium' | 'low';
  } {
    if (reasoning.length === 0) {
      return {
        total_steps: 0,
        avg_confidence: 0,
        reasoning_quality: 'low'
      };
    }

    const totalConfidence = reasoning.reduce(
      (sum, r) => sum + (r.confidence || 0.5),
      0
    );
    const avgConfidence = totalConfidence / reasoning.length;

    const quality =
      avgConfidence >= 0.85 && reasoning.length >= 3 ? 'high' :
      avgConfidence >= 0.70 && reasoning.length >= 2 ? 'medium' : 'low';

    return {
      total_steps: reasoning.length,
      avg_confidence: Number(avgConfidence.toFixed(2)),
      reasoning_quality: quality
    };
  }

  /**
   * Extract reasoning from markdown-style output
   */
  parseMarkdownReasoning(output: string): CoTReasoning[] {
    const reasoning: CoTReasoning[] = [];

    // Look for reasoning sections in markdown
    const sections = output.split(/#{1,3}\s+(Reasoning|Chain-of-Thought|Analysis)/gi);

    for (const section of sections) {
      const stepMatch = section.match(/Step:\s*(.+)/i);
      const obsMatch = section.match(/Observation:\s*(.+)/i);
      const hypMatch = section.match(/Hypothesis:\s*(.+)/i);
      const valMatch = section.match(/Validation:\s*(.+)/i);
      const conMatch = section.match(/Conclusion:\s*(.+)/i);

      if (stepMatch && obsMatch && hypMatch) {
        reasoning.push({
          step: stepMatch[1].trim(),
          observation: obsMatch[1].trim(),
          hypothesis: hypMatch[1].trim(),
          validation: valMatch ? valMatch[1].trim() : '',
          conclusion: conMatch ? conMatch[1].trim() : ''
        });
      }
    }

    return reasoning;
  }

  /**
   * Format reasoning for display
   */
  formatReasoning(reasoning: CoTReasoning): string {
    const lines = [
      `Step: ${reasoning.step}`,
      `Observation: ${reasoning.observation}`,
      `Hypothesis: ${reasoning.hypothesis}`,
      `Validation: ${Array.isArray(reasoning.validation) ? reasoning.validation.join(', ') : reasoning.validation}`,
      `Conclusion: ${reasoning.conclusion}`
    ];

    if (reasoning.confidence) {
      lines.push(`Confidence: ${(reasoning.confidence * 100).toFixed(1)}%`);
    }

    if (reasoning.confidence_factors && reasoning.confidence_factors.length > 0) {
      lines.push(`Confidence Factors:`);
      reasoning.confidence_factors.forEach(factor => {
        lines.push(`  - ${factor}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * Format all reasoning steps
   */
  formatAllReasoning(reasoning: CoTReasoning[]): string {
    return reasoning.map((r, index) => {
      return `\n=== Reasoning Step ${index + 1} ===\n${this.formatReasoning(r)}`;
    }).join('\n\n');
  }

  /**
   * Validate reasoning completeness
   */
  validateCompleteness(reasoning: CoTReasoning): {
    isComplete: boolean;
    missingFields: string[];
  } {
    const required = ['step', 'observation', 'hypothesis', 'validation', 'conclusion'];
    const missing: string[] = [];

    for (const field of required) {
      const value = reasoning[field as keyof CoTReasoning];
      if (!value || (typeof value === 'string' && value.trim().length === 0)) {
        missing.push(field);
      }
    }

    return {
      isComplete: missing.length === 0,
      missingFields: missing
    };
  }

  /**
   * Extract key insights from reasoning
   */
  extractInsights(reasoning: CoTReasoning[]): string[] {
    const insights: string[] = [];

    for (const r of reasoning) {
      if (r.conclusion && r.conclusion.length > 20) {
        insights.push(r.conclusion);
      }
    }

    return insights;
  }

  /**
   * Calculate reasoning confidence distribution
   */
  getConfidenceDistribution(reasoning: CoTReasoning[]): {
    very_high: number; // 0.9-1.0
    high: number; // 0.75-0.89
    medium: number; // 0.50-0.74
    low: number; // 0.0-0.49
  } {
    const dist = {
      very_high: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    for (const r of reasoning) {
      const conf = r.confidence || 0.5;

      if (conf >= 0.9) dist.very_high++;
      else if (conf >= 0.75) dist.high++;
      else if (conf >= 0.50) dist.medium++;
      else dist.low++;
    }

    return dist;
  }

  /**
   * Filter reasoning by confidence threshold
   */
  filterByConfidence(reasoning: CoTReasoning[], minConfidence: number = 0.7): CoTReasoning[] {
    return reasoning.filter(r => (r.confidence || 0.5) >= minConfidence);
  }

  /**
   * Group reasoning by related finding
   */
  groupByFinding(reasoning: CoTReasoning[]): Map<string, CoTReasoning[]> {
    const grouped = new Map<string, CoTReasoning[]>();

    for (const r of reasoning) {
      const findingId = r.related_finding || 'unrelated';
      if (!grouped.has(findingId)) {
        grouped.set(findingId, []);
      }
      grouped.get(findingId)!.push(r);
    }

    return grouped;
  }
}

// Singleton instance
let parser: CoTParser | null = null;

export function getCoTParser(): CoTParser {
  if (!parser) {
    parser = new CoTParser();
  }
  return parser;
}

export function resetCoTParser(): void {
  parser = null;
}
