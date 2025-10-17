const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Minimal local RAG using OpenAI embeddings. Prefer Chroma for similarity if available.
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

let useChroma = false;
let chromaClient = null;
try {
  const chroma = require('chromadb');
  // try to instantiate a client pointing to local duckdb+parquet store
  chromaClient = new chroma.Client();
  useChroma = true;
  console.log('Chroma client available — will use Chroma for retrieval if collection exists');
} catch (err) {
  console.log('Chroma JS client not available — falling back to in-memory retrieval');
}

let docs = []; // { id, text, metadata }
let embeddings = []; // { id, vector }

async function embedText(text) {
  const res = await openai.embeddings.create({ model: 'text-embedding-3-small', input: text });
  return res.data[0].embedding;
}

function cosine(a, b) {
  const dot = a.reduce((s, ai, i) => s + ai * b[i], 0);
  const na = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const nb = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  return dot / (na * nb + 1e-12);
}

router.post('/ingest', async (req, res) => {
  try {
    // Load crop docs
    const cropsPath = path.join(__dirname, '..', 'data', 'crops.json');
    const txt = fs.readFileSync(cropsPath, 'utf8');
    const parsed = JSON.parse(txt);
    const flatten = (obj) => {
      const entries = [];
      for (const [section, items] of Object.entries(obj)) {
        for (const [key, val] of Object.entries(items)) {
          entries.push({ id: `${section}_${key}`, text: JSON.stringify(val), metadata: { section, key } });
        }
      }
      return entries;
    };

    const flat = flatten(parsed);

    if (useChroma && chromaClient) {
      try {
        const collection = chromaClient.get_collection({ name: 'plantprofit' });
        // upsert using JS client API
        const ids = flat.map(d => d.id);
        const documents = flat.map(d => d.text);
        const metadatas = flat.map(d => d.metadata);
        // create embeddings in batch
        const vectors = [];
        for (const d of flat) {
          const v = await embedText(d.text);
          vectors.push(v);
        }
        collection.upsert({ ids, metadatas, documents, embeddings: vectors });
        res.json({ ok: true, count: flat.length, backend: 'chroma' });
        return;
      } catch (err) {
        console.error('Chroma ingest failed, falling back to in-memory:', err.message);
      }
    }

    // fallback: in-memory
    docs = flat;
    embeddings = [];
    for (const d of docs) {
      const v = await embedText(d.text);
      embeddings.push({ id: d.id, vector: v });
    }

    res.json({ ok: true, count: docs.length, backend: 'memory' });
  } catch (err) {
    console.error('ingest error', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/query', async (req, res) => {
  try {
    const { query, topK = 3 } = req.body;
    if (!query) return res.status(400).json({ error: 'missing query' });

    const qVec = await embedText(query);

      let context = [];

      if (useChroma && chromaClient) {
        try {
          const collection = chromaClient.get_collection({ name: 'plantprofit' });
          const resVec = await collection.query({ query_embeddings: [qVec], n_results: topK });
          // resVec has IDs and scores depending on client
          const ids = resVec['ids'][0] || [];
          const distances = resVec['distances'] ? resVec['distances'][0] : [];
          context = ids.map((id, i) => ({ id, score: distances[i], text: null }));
          // fill text from docs file
          const cropsPath = path.join(__dirname, '..', 'data', 'crops.json');
          const parsed = JSON.parse(fs.readFileSync(cropsPath, 'utf8'));
          const flat = [];
          for (const [section, items] of Object.entries(parsed)) {
            for (const [key, val] of Object.entries(items)) {
              flat.push({ id: `${section}_${key}`, text: JSON.stringify(val) });
            }
          }
          for (const c of context) {
            const found = flat.find(f => f.id === c.id);
            if (found) c.text = found.text;
          }
        } catch (err) {
          console.error('Chroma query failed, falling back to memory:', err.message);
        }
      }

      if (context.length === 0) {
        const scored = embeddings.map(e => ({ id: e.id, score: cosine(e.vector, qVec) }));
        scored.sort((a, b) => b.score - a.score);
        const top = scored.slice(0, topK);
        context = top.map(t => {
          const d = docs.find(x => x.id === t.id);
          return { id: d.id, score: t.score, text: d.text };
        });
      }

    // LLM prompt with retrieved context
    const system = `You are PlantProfit Assistant. Answer concisely with a recommended plan and include citations from the provided CONTEXT when relevant. Return JSON with fields: answer (string), sources (array of {id, score}).`;
    const userPrompt = `QUERY: ${query}\n\nCONTEXT:\n${context.map(c => `### ${c.id}\n${c.text}`).join('\n\n')}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 600
    });

    let answer = completion.choices[0].message.content;
    // Remove JSON-like formatting if present
    if (typeof answer === 'string') {
      // Try to parse as JSON and extract the answer field
      try {
        const parsed = JSON.parse(answer);
        if (parsed && parsed.answer) {
          answer = parsed.answer;
        }
      } catch (e) {
        // Not valid JSON, continue
      }
  // Remove any curly braces, quotes, brackets, and single quotes left
  answer = answer.replace(/[{}\[\]"'`]+/g, '').replace(/\\n/g, ' ').replace(/\\/g, '').trim();
    }
    res.json({ answer, context: context.map(c => ({ id: c.id, score: c.score })) });
  } catch (err) {
    console.error('query error', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
