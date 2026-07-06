"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { isCloudMode } from "@/lib/supabase/config";

type AuthMode = "login" | "signup";

interface AuthFormProps {
  mode: AuthMode;
}

type AuthFields = {
  email: string;
  password: string;
  fullName: string;
  organizationName: string;
};

async function signUpUser(fields: AuthFields, next: string) {
  const supabase = createClient();
  const { error } = await supabase.auth.signUp({
    email: fields.email,
    password: fields.password,
    options: {
      data: {
        full_name: fields.fullName || undefined,
        organization_name: fields.organizationName || undefined,
      },
      emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) throw error;
}

async function signInUser(email: string, password: string) {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

function SignupFields({
  fullName,
  organizationName,
  onFullNameChange,
  onOrganizationNameChange,
}: {
  fullName: string;
  organizationName: string;
  onFullNameChange: (value: string) => void;
  onOrganizationNameChange: (value: string) => void;
}) {
  return (
    <>
      <div>
        <label htmlFor="fullName" className="mb-1 block text-sm font-medium">
          Full name
        </label>
        <input
          id="fullName"
          type="text"
          autoComplete="name"
          value={fullName}
          onChange={(e) => onFullNameChange(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </div>
      <div>
        <label htmlFor="organizationName" className="mb-1 block text-sm font-medium">
          Organization name
        </label>
        <input
          id="organizationName"
          type="text"
          value={organizationName}
          onChange={(e) => onOrganizationNameChange(e.target.value)}
          placeholder="Acme Hiring"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </div>
    </>
  );
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const isSignup = mode === "signup";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!isCloudMode()) {
      setError(
        "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to web/.env.local — see docs/local-development.md",
      );
      return;
    }

    setLoading(true);
    try {
      if (isSignup) {
        await signUpUser({ email, password, fullName, organizationName }, next);
        setMessage("Account created. You can sign in now.");
        router.push(`/login?next=${encodeURIComponent(next)}`);
        return;
      }

      await signInUser(email, password);
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          {isSignup ? "Create account" : "Sign in"}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {isSignup ? "Start your hiring workspace" : "Access your applicants dashboard"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {isSignup && (
          <SignupFields
            fullName={fullName}
            organizationName={organizationName}
            onFullNameChange={setFullName}
            onOrganizationNameChange={setOrganizationName}
          />
        )}

        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete={isSignup ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}
        {message && (
          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {loading ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500">
        {isSignup ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-indigo-600 hover:underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            No account yet?{" "}
            <Link href="/signup" className="font-medium text-indigo-600 hover:underline">
              Sign up
            </Link>
          </>
        )}
      </p>

      <p className="mt-4 text-center text-xs text-zinc-400">
        Local mode works without Supabase env vars — see docs/local-development.md
      </p>
    </div>
  );
}
