/**
 * Insights Integration for HTML Reports
 * Automatically pulls top insights into "What could be better" section
 */
import fs from "fs-extra";
import path from "node:path";
import { logger } from "../../utils/logger.js";

const log = logger.child({ module: 'insightsIntegration' });

export interface InsightSummary {
  area: string;
  summary: string;
  severity: string;
  impact: string;
}

/**
 * Extract top insights from insights.md and format for report
 */
export async function extractInsightsForReport(
  runPath: string, 
  maxInsights = 3
): Promise<string[]> {
  const insightsPath = path.join(runPath, "insights.md");
  
  if (!(await fs.pathExists(insightsPath))) {
    log.debug('No insights.md file found', { runPath });
    return [];
  }
  
  try {
    const insightsContent = await fs.readFile(insightsPath, "utf8");
    
    if (!insightsContent.trim() || insightsContent.includes('No insights generated')) {
      return [];
    }
    
    // Extract insight headings (## [Area] Summary)
    const insightMatches = insightsContent.match(/##\s*\[([^\]]+)\]\s*([^\n]+)/g);
    
    if (!insightMatches) {
      return [];
    }
    
    const insights = insightMatches
      .slice(0, maxInsights) // Take top N insights
      .map(match => {
        const areaMatch = match.match(/\[([^\]]+)\]/);
        const summaryMatch = match.match(/\]\s*(.+)$/);
        
        const area = areaMatch ? areaMatch[1] : 'General';
        const summary = summaryMatch ? summaryMatch[1].trim() : 'Issue detected';
        
        return `**[${area}]** ${summary}`;
      });
    
    log.debug('Extracted insights for report', { 
      count: insights.length, 
      maxInsights 
    });
    
    return insights;
    
  } catch (error) {
    log.warn('Failed to extract insights for report', { error: String(error) });
    return [];
  }
}

/**
 * Get detailed insight summaries for JSON output
 */
export async function getInsightSummaries(runPath: string): Promise<InsightSummary[]> {
  const insightsJsonPath = path.join(runPath, "insights.json");
  
  if (!(await fs.pathExists(insightsJsonPath))) {
    return [];
  }
  
  try {
    const insights = await fs.readJson(insightsJsonPath);
    
    if (!Array.isArray(insights)) {
      return [];
    }
    
    return insights.map((insight: any) => ({
      area: insight.area || 'General',
      summary: insight.summary || 'Issue detected',
      severity: insight.severity || 'medium',
      impact: insight.impact || 'Medium'
    }));
    
  } catch (error) {
    log.warn('Failed to read insights JSON', { error: String(error) });
    return [];
  }
}

/**
 * Merge insights with existing report improvements
 */
export async function mergeInsightsWithImprovements(
  runPath: string,
  existingImprovements: string[] = []
): Promise<string[]> {
  const insightBullets = await extractInsightsForReport(runPath, 3);
  
  // Combine and deduplicate
  const allImprovements = [...new Set([...existingImprovements, ...insightBullets])];
  
  // Sort by priority (put security and build issues first)
  return allImprovements.sort((a, b) => {
    const getPriority = (item: string): number => {
      if (item.includes('[Security]')) return 0;
      if (item.includes('[Build]')) return 1;
      if (item.includes('[Config]')) return 2;
      if (item.includes('[Tests]')) return 3;
      if (item.includes('[Coverage]')) return 4;
      return 5;
    };
    
    return getPriority(a) - getPriority(b);
  });
}

/**
 * Generate insights statistics for report metadata
 */
export async function getInsightStats(runPath: string): Promise<{
  total: number;
  bySeverity: Record<string, number>;
  byArea: Record<string, number>;
}> {
  const summaries = await getInsightSummaries(runPath);
  
  const stats = {
    total: summaries.length,
    bySeverity: {} as Record<string, number>,
    byArea: {} as Record<string, number>
  };
  
  summaries.forEach(insight => {
    // Count by severity
    const severity = insight.severity;
    stats.bySeverity[severity] = (stats.bySeverity[severity] || 0) + 1;
    
    // Count by area
    const area = insight.area;
    stats.byArea[area] = (stats.byArea[area] || 0) + 1;
  });
  
  return stats;
}

/**
 * Create insights timeline entry for report
 */
export async function createInsightsTimelineEntry(runPath: string): Promise<{
  phase: string;
  status: 'success' | 'warning' | 'error';
  message: string;
  timestamp: string;
} | null> {
  const stats = await getInsightStats(runPath);
  
  if (stats.total === 0) {
    return {
      phase: 'insights',
      status: 'success',
      message: 'No issues detected - clean execution',
      timestamp: new Date().toISOString()
    };
  }
  
  const hasHighSeverity = stats.bySeverity.critical || stats.bySeverity.high;
  const status = hasHighSeverity ? 'warning' : 'success';
  
  const message = `${stats.total} insight${stats.total === 1 ? '' : 's'} generated` +
    (hasHighSeverity ? ' (includes high-priority items)' : '');
  
  return {
    phase: 'insights',
    status,
    message,
    timestamp: new Date().toISOString()
  };
}
