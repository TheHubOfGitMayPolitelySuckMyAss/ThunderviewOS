import Link from "next/link";
import PublicNav from "@/components/public-nav";
import SignInButton from "./sign-in-button";

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
              <h1 className="tv-h2 mb-3">Sign in to Thunderview</h1>
              {email ? (
                <p className="text-fg2 mb-6">
                  Signing in as <span className="text-fg1 font-semibold">{email}</span>
                </p>
              ) : (
                <p className="text-fg2 mb-6">Press the button to finish signing in.</p>
              )}
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
