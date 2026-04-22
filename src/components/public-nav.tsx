import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function PublicNav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthenticated = !!user;

  return (
    <nav className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 md:px-12 border-b border-border-subtle bg-[rgba(251,247,240,0.86)] backdrop-blur-[10px]">
      <Link
        href="/"
        className="font-display font-medium text-[22px] tracking-[-0.01em] text-fg1 no-underline"
      >
        Thunderview
      </Link>

      <div className="hidden md:flex items-center gap-7 text-sm font-medium text-fg2">
        <Link href="/about" className="hover:text-fg1 no-underline">About</Link>
        <Link href="/faq" className="hover:text-fg1 no-underline">FAQ</Link>
        <Link href="/team" className="hover:text-fg1 no-underline">Team</Link>
        <Link href="/gallery" className="hover:text-fg1 no-underline">Gallery</Link>
      </div>

      <div className="flex items-center gap-2.5">
        <Link
          href="/apply"
          className="inline-block rounded-md border border-border bg-transparent px-5 py-[11px] text-sm font-semibold text-fg1 no-underline transition-colors duration-[var(--tv-dur-fast)] hover:bg-bg-tinted"
        >
          Apply
        </Link>
        {isAuthenticated ? (
          <Link
            href="/portal"
            className="inline-block rounded-md bg-accent px-5 py-[11px] text-sm font-semibold text-cream-50 no-underline transition-colors duration-[var(--tv-dur-fast)] hover:bg-accent-hover"
          >
            Portal
          </Link>
        ) : (
          <Link
            href="/login"
            className="inline-block rounded-md bg-accent px-5 py-[11px] text-sm font-semibold text-cream-50 no-underline transition-colors duration-[var(--tv-dur-fast)] hover:bg-accent-hover"
          >
            Sign In
          </Link>
        )}
      </div>
    </nav>
  );
}
