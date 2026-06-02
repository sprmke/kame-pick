"use client";

import { usePathname } from "next/navigation";

import { Sidebar } from "@/components/sidebar";
import { isPublicRoute } from "@/lib/supabase/config";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = isPublicRoute(pathname) && pathname !== "/auth/callback";

  if (isAuthPage) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
        {children}
      </div>
    );
  }

  return (
    <>
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </>
  );
}
