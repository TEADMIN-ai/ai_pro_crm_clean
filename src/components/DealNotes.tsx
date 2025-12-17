'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase/config';
import { addDealNote, getDealNotes } from '@/lib/firebase/dealNotes';

export default function DealNotes({ dealId }: { dealId: string }) {
  const [notes, setNotes] = useState<any[]>([]);
  const [text, setText] = useState('');

  const load = async () => {
    const data = await getDealNotes(dealId);
    setNotes(data);
  };

  useEffect(() => {
    load();
  }, [dealId]);

  const submit = async () => {
    if (!text || !auth.currentUser) return;

    await addDealNote({
      dealId,
      note: text,
      userId: auth.currentUser.uid,
      userEmail: auth.currentUser.email || '',
    });

    setText('');
    load();
  };

  return (
    <div style={{ marginTop: 12 }}>
      <h4>Notes</h4>

      <div style={{ marginBottom: 8 }}>
        {notes.map((n, i) => (
          <div key={i} style={{ fontSize: 13, marginBottom: 4 }}>
            <strong>{n.userEmail}</strong>: {n.note}
          </div>
        ))}
      </div>

      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={2}
        style={{ width: '100%' }}
      />

      <button onClick={submit} style={{ marginTop: 4 }}>
        Add Note
      </button>
    </div>
  );
}
