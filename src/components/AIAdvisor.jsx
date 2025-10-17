import React, { useState } from 'react';

export default function AIAdvisor({ model }) {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([]);
  const [loadingQuery, setLoadingQuery] = useState(false);
  const [lastContext, setLastContext] = useState([]);
  const [optResult, setOptResult] = useState(null);

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
      <div className="card" style={{ marginTop: 12 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700 }}>Ask the AI Advisor</h3>
        <div style={{ marginTop: 8 }}>
          <textarea value={query} onChange={e => setQuery(e.target.value)} placeholder="Ask something like: Which crop mix maximizes profit given 50 irrigated acres and $25k?" style={{ width: '100%', minHeight: 80, fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif', fontSize: 14, lineHeight: 1.5 }} />
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
