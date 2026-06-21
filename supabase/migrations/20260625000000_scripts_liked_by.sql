-- Add liked_by array column to scripts table for per-user like tracking
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS liked_by UUID[] NOT NULL DEFAULT '{}';

-- Allow users to update their own like status via service_role (admin API)
-- This is managed through the like-script API endpoint
