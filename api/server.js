require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Simple request logger to aid debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} -> ${req.method} ${req.originalUrl}`);
  next();
});

// Mount AI routes (load safely so missing deps don't prevent server start)
try {
  const aiRouter = require('./ai');
  app.use('/api/ai', aiRouter);
  console.log('AI router loaded — using real OpenAI-backed endpoints');
} catch (err) {
  console.warn('Warning: failed to load ./api/ai router - will use mock AI router. Error:', err.message);
  try {
    const mock = require('./ai.mock');
    app.use('/api/ai', mock);
  } catch (mErr) {
    console.warn('Also failed to load ai.mock:', mErr.message);
    const fallback = express.Router();
    fallback.post('/ingest', (req, res) => res.status(501).json({ error: 'AI module unavailable' }));
    fallback.post('/query', (req, res) => res.status(501).json({ error: 'AI module unavailable' }));
    app.use('/api/ai', fallback);
  }
}

// Helper to build a farm model with human-readable fields
function buildModelFromParams({ acres = 0, irrigated = 0, budget = 0 }) {
  const cropsPath = require('path').join(__dirname, '..', 'data', 'crops.json');
  const raw = require('fs').readFileSync(cropsPath, 'utf8');
  const parsed = JSON.parse(raw);

  // flatten annual + perennial into a single map
  const flat = { ...parsed.annual, ...parsed.perennial };

  const irrigationFraction = acres > 0 ? (irrigated / acres) : 0;
  const waterScore = Math.min(1, irrigationFraction + 0.1);

  return Object.entries(flat).map(([k, info]) => {
    const baseYield = info.avgYield || 0;
    const budgetPerAcre = acres > 0 ? budget / acres : 0;
    const budgetFactor = 1 + Math.min(1, budgetPerAcre / 5000);
    const estimatedYield = baseYield * waterScore * budgetFactor;
    const estPrice = info.avgPrice || 0;
    const estCosts = info.costs || 0;

    const revenuePerAcre = estimatedYield * estPrice;
    const profitPerAcre = revenuePerAcre - estCosts;

    return {
      key: k,
      label: info.name || k,
      type: info.type || null,
      estimatedYield: parseFloat(estimatedYield.toFixed(1)),
      estPrice,
      estCosts,
      revenuePerAcre: parseFloat(revenuePerAcre.toFixed(2)),
      profitPerAcre: parseFloat(profitPerAcre.toFixed(2)),
      revenuePerAcreFormatted: `$${Math.round(revenuePerAcre).toLocaleString()}`,
      profitPerAcreFormatted: `$${Math.round(profitPerAcre).toLocaleString()}`,
      profitable: profitPerAcre > 0,
      description: info.description || null
    };
  });
}

// Simple farm model endpoint
app.post('/api/farm-model', (req, res) => {
  try {
    const { acres = 0, irrigated = 0, budget = 0, zones = [] } = req.body;

    const model = buildModelFromParams({ acres, irrigated, budget });
    res.json({ ok: true, model });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fallback route to catch requests that don't include /api prefix (helps local debugging)
app.post('/farm-model', (req, res) => {
  console.log('Fallback /farm-model invoked (no /api prefix). Request body:', req.body);
  // Reuse the same logic as /api/farm-model by delegating
  try {
    const { acres = 0, irrigated = 0, budget = 0, zones = [] } = req.body;
    const model = buildModelFromParams({ acres, irrigated, budget });
    res.json({ ok: true, model });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Simple optimizer endpoint
app.post('/api/optimize', async (req, res) => {
  try {
    const { model, acres = 0, budget = 0 } = req.body;
    if (!model || model.length === 0) return res.status(400).json({ error: 'missing model' });
    // Build LP model
    const solver = require('javascript-lp-solver');

    // Variables: acres allocated to each crop key
    const lp = { optimize: 'profit', opType: 'max', constraints: {}, variables: {}, ints: {} };

    // constraint: sum of acres <= acres
    lp.constraints.total_acres = { 'max': acres };
    // constraint: budget <= budget (sum(cost_per_acre * acres) <= budget)
    lp.constraints.total_cost = { 'max': budget };

    for (const m of model) {
      const profitPerAcre = (m.estPrice * m.estimatedYield) - m.estCosts;
      // variable name
      const v = m.key;
      lp.variables[v] = {
        profit: profitPerAcre,
        total_acres: 1,
        total_cost: m.estCosts
      };
      // force integer acres (useful for small farms) — optional
      lp.ints[v] = 1;
    }

    const solution = solver.Solve(lp);

    // Build allocation result
    const allocation = [];
    for (const m of model) {
      const acresAllocated = solution[m.key] || 0;
      allocation.push({ key: m.key, acres: acresAllocated, profitPerAcre: (m.estPrice * m.estimatedYield) - m.estCosts });
    }

    const totalProfit = solution.result || 0;

    const explanationPrompt = `Given the farm model: ${JSON.stringify(model)} and optimization allocation: ${JSON.stringify(allocation)}, explain in plain language why this allocation maximizes expected profit and mention any key risks.`;

    // Call AI endpoint to get an explanation - use direct OpenAI instead of internal API call
    let aiExplanation = null;
    try {
      // Import OpenAI directly instead of calling localhost
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: explanationPrompt }],
        temperature: 0.7
      });
      
      let answer = completion.choices[0].message.content;
      // Remove any JSON formatting artifacts
      answer = answer.replace(/[{}\[\]"'`]+/g, '').replace(/\\n/g, ' ').replace(/\\/g, '').trim();
      aiExplanation = answer;
    } catch (err) {
      aiExplanation = 'Could not fetch AI explanation: ' + err.message;
    }

    res.json({ allocation, totalProfit, explanation: aiExplanation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/usda', async (req, res) => {
  try {
    const { key, ...params } = req.query;
    
    // Build USDA API URL
    const queryString = new URLSearchParams(params).toString();
    const url = `https://quickstats.nass.usda.gov/api/api_GET/?key=${key}&${queryString}`;
    
    console.log('Fetching from USDA:', url);
    
    // Use native fetch (Node 18+) or dynamic import
    let fetchFunc;
    if (global.fetch) {
      fetchFunc = global.fetch;
    } else {
      fetchFunc = (await import('node-fetch')).default;
    }
    
    const response = await fetchFunc(url);
    const data = await response.json();
    
    console.log('USDA Response:', data);
    
    res.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Simple health check for debugging from the frontend
app.get('/health', (req, res) => {
  res.json({ ok: true, pid: process.pid, timestamp: Date.now() });
});

// Also expose health under /api so Vite dev proxy can forward it
app.get('/api/health', (req, res) => {
  res.json({ ok: true, pid: process.pid, timestamp: Date.now() });
});

// Export the app for Vercel serverless
module.exports = app;

// Only start the server if this file is run directly (not imported)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Proxy server running on http://localhost:${PORT}`);
  });
}