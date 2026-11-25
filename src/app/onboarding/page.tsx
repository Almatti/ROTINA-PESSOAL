"use client";
import { SessionProvider } from "@/lib/session";
import { Onboarding } from "@/components/onboarding";

export default function Page() {
  return (
    <SessionProvider>
      <Onboarding />
    </SessionProvider>
  );
}
