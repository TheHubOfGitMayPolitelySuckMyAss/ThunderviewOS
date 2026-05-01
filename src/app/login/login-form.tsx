"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import Field from "@/components/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function LoginForm({ redirect }: { redirect?: string }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Store redirect target in a cookie so /auth/confirm can read it
    if (redirect) {
      document.cookie = `auth_redirect=${encodeURIComponent(redirect)}; path=/; max-age=600; SameSite=Lax`;
    }

    // Always use window.location.origin so preview deploys keep magic links
    // on the preview hostname. NEXT_PUBLIC_SITE_URL is production-only and
    // would land users on prod after click-through. The Supabase email
    // template references {{ .RedirectTo }}, so this URL controls where
    // the magic link points.
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
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
    <div className="w-full max-w-[420px] bg-bg border border-border rounded-lg p-7 shadow-sm">
      <h1 className="font-display font-medium text-[32px] leading-[1.1] tracking-[-0.015em] mb-1.5" style={{ fontVariationSettings: '"opsz" 144' }}>
        Thunderview OS
      </h1>
      <p className="text-[15px] text-fg2 leading-[1.5] mb-6">
        Sign in with your email
      </p>

      {sent ? (
        <div className="rounded-md bg-[rgba(91,106,59,0.08)] border border-[rgba(91,106,59,0.2)] text-success px-4 py-3.5 text-[14px] leading-[1.5]">
          Check your email for a magic link to sign in.
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <Field label="Email">
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
            <div className="mt-form-row rounded-md bg-[rgba(192,68,42,0.08)] border border-[rgba(192,68,42,0.2)] px-3.5 py-3 text-[14px] text-danger leading-[1.4]">
              {error}
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full mt-1">
            {loading ? "Sending\u2026" : "Send Magic Link"}
          </Button>
        </form>
      )}
    </div>
  );
}
