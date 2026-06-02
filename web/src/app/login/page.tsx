import { Suspense } from "react";

import { AuthForm } from "@/components/auth-form";

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <AuthForm mode="login" />
    </Suspense>
  );
}
