/**
 * Email Notification Service
 *
 * Sends email notifications for interactive audits:
 * - Audit completion
 * - Input needed (prompt waiting)
 * - Critical finding discovered
 *
 * Supports multiple providers: SendGrid, Postmark, Resend, or SMTP fallback.
 */

import { logger } from '../utils/logger.js';

const log = logger.child({ module: 'email-notification-service' });

// ============================================================================
// Types
// ============================================================================

export type EmailProvider = 'sendgrid' | 'postmark' | 'resend' | 'smtp' | 'console';

export interface EmailConfig {
  provider: EmailProvider;
  apiKey?: string;
  fromEmail: string;
  fromName: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  tags?: string[];
}

export interface NotificationContext {
  jobId: string;
  projectName?: string;
  auditUrl?: string;
  recipientEmail: string;
  recipientName?: string;
}

export interface PromptNotificationContext extends NotificationContext {
  promptId: string;
  question: string;
  timeoutSeconds: number;
  stepName?: string;
}

export interface CompletionNotificationContext extends NotificationContext {
  status: 'completed' | 'failed' | 'cancelled';
  findingsCount?: number;
  criticalCount?: number;
  highCount?: number;
  mediumCount?: number;
  lowCount?: number;
  auditScore?: number;
  reportUrl?: string;
}

export interface CriticalFindingContext extends NotificationContext {
  findingTitle: string;
  findingSeverity: string;
  findingDescription: string;
  affectedContract?: string;
  affectedFunction?: string;
}

// ============================================================================
// Configuration
// ============================================================================

function getEmailConfig(): EmailConfig {
  const provider = (process.env.EMAIL_PROVIDER || 'console') as EmailProvider;

  return {
    provider,
    apiKey: process.env.EMAIL_API_KEY,
    fromEmail: process.env.EMAIL_FROM_ADDRESS || 'noreply@uatu.audit',
    fromName: process.env.EMAIL_FROM_NAME || 'Uatu Audit',
    smtpHost: process.env.SMTP_HOST,
    smtpPort: parseInt(process.env.SMTP_PORT || '587'),
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
  };
}

// ============================================================================
// Email Templates
// ============================================================================

