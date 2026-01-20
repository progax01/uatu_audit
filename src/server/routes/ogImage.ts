/**
 * OG Image Routes
 *
 * Serves dynamically generated Open Graph images for audit reports
 */

import fs from 'fs-extra';
import path from 'path';
import { getUatuHome } from '../../constants/paths.js';
import { generateOGImage, type OGImageOptions } from '../../services/ogImageGenerator.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ module: 'og-image-routes' });

// ============================================================================
// Route Handler
// ============================================================================

export async function handleOGImageRoutes(
  req: any,
  res: any,
  parsed: { pathname: string; query: any }
): Promise<boolean> {

  // ============================================================================
  // GET /og-images/:jobId.png - Serve OG image
  // ============================================================================
  const imageMatch = parsed.pathname?.match(/^\/og-images\/([a-f0-9-]+)\.png$/);
  if (req.method === 'GET' && imageMatch) {
    const jobId = imageMatch[1];

    try {
      const ogImagesDir = path.join(getUatuHome(), 'public', 'og-images');
      const imagePath = path.join(ogImagesDir, `${jobId}.png`);

      // Check if image exists
      if (await fs.pathExists(imagePath)) {
        const imageBuffer = await fs.readFile(imagePath);
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.end(imageBuffer);
        return true;
      }

      // Image doesn't exist
      log.warn('OG image not found', { jobId, imagePath });
      res.statusCode = 404;
      res.end('Image not found');
      return true;
    } catch (error: any) {
      log.error('Failed to serve OG image', { jobId, error: error.message });
      res.statusCode = 500;
      res.end('Internal server error');
      return true;
    }
  }

  // ============================================================================
  // POST /api/og-images/generate - Generate OG image on-demand
  // ============================================================================
  if (req.method === 'POST' && parsed.pathname === '/api/og-images/generate') {
    try {
      const chunks: any[] = [];
      for await (const c of req) chunks.push(c);
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');

      const { jobId, projectName, auditType, grade, score, status, reportId, severityCounts } = body;

      if (!jobId || !projectName || !grade || score === undefined || !status || !reportId) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: 'Missing required fields' }));
        return true;
      }

      const options: OGImageOptions = {
        projectName,
        auditType: auditType || 'standard',
        grade,
        score,
        status,
        reportId,
        severityCounts,
      };

      const imageUrl = await generateOGImage(jobId, options);

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: true,
        imageUrl,
        fullUrl: `${req.headers.origin || 'https://uatu.xyz'}${imageUrl}`,
      }));
      return true;
    } catch (error: any) {
      log.error('Failed to generate OG image', { error: error.message, stack: error.stack });
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  return false;
}
