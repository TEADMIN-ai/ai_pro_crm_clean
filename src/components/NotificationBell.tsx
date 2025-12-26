'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase/config';
import {
  getUserNotifications,
  markNotificationRead,
} from '@/lib/notifications';

export default function NotificationBell() {
  const [items, setItems] = useState<any[]>([]);
  const user = auth?.currentUser;
  if (!user) return null;

  const load = async () => {
    if (!user) return;
    const data = await getUserNotifications(user.uid);
    setItems(data);
  };

  useEffect(() => {
    load();
  }, [user]);

  return (
    <div style={{ position: 'relative' }}>
      ?? {items.filter(i => !i.read).length}

      <div style={{ position: 'absolute', background: '#fff', padding: 8 }}>
        {items.map(i => (
          <div key={i.id} style={{ fontSize: 12 }}>
            <strong>{i.title}</strong>
            <div>{i.message}</div>
            {!i.read && (
              <button onClick={() => markNotificationRead(i.id)}>
                Mark read
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


