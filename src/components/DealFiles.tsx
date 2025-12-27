'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase/config';
import { uploadDealFile, getDealFiles } from '@/lib/firebase/dealFiles';

export default function DealFiles({ dealId }: { dealId: string }) {
  const [files, setFiles] = useState<any[]>([]);
  const user = auth?.currentUser;
  if (!user) return null;

  const load = async () => {
    const data = await getDealFiles(dealId);
    setFiles(data);
  };

  useEffect(() => {
    load();
  }, [dealId]);

  const upload = async (e: any) => {
    if (!user || !e.target.files?.[0]) return;

    await uploadDealFile({
      dealId,
      file: e.target.files[0],


    });

    e.target.value = '';
    load();
  };

  return (
    <div style={{ marginTop: 10 }}>
      <h4>Attachments</h4>

      <input type="file" onChange={upload} />

      <ul>
        {files.map((f, i) => (
          <li key={i}>
            <a href={f.fileUrl} target="_blank">
              {f.fileName}
            </a>{' '}
            — {f.userEmail}
          </li>
        ))}
      </ul>
    </div>
  );
}


