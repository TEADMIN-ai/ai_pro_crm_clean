'use client';

import { useState } from 'react';

export default function SalesAssistant() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<
    { role: 'user' | 'bot'; text: string }[]
  >([]);

  const handleSend = () => {
    if (!input.trim()) return;

    setMessages(prev => [
      ...prev,
      { role: 'user', text: input },
      {
        role: 'bot',
        text:
          'I understand. The next best step is to confirm customer requirements and guide them toward a suitable option.',
      },
    ]);

    setInput('');
  };

  return (
    <div
      style={{
        padding: 16,
        borderRadius: 16,
        background: 'rgba(255,255,255,0.04)',
        maxWidth: 420,
      }}
    >
      <h4 style={{ marginBottom: 8 }}>🤖 Sales Assistant</h4>

      <div
        style={{
          minHeight: 120,
          maxHeight: 220,
          overflowY: 'auto',
          fontSize: 13,
          marginBottom: 12,
        }}
      >
        {messages.length === 0 && (
          <div style={{ opacity: 0.6 }}>
            Ask how to respond to a customer, handle objections, or follow up.
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 6 }}>
            <strong>{m.role === 'user' ? 'You' : 'Bot'}:</strong> {m.text}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask sales assistant..."
          style={{
            flex: 1,
            padding: 8,
            borderRadius: 8,
            border: 'none',
            outline: 'none',
          }}
        />
        <button
          onClick={handleSend}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
