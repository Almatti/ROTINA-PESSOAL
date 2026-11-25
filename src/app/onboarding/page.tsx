"use client";
import { useEffect, useState } from "react";
import { SessionProvider } from "@/lib/session";
import { Onboarding } from "@/components/onboarding";

export default function Page() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;
  return (
    <SessionProvider>
      <Onboarding />
    </SessionProvider>
  );
}
