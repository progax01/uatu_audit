/**
 * OG Image Generator
 *
 * Generates beautiful Open Graph images for audit reports
 * Uses Puppeteer to render HTML/CSS to PNG images
 */

import puppeteer from 'puppeteer';
import fs from 'fs-extra';
import path from 'path';
import { logger } from '../utils/logger.js';
import { getUatuHome } from '../constants/paths.js';

const log = logger.child({ service: 'og-image-generator' });

// Get paths to logo and mascot (relative to project root)
const PROJECT_ROOT = process.cwd();
const LOGO_PATH = path.join(PROJECT_ROOT, 'ui/public/logo.svg');
const MASCOT_PATH = path.join(PROJECT_ROOT, 'ui/public/mascot.png');

// ============================================================================
// TYPES
// ============================================================================

export interface OGImageOptions {
  projectName: string;
  auditType: 'quick' | 'standard' | 'deep';
  grade: string;
  score: number;
  status: 'verified' | 'warning' | 'critical';
  reportId: string;
  projectLogoUrl?: string; // Base64 or URL to project logo
  severityCounts?: {
    critical?: number;
    high?: number;
    medium?: number;
    low?: number;
  };
  componentScores?: Array<{
    library: string;
    grade: string;
    score: number;
  }>;
}

// ============================================================================
// IMAGE GENERATION
// ============================================================================

/**
 * Generate OG image for an audit report
 */
