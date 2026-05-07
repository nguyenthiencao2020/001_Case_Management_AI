export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://thaodan.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Read keys inside handler so Vercel picks up updated env vars without module cache
  const KEYS = [
    process.env.GROQ_KEY_1,
    process.env.GROQ_KEY_2,
    process.env.GROQ_KEY_3,
  ].filter(Boolean);

  if (KEYS.length === 0)
    return res.status(500).json({ error: { message: 'Chưa cấu hình GROQ_KEY_1/2/3 trên Vercel' } });

  // Round-robin across keys based on current second to spread rate limits
  const apiKey = KEYS[Math.floor(Date.now() / 1000) % KEYS.length];

  try {
    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify(req.body)
    });
    const data = await upstream.json();
    // If rate-limited, try remaining keys before giving up
    if (upstream.status === 429 && KEYS.length > 1) {
      for (const key of KEYS.filter(k => k !== apiKey)) {
        const retry = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
          body: JSON.stringify(req.body)
        });
        if (retry.status !== 429) {
          const retryData = await retry.json();
          return res.status(retry.status).json(retryData);
        }
      }
    }
    return res.status(upstream.status).json(data);
  } catch (err) {
    return res.status(502).json({ error: { message: err.message } });
  }
}
