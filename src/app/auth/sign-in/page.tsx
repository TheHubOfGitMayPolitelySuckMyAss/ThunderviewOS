import Link from "next/link";
import PublicNav from "@/components/public-nav";
import SignInButton from "./sign-in-button";
import { createAdminClient } from "@/lib/supabase/admin";
import { findMemberByAnyEmail } from "@/lib/member-lookup";

// Greeting name only. A failed lookup must not block sign-in — log it and
// fall back to a nameless greeting.
async function firstNameFor(email: string | undefined): Promise<string | null> {
  if (!email) return null;
  try {
    const result = await findMemberByAnyEmail<{ first_name: string | null }>(
      createAdminClient("read-only"),
      email,
      "first_name"
    );
    return result?.member.first_name?.trim() || null;
  } catch (err) {
    console.error("[auth/sign-in] first-name lookup failed:", err);
    return null;
  }
}

export const dynamic = "force-dynamic";

// Landing page for the magic link. /auth/confirm (the URL in the email)
// forwards here on GET without touching the token. Login happens only when
// the member presses the button, which POSTs to /auth/confirm. This is what
// keeps corporate link scanners from spending the single-use token.
// See src/app/auth/confirm/route.ts.
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; email?: string }>;
}) {
  const { token_hash, type, email } = await searchParams;
  const firstName = token_hash && type ? await firstNameFor(email) : null;

  return (
    <div className="tv-surface min-h-screen">
      <PublicNav />
      <div
        className="flex items-center justify-center px-gutter-sm py-7"
        style={{ minHeight: "calc(100vh - var(--tv-nav-height))" }}
      >
        <div className="w-full max-w-md text-center">
          {token_hash && type ? (
            <>
              <h1 className="tv-h2 mb-3">
                {firstName ? `Heya, ${firstName}!` : "Heya!"}
              </h1>
              <p className="text-fg2 mb-6">Click to Finish Signing In</p>
              <form method="post" action="/auth/confirm">
                <input type="hidden" name="token_hash" value={token_hash} />
                <input type="hidden" name="type" value={type} />
                {email ? <input type="hidden" name="email" value={email} /> : null}
                <SignInButton />
              </form>
            </>
          ) : (
            <>
              <h1 className="tv-h2 mb-4">Invalid link</h1>
              <p className="text-fg2 leading-relaxed">
                This sign-in link is incomplete.{" "}
                <Link href="/login" className="text-accent-hover underline">
                  Request a new one
                </Link>
                .
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
