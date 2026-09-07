"use client";

import { LogIn, LogOut, User } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { isCloudMode } from "@/lib/supabase/config";
import { cn } from "@/lib/utils";

export function UserMenu() {
  const cloud = isCloudMode();
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(cloud);

  useEffect(() => {
    if (!cloud) {
      return;
    }

    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });

    return () => subscription.unsubscribe();
  }, [cloud]);

  if (!cloud) {
    return (
      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        <p className="px-3 py-2 text-xs text-zinc-500">Local mode</p>
        <Link
          href="/login"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          <LogIn className="h-4 w-4" />
          Enable cloud auth
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
        <p className="text-xs text-zinc-500">Loading account…</p>
      </div>
    );
  }

  if (!email) {
    return (
      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        <Link
          href="/login"
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
            "bg-indigo-600 text-white hover:bg-indigo-700",
          )}
        >
          <LogIn className="h-4 w-4" />
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
      <div className="mb-2 flex items-center gap-2 px-3 py-1">
        <User className="h-4 w-4 shrink-0 text-zinc-400" />
        <p className="truncate text-xs text-zinc-600 dark:text-zinc-400">{email}</p>
      </div>
      <form action="/auth/signout" method="post">
        <button
          type="submit"
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </form>
    </div>
  );
}
