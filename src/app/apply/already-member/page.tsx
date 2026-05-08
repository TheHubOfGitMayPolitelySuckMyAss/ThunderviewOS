import Link from "next/link";
import PublicNav from "@/components/public-nav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AlreadyMemberPage() {
  return (
    <div className="tv-surface min-h-screen">
      <PublicNav />
      <div
        className="flex items-center justify-center px-gutter-sm py-7"
        style={{ minHeight: "calc(100vh - var(--tv-nav-height))" }}
      >
        <Card className="w-full max-w-[520px] text-center">
          <h1
            className="font-display font-medium text-[36px] leading-[1.1] tracking-[-0.015em] mb-4"
            style={{ fontVariationSettings: '"opsz" 144' }}
          >
            Hooray! You&rsquo;re already a member.
          </h1>
          <p className="text-[15px] text-fg2 leading-[1.5] mb-6">
            That email is already on file. No need to apply &mdash; just sign in
            and you&rsquo;re back in.
          </p>
          <Button asChild size="lg" className="w-full justify-center">
            <Link href="/login">Sign In</Link>
          </Button>
        </Card>
      </div>
    </div>
  );
}
