#!/usr/bin/env node
// Indexes all .md/.txt files in /docs/ into Supabase pgvector.
// Run: node scripts/index-docs.js
// Env required: SUPABASE_URL, SUPABASE_SERVICE_KEY, OPENAI_API_KEY

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DOCS_DIR = join(ROOT, 'docs');

const { SUPABASE_URL, SUPABASE_SERVICE_KEY, OPENAI_API_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !OPENAI_API_KEY) {
  console.error('❌ Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY, OPENAI_API_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 150;

function getAllFiles(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry.startsWith('.') || entry === 'README.md') continue;
    if (statSync(full).isDirectory()) getAllFiles(full, acc);
    else if (['.md', '.txt'].includes(extname(entry))) acc.push(full);
  }
  return acc;
}

function chunkText(text) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 60) chunks.push(chunk);
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
}

async function embedBatch(texts) {
  const res = await openai.embeddings.create({ model: 'text-embedding-3-small', input: texts });
  return res.data.map(d => d.embedding);
}

async function indexFile(filePath) {
  const sourceFile = relative(ROOT, filePath);
  const text = readFileSync(filePath, 'utf-8');
  const chunks = chunkText(text);
  console.log(`  ${sourceFile} → ${chunks.length} chunk(s)`);

  await supabase.from('documents').delete().eq('source_file', sourceFile);

  for (let i = 0; i < chunks.length; i += 10) {
    const batch = chunks.slice(i, i + 10);
    const embeddings = await embedBatch(batch);
    const rows = batch.map((content, j) => ({
      content,
      embedding: embeddings[j],
      source_file: sourceFile,
      metadata: { chunk_index: i + j },
    }));
    const { error } = await supabase.from('documents').insert(rows);
    if (error) console.error(`    ⚠️  Insert error chunk ${i}: ${error.message}`);
  }
}

async function main() {
  const files = getAllFiles(DOCS_DIR);
  console.log(`\n📚 Indexing ${files.length} document(s) from docs/\n`);
  for (const f of files) await indexFile(f);
  console.log('\n✅ Done.\n');
}

main().catch(err => { console.error(err); process.exit(1); });
