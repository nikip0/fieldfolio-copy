const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

let docs = [];

function flattenDocs(parsed) {
  const flat = [];
  for (const [section, items] of Object.entries(parsed)) {
    for (const [key, val] of Object.entries(items)) {
      flat.push({ id: `${section}_${key}`, text: JSON.stringify(val), metadata: { section, key } });
    }
  }
  return flat;
}

router.post('/ingest', (req, res) => {
  try {
    const cropsPath = path.join(__dirname, '..', 'data', 'crops.json');
    const txt = fs.readFileSync(cropsPath, 'utf8');
    const parsed = JSON.parse(txt);
    docs = flattenDocs(parsed);
    res.json({ ok: true, count: docs.length, backend: 'mock' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/query', (req, res) => {
  try {
    const { query, topK = 3 } = req.body;
    if (!query) return res.status(400).json({ error: 'missing query' });

    const q = query.toLowerCase();
    const scored = docs.map(d => {
      // simple keyword count heuristic
      const text = (d.text || '').toLowerCase();
      const score = q.split(/\W+/).reduce((s, w) => w ? s + (text.includes(w) ? 1 : 0) : s, 0);
      return { id: d.id, score, text: d.text };
    });
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, topK);

    const answer = `Mock AI: I found these relevant docs: ${top.map(t => t.id).join(', ')}. Use these as examples; install OpenAI to get full AI features.`;

    res.json({ answer, context: top.map(t => ({ id: t.id, score: t.score })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
