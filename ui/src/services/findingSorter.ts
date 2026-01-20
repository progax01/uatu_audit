/**
 * Finding Sorter
 *
 * Organizes audit findings by severity and category for better presentation.
 * Critical issues appear first, grouped by attack type.
 */

export interface Finding {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  file: string;
  rec: string;
  code_snippet?: string;
  category?: string;
}

export interface FindingGroup {
  category: string;
  categoryLabel: string;
  severity: Finding['severity'];
  findings: Finding[];
  count: number;
}

const SEVERITY_ORDER: Record<Finding['severity'], number> = {
  'critical': 0,
  'high': 1,
  'medium': 2,
  'low': 3,
  'info': 4,
};

const CATEGORY_LABELS: Record<string, string> = {
  'reentrancy': 'Reentrancy Attacks',
  'access-control': 'Access Control',
  'arithmetic': 'Integer Overflow/Underflow',
  'unchecked-calls': 'Unchecked External Calls',
  'gas': 'Gas Optimization',
  'code-quality': 'Code Quality',
  'injection': 'Injection Vulnerabilities',
  'cryptography': 'Cryptography Issues',
  'logic': 'Business Logic Errors',
  'configuration': 'Configuration Issues',
  'general': 'General Security',
  'other': 'Other Issues',
};

/**
 * Infer category from finding title and description
 */
function inferCategory(finding: Finding): string {
  if (finding.category) {
    return finding.category;
  }

  const text = `${finding.title} ${finding.rec || ''}`.toLowerCase();

  const categoryKeywords: Record<string, string[]> = {
    'reentrancy': ['reentrancy', 'reentrant', 'callback', 'external call before state', 'cei violation'],
    'access-control': ['access control', 'unauthorized', 'permission', 'onlyowner missing', 'role', 'admin', 'privilege'],
    'arithmetic': ['overflow', 'underflow', 'integer', 'division', 'multiplication'],
    'unchecked-calls': ['unchecked', 'return value', 'call result', 'transfer', 'send'],
    'injection': ['injection', 'sql', 'command', 'xss', 'script injection'],
    'cryptography': ['random', 'signature', 'hash', 'encrypt', 'decrypt', 'prng', 'weak entropy'],
    'logic': ['logic error', 'business logic', 'incorrect calculation', 'wrong condition'],
    'configuration': ['config', 'pragma', 'version', 'compiler', 'deployment'],
    'gas': ['gas', 'optimization', 'costly', 'loop', 'cache', 'immutable', 'constant'],
    'code-quality': ['naming', 'style', 'dead code', 'unused', 'redundant'],
  };

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(kw => text.includes(kw))) {
      return category;
    }
  }

  return 'general';
}

/**
 * Organize findings by severity and category
 * Returns groups sorted by severity (critical first), then by count (most findings first)
 */
export function organizeFindings(findings: Finding[]): FindingGroup[] {
  // Group by severity + category
  const grouped = new Map<string, FindingGroup>();

  for (const finding of findings) {
    const category = inferCategory(finding);
    const key = `${finding.severity}-${category}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        category,
        categoryLabel: CATEGORY_LABELS[category] || category,
        severity: finding.severity,
        findings: [],
        count: 0,
      });
    }

    grouped.get(key)!.findings.push(finding);
    grouped.get(key)!.count++;
  }

  // Sort by severity (critical first), then by count (most findings first)
  return Array.from(grouped.values()).sort((a, b) => {
    const severityDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return b.count - a.count; // More findings first within same severity
  });
}

/**
 * Get summary statistics for findings
 */
export function getFindingSummary(findings: Finding[]): {
  total: number;
  bySeverity: Record<Finding['severity'], number>;
  byCategory: Record<string, number>;
  criticalCategories: string[];
} {
  const bySeverity: Record<Finding['severity'], number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  const byCategory: Record<string, number> = {};
  const criticalCategories: string[] = [];

  for (const finding of findings) {
    bySeverity[finding.severity]++;

    const category = inferCategory(finding);
    byCategory[category] = (byCategory[category] || 0) + 1;

    if (finding.severity === 'critical' && !criticalCategories.includes(category)) {
      criticalCategories.push(category);
    }
  }

  return {
    total: findings.length,
    bySeverity,
    byCategory,
    criticalCategories: criticalCategories.map(c => CATEGORY_LABELS[c] || c),
  };
}

/**
 * Filter findings by severity
 */
export function filterBySeverity(
  findings: Finding[],
  severities: Finding['severity'][]
): Finding[] {
  return findings.filter(f => severities.includes(f.severity));
}

/**
 * Filter findings by category
 */
export function filterByCategory(
  findings: Finding[],
  categories: string[]
): Finding[] {
  return findings.filter(f => {
    const category = inferCategory(f);
    return categories.includes(category);
  });
}

/**
 * Get the most critical findings (top N by severity)
 */
export function getTopFindings(findings: Finding[], limit: number = 5): Finding[] {
  const sorted = [...findings].sort((a, b) => {
    const severityDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    return severityDiff;
  });

  return sorted.slice(0, limit);
}
