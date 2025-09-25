#!/usr/bin/env node

/**
 * HTML to PDF Converter for UatuAudit Reports
 * 
 * Usage:
 *   node scripts/html-to-pdf.js <input.html> <output.pdf> [data.json]
 * 
 * This script uses Puppeteer to render the HTML report template as a PDF
 * with proper styling and print optimizations.
 */

import fs from 'fs/promises';
import path from 'path';
import puppeteer from 'puppeteer';

async function convertHtmlToPdf(htmlPath, outputPath, dataPath = null) {
  console.log('🚀 Starting HTML to PDF conversion...');
  
  try {
    // Launch Puppeteer
    const browser = await puppeteer.launch({ 
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // If data is provided, inject it before loading the page
    if (dataPath) {
      console.log(`📊 Loading data from ${dataPath}`);
      const data = JSON.parse(await fs.readFile(dataPath, 'utf8'));
      
      // Expose function to inject data
      await page.exposeFunction('getInjectedData', () => data);
    }
    
    // Read and modify HTML to inject data
    let html = await fs.readFile(htmlPath, 'utf8');
    
    if (dataPath) {
      // Inject script to set window.UATU_DATA before the page loads
      const dataScript = `
        <script>
          (async function() {
            if (window.getInjectedData) {
              window.UATU_DATA = await window.getInjectedData();
            }
          })();
        </script>
      `;
      html = html.replace('</head>', dataScript + '\n</head>');
    }
    
    console.log('📄 Loading HTML content...');
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    // Wait a bit for any dynamic content to render
    await page.waitForTimeout(1000);
    
    console.log('🖨️  Generating PDF...');
    await page.pdf({
      path: outputPath,
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="font-size:9px;width:100%;padding:0 16px;color:#6072a6;">
          <span class="title"></span>
        </div>`,
      footerTemplate: `
        <div style="font-size:9px;width:100%;padding:0 16px;color:#6072a6;display:flex;justify-content:space-between;">
          <div>UatuAudit • SOPs > AI</div>
          <div><span class="pageNumber"></span>/<span class="totalPages"></span></div>
        </div>`,
      margin: { 
        top: "14mm", 
        bottom: "14mm", 
        left: "12mm", 
        right: "12mm" 
      },
      preferCSSPageSize: true
    });
    
    await browser.close();
    
    console.log(`✅ PDF generated successfully: ${outputPath}`);
    
    // Get file size for confirmation
    const stats = await fs.stat(outputPath);
    const fileSizeKB = Math.round(stats.size / 1024);
    console.log(`📏 File size: ${fileSizeKB} KB`);
    
  } catch (error) {
    console.error('❌ Error converting HTML to PDF:', error);
    process.exit(1);
  }
}

// CLI interface
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log('Usage: node scripts/html-to-pdf.js <input.html> <output.pdf> [data.json]');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/html-to-pdf.js report.html report.pdf');
  console.log('  node scripts/html-to-pdf.js src/templates/report.html output.pdf summary.json');
  process.exit(1);
}

const [inputHtml, outputPdf, dataJson] = args;

// Validate input file exists
try {
  await fs.access(inputHtml);
} catch {
  console.error(`❌ Input HTML file not found: ${inputHtml}`);
  process.exit(1);
}

// Validate data file exists (if provided)
if (dataJson) {
  try {
    await fs.access(dataJson);
  } catch {
    console.error(`❌ Data JSON file not found: ${dataJson}`);
    process.exit(1);
  }
}

// Ensure output directory exists
const outputDir = path.dirname(outputPdf);
await fs.mkdir(outputDir, { recursive: true });

// Convert
await convertHtmlToPdf(inputHtml, outputPdf, dataJson);
