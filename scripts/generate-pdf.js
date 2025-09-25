#!/usr/bin/env node

/**
 * Generate PDF from HTML report using Puppeteer
 * Usage: node scripts/generate-pdf.js <project> <branch> [daemon-url]
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs/promises');

const [,, project, branch, daemonUrl = 'http://localhost:8080'] = process.argv;

if (!project || !branch) {
  console.error('Usage: node scripts/generate-pdf.js <project> <branch> [daemon-url]');
  process.exit(1);
}

async function generatePDF() {
  console.log(`🔄 Generating PDF for ${project}/${branch}...`);
  
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Fetch HTML report from daemon
    const reportUrl = `${daemonUrl}/report?project=${encodeURIComponent(project)}&branch=${encodeURIComponent(branch)}&format=html`;
    console.log(`📄 Loading HTML report: ${reportUrl}`);
    
    await page.goto(reportUrl, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    // Wait for any dynamic content to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
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
        top: '14mm',
        bottom: '14mm',
        left: '12mm',
        right: '12mm'
      }
    });
    
    // Save PDF to run directory
    const response = await fetch(`${daemonUrl}/progress?project=${encodeURIComponent(project)}&branch=${encodeURIComponent(branch)}`);
    const progress = await response.json();
    
    if (!progress.timestamp) {
      throw new Error('No run found for this project/branch');
    }
    
    // Determine run path from daemon logs or use standard path
    const home = require('os').homedir();
    const runPath = path.join(home, '.uatu/workspace/users', process.env.USER || 'user', 'projects', project, 'branches', branch, 'runs', progress.timestamp);
    const pdfPath = path.join(runPath, 'report.pdf');
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(pdfPath), { recursive: true });
    await fs.writeFile(pdfPath, pdfBuffer);
    console.log(`✅ PDF generated: ${pdfPath}`);
    console.log(`🔗 Access via: ${daemonUrl}/report?project=${encodeURIComponent(project)}&branch=${encodeURIComponent(branch)}&format=pdf`);
    
  } catch (error) {
    console.error('❌ PDF generation failed:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

generatePDF().catch(console.error);