export async function generateOGImage(
  jobId: string,
  options: OGImageOptions
): Promise<string> {
  const startTime = Date.now();

  log.info('Generating OG image', { jobId, projectName: options.projectName });

  try {
    // Ensure output directory exists
    const ogImagesDir = path.join(getUatuHome(), 'public', 'og-images');
    await fs.ensureDir(ogImagesDir);

    const outputPath = path.join(ogImagesDir, `${jobId}.png`);

    // Check if image already exists
    if (await fs.pathExists(outputPath)) {
      log.info('OG image already exists', { jobId, outputPath });
      return `/og-images/${jobId}.png`;
    }

    // Load logo and mascot
    const logoBase64 = await loadImageAsBase64(LOGO_PATH, 'image/svg+xml');
    const mascotBase64 = await loadImageAsBase64(MASCOT_PATH, 'image/png');

    // Generate HTML for the badge
    const html = generateBadgeHTML(options, logoBase64, mascotBase64);

    // Render HTML to image using Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 630 }); // Standard OG image size

    await page.setContent(html, { waitUntil: 'networkidle0' });

    // Take screenshot
    await page.screenshot({
      path: outputPath,
      type: 'png',
    });

    await browser.close();

    const duration = Date.now() - startTime;
    log.info('OG image generated successfully', {
      jobId,
      outputPath,
      durationMs: duration,
    });

    return `/og-images/${jobId}.png`;
  } catch (error: any) {
    log.error('Failed to generate OG image', {
      jobId,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Load image file as base64 data URI
 */
async function loadImageAsBase64(filePath: string, mimeType: string): Promise<string> {
  try {
    const fileBuffer = await fs.readFile(filePath);
    const base64 = fileBuffer.toString('base64');
    return `data:${mimeType};base64,${base64}`;
  } catch (error: any) {
    log.warn('Failed to load image', { filePath, error: error.message });
    return ''; // Return empty string if image can't be loaded
  }
}

/**
 * Generate HTML for the badge
 */
function generateBadgeHTML(options: OGImageOptions, logoBase64: string, mascotBase64: string): string {
  const { projectName, auditType, grade, score, status, reportId, severityCounts, projectLogoUrl, componentScores } = options;

  // Determine status styling
  const statusConfig = {
    verified: {
      color: '#10b981',
      text: 'VERIFIED SECURE',
      icon: '✓',
    },
    warning: {
      color: '#f59e0b',
      text: 'NEEDS ATTENTION',
      icon: '⚠',
    },
    critical: {
      color: '#ef4444',
      text: 'CRITICAL ISSUES',
      icon: '✕',
    },
  };

  const statusStyle = statusConfig[status];

  // Determine audit type label
  const auditTypeLabel = {
    quick: 'QUICK SCAN REPORT',
    standard: 'STANDARD AUDIT REPORT',
    deep: 'DEEP AUDIT REPORT',
  }[auditType];

  // Determine grade color
  const gradeColor = score >= 90 ? '#10b981' : score >= 70 ? '#3b82f6' : score >= 50 ? '#f59e0b' : '#ef4444';

  // Build severity summary
  let severitySummary = '';
  if (severityCounts) {
    const counts: string[] = [];
    if (severityCounts.critical) counts.push(`${severityCounts.critical} Critical`);
    if (severityCounts.high) counts.push(`${severityCounts.high} High`);
    if (severityCounts.medium) counts.push(`${severityCounts.medium} Medium`);
    if (severityCounts.low) counts.push(`${severityCounts.low} Low`);
    if (counts.length > 0) {
      severitySummary = `<div style="text-align: center; margin-top: 20px; font-size: 16px; color: #64748b;">${counts.join(' • ')}</div>`;
    }
  }

  // Build component scores summary
  let componentScoresHtml = '';
  if (componentScores && componentScores.length > 0) {
    const topComponents = componentScores.slice(0, 3);
    const componentsHtml = topComponents.map((c: { library: string; grade: string; score: number }) => {
      const gradeColor = c.score >= 90 ? '#10b981' : c.score >= 70 ? '#3b82f6' : c.score >= 50 ? '#f59e0b' : '#ef4444';
      return `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; background: rgba(255, 255, 255, 0.5); border-radius: 12px;">
          <span style="font-size: 14px; color: #1e293b; font-weight: 600; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(c.library)}</span>
          <span style="font-size: 18px; font-weight: 900; color: ${gradeColor}; margin-left: 12px;">${c.grade}</span>
        </div>
      `;
    }).join('');

    componentScoresHtml = `
      <div style="margin-top: 24px;">
        <div style="text-align: center; font-size: 14px; color: #94a3b8; font-weight: 700; letter-spacing: 2px; margin-bottom: 12px;">TOP COMPONENTS</div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${componentsHtml}
        </div>
      </div>
    `;
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      width: 1200px;
      height: 630px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      position: relative;
      overflow: hidden;
    }

    /* Mascot background */
    .mascot-bg {
      position: absolute;
      right: -100px;
      bottom: -100px;
      width: 500px;
      height: 500px;
      opacity: 0.08;
      z-index: 0;
      pointer-events: none;
    }

    /* Background decoration */
    body::before {
      content: '';
      position: absolute;
      width: 500px;
      height: 500px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.1);
      top: -200px;
      right: -200px;
    }

    body::after {
      content: '';
      position: absolute;
      width: 400px;
      height: 400px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.05);
      bottom: -150px;
      left: -150px;
    }

    .card {
      width: 900px;
      background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%);
      border-radius: 40px;
      padding: 60px;
      box-shadow: 0 30px 60px rgba(0, 0, 0, 0.3);
      position: relative;
      z-index: 1;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 40px;
    }

    .logo-section {
      display: flex;
      align-items: center;
      gap: 20px;
    }

    .logo-container {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .logo {
      width: 80px;
      height: 80px;
      border-radius: 20px;
      object-fit: contain;
      background: white;
      padding: 8px;
      box-shadow: 0 10px 25px rgba(102, 126, 234, 0.4);
    }

    .project-logo {
      width: 80px;
      height: 80px;
      border-radius: 20px;
      object-fit: contain;
      background: white;
      padding: 8px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
      border: 3px solid #f5f7fa;
    }

    .logo-separator {
      font-size: 32px;
      font-weight: 900;
      color: #94a3b8;
      margin: 0 4px;
    }

    .brand {
      display: flex;
      flex-direction: column;
    }

    .brand-name {
      font-size: 36px;
      font-weight: 900;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .brand-tagline {
      font-size: 16px;
      color: #94a3b8;
      font-weight: 500;
      margin-top: 4px;
    }

    .audit-type-badge {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 12px 32px;
      border-radius: 999px;
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 1px;
      box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
    }

    .project-name {
      text-align: center;
      font-size: 48px;
      font-weight: 900;
      color: #1e293b;
      margin-bottom: 12px;
      line-height: 1.2;
    }

    .subtitle {
      text-align: center;
      font-size: 20px;
      color: #94a3b8;
      font-weight: 600;
      letter-spacing: 4px;
      margin-bottom: 40px;
    }

    .metrics {
      display: flex;
      gap: 30px;
      margin-bottom: 30px;
    }

    .metric {
      flex: 1;
      background: white;
      border-radius: 20px;
      padding: 30px;
      text-align: center;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
    }

    .metric-label {
      font-size: 16px;
      color: #94a3b8;
      font-weight: 700;
      letter-spacing: 2px;
      margin-bottom: 12px;
    }

    .metric-value {
      font-size: 72px;
      font-weight: 900;
      color: #1e293b;
      line-height: 1;
    }

    .score-value {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .status-badge {
      background: ${statusStyle.color};
      color: white;
      padding: 24px;
      border-radius: 20px;
      text-align: center;
      font-size: 24px;
      font-weight: 800;
      letter-spacing: 2px;
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
    }

    .status-icon {
      font-size: 28px;
      background: rgba(255, 255, 255, 0.3);
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .footer {
      text-align: center;
      margin-top: 30px;
      font-size: 16px;
      color: #94a3b8;
      font-weight: 600;
    }
  </style>
</head>
<body>
  ${mascotBase64 ? `<img src="${mascotBase64}" alt="" class="mascot-bg" />` : ''}
  <div class="card">
    <div class="header">
      <div class="logo-section">
        <div class="logo-container">
          ${logoBase64 ? `<img src="${logoBase64}" alt="Uatu Logo" class="logo" />` : '<div class="logo">U</div>'}
          ${projectLogoUrl ? `
          <div class="logo-separator">×</div>
          <img src="${escapeHtml(projectLogoUrl)}" alt="Project Logo" class="project-logo" />
          ` : ''}
        </div>
        <div class="brand">
          <div class="brand-name">UATU</div>
          <div class="brand-tagline">Protocol Intelligence</div>
        </div>
      </div>
      <div class="audit-type-badge">${auditTypeLabel}</div>
    </div>

    <div class="project-name">${escapeHtml(projectName)}</div>
    <div class="subtitle">SECURITY ASSESSMENT</div>

    <div class="metrics">
      <div class="metric">
        <div class="metric-label">GRADE</div>
        <div class="metric-value" style="color: ${gradeColor};">${grade}</div>
      </div>
      <div class="metric">
        <div class="metric-label">SCORE</div>
        <div class="metric-value score-value">${score}%</div>
      </div>
    </div>

    <div class="status-badge">
      <div class="status-icon">${statusStyle.icon}</div>
      ${statusStyle.text}
    </div>

    ${severitySummary}
    ${componentScoresHtml}

    <div class="footer">Report ID: ${reportId}</div>
  </div>
</body>
</html>
  `.trim();
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
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Delete OG image for a job
 */
export async function deleteOGImage(jobId: string): Promise<void> {
  try {
    const ogImagesDir = path.join(getUatuHome(), 'public', 'og-images');
    const imagePath = path.join(ogImagesDir, `${jobId}.png`);

    if (await fs.pathExists(imagePath)) {
      await fs.remove(imagePath);
      log.info('OG image deleted', { jobId });
    }
  } catch (error: any) {
    log.warn('Failed to delete OG image', { jobId, error: error.message });
  }
}

/**
 * Get OG image URL for a job
 */
export function getOGImageUrl(jobId: string, baseUrl: string = 'https://uatu.xyz'): string {
  return `${baseUrl}/og-images/${jobId}.png`;
}
