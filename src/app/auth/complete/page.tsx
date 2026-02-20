import { Suspense } from "react";
import { AuthCompleteClient } from "./auth-complete-client";

export default function AuthCompletePage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#f7f4ef]" />}>
      <AuthCompleteClient />
    </Suspense>
  );
}
