/**
 * Reset ALL Database Tables
 *
 * NUCLEAR OPTION: Wipes everything clean
 * WARNING: This deletes ALL data including users, sessions, audits, projects, everything
 */

import 'dotenv/config';
import { db } from './index.js';
import {
  users,
  sessions,
  auditJobs,
  auditResults,
  auditReports,
  auditStepProgress,
  auditSopExecution,
  auditClarifications,
  auditFindings,
  auditCrossReferences,
  auditUserAnswers,
  auditPrompts,
  auditKnownAddresses,
  auditLinkedProjects,
  auditSessions,
  auditTrail,
  toolExecutionLogs,
  aiContextSnapshots,
  aiConversationHistory,
  preauditQuestionnaires,
  preauditAnswers,
  publicAuditShowcase,
  notifications,
  projects,
  projectComponents,
  organizations,
  organizationMembers,
  xpRules,
  tierThresholds,
  contractClassifications,
} from './schema.js';

async function resetAll() {
  console.log('☢️  NUCLEAR RESET - DELETING ALL DATA\n');
  console.log('🔗 Connecting to database...\n');

  try {
    const tables = [
      // Auth & Users
      { name: 'sessions', table: sessions },
      { name: 'users', table: users },

      // Audits
      { name: 'ai_context_snapshots', table: aiContextSnapshots },
      { name: 'ai_conversation_history', table: aiConversationHistory },
      { name: 'audit_cross_references', table: auditCrossReferences },
      { name: 'audit_findings', table: auditFindings },
      { name: 'audit_user_answers', table: auditUserAnswers },
      { name: 'audit_prompts', table: auditPrompts },
      { name: 'audit_known_addresses', table: auditKnownAddresses },
      { name: 'audit_linked_projects', table: auditLinkedProjects },
      { name: 'audit_sessions', table: auditSessions },
      { name: 'tool_execution_logs', table: toolExecutionLogs },
      { name: 'audit_step_progress', table: auditStepProgress },
      { name: 'audit_sop_execution', table: auditSopExecution },
      { name: 'audit_clarifications', table: auditClarifications },
      { name: 'preaudit_answers', table: preauditAnswers },
      { name: 'preaudit_questionnaires', table: preauditQuestionnaires },
      { name: 'audit_reports', table: auditReports },
      { name: 'audit_results', table: auditResults },
      { name: 'public_audit_showcase', table: publicAuditShowcase },
      { name: 'contract_classifications', table: contractClassifications },
      { name: 'audit_jobs', table: auditJobs },
      { name: 'audit_trail', table: auditTrail },
      { name: 'notifications', table: notifications },

      // Projects & Organizations
      { name: 'project_components', table: projectComponents },
      { name: 'projects', table: projects },
      { name: 'organization_members', table: organizationMembers },
      { name: 'organizations', table: organizations },

      // Config (keeping these)
      // { name: 'xp_rules', table: xpRules },
      // { name: 'tier_thresholds', table: tierThresholds },
    ];

    let totalDeleted = 0;

    for (const { name, table } of tables) {
      try {
        const deleted = await db.delete(table).returning();
        console.log(`  ✓ Cleared: ${name} (${deleted.length} rows)`);
        totalDeleted += deleted.length;
      } catch (error: any) {
        console.log(`  ⚠️  Failed: ${name} - ${error.message}`);
      }
    }

    console.log('\n✅ COMPLETE DATABASE RESET FINISHED!\n');
    console.log(`📝 Summary:`);
    console.log(`   Total rows deleted: ${totalDeleted}`);
    console.log(`   All users must re-authenticate`);
    console.log(`   All audits deleted`);
    console.log(`   All projects deleted\n`);

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Reset failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

resetAll();
