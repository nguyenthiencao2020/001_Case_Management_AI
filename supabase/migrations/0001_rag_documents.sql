-- RAG: documents table + similarity search function
-- Run once in Supabase SQL editor (Dashboard → SQL Editor → New query)

create extension if not exists vector;

create table if not exists documents (
  id          bigserial primary key,
  content     text        not null,
  embedding   vector(1536),
  source_file text,
  metadata    jsonb       default '{}',
  created_at  timestamptz default now()
);

-- IVFFlat index for fast approximate nearest-neighbor search
create index if not exists documents_embedding_idx
  on documents using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Similarity search function called by api/rag.js
create or replace function match_documents(
  query_embedding vector(1536),
  match_count     int default 5
)
returns table (
  id          bigint,
  content     text,
  source_file text,
  metadata    jsonb,
  similarity  float
)
language plpgsql
as $$
begin
  return query
  select
    d.id,
    d.content,
    d.source_file,
    d.metadata,
    1 - (d.embedding <=> query_embedding) as similarity
  from documents d
  order by d.embedding <=> query_embedding
  limit match_count;
end;
$$;
