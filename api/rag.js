import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://thaodan.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Graceful degradation: if RAG not configured, return empty
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY || !process.env.OPENAI_API_KEY) {
    return res.status(200).json({ chunks: [] });
  }

  const { query, top_k = 3 } = req.body || {};
  if (!query || typeof query !== 'string') return res.status(400).json({ error: 'query required' });

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const embRes = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query.slice(0, 2000),
    });
    const embedding = embRes.data[0].embedding;

    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: embedding,
      match_count: Math.min(top_k, 5),
    });

    if (error) throw new Error(error.message);

    return res.status(200).json({ chunks: data || [] });
  } catch (err) {
    console.error('RAG error:', err.message);
    return res.status(200).json({ chunks: [] }); // Always degrade gracefully
  }
}
