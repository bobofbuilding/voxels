import type { Express, Request, Response } from 'express'

async function parseTime(req: Request, res: Response) {
  const { input, now: rawNow } = req.body
  if (!input) return res.json({ error: 'no input' })

  // client sends their wall clock with offset, e.g. 2026-05-20T11:53:00+12:00
  const now = typeof rawNow === 'string' && /[+-]\d\d:?\d\d$/.test(rawNow) ? rawNow : new Date().toISOString()
  const offset = now.slice(-6)

  const prompt = `User's current local time: ${now}. Parse "${input}" into a single ISO 8601 timestamp using the same timezone offset (${offset}). Reply with ONLY the ISO string, no prose.`

  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    }),
  }).then((r) => r.json())

  const iso = r.choices?.[0]?.message?.content?.trim()
  if (!iso) return res.json({ error: 'parse failed' })
  res.json({ iso })
}

export default function ModelsController(app: Express) {
  app.post('/api/models/time', parseTime)
}
