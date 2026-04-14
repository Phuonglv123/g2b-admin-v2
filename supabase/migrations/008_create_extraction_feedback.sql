-- =============================================
-- Extraction Feedback & Learning System
-- =============================================

-- Table: extraction_feedback
-- Stores original AI extraction vs user-corrected data for learning
CREATE TABLE IF NOT EXISTS extraction_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- File info
  file_name TEXT,
  file_type TEXT,          -- 'application/pdf', 'image/png', etc.
  file_size INTEGER,       -- bytes
  
  -- Provider
  provider_name TEXT,
  
  -- AI extraction (original)
  original_extraction JSONB NOT NULL,
  
  -- User corrections (final saved data)
  corrected_data JSONB NOT NULL,
  
  -- Diff tracking
  was_corrected BOOLEAN DEFAULT false,  -- true if user changed anything
  corrections_summary JSONB,            -- { field: { from: X, to: Y } }
  
  -- Confidence from AI
  ai_confidence JSONB,                  -- { location: 0.9, pricing: 0.7, ... }
  
  -- Usage stats
  input_tokens INTEGER,
  output_tokens INTEGER,
  pass2_corrected BOOLEAN DEFAULT false,
  few_shot_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for provider-based few-shot lookup
CREATE INDEX IF NOT EXISTS idx_feedback_provider ON extraction_feedback(provider_name);
CREATE INDEX IF NOT EXISTS idx_feedback_corrected ON extraction_feedback(was_corrected) WHERE was_corrected = true;
CREATE INDEX IF NOT EXISTS idx_feedback_created ON extraction_feedback(created_at DESC);

-- Table: provider_templates
-- Stores provider-specific extraction hints and field mappings
CREATE TABLE IF NOT EXISTS provider_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_name TEXT NOT NULL UNIQUE,
  
  -- Template data
  layout_hints TEXT,              -- Description of typical PDF layout
  field_mapping JSONB,            -- Custom field name mappings
  extraction_notes TEXT,          -- Special instructions for this provider
  example_json JSONB,             -- Example correct output
  
  -- Stats
  total_extractions INTEGER DEFAULT 0,
  avg_confidence REAL DEFAULT 0,
  correction_rate REAL DEFAULT 0,  -- % of extractions that needed correction
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provider_templates_name ON provider_templates(provider_name);

-- Enable RLS
ALTER TABLE extraction_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies: authenticated users can read/write their own feedback
CREATE POLICY "Users can insert their own feedback"
  ON extraction_feedback FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read all feedback"
  ON extraction_feedback FOR SELECT
  TO authenticated
  USING (true);

-- Provider templates: readable by all, writable by authenticated
CREATE POLICY "Anyone can read provider templates"
  ON provider_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage templates"
  ON provider_templates FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Service role bypass (for server-side operations)
CREATE POLICY "Service role full access feedback"
  ON extraction_feedback FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access templates"
  ON provider_templates FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to auto-update provider template stats
CREATE OR REPLACE FUNCTION update_provider_template_stats()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO provider_templates (provider_name, total_extractions, correction_rate)
  VALUES (
    NEW.provider_name,
    1,
    CASE WHEN NEW.was_corrected THEN 1.0 ELSE 0.0 END
  )
  ON CONFLICT (provider_name)
  DO UPDATE SET
    total_extractions = provider_templates.total_extractions + 1,
    correction_rate = (
      SELECT COALESCE(AVG(CASE WHEN was_corrected THEN 1.0 ELSE 0.0 END), 0)
      FROM extraction_feedback
      WHERE provider_name = NEW.provider_name
    ),
    avg_confidence = (
      SELECT COALESCE(AVG((ai_confidence->>'overall')::REAL), 0)
      FROM extraction_feedback
      WHERE provider_name = NEW.provider_name
      AND ai_confidence IS NOT NULL
    ),
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_provider_stats
  AFTER INSERT ON extraction_feedback
  FOR EACH ROW
  WHEN (NEW.provider_name IS NOT NULL)
  EXECUTE FUNCTION update_provider_template_stats();
