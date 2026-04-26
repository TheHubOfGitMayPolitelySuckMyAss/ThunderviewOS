import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export default async function PublicNav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthenticated = !!user;

  return (
    <nav className="tv-nav sticky top-0 z-10 justify-between bg-[rgba(251,247,240,0.86)] backdrop-blur-[10px]">
      <Link href="/" className="tv-nav-logo no-underline">
        Thunderview
      </Link>

      <div className="hidden md:flex items-center gap-[var(--tv-nav-link-gap)] text-sm font-medium text-fg2">
        <Link href="/about" className="hover:text-fg1 no-underline">About</Link>
        <Link href="/faq" className="hover:text-fg1 no-underline">FAQ</Link>
        <Link href="/team" className="hover:text-fg1 no-underline">Team</Link>
      </div>

      <div className="flex items-center gap-[var(--tv-button-group-gap)]">
        {isAuthenticated ? (
          <Button asChild>
            <Link href="/portal">Member Portal</Link>
          </Button>
        ) : (
          <>
            <Button variant="secondary" asChild>
              <Link href="/apply">Apply</Link>
            </Button>
            <Button asChild>
              <Link href="/login">Sign In</Link>
            </Button>
          </>
        )}
      </div>
    </nav>
  );
}
