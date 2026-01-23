'use client';

import { useState } from 'react';

export default function SalesAssistant() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<string[]>([]);

  const handleSend = () => {
    if (!input.trim()) return;

    setMessages(prev => [
      ...prev,
      `You: ${input}`,
      `Bot: Thanks — I understand. Let me help you respond professionally.`,
    ]);

    setInput('');
  };

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 16,
        width: 360,
      }}
    >
      <h3 style={{ marginBottom: 8 }}>Sales Assistant</h3>

      <div
        style={{
          fontSize: 13,
          opacity: 0.8,
          marginBottom: 12,
        }}
      >
        Ask how to respond to customers, handle objections, or follow up.
      </div>

      <div style={{ minHeight: 120, marginBottom: 12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 6 }}>
            {m}
          </div>
        ))}
      </div>

      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="Ask how to respond to a customer…"
        style={{
          width: '100%',
          padding: 8,
          borderRadius: 8,
          border: 'none',
          marginBottom: 8,
        }}
      />

      <button
        onClick={handleSend}
        style={{
          width: '100%',
          padding: 8,
          borderRadius: 8,
          border: 'none',
          background: '#2563eb',
          color: '#fff',
          cursor: 'pointer',
        }}
      >
        Send
      </button>
    </div>
  );
}
