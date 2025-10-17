import React, { useState } from 'react';

export default function AIAdvisor() {
  const [acres, setAcres] = useState(50);
  const [irrigated, setIrrigated] = useState(50);
  const [budget, setBudget] = useState(25000);
  const [zones, setZones] = useState('');
  const [model, setModel] = useState(null);
  const [loadingModel, setLoadingModel] = useState(false);
  const [modelError, setModelError] = useState(null);
  const [healthStatus, setHealthStatus] = useState(null);

  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([]);
  const [loadingQuery, setLoadingQuery] = useState(false);
  const [lastContext, setLastContext] = useState([]);
  const [optResult, setOptResult] = useState(null);

  const buildModel = async () => {
    setLoadingModel(true);
    setModelError(null);
    try {
      // Explicit backend URL (server runs on port 3001)
  const res = await fetch('http://localhost:3001/api/farm-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acres: Number(acres), irrigated: Number(irrigated), budget: Number(budget), zones })
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Server error (${res.status}): ${txt}`);
      }
      const data = await res.json();
      if (!data || !data.model) throw new Error('Invalid model response from server');
      setModel(data.model);
    } catch (err) {
      console.error('buildModel error', err);
      setModelError(err.message || String(err));
      setModel(null);
    } finally {
      setLoadingModel(false);
    }
  };

  const testApi = async () => {
    setHealthStatus(null);
    try {
  const res = await fetch('http://localhost:3001/api/health');
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const j = await res.json();
      setHealthStatus({ ok: true, info: j });
    } catch (err) {
      console.error('health check failed', err);
      setHealthStatus({ ok: false, error: err.message || String(err) });
    }
  };

  const sendQuery = async () => {
    if (!query) return;
    const userMsg = { role: 'user', text: query };
    setMessages(prev => [...prev, userMsg]);
    setLoadingQuery(true);
    try {
      const res = await fetch('http://localhost:3001/api/ai/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`AI query failed (${res.status}): ${txt}`);
      }
      let data = await res.json();
      // If the backend returns a stringified JSON, parse it
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch {}
      }
      let answer = data.answer;
      if (!answer && typeof data === 'object') {
        // If the answer is missing, but the whole object is the answer
        answer = data.answer || data.text || JSON.stringify(data);
      }
      if (!answer && typeof data === 'string') {
        answer = data;
      }
      const botMsg = { role: 'assistant', text: answer || 'No answer returned' };
      setMessages(prev => [...prev, botMsg]);
      setLastContext(data.context || []);
    } catch (err) {
      console.error('sendQuery error', err);
      const botMsg = { role: 'assistant', text: `Error: ${err.message || String(err)}` };
      setMessages(prev => [...prev, botMsg]);
    } finally {
      setLoadingQuery(false);
      setQuery('');
    }
  };

  const optimizePlan = async () => {
    if (!model) return alert('Build the farm model first');
    setOptResult(null);
    try {
  const res = await fetch('http://localhost:3001/api/optimize', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, acres: Number(acres), budget: Number(budget) })
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Optimize failed (${res.status}): ${txt}`);
      }
      const data = await res.json();
      setOptResult(data);
    } catch (err) {
      console.error('optimizePlan error', err);
      setOptResult({ error: err.message || String(err) });
    }
  };

  return (
    <div>
      <div className="card">
        <h3 style={{ fontSize: 16, fontWeight: 700 }}>Onboard Farm / Build Model</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
          <div>
            <label>Acres</label>
            <input type="number" value={acres} onChange={(e) => setAcres(e.target.value)} />
          </div>
          <div>
            <label>Irrigated Acres</label>
            <input type="number" value={irrigated} onChange={(e) => setIrrigated(e.target.value)} />
          </div>
          <div>
            <label>Budget ($)</label>
            <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <label>Zones (optional)</label>
          <input type="text" value={zones} onChange={(e) => setZones(e.target.value)} placeholder="e.g. zone1:10,zone2:40" />
        </div>
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-primary" onClick={buildModel} disabled={loadingModel}>{loadingModel ? 'Building...' : 'Build Farm Model'}</button>
            <button className="btn-ghost" onClick={testApi} style={{ padding: '8px 12px' }}>Test API</button>
          </div>
        </div>
        {modelError && (
          <div style={{ marginTop: 8, color: '#b91c1c', background: '#fff1f2', padding: 8, borderRadius: 6 }}>
            <strong>Error:</strong> {modelError}
          </div>
        )}
        {healthStatus && (
          <div style={{ marginTop: 8, padding: 8, borderRadius: 6, background: healthStatus.ok ? '#ecfdf5' : '#fff1f2', color: healthStatus.ok ? '#065f46' : '#7f1d1d' }}>
            {healthStatus.ok ? (
              <div>API reachable — pid: {healthStatus.info.pid} — timestamp: {new Date(healthStatus.info.timestamp).toLocaleString()}</div>
            ) : (
              <div>API health check failed: {healthStatus.error}</div>
            )}
          </div>
        )}
        {model && (
          <div style={{ marginTop: 12 }}>
            <h4 style={{ marginBottom: 8 }}>Estimated Model</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {model.map((m) => (
                <div key={m.key} style={{ padding: 10, borderRadius: 8, background: '#fbfbfe', border: '1px solid #eef2f7' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div style={{ fontWeight: 700 }}>{m.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{m.type}</div>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 13 }}>
                    <div>Yield (per acre): <strong>{m.estimatedYield}</strong></div>
                    <div>Price: <strong>${m.estPrice}</strong> · Costs: <strong>${m.estCosts}</strong></div>
                    <div>Revenue / acre: <strong>{m.revenuePerAcreFormatted}</strong></div>
                    <div>Profit / acre: <strong style={{ color: m.profitable ? '#065f46' : '#b91c1c' }}>{m.profitPerAcreFormatted}</strong></div>
                    {m.description && <div style={{ marginTop: 6, color: 'var(--muted)', fontSize: 12 }}>{m.description}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700 }}>Ask the AI Advisor</h3>
        <div style={{ marginTop: 8 }}>
          <textarea value={query} onChange={e => setQuery(e.target.value)} placeholder="Ask something like: Which crop mix maximizes profit given 50 irrigated acres and $25k?" style={{ width: '100%', minHeight: 80 }} />
        </div>
        <div style={{ marginTop: 8 }}>
          <button className="btn-primary" onClick={sendQuery} disabled={loadingQuery}>{loadingQuery ? 'Thinking...' : 'Ask AI'}</button>
        </div>

        <div style={{ marginTop: 12 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: m.role === 'user' ? 'var(--muted)' : 'var(--accent-2)', fontWeight: 700 }}>{m.role}</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
            </div>
          ))}
          {lastContext.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <h4 style={{ marginBottom: 6 }}>Sources</h4>
              <ul>
                {lastContext.map((c, i) => (
                  <li key={i} style={{ fontSize: 13 }}>{c.id} — score: {c.score.toFixed(3)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      {model && (
        <div style={{ marginTop: 12 }} className="card">
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>Optimize Plan</h3>
          <p style={{ color: 'var(--muted)' }}>Run a quick optimization to allocate acres to crops to maximize expected profit.</p>
          <div style={{ marginTop: 8 }}>
            <button className="btn-primary" onClick={optimizePlan}>Optimize Plan</button>
          </div>
          {optResult && (
            <div style={{ marginTop: 12 }}>
              <h4 style={{ marginBottom: 8 }}>Allocation</h4>
              {Array.isArray(optResult.allocation) && optResult.allocation.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
                  <thead>
                    <tr style={{ background: '#f3f4f6' }}>
                      <th style={{ textAlign: 'left', padding: '6px 10px', borderBottom: '1px solid #e5e7eb' }}>Crop</th>
                      <th style={{ textAlign: 'right', padding: '6px 10px', borderBottom: '1px solid #e5e7eb' }}>Acres</th>
                      <th style={{ textAlign: 'right', padding: '6px 10px', borderBottom: '1px solid #e5e7eb' }}>Profit/Acre</th>
                    </tr>
                  </thead>
                  <tbody>
                    {optResult.allocation.map((row) => (
                      <tr key={row.key}>
                        <td style={{ padding: '6px 10px', borderBottom: '1px solid #f1f5f9' }}>{row.key}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', borderBottom: '1px solid #f1f5f9' }}>{row.acres}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', borderBottom: '1px solid #f1f5f9' }}>${Math.round(row.profitPerAcre).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ color: '#b91c1c', marginBottom: 12 }}>No allocation data returned.</div>
              )}
              {typeof optResult.totalProfit === 'number' && !isNaN(optResult.totalProfit) && (
                <>
                  <h4 style={{ marginTop: 16, marginBottom: 4 }}>Estimated Profit</h4>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#065f46', marginBottom: 12 }}>${Math.round(optResult.totalProfit).toLocaleString()}</div>
                </>
              )}
              {optResult.explanation && (
                <>
                  <h4 style={{ marginTop: 16, marginBottom: 4 }}>AI Explanation</h4>
                  <div style={{ whiteSpace: 'pre-wrap', background: '#f8fafc', borderRadius: 6, padding: 10, color: '#334155' }}>
                    {(() => {
                      try {
                        const parsed = JSON.parse(optResult.explanation);
                        if (parsed && parsed.answer) {
                          return parsed.answer.replace(/[{}\[\]"]+/g, '').trim();
                        }
                      } catch (e) {}
                      // Remove any curly braces, quotes, or brackets left
                      return String(optResult.explanation).replace(/[{}\[\]"]+/g, '').trim();
                    })()}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
