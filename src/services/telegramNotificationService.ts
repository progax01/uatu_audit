/**
 * Telegram Notification Service
 *
 * Sends notifications via Telegram Bot API for interactive audits:
 * - Audit completion
 * - Input needed (prompt waiting)
 * - Critical finding discovered
 *
 * Configure with TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID environment variables.
 */

import { logger } from '../utils/logger.js';

const log = logger.child({ module: 'telegram-notification-service' });

// ============================================================================
// Types
// ============================================================================

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
}

export type NotificationType = 'input_needed' | 'audit_complete' | 'critical_finding' | 'info';

export interface NotificationContext {
  jobId: string;
  projectName?: string;
  auditUrl?: string;
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

function getTelegramConfig(): TelegramConfig {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || '';
  const chatId = process.env.TELEGRAM_CHAT_ID || '';

  return {
    botToken,
    chatId,
    enabled: Boolean(botToken && chatId),
  };
}

/**
 * Check if Telegram notifications are configured and enabled
 */
export function isTelegramEnabled(): boolean {
  const config = getTelegramConfig();
  return config.enabled;
}

// ============================================================================
// Message Formatting
// ============================================================================

/**
 * Escape special characters for Telegram MarkdownV2
 */
function escapeMarkdown(text: string): string {
  return text.replace(/[_*\[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

/**
 * Format a prompt notification message
 */
function formatPromptMessage(ctx: PromptNotificationContext): string {
  const timeoutMinutes = Math.floor(ctx.timeoutSeconds / 60);
  const timeoutDisplay = timeoutMinutes > 0 ? `${timeoutMinutes} minutes` : `${ctx.timeoutSeconds} seconds`;

  return `
🔔 *Input Required*

${ctx.projectName ? `*Project:* ${escapeMarkdown(ctx.projectName)}` : ''}
${ctx.stepName ? `*Step:* ${escapeMarkdown(ctx.stepName)}` : ''}

\`\`\`
${ctx.question.substring(0, 500)}${ctx.question.length > 500 ? '...' : ''}
\`\`\`

⏱ *Time remaining:* ${escapeMarkdown(timeoutDisplay)}

${ctx.auditUrl ? `[Respond Now](${ctx.auditUrl})` : ''}
`.trim();
}

/**
 * Format a completion notification message
 */
function formatCompletionMessage(ctx: CompletionNotificationContext): string {
  const statusEmoji = ctx.status === 'completed' ? '✅' : ctx.status === 'failed' ? '❌' : '⚠️';
  const statusText = ctx.status === 'completed' ? 'Completed' : ctx.status === 'failed' ? 'Failed' : 'Cancelled';

  let findingsSection = '';
  if (ctx.status === 'completed' && ctx.findingsCount !== undefined) {
    findingsSection = `
*Findings Summary:*
• Total: ${ctx.findingsCount}
${ctx.criticalCount !== undefined ? `• 🔴 Critical: ${ctx.criticalCount}` : ''}
${ctx.highCount !== undefined ? `• 🟠 High: ${ctx.highCount}` : ''}
${ctx.mediumCount !== undefined ? `• 🟡 Medium: ${ctx.mediumCount}` : ''}
${ctx.lowCount !== undefined ? `• 🟢 Low: ${ctx.lowCount}` : ''}
${ctx.auditScore !== undefined ? `• Score: ${ctx.auditScore}/100` : ''}
`;
  }

  return `
${statusEmoji} *Audit ${statusText}*

${ctx.projectName ? `*Project:* ${escapeMarkdown(ctx.projectName)}` : ''}
${findingsSection}
${ctx.reportUrl ? `[View Report](${ctx.reportUrl})` : ctx.auditUrl ? `[View Details](${ctx.auditUrl})` : ''}
`.trim();
}

/**
 * Format a critical finding notification message
 */
function formatCriticalFindingMessage(ctx: CriticalFindingContext): string {
  const severityEmoji = ctx.findingSeverity.toLowerCase() === 'critical' ? '🚨' : '⚠️';

  return `
${severityEmoji} *${escapeMarkdown(ctx.findingSeverity)} Finding Discovered*

${ctx.projectName ? `*Project:* ${escapeMarkdown(ctx.projectName)}` : ''}

*${escapeMarkdown(ctx.findingTitle)}*

${ctx.affectedContract ? `*Contract:* \`${escapeMarkdown(ctx.affectedContract)}\`` : ''}
${ctx.affectedFunction ? `*Function:* \`${escapeMarkdown(ctx.affectedFunction)}\`` : ''}

\`\`\`
${ctx.findingDescription.substring(0, 400)}${ctx.findingDescription.length > 400 ? '...' : ''}
\`\`\`

${ctx.auditUrl ? `[View Details](${ctx.auditUrl})` : ''}
`.trim();
}

// ============================================================================
// Telegram API
// ============================================================================

/**
 * Send a message via Telegram Bot API
 */
async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  message: string,
  parseMode: 'MarkdownV2' | 'HTML' = 'MarkdownV2'
): Promise<void> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: parseMode,
      disable_web_page_preview: false,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Telegram API error: ${JSON.stringify(error)}`);
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Send a generic notification via Telegram
 */
export async function sendTelegramNotification(
  type: NotificationType,
  title: string,
  message: string,
  context?: {
    jobId?: string;
    projectName?: string;
    auditUrl?: string;
    promptId?: string;
    question?: string;
    timeoutSeconds?: number;
    stepName?: string;
    findingTitle?: string;
    findingSeverity?: string;
    findingDescription?: string;
    affectedContract?: string;
    affectedFunction?: string;
    status?: 'completed' | 'failed' | 'cancelled';
    findingsCount?: number;
    criticalCount?: number;
    highCount?: number;
    mediumCount?: number;
    lowCount?: number;
    auditScore?: number;
    reportUrl?: string;
  }
): Promise<void> {
  const config = getTelegramConfig();

  if (!config.enabled) {
    log.debug('Telegram notifications not configured, skipping', { type, title });
    return;
  }

  try {
    let formattedMessage: string;

    if (type === 'input_needed' && context?.promptId && context?.question) {
      formattedMessage = formatPromptMessage({
        jobId: context.jobId || '',
        projectName: context.projectName,
        auditUrl: context.auditUrl,
        promptId: context.promptId,
        question: context.question,
        timeoutSeconds: context.timeoutSeconds || 300,
        stepName: context.stepName,
      });
    } else if (type === 'audit_complete' && context?.status) {
      formattedMessage = formatCompletionMessage({
        jobId: context.jobId || '',
        projectName: context.projectName,
        auditUrl: context.auditUrl,
        status: context.status,
        findingsCount: context.findingsCount,
        criticalCount: context.criticalCount,
        highCount: context.highCount,
        mediumCount: context.mediumCount,
        lowCount: context.lowCount,
        auditScore: context.auditScore,
        reportUrl: context.reportUrl,
      });
    } else if (type === 'critical_finding' && context?.findingTitle) {
      formattedMessage = formatCriticalFindingMessage({
        jobId: context.jobId || '',
        projectName: context.projectName,
        auditUrl: context.auditUrl,
        findingTitle: context.findingTitle,
        findingSeverity: context.findingSeverity || 'Critical',
        findingDescription: context.findingDescription || message,
        affectedContract: context.affectedContract,
        affectedFunction: context.affectedFunction,
      });
    } else {
      // Generic message
      const emoji = type === 'critical_finding' ? '🚨' : type === 'input_needed' ? '🔔' : type === 'audit_complete' ? '✅' : 'ℹ️';
      formattedMessage = `${emoji} *${escapeMarkdown(title)}*\n\n${escapeMarkdown(message)}`;
    }

    await sendTelegramMessage(config.botToken, config.chatId, formattedMessage);

    log.info('Telegram notification sent', { type, title });
  } catch (error) {
    log.error('Failed to send Telegram notification', {
      type,
      title,
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't throw - notification failure shouldn't stop the audit
  }
}

/**
 * Send a prompt waiting notification via Telegram
 */
export async function notifyPromptWaitingTelegram(ctx: PromptNotificationContext): Promise<void> {
  const config = getTelegramConfig();
  if (!config.enabled) return;

  const message = formatPromptMessage(ctx);
  await sendTelegramMessage(config.botToken, config.chatId, message);
  log.info('Telegram prompt notification sent', { promptId: ctx.promptId });
}

/**
 * Send an audit completion notification via Telegram
 */
export async function notifyAuditCompletedTelegram(ctx: CompletionNotificationContext): Promise<void> {
  const config = getTelegramConfig();
  if (!config.enabled) return;

  const message = formatCompletionMessage(ctx);
  await sendTelegramMessage(config.botToken, config.chatId, message);
  log.info('Telegram completion notification sent', { jobId: ctx.jobId, status: ctx.status });
}

/**
 * Send a critical finding notification via Telegram
 */
export async function notifyCriticalFindingTelegram(ctx: CriticalFindingContext): Promise<void> {
  const config = getTelegramConfig();
  if (!config.enabled) return;

  const message = formatCriticalFindingMessage(ctx);
  await sendTelegramMessage(config.botToken, config.chatId, message);
  log.info('Telegram critical finding notification sent', { findingTitle: ctx.findingTitle });
}

/**
 * Get the current Telegram configuration status
 */
export function getTelegramStatus(): { enabled: boolean; chatId?: string } {
  const config = getTelegramConfig();
  return {
    enabled: config.enabled,
    chatId: config.enabled ? config.chatId : undefined,
  };
}

export default {
  sendTelegramNotification,
  notifyPromptWaitingTelegram,
  notifyAuditCompletedTelegram,
  notifyCriticalFindingTelegram,
  isTelegramEnabled,
  getTelegramStatus,
};
