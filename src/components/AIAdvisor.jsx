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
      // Use relative URL for Vercel compatibility
      const res = await fetch('/api/farm-model', {
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
      const res = await fetch('/api/health');
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
      const res = await fetch('/api/ai/query', {
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
      const res = await fetch('/api/optimize', {
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
    <div style={{ fontFamily: 'Inter, Helvetica Neue, Arial, sans-serif', color: 'var(--text-primary)', fontSize: 15, lineHeight: 1.6 }}>
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
          <div className="alert alert-warning">{modelError}</div>
        )}
        {healthStatus && (
          <div className={healthStatus.ok ? "alert alert-success" : "alert alert-warning"}>
            {healthStatus.ok ? (
              <div>API reachable — pid: {healthStatus.info.pid} — timestamp: {new Date(healthStatus.info.timestamp).toLocaleString()}</div>
            ) : (
              <div>API health check failed: {healthStatus.error}</div>
            )}
          </div>
        )}
        {model && (
          <div style={{ marginTop: 12 }}>
            <h4 style={{ marginBottom: 8 }}>Farm Model Results</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 12 }}>
              {model.map((m) => (
                <div key={m.key} className="metric-section" style={{ padding: 16, border: '1px solid var(--border-color)', borderRadius: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{m.label}</div>
                    <div style={{ fontSize: 14, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{m.type}</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Estimated Yield</div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{m.estimatedYield} {m.type === 'annual' ? 'tons' : 'lbs'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Est. Price</div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>${m.estPrice}</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Revenue/Acre</div>
                      <div style={{ fontWeight: 600, color: 'var(--accent)' }}>{m.revenuePerAcreFormatted}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Profit/Acre</div>
                      <div style={{ fontWeight: 600, color: m.profitable ? 'var(--success)' : 'var(--warning)' }}>{m.profitPerAcreFormatted}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>{m.description}</div>
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
                    <tr style={{ background: 'var(--card)' }}>
                      <th style={{ textAlign: 'left', padding: '6px 10px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>Crop</th>
                      <th style={{ textAlign: 'right', padding: '6px 10px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>Acres</th>
                      <th style={{ textAlign: 'right', padding: '6px 10px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>Profit/Acre</th>
                    </tr>
                  </thead>
                  <tbody>
                    {optResult.allocation.map((row) => (
                      <tr key={row.key}>
                        <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>{row.key}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>{row.acres}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>${Math.round(row.profitPerAcre).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ color: 'var(--warning)', marginBottom: 12 }}>No allocation data returned.</div>
              )}
              {typeof optResult.totalProfit === 'number' && !isNaN(optResult.totalProfit) && (
                <>
                  <h4 style={{ marginTop: 16, marginBottom: 4 }}>Estimated Profit</h4>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)', marginBottom: 12 }}>${Math.round(optResult.totalProfit).toLocaleString()}</div>
                </>
              )}
              {optResult.explanation && (
                <>
                  <h4 style={{ marginTop: 16, marginBottom: 4 }}>AI Explanation</h4>
                  <div style={{ whiteSpace: 'pre-wrap', background: 'var(--card)', borderRadius: 6, padding: 10, color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
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
