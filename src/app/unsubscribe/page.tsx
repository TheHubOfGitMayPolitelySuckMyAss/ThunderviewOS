import PublicNav from "@/components/public-nav";

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;

  return (
    <div className="min-h-screen bg-bg tv-paper">
      <PublicNav />
      <main className="flex items-center justify-center px-6 py-24">
        <div className="max-w-md text-center">
          {status === "success" ? (
            <>
              <h1 className="tv-h2 mb-4">You&rsquo;ve been unsubscribed</h1>
              <p className="text-fg2 leading-relaxed">
                You won&rsquo;t receive any more marketing emails from Thunderview CEO Dinners.
                If this was a mistake, you can re-subscribe from your{" "}
                <a href="/portal/profile" className="text-accent-hover underline">
                  Community Portal profile
                </a>.
              </p>
            </>
          ) : status === "invalid" ? (
            <>
              <h1 className="tv-h2 mb-4">Invalid link</h1>
              <p className="text-fg2 leading-relaxed">
                This unsubscribe link is invalid or has expired.
                If you&rsquo;d like to manage your email preferences, sign in to your{" "}
                <a href="/portal/profile" className="text-accent-hover underline">
                  Community Portal profile
                </a>.
              </p>
            </>
          ) : (
            <>
              <h1 className="tv-h2 mb-4">Something went wrong</h1>
              <p className="text-fg2 leading-relaxed">
                We couldn&rsquo;t process your unsubscribe request. Please try again or contact{" "}
                <a href="mailto:eric@marcoullier.com" className="text-accent-hover underline">
                  eric@marcoullier.com
                </a>.
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
