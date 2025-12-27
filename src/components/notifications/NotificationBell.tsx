'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase/config';
import {
  getUserNotifications,
  markNotificationRead,
} from '@/lib/firebase/notifications';

export default function NotificationBell() {
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      const user = auth?.currentUser;
      if (!user) return;
      const res = await getUserNotifications(user.uid);
      setItems(res);
    };
    load();
  }, []);

  const unread = items.filter(i => !i.read).length;

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)}>
        🔔 {unread > 0 && <strong>({unread})</strong>}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            background: '#111',
            padding: 10,
            width: 300,
            zIndex: 50,
          }}
        >
          {items.length === 0 && <p>No notifications</p>}

          {items.map(n => (
            <div
              key={n.id}
              style={{ opacity: n.read ? 0.6 : 1, marginBottom: 8 }}
              onClick={async () => {
                await markNotificationRead(n.id);
                setItems(items.map(i =>
                  i.id === n.id ? { ...i, read: true } : i
                ));
              }}
            >
              <strong>{n.title}</strong>
              <p>{n.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
