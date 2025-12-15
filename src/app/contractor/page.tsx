'use client';
import { useState } from 'react';

export default function ContractorPage() {
  const [result, setResult] = useState<any>(null);

  async function submit(e: any) {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.target));
    const res = await fetch('/api/contractor/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    setResult(await res.json());
  }

  return (
    <form onSubmit={submit}>
      <input name='name' placeholder='Name' />
      <input name='company' placeholder='Company' />
      <input name='phone' placeholder='Phone' />
      <input name='email' placeholder='Email' />
      <input name='cidb' placeholder='CIDB' />
      <input name='regNumber' placeholder='Reg Number' />
      <input name='address' placeholder='Address' />
      <button type='submit'>Save Contractor</button>
      <pre>{JSON.stringify(result, null, 2)}</pre>
    </form>
  );
}
