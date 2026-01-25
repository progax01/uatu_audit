-- Migration: Drop Unused Audit Tables
-- Date: 2026-01-23
-- Reason: Removing completely unused tables (audit_trail, audit_cross_references)
--         These tables were defined in schema but never used in production

-- Drop audit_cross_references table
-- This table was intended for linking findings but was never implemented
DROP TABLE IF EXISTS audit_cross_references CASCADE;

-- Drop audit_trail table
-- This table was intended for audit logging but was never implemented
DROP TABLE IF EXISTS audit_trail CASCADE;

-- Note: These tables had zero rows and zero usage in the codebase
-- Confirmed by:
-- - grep analysis showing only schema definition references
-- - No actual INSERT/UPDATE/SELECT operations in codebase
-- - Database audit showing 0 rows in both tables
