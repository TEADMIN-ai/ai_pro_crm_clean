'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase/config';
import { addDealNote, getDealNotes } from '@/lib/firebase/dealNotes';
import { notifyUser } from '@/lib/notifications';

export default function DealNotes({ dealId }: { dealId: string }) {
  const [notes, setNotes] = useState<any[]>([]);
  const [text, setText] = useState('');
  const user = auth?.currentUser;
  if (!user) return null;

  const load = async () => {
    const data = await getDealNotes(dealId);
    setNotes(data);
  };

  useEffect(() => {
    load();
  }, [dealId]);

  const submit = async () => {
    if (!text || !user) return;

    await addDealNote({
      dealId,
      note: text,
      userId: user.uid,
      userEmail: user.email || '',
    });

    await notifyUser({
      userId: user.uid,
      title: 'New deal note',
      message: text,
      link: '/dashboard/deals',
    });

    setText('');
    load();
  };

  return (
    <div style={{ marginTop: 12 }}>
      <h4>Notes</h4>

      {notes.map((n, i) => (
        <div key={i} style={{ fontSize: 13 }}>
          <strong>{n.userEmail}</strong>: {n.note}
        </div>
      ))}

      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={2}
        style={{ width: '100%' }}
      />

      <button onClick={submit}>Add Note</button>
    </div>
  );
}


