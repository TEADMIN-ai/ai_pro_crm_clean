'use client';

import { useState } from 'react';

export default function SalesBotPanel() {
  const [messages, setMessages] = useState<
    { role: 'user' | 'bot'; content: string }[]
  >([
    {
      role: 'bot',
      content:
        'Hi 👋 I’m your Sales Assistant. Ask me how to respond to customers, handle objections, or follow up on deals.',
    },
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);

    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    // 🔒 SAFE MOCK RESPONSE (Phase 1)
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        {
          role: 'bot',
          content:
            'Suggested response:\n\n“Thanks for your interest — I completely understand your concern. Let’s look at options that fit your budget while keeping the value you want.”',
        },
      ]);
      setLoading(false);
    }, 800);
  };

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.04)',
        borderRadius: 16,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      <h3 style={{ marginBottom: 8 }}>🤖 Sales Assistant</h3>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          marginBottom: 12,
          paddingRight: 6,
        }}
      >
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              marginBottom: 10,
              fontSize: 14,
              whiteSpace: 'pre-line',
              opacity: m.role === 'bot' ? 0.9 : 1,
            }}
          >
            <strong>{m.role === 'bot' ? 'Bot' : 'You'}:</strong> {m.content}
          </div>
        ))}

        {loading && <div style={{ opacity: 0.6 }}>Thinking…</div>}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask how to respond to a customer…"
          style={{
            flex: 1,
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'transparent',
            color: 'inherit',
          }}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
        />
        <button
          onClick={sendMessage}
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            background: '#2563eb',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
