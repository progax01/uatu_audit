/**
 * Link Audits to Projects Migration Script
 *
 * Links existing audits (with projectId=null) to projects by matching:
 * - Repository URLs from audit.repo
 * - Contract addresses from audit.contractAddress
 * - Component configs in projects
 *
 * Usage: npx tsx src/db/link-audits-to-projects.ts
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq, isNull, and } from 'drizzle-orm';
import { auditJobs, projects } from './schema.js';
import { listProjects, getProject } from '../services/projectService.js';

async function linkAuditsToProjects() {
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  console.log('🔗 Connecting to database...');

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('azure.com') ? { rejectUnauthorized: false } : undefined,
  });

  const db = drizzle(pool);

  console.log('🔍 Finding orphaned audits and projects...\n');

  // Get all audits without projectId
  const orphanedAudits = await db
    .select()
    .from(auditJobs)
    .where(isNull(auditJobs.projectId));

  console.log(`Found ${orphanedAudits.length} audits without projectId`);

  if (orphanedAudits.length === 0) {
    console.log('✅ No orphaned audits found. All audits are linked!');
    await pool.end();
    process.exit(0);
  }

  // Load all projects from file system (not database!)
  // Projects are stored as JSON files, not in the database
  const fs = await import('fs/promises');
  const path = await import('path');

  const uatuHome = process.env.UATU_HOME || path.join(process.env.HOME || '', '.uatu');
  const projectsIndexPath = path.join(uatuHome, 'projects', 'index.json');

  let allProjects: any[] = [];

  try {
    const indexContent = await fs.readFile(projectsIndexPath, 'utf-8');
    const index = JSON.parse(indexContent);
    const projectIds = Object.keys(index.projects || {});

    console.log(`Found ${projectIds.length} projects in file system index`);

    // Load full project metadata for each project
    for (const projectId of projectIds) {
      const project = await getProject(projectId);
      if (project) {
        allProjects.push(project);
      }
    }

    console.log(`Loaded ${allProjects.length} project metadata files`);

    if (allProjects.length > 0) {
      console.log('\nProjects found:');
      for (const p of allProjects.slice(0, 5)) {
        console.log(`  - ${p.name} (${p.id.substring(0, 8)}) - ${(p.components || []).length} components`);
      }
    }
  } catch (error: any) {
    console.log(`\n⚠️  WARNING: Could not load projects from file system!`);
    console.log(`   Error: ${error.message}`);
    console.log(`   Index path: ${projectsIndexPath}`);
  }

  // Insert projects into database to satisfy foreign key constraint
  if (allProjects.length > 0) {
    console.log('\n📝 Syncing projects to database...');

    for (const project of allProjects) {
      try {
        // Check if project already exists in DB
        const existing = await db.select().from(projects).where(eq(projects.id, project.id));

        if (existing.length === 0) {
          // Insert project into database
          await db.insert(projects).values({
            id: project.id,
            slug: project.slug,
            name: project.name,
            description: project.description || null,
            userId: project.userId,
            organizationId: project.organizationId || null,
            type: project.type,
            ecosystems: project.ecosystems || [],
            networks: project.networks || [],
            components: project.components || [],
            settings: project.settings || {},
            status: project.status || 'draft',
            tags: project.tags || [],
            auditCount: project.auditCount || 0,
            aggregatedScore: project.aggregatedScore || null,
            lastAuditAt: project.lastAuditAt || null,
            createdAt: new Date(project.createdAt),
            updatedAt: new Date(project.updatedAt),
          });

          console.log(`  ✓ Synced project "${project.name}" to database`);
        } else {
          console.log(`  - Project "${project.name}" already in database`);
        }
      } catch (error: any) {
        console.log(`  ✗ Failed to sync project "${project.name}": ${error.message}`);
      }
    }
  }

  console.log();

  let linked = 0;
  let skipped = 0;

  for (const audit of orphanedAudits) {
    let matched = false;

    // Try to match by repository URL
    if (audit.repo) {
      const auditRepo = normalizeRepoUrl(audit.repo);

      for (const project of allProjects) {
        if (!project.components || project.components.length === 0) continue;

        for (const component of project.components as any[]) {
          if (component.type === 'github-repo' && component.config) {
            const componentRepo = normalizeRepoUrl(
              component.config.cloneUrl ||
              component.config.fullName ||
              `${component.config.owner}/${component.config.repo}`
            );

            if (auditRepo === componentRepo) {
              // Match found!
              await db
                .update(auditJobs)
                .set({ projectId: project.id })
                .where(eq(auditJobs.id, audit.id));

              console.log(`  ✓ Linked audit ${audit.id.substring(0, 8)} to project "${project.name}"`);
              console.log(`    Repo: ${audit.repo}`);
              linked++;
              matched = true;
              break;
            }
          }
        }

        if (matched) break;
      }
    }

    // Try to match by contract address
    if (!matched && audit.contractAddress) {
      const auditAddress = normalizeAddress(audit.contractAddress);

      for (const project of allProjects) {
        if (!project.components || project.components.length === 0) continue;

        for (const component of project.components as any[]) {
          if (component.type === 'deployed-contract' && component.config?.address) {
            const componentAddress = normalizeAddress(component.config.address);

            if (auditAddress === componentAddress) {
              // Match found!
              await db
                .update(auditJobs)
                .set({ projectId: project.id })
                .where(eq(auditJobs.id, audit.id));

              console.log(`  ✓ Linked audit ${audit.id.substring(0, 8)} to project "${project.name}"`);
              console.log(`    Contract: ${audit.contractAddress}`);
              linked++;
              matched = true;
              break;
            }
          }
        }

        if (matched) break;
      }
    }

    if (!matched) {
      console.log(`  ⚠ Could not match audit ${audit.id.substring(0, 8)}`);
      console.log(`    Repo: ${audit.repo || 'N/A'}`);
      console.log(`    Contract: ${audit.contractAddress || 'N/A'}`);
      skipped++;
    }
  }

  await pool.end();

  console.log(`\n✅ Migration complete!`);
  console.log(`   Linked: ${linked} audits`);
  console.log(`   Skipped: ${skipped} audits (no matching project found)`);

  process.exit(0);
}

/**
 * Normalize repository URL to compare
 */
function normalizeRepoUrl(url: string): string {
  if (!url) return '';

  // Remove protocol, .git suffix, trailing slashes
  return url
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^git@/, '')
    .replace(/\.git$/, '')
    .replace(/\/$/, '')
    .replace(/github\.com[:/]/, '');
}

/**
 * Normalize contract address for comparison
 */
function normalizeAddress(address: string): string {
  if (!address) return '';
  return address.toLowerCase().trim();
}

// Run if called directly
linkAuditsToProjects().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
