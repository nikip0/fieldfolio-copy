const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Minimal local RAG using OpenAI embeddings. Prefer Chroma for similarity if available.
const OpenAI = require('openai');

// Check if API key is configured
if (!process.env.OPENAI_API_KEY) {
  console.warn('WARNING: OPENAI_API_KEY not found in environment variables. AI features will not work.');
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'dummy-key' });

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
  // Add units to yield values in the text before embedding
  let textWithUnits = text;
  try {
    // If text is JSON, add units to any 'yield' or 'next season' fields
    const obj = JSON.parse(text);
    if (obj && typeof obj === 'object') {
      for (const k of Object.keys(obj)) {
        if (/yield/i.test(k) && typeof obj[k] === 'number') {
          obj[k] = `${obj[k]} tons/acre`;
        }
        // Add units to 'what to plant next season' recommendations
        if (/next season/i.test(k) && typeof obj[k] === 'string') {
          obj[k] = obj[k].replace(/(\d+(\.\d+)?)/g, '$1 acres');
        }
      }
      textWithUnits = JSON.stringify(obj);
    }
  } catch {}
  const res = await openai.embeddings.create({ model: 'text-embedding-3-small', input: textWithUnits });
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
    // Check if API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ 
        error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to your environment variables.',
        answer: 'AI features are currently unavailable. Please contact the administrator to configure the OpenAI API key.'
      });
    }

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
      // Add units to 'yield' and 'next season' recommendations in answer
      answer = answer.replace(/(yield:?\s*)(\d+(\.\d+)?)/gi, '$1$2 tons/acre');
      answer = answer.replace(/(plant next season:?\s*)([\w\s]+)(\d+(\.\d+)?)/gi, (m, p1, p2, p3) => `${p1}${p2}${p3} acres`);
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
