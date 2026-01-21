/**
 * Dynamic Meta Tags Routes
 *
 * Injects dynamic Open Graph and Twitter meta tags into HTML for audit pages
 * This enables beautiful link previews when sharing audit reports on social media
 */

import fs from 'fs-extra';
import path from 'path';
import { db } from '../../db/index.js';
import { auditJobs, auditResults } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { logger } from '../../utils/logger.js';

const log = logger.child({ module: 'meta-tags-routes' });

interface AuditMetaTags {
  title: string;
  description: string;
  ogImage: string;
  url: string;
  type: 'quick-scan' | 'full-audit';
}

/**
 * Generate meta tags for an audit
 */
async function generateAuditMetaTags(jobId: string, baseUrl: string): Promise<AuditMetaTags | null> {
  try {
    // Fetch audit job and results
    const [job] = await db.select().from(auditJobs).where(eq(auditJobs.id, jobId));
    if (!job) {
      log.warn('Audit job not found for meta tags', { jobId });
      return null;
    }

    const [results] = await db.select().from(auditResults).where(eq(auditResults.jobId, jobId));
    if (!results) {
      log.warn('Audit results not found for meta tags', { jobId });
      return null;
    }

    // Extract contract/project name from repo or address
    let projectName = 'Smart Contract';
    if (job.repo) {
      if (job.repo.startsWith('contract:')) {
        // Extract address for deployed contracts
        const parts = job.repo.split(':');
        projectName = parts[2] ? `${parts[2].slice(0, 10)}...` : 'Contract';
      } else {
        // Extract repo name from GitHub URL
        const repoMatch = job.repo.match(/([^/]+)(?:\.git)?$/);
        projectName = repoMatch ? repoMatch[1] : 'Repository';
      }
    }

    // Determine audit type from audit depth
    const auditType = job.auditDepth === 'quick' ? 'quick-scan' : 'full-audit';

    // Get severity counts from metadata
    const metadata = results.metadata as any;
    const bySeverity = metadata?.bySeverity || {};
    const criticalCount = bySeverity.critical || 0;
    const highCount = bySeverity.high || 0;
    const mediumCount = bySeverity.medium || 0;
    const lowCount = bySeverity.low || 0;
    const totalFindings = criticalCount + highCount + mediumCount + lowCount;

    // Build description based on findings
    let status = 'Secure';
    if (criticalCount > 0) {
      status = `${criticalCount} Critical Issue${criticalCount > 1 ? 's' : ''} Found`;
    } else if (highCount > 0) {
      status = `${highCount} High Severity Issue${highCount > 1 ? 's' : ''} Found`;
    } else if (mediumCount > 0) {
      status = `${mediumCount} Medium Issue${mediumCount > 1 ? 's' : ''} Found`;
    } else if (lowCount > 0) {
      status = `${lowCount} Low Severity Issue${lowCount > 1 ? 's' : ''} Found`;
    }

    const grade = results.scoreLabel || 'N/A';
    const score = results.scoreValue || 0;

    const title = `${projectName} - Security Audit Report | ${grade} Grade (${score}%) | Uatu`;
    const description = `${status} • ${totalFindings} total findings • AI-powered security analysis by Uatu. View detailed vulnerability report and recommendations.`;

    // OG image URL
    const ogImage = `${baseUrl}/og-images/${jobId}.png`;

    // Page URL
    const url = auditType === 'quick-scan'
      ? `${baseUrl}/quick-scan/${jobId}`
      : `${baseUrl}/audits/${jobId}`;

    return {
      title,
      description,
      ogImage,
      url,
      type: auditType,
    };
  } catch (error: any) {
    log.error('Failed to generate audit meta tags', { jobId, error: error.message });
    return null;
  }
}

/**
 * Inject meta tags into HTML
 */
function injectMetaTags(html: string, meta: AuditMetaTags): string {
  // Remove existing dynamic meta tags (keep the generic ones as fallback)
  let modifiedHtml = html;

  // Find the </head> tag and inject before it
  const headCloseIndex = modifiedHtml.indexOf('</head>');
  if (headCloseIndex === -1) {
    log.warn('Could not find </head> tag in HTML');
    return html;
  }

  const metaTagsHtml = `
  <!-- Dynamic Meta Tags - Audit Report -->
  <title>${escapeHtml(meta.title)}</title>
  <meta name="description" content="${escapeHtml(meta.description)}" />

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${escapeHtml(meta.url)}" />
  <meta property="og:title" content="${escapeHtml(meta.title)}" />
  <meta property="og:description" content="${escapeHtml(meta.description)}" />
  <meta property="og:image" content="${escapeHtml(meta.ogImage)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${escapeHtml(meta.title)}" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:url" content="${escapeHtml(meta.url)}" />
  <meta name="twitter:title" content="${escapeHtml(meta.title)}" />
  <meta name="twitter:description" content="${escapeHtml(meta.description)}" />
  <meta name="twitter:image" content="${escapeHtml(meta.ogImage)}" />
  <meta name="twitter:image:alt" content="${escapeHtml(meta.title)}" />

  <!-- Additional Meta -->
  <meta name="author" content="Uatu Security" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" content="${escapeHtml(meta.url)}" />
  `;

  // Insert before </head>
  modifiedHtml = modifiedHtml.slice(0, headCloseIndex) + metaTagsHtml + modifiedHtml.slice(headCloseIndex);

  return modifiedHtml;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Route Handler - Intercepts audit pages and injects meta tags
 */
export async function handleMetaTagInjection(
  req: any,
  res: any,
  parsed: { pathname: string; query: any }
): Promise<boolean> {
  // Only handle GET requests for HTML pages
  if (req.method !== 'GET') return false;

  // Check if this is an audit detail page
  const quickScanMatch = parsed.pathname?.match(/^\/quick-scan\/([a-f0-9-]+)$/);
  const fullAuditMatch = parsed.pathname?.match(/^\/audits\/([a-f0-9-]+)$/);
  const publicAuditMatch = parsed.pathname?.match(/^\/public-audits\/([a-f0-9-]+)$/);

  const jobId = quickScanMatch?.[1] || fullAuditMatch?.[1] || publicAuditMatch?.[1];

  if (!jobId) return false; // Not an audit page

  try {
    // Load base HTML
    const uiPath = path.join(__dirname, '../../../dist-ui/index.html');
    if (!await fs.pathExists(uiPath)) {
      log.error('UI index.html not found', { uiPath });
      return false;
    }

    let html = await fs.readFile(uiPath, 'utf8');

    // Generate meta tags
    const baseUrl = req.headers.origin || req.headers.referer?.replace(/\/$/, '') || 'https://uatu.xyz';
    const meta = await generateAuditMetaTags(jobId, baseUrl);

    if (meta) {
      // Inject meta tags
      html = injectMetaTags(html, meta);
      log.info('Injected dynamic meta tags', { jobId, type: meta.type, url: meta.url });
    } else {
      log.warn('Could not generate meta tags, serving default HTML', { jobId });
    }

    // Serve HTML
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes
    res.writeHead(200);
    res.end(html);
    return true;

  } catch (error: any) {
    log.error('Failed to inject meta tags', { jobId, error: error.message, stack: error.stack });
    return false; // Let default handler serve static HTML
  }
}