const BASE_STYLES = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
  .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
  .header h1 { color: #22d3ee; margin: 0; font-size: 24px; }
  .header .logo { color: #94a3b8; font-size: 14px; margin-top: 5px; }
  .content { background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; }
  .alert-box { padding: 16px; border-radius: 8px; margin: 20px 0; }
  .alert-critical { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
  .alert-warning { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; }
  .alert-info { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; }
  .alert-success { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
  .button { display: inline-block; padding: 12px 24px; background: #0891b2; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 500; margin: 10px 0; }
  .button:hover { background: #0e7490; }
  .stats { display: flex; gap: 10px; flex-wrap: wrap; margin: 20px 0; }
  .stat-item { flex: 1; min-width: 100px; padding: 12px; background: #f8fafc; border-radius: 8px; text-align: center; }
  .stat-value { font-size: 24px; font-weight: bold; color: #0f172a; }
  .stat-label { font-size: 12px; color: #64748b; text-transform: uppercase; }
  .footer { text-align: center; padding: 20px; color: #94a3b8; font-size: 12px; }
  .code-block { background: #1e293b; color: #e2e8f0; padding: 16px; border-radius: 8px; font-family: monospace; overflow-x: auto; }
  .severity-critical { color: #dc2626; font-weight: bold; }
  .severity-high { color: #ea580c; font-weight: bold; }
  .severity-medium { color: #ca8a04; font-weight: bold; }
  .severity-low { color: #16a34a; font-weight: bold; }
  .countdown { font-size: 18px; font-weight: bold; color: #0891b2; }
`;

function createEmailTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${BASE_STYLES}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Uatu Audit</h1>
      <div class="logo">Smart Contract Security</div>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>This is an automated notification from Uatu Audit.</p>
      <p>If you no longer wish to receive these emails, update your notification preferences in your audit settings.</p>
    </div>
  </div>
</body>
</html>
`;
}

// ============================================================================
// Notification Templates
// ============================================================================

function createPromptNotificationEmail(ctx: PromptNotificationContext): EmailMessage {
  const timeoutMinutes = Math.floor(ctx.timeoutSeconds / 60);

  const html = createEmailTemplate(`
    <h2>Input Required for Your Audit</h2>

    <div class="alert-box alert-warning">
      <strong>Action Required:</strong> Your audit is paused and waiting for your input.
    </div>

    ${ctx.projectName ? `<p><strong>Project:</strong> ${escapeHtml(ctx.projectName)}</p>` : ''}
    ${ctx.stepName ? `<p><strong>Current Step:</strong> ${escapeHtml(ctx.stepName)}</p>` : ''}

    <div class="code-block">
      ${escapeHtml(ctx.question)}
    </div>

    <p class="countdown">
      Time remaining: ${timeoutMinutes > 0 ? `${timeoutMinutes} minutes` : `${ctx.timeoutSeconds} seconds`}
    </p>

    <p>If you don't respond, the audit will continue with default values.</p>

    ${ctx.auditUrl ? `<p><a href="${ctx.auditUrl}" class="button">Respond Now</a></p>` : ''}
  `);

  const text = `
Input Required for Your Audit

Your audit is paused and waiting for your input.

${ctx.projectName ? `Project: ${ctx.projectName}` : ''}
${ctx.stepName ? `Current Step: ${ctx.stepName}` : ''}

Question:
${ctx.question}

Time remaining: ${timeoutMinutes > 0 ? `${timeoutMinutes} minutes` : `${ctx.timeoutSeconds} seconds`}

If you don't respond, the audit will continue with default values.

${ctx.auditUrl ? `Respond here: ${ctx.auditUrl}` : ''}
`;

  return {
    to: ctx.recipientEmail,
    subject: `[Action Required] Input needed for your audit${ctx.projectName ? ` - ${ctx.projectName}` : ''}`,
    text: text.trim(),
    html,
    tags: ['audit', 'prompt', 'action-required'],
  };
}

function createCompletionNotificationEmail(ctx: CompletionNotificationContext): EmailMessage {
  const isSuccess = ctx.status === 'completed';
  const alertClass = isSuccess ? 'alert-success' : ctx.status === 'failed' ? 'alert-critical' : 'alert-info';
  const statusText = ctx.status === 'completed' ? 'Completed Successfully' : ctx.status === 'failed' ? 'Failed' : 'Cancelled';

  const statsHtml = isSuccess && ctx.findingsCount !== undefined ? `
    <div class="stats">
      <div class="stat-item">
        <div class="stat-value">${ctx.findingsCount}</div>
        <div class="stat-label">Total Findings</div>
      </div>
      ${ctx.criticalCount !== undefined ? `
        <div class="stat-item">
          <div class="stat-value severity-critical">${ctx.criticalCount}</div>
          <div class="stat-label">Critical</div>
        </div>
      ` : ''}
      ${ctx.highCount !== undefined ? `
        <div class="stat-item">
          <div class="stat-value severity-high">${ctx.highCount}</div>
          <div class="stat-label">High</div>
        </div>
      ` : ''}
      ${ctx.mediumCount !== undefined ? `
        <div class="stat-item">
          <div class="stat-value severity-medium">${ctx.mediumCount}</div>
          <div class="stat-label">Medium</div>
        </div>
      ` : ''}
      ${ctx.lowCount !== undefined ? `
        <div class="stat-item">
          <div class="stat-value severity-low">${ctx.lowCount}</div>
          <div class="stat-label">Low</div>
        </div>
      ` : ''}
      ${ctx.auditScore !== undefined ? `
        <div class="stat-item">
          <div class="stat-value">${ctx.auditScore}/100</div>
          <div class="stat-label">Score</div>
        </div>
      ` : ''}
    </div>
  ` : '';

  const html = createEmailTemplate(`
    <h2>Audit ${statusText}</h2>

    <div class="alert-box ${alertClass}">
      ${isSuccess ? 'Your audit has completed successfully!' : ctx.status === 'failed' ? 'Your audit encountered an error.' : 'Your audit was cancelled.'}
    </div>

    ${ctx.projectName ? `<p><strong>Project:</strong> ${escapeHtml(ctx.projectName)}</p>` : ''}

    ${statsHtml}

    ${ctx.reportUrl ? `<p><a href="${ctx.reportUrl}" class="button">View Full Report</a></p>` : ''}
    ${ctx.auditUrl && !ctx.reportUrl ? `<p><a href="${ctx.auditUrl}" class="button">View Audit Details</a></p>` : ''}
  `);

  const text = `
Audit ${statusText}

${isSuccess ? 'Your audit has completed successfully!' : ctx.status === 'failed' ? 'Your audit encountered an error.' : 'Your audit was cancelled.'}

${ctx.projectName ? `Project: ${ctx.projectName}` : ''}

${isSuccess && ctx.findingsCount !== undefined ? `
Findings Summary:
- Total: ${ctx.findingsCount}
${ctx.criticalCount !== undefined ? `- Critical: ${ctx.criticalCount}` : ''}
${ctx.highCount !== undefined ? `- High: ${ctx.highCount}` : ''}
${ctx.mediumCount !== undefined ? `- Medium: ${ctx.mediumCount}` : ''}
${ctx.lowCount !== undefined ? `- Low: ${ctx.lowCount}` : ''}
${ctx.auditScore !== undefined ? `- Score: ${ctx.auditScore}/100` : ''}
` : ''}

${ctx.reportUrl ? `View Full Report: ${ctx.reportUrl}` : ctx.auditUrl ? `View Audit Details: ${ctx.auditUrl}` : ''}
`;

  return {
    to: ctx.recipientEmail,
    subject: `[Audit ${statusText}]${ctx.projectName ? ` ${ctx.projectName}` : ''}${isSuccess && ctx.findingsCount ? ` - ${ctx.findingsCount} findings` : ''}`,
    text: text.trim(),
    html,
    tags: ['audit', 'completion', ctx.status],
  };
}

function createCriticalFindingNotificationEmail(ctx: CriticalFindingContext): EmailMessage {
  const html = createEmailTemplate(`
    <h2>Critical Finding Discovered</h2>

    <div class="alert-box alert-critical">
      <strong>Critical Security Issue:</strong> A ${ctx.findingSeverity.toLowerCase()} severity vulnerability has been identified in your audit.
    </div>

    ${ctx.projectName ? `<p><strong>Project:</strong> ${escapeHtml(ctx.projectName)}</p>` : ''}

    <h3>${escapeHtml(ctx.findingTitle)}</h3>
    <p><strong>Severity:</strong> <span class="severity-${ctx.findingSeverity.toLowerCase()}">${ctx.findingSeverity}</span></p>

    ${ctx.affectedContract ? `<p><strong>Contract:</strong> <code>${escapeHtml(ctx.affectedContract)}</code></p>` : ''}
    ${ctx.affectedFunction ? `<p><strong>Function:</strong> <code>${escapeHtml(ctx.affectedFunction)}</code></p>` : ''}

    <div class="code-block">
      ${escapeHtml(ctx.findingDescription)}
    </div>

    ${ctx.auditUrl ? `<p><a href="${ctx.auditUrl}" class="button">View Full Details</a></p>` : ''}

    <p><em>We recommend addressing this issue immediately.</em></p>
  `);

  const text = `
CRITICAL FINDING DISCOVERED

A ${ctx.findingSeverity.toLowerCase()} severity vulnerability has been identified in your audit.

${ctx.projectName ? `Project: ${ctx.projectName}` : ''}

Title: ${ctx.findingTitle}
Severity: ${ctx.findingSeverity}
${ctx.affectedContract ? `Contract: ${ctx.affectedContract}` : ''}
${ctx.affectedFunction ? `Function: ${ctx.affectedFunction}` : ''}

Description:
${ctx.findingDescription}

${ctx.auditUrl ? `View Full Details: ${ctx.auditUrl}` : ''}

We recommend addressing this issue immediately.
`;

  return {
    to: ctx.recipientEmail,
    subject: `[CRITICAL] ${ctx.findingTitle}${ctx.projectName ? ` - ${ctx.projectName}` : ''}`,
    text: text.trim(),
    html,
    tags: ['audit', 'finding', 'critical', ctx.findingSeverity.toLowerCase()],
  };
}

// ============================================================================
// Email Sending
// ============================================================================

async function sendEmailViaSendGrid(config: EmailConfig, message: EmailMessage): Promise<void> {
  if (!config.apiKey) {
    throw new Error('SendGrid API key not configured');
  }

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: message.to }] }],
      from: { email: config.fromEmail, name: config.fromName },
      subject: message.subject,
      content: [
        { type: 'text/plain', value: message.text },
        { type: 'text/html', value: message.html },
      ],
      categories: message.tags,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`SendGrid API error: ${response.status} - ${error}`);
  }
}

async function sendEmailViaPostmark(config: EmailConfig, message: EmailMessage): Promise<void> {
  if (!config.apiKey) {
    throw new Error('Postmark API key not configured');
  }

  const response = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: {
      'X-Postmark-Server-Token': config.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      From: `${config.fromName} <${config.fromEmail}>`,
      To: message.to,
      Subject: message.subject,
      TextBody: message.text,
      HtmlBody: message.html,
      Tag: message.tags?.[0],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Postmark API error: ${response.status} - ${error}`);
  }
}

async function sendEmailViaResend(config: EmailConfig, message: EmailMessage): Promise<void> {
  if (!config.apiKey) {
    throw new Error('Resend API key not configured');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${config.fromName} <${config.fromEmail}>`,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
      tags: message.tags?.map((t) => ({ name: 'category', value: t })),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend API error: ${response.status} - ${error}`);
  }
}

async function sendEmailViaSMTP(config: EmailConfig, message: EmailMessage): Promise<void> {
  // Dynamic import to avoid loading nodemailer if not installed
  // nodemailer is an optional dependency - install with: npm install nodemailer @types/nodemailer
  let nodemailer: any;
  try {
    // Use dynamic import with string variable to prevent TypeScript from checking module at compile time
    const moduleName = 'nodemailer';
    nodemailer = await import(/* webpackIgnore: true */ moduleName);
  } catch {
    throw new Error('nodemailer is not installed. Install with: npm install nodemailer @types/nodemailer');
  }

  const transporter = nodemailer.default?.createTransport
    ? nodemailer.default.createTransport({
        host: config.smtpHost || 'localhost',
        port: config.smtpPort || 587,
        secure: config.smtpPort === 465,
        auth: config.smtpUser
          ? {
              user: config.smtpUser,
              pass: config.smtpPass,
            }
          : undefined,
      })
    : nodemailer.createTransport({
        host: config.smtpHost || 'localhost',
        port: config.smtpPort || 587,
        secure: config.smtpPort === 465,
        auth: config.smtpUser
          ? {
              user: config.smtpUser,
              pass: config.smtpPass,
            }
          : undefined,
      });

  await transporter.sendMail({
    from: `"${config.fromName}" <${config.fromEmail}>`,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}

function sendEmailToConsole(config: EmailConfig, message: EmailMessage): void {
  log.info('Email notification (console mode)', {
    to: message.to,
    from: `${config.fromName} <${config.fromEmail}>`,
    subject: message.subject,
    tags: message.tags,
    textPreview: message.text.substring(0, 200) + '...',
  });
}

async function sendEmail(message: EmailMessage): Promise<void> {
  const config = getEmailConfig();

  try {
    switch (config.provider) {
      case 'sendgrid':
        await sendEmailViaSendGrid(config, message);
        break;
      case 'postmark':
        await sendEmailViaPostmark(config, message);
        break;
      case 'resend':
        await sendEmailViaResend(config, message);
        break;
      case 'smtp':
        await sendEmailViaSMTP(config, message);
        break;
      case 'console':
      default:
        sendEmailToConsole(config, message);
        return; // Don't log success for console mode
    }

    log.info('Email sent successfully', {
      provider: config.provider,
      to: message.to,
      subject: message.subject,
    });
  } catch (error) {
    log.error('Failed to send email', {
      provider: config.provider,
      to: message.to,
      subject: message.subject,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Send a notification that a prompt is waiting for user input
 */
export async function notifyPromptWaiting(ctx: PromptNotificationContext): Promise<void> {
  const message = createPromptNotificationEmail(ctx);
  await sendEmail(message);
}

/**
 * Send a notification that an audit has completed
 */
export async function notifyAuditCompleted(ctx: CompletionNotificationContext): Promise<void> {
  const message = createCompletionNotificationEmail(ctx);
  await sendEmail(message);
}

/**
 * Send a notification about a critical finding
 */
export async function notifyCriticalFinding(ctx: CriticalFindingContext): Promise<void> {
  const message = createCriticalFindingNotificationEmail(ctx);
  await sendEmail(message);
}

/**
 * Send a generic email (for custom notifications)
 */
export async function sendNotificationEmail(message: EmailMessage): Promise<void> {
  await sendEmail(message);
}

/**
 * Check if email notifications are configured and enabled
 */
export function isEmailEnabled(): boolean {
  const config = getEmailConfig();
  return config.provider !== 'console' || process.env.NODE_ENV !== 'production';
}

/**
 * Get the current email provider
 */
export function getEmailProvider(): EmailProvider {
  return getEmailConfig().provider;
}

// ============================================================================
// Helpers
// ============================================================================

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, '<br>');
}

export default {
  notifyPromptWaiting,
  notifyAuditCompleted,
  notifyCriticalFinding,
  sendNotificationEmail,
  isEmailEnabled,
  getEmailProvider,
};
