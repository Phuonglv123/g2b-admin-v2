-- =============================================
-- RAG Document Chunks + Vector Search (pgvector)
-- =============================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Table: rag_document_chunks
-- Stores semantic chunks for product/location knowledge retrieval
CREATE TABLE IF NOT EXISTS rag_document_chunks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Relation fields
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES providers(id) ON DELETE SET NULL,

  -- Fast filter fields
  provider_name TEXT,
  product_name TEXT NOT NULL,
  product_code TEXT,
  city_province TEXT,
  ward TEXT,
  type TEXT,
  chunk_type TEXT NOT NULL DEFAULT 'overview', -- overview|location|pricing|spec

  -- Search payload
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  content_tsv tsvector GENERATED ALWAYS AS (to_tsvector('simple', COALESCE(content, ''))) STORED,
  embedding vector(1536),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique guard to avoid duplicate chunk rows per product/chunk/content combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_rag_chunks_product_chunk_type_content
  ON rag_document_chunks (product_id, chunk_type, md5(content));

-- Lookup indexes
CREATE INDEX IF NOT EXISTS idx_rag_chunks_product_id ON rag_document_chunks(product_id);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_city_type ON rag_document_chunks(city_province, type);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_provider_name ON rag_document_chunks(provider_name);

-- Full-text index for keyword fallback/hybrid ranking
CREATE INDEX IF NOT EXISTS idx_rag_chunks_tsv ON rag_document_chunks USING GIN(content_tsv);

-- Vector index (ivfflat). Requires ANALYZE and enough rows for best results.
CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding
  ON rag_document_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION set_rag_chunks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_rag_chunks_updated_at ON rag_document_chunks;
CREATE TRIGGER trigger_set_rag_chunks_updated_at
  BEFORE UPDATE ON rag_document_chunks
  FOR EACH ROW
  EXECUTE FUNCTION set_rag_chunks_updated_at();

-- Hybrid search function (semantic + keyword)
CREATE OR REPLACE FUNCTION match_rag_chunks(
  query_embedding vector(1536),
  keyword_query TEXT DEFAULT NULL,
  match_count INT DEFAULT 24,
  min_similarity FLOAT DEFAULT 0.60,
  filter_city TEXT DEFAULT NULL,
  filter_type TEXT DEFAULT NULL,
  filter_provider TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  product_id UUID,
  provider_name TEXT,
  product_name TEXT,
  product_code TEXT,
  city_province TEXT,
  ward TEXT,
  type TEXT,
  chunk_type TEXT,
  content TEXT,
  metadata JSONB,
  similarity FLOAT,
  keyword_rank FLOAT,
  hybrid_score FLOAT
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    c.id,
    c.product_id,
    c.provider_name,
    c.product_name,
    c.product_code,
    c.city_province,
    c.ward,
    c.type,
    c.chunk_type,
    c.content,
    c.metadata,
    (1 - (c.embedding <=> query_embedding))::FLOAT AS similarity,
    CASE
      WHEN keyword_query IS NULL OR btrim(keyword_query) = '' THEN 0::FLOAT
      ELSE ts_rank_cd(c.content_tsv, websearch_to_tsquery('simple', keyword_query))::FLOAT
    END AS keyword_rank,
    (
      ((1 - (c.embedding <=> query_embedding)) * 0.82) +
      (CASE
        WHEN keyword_query IS NULL OR btrim(keyword_query) = '' THEN 0
        ELSE LEAST(ts_rank_cd(c.content_tsv, websearch_to_tsquery('simple', keyword_query)), 1)
      END * 0.18)
    )::FLOAT AS hybrid_score
  FROM rag_document_chunks c
  WHERE
    c.embedding IS NOT NULL
    AND (1 - (c.embedding <=> query_embedding)) >= min_similarity
    AND (filter_city IS NULL OR c.city_province ILIKE filter_city)
    AND (filter_type IS NULL OR c.type = filter_type)
    AND (filter_provider IS NULL OR c.provider_name ILIKE filter_provider)
  ORDER BY hybrid_score DESC
  LIMIT match_count;
$$;

-- Enable RLS
ALTER TABLE rag_document_chunks ENABLE ROW LEVEL SECURITY;

-- Read for authenticated users (for future direct client use)
DROP POLICY IF EXISTS "Authenticated can read rag chunks" ON rag_document_chunks;
CREATE POLICY "Authenticated can read rag chunks"
  ON rag_document_chunks FOR SELECT
  TO authenticated
  USING (true);

-- Service role full access (used by proxy server)
DROP POLICY IF EXISTS "Service role full access rag chunks" ON rag_document_chunks;
CREATE POLICY "Service role full access rag chunks"
  ON rag_document_chunks FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
