import puppeteer from 'puppeteer';
import { logger } from '../utils/logger.js';
import path from 'node:path';

const log = logger.child({ service: 'pdf-generator' });

/**
 * Generate PDF from HTML report using Puppeteer
 */
export async function generatePdfFromHtml(
  htmlPath: string,
  pdfPath: string
): Promise<{ success: boolean; error?: string }> {
  let browser;

  try {
    log.info('Starting PDF generation', { htmlPath, pdfPath });

    // Launch headless browser using system Chromium
    browser = await puppeteer.launch({
      headless: true,
      executablePath: '/usr/bin/chromium',  // Use system Chromium
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();

    // Load the HTML file
    const fileUrl = `file://${path.resolve(htmlPath)}`;
    await page.goto(fileUrl, {
      waitUntil: ['load', 'domcontentloaded', 'networkidle0'],
      timeout: 30000
    });

    // Wait for JavaScript to populate the report data
    // The HTML uses JavaScript to fill in the score, so we wait for it
    try {
      await page.waitForFunction(
        `(() => {
          const scoreEl = document.getElementById('scoreNumber');
          return scoreEl && scoreEl.textContent !== '--';
        })()`,
        { timeout: 10000 }
      );
    } catch (e) {
      log.warn('Timeout waiting for report data to render, continuing anyway');
    }

    // Additional wait to ensure all rendering is complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Generate PDF with good settings for audit reports
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      },
      preferCSSPageSize: false
    });

    await browser.close();

    log.info('PDF generated successfully', { pdfPath });
    return { success: true };

  } catch (error: any) {
    log.error('PDF generation failed', {
      error: String(error),
      message: error.message,
      stack: error.stack
    });

    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        log.warn('Failed to close browser', { error: String(closeError) });
      }
    }

    return {
      success: false,
      error: error.message || String(error)
    };
  }
}
