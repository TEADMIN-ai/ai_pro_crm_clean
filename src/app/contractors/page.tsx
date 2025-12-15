'use client';
import { useState } from 'react';

export default function ContractorPortal() {
  const [form, setForm] = useState({
    name: '', company: '', phone: '', email: '',
    cidb: '', csd: '', address: ''
  });
  const [result, setResult] = useState<any>(null);

  const handleChange = (e: any) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const submit = async () => {
    const res = await fetch('/api/contractor/create', {
      method: 'POST',
      body: JSON.stringify(form),
      headers: { 'Content-Type': 'application/json' }
    });
    setResult(await res.json());
  };

  return (
    <div style={{ padding: 40, maxWidth: 600 }}>
      <h1>Contractor Profile Registration</h1>

      {Object.keys(form).map((field) => (
        <input
          key={field}
          placeholder={field}
          name={field}
          value={form[field as keyof typeof form]}
          onChange={handleChange}
          style={{ display: 'block', margin: '8px 0', padding: 8 }}
        />
      ))}

      <button onClick={submit} style={{ padding: 10 }}>Save Contractor</button>

      {result && (
        <pre style={{ marginTop: 20 }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}


