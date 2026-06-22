-- Add dislike, favorite, and download tracking to scripts
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS disliked_by UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS dislikes_count INT NOT NULL DEFAULT 0;
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS favorited_by UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS favorites_count INT NOT NULL DEFAULT 0;
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS downloads_count INT NOT NULL DEFAULT 0;

-- Create script reports table
CREATE TABLE IF NOT EXISTS script_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (script_id, user_id)
);

GRANT SELECT ON script_reports TO authenticated;
GRANT ALL ON script_reports TO service_role;
ALTER TABLE script_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports_self_insert" ON script_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reports_self_read" ON script_reports FOR SELECT
   USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "reports_admin_all" ON script_reports FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));
