-- Migration: Migrate Findings from Normalized Table to JSONB
-- Date: 2026-01-23
-- Reason: Consolidate findings storage to single JSONB field in audit_results
--         Eliminates dual-storage architecture and fallback logic

-- Step 1: Migrate existing findings from audit_findings to audit_results.findings (JSONB)
-- This updates audit_results records where findings exist in audit_findings but not in JSONB

UPDATE audit_results ar
SET findings = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', af.finding_id,
      'findingId', af.finding_id,
      'title', af.title,
      'description', af.description,
      'severity', COALESCE(af.adjusted_severity, af.original_severity),
      'originalSeverity', af.original_severity,
      'recommendation', af.recommendation,
      'location', af.location,
      'tool', af.tool,
      'stepId', af.step_id,
      'status', af.status,
      'impact', af.impact,
      'likelihood', af.likelihood,
      'remediationEffort', af.remediation_effort,
      'codeSnippet', af.code_snippet,
      'references', af.references,
      'metadata', af.metadata
    )
    ORDER BY af.created_at ASC
  )
  FROM audit_findings af
  WHERE af.job_id = ar.job_id
)
WHERE EXISTS (
  SELECT 1 FROM audit_findings WHERE job_id = ar.job_id
)
AND (ar.findings IS NULL OR jsonb_array_length(ar.findings) = 0);

-- Step 2: For audit_results records that don't exist yet but have findings
-- This handles edge case where findings exist but no audit_results record
INSERT INTO audit_results (
  job_id,
  findings,
  score_value,
  score_label,
  summary,
  created_at,
  updated_at
)
SELECT DISTINCT
  af.job_id,
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', af2.finding_id,
        'findingId', af2.finding_id,
        'title', af2.title,
        'description', af2.description,
        'severity', COALESCE(af2.adjusted_severity, af2.original_severity),
        'originalSeverity', af2.original_severity,
        'recommendation', af2.recommendation,
        'location', af2.location,
        'tool', af2.tool,
        'stepId', af2.step_id,
        'status', af2.status,
        'impact', af2.impact,
        'likelihood', af2.likelihood,
        'remediationEffort', af2.remediation_effort,
        'codeSnippet', af2.code_snippet,
        'references', af2.references,
        'metadata', af2.metadata
      )
      ORDER BY af2.created_at ASC
    )
    FROM audit_findings af2
    WHERE af2.job_id = af.job_id
  ) as findings,
  0 as score_value,
  'pending' as score_label,
  'Migrated from audit_findings' as summary,
  NOW() as created_at,
  NOW() as updated_at
FROM audit_findings af
WHERE NOT EXISTS (
  SELECT 1 FROM audit_results WHERE job_id = af.job_id
)
GROUP BY af.job_id;

-- Step 3: Verification query (run manually to check migration)
-- SELECT
--   ar.job_id,
--   jsonb_array_length(ar.findings) as jsonb_finding_count,
--   COUNT(af.id) as normalized_finding_count,
--   CASE
--     WHEN jsonb_array_length(ar.findings) = COUNT(af.id) THEN '✓ Match'
--     WHEN jsonb_array_length(ar.findings) > COUNT(af.id) THEN '⚠ More in JSONB'
--     ELSE '⚠ More in normalized'
--   END as status
-- FROM audit_results ar
-- LEFT JOIN audit_findings af ON ar.job_id = af.job_id
-- WHERE EXISTS (SELECT 1 FROM audit_findings WHERE job_id = ar.job_id)
-- GROUP BY ar.job_id, ar.findings
-- ORDER BY ar.job_id;

-- Step 4: After verification, drop the audit_findings table
-- IMPORTANT: Only run this after confirming migration succeeded!
-- Uncomment when ready:
-- DROP TABLE IF EXISTS audit_findings CASCADE;

-- Step 5: Drop related indexes and constraints
-- These will be automatically dropped with CASCADE, but listing for documentation:
-- - audit_findings_job_id_idx
-- - audit_findings_session_id_idx
-- - audit_findings_finding_id_idx
-- - audit_findings_severity_idx
-- - audit_findings_status_idx

-- Migration Notes:
-- - All findings from audit_findings are now in audit_results.findings JSONB
-- - Original severity tracking is preserved in originalSeverity field
-- - Adjusted severity becomes the primary severity field
-- - All metadata and references are preserved
-- - Ordering is preserved by created_at timestamp
-- - After this migration, update application code to use JSONB only
