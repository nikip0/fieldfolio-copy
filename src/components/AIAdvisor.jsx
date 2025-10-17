import React, { useState } from 'react';

export default function AIAdvisor({ model }) {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([]);
  const [loadingQuery, setLoadingQuery] = useState(false);
  const [lastContext, setLastContext] = useState([]);

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
    </div>
  );
}
