CREATE TABLE IF NOT EXISTS script_likes (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, script_id)
);

ALTER TABLE script_likes ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all likes
CREATE POLICY "Anyone can read script_likes"
  ON script_likes FOR SELECT
  USING (true);

-- Authenticated users can insert their own likes
CREATE POLICY "Users can insert their own likes"
  ON script_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Authenticated users can delete their own likes
CREATE POLICY "Users can delete their own likes"
  ON script_likes FOR DELETE
  USING (auth.uid() = user_id);
