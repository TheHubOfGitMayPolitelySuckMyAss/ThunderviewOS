"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import Link from "next/link";
import Field from "@/components/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${(process.env.NEXT_PUBLIC_SITE_URL || window.location.origin).trim()}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSent(true);
      setLoading(false);
    }
  }

  return (
    <div className="tv-surface min-h-screen">
      {/* Minimal nav — logo only per kit */}
      <nav className="tv-nav sticky top-0 z-10 bg-[rgba(251,247,240,0.86)] backdrop-blur-[10px]">
        <Link href="/" className="tv-nav-logo no-underline">
          Thunderview
        </Link>
        <div />
        <div />
      </nav>

      <div className="flex items-center justify-center px-gutter-sm py-7" style={{ minHeight: "calc(100vh - var(--tv-nav-height))" }}>
        <div className="w-full max-w-[420px] bg-bg-elevated border border-border rounded-lg p-8 shadow-sm">
          <h1 className="tv-h3 !text-[32px] mb-2">Sign in.</h1>
          <p className="text-[14px] text-fg3 mb-7">We&rsquo;ll email you a magic link.</p>

          {sent ? (
            <p className="rounded-md bg-[rgba(91,106,59,0.12)] text-success px-4 py-3.5 text-[14px] leading-[1.5]">
              Check your email for a magic link to sign in.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-form-row">
              <Field label="Email" required>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </Field>

              {error && (
                <p className="rounded-md bg-[rgba(192,68,42,0.1)] px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              )}

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Sending\u2026" : "Send Magic Link"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
