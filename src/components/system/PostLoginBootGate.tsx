"use client";

import { ReactNode, useCallback, useEffect, useState } from "react";
import AISystemCore from "@/components/system/AISystemCore";

const BOOT_FLAG_KEY = "show_ai_boot";

export default function PostLoginBootGate({
  children,
}: {
  children: ReactNode;
}) {
  const [booting, setBooting] = useState(false);

  useEffect(() => {
    const shouldShow = window.sessionStorage.getItem(BOOT_FLAG_KEY) === "true";
    if (shouldShow) {
      window.sessionStorage.removeItem(BOOT_FLAG_KEY);
      setBooting(true);
    }
  }, []);

  const handleFinish = useCallback(() => {
    setBooting(false);
  }, []);

  return (
    <>
      {children}
      {booting ? <AISystemCore onFinish={handleFinish} /> : null}
    </>
  );
}
