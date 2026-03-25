"use client";

import { useEffect, useState } from "react";

export default function AISystemCore({ onFinish }: { onFinish: () => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onFinish();
    }, 2500);

    return () => clearTimeout(timer);
  }, [onFinish]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
      <div className="text-center">
        <div className="text-cyan-400 text-[120px] font-bold animate-pulse">
          TE
        </div>

        <div className="mt-6 text-white text-xl tracking-widest">
          TORQUE EMPIRE
        </div>

        <div className="mt-3 text-cyan-400 text-xs tracking-[0.5em]">
          AI SYSTEM INITIALIZING
        </div>
      </div>
    </div>
  );
}
