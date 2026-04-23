import Link from "next/link";
import PublicNav from "@/components/public-nav";
import { Button } from "@/components/ui/button";
import ConfettiEffect from "./confetti";

export default function ThanksPage() {
  return (
    <div className="tv-surface min-h-screen">
      <PublicNav />
      <div className="flex items-center justify-center px-gutter-sm" style={{ minHeight: "calc(100vh - var(--tv-nav-height))" }}>
        <div className="w-full max-w-[540px] bg-bg-elevated border border-transparent rounded-xl p-7 md:p-8 shadow-glow text-center">
          <h1 className="tv-h2 !text-[44px] mb-4">Thanks &mdash; we&rsquo;ll be in touch.</h1>
          <p className="text-[17px] text-fg2 leading-[1.55] mb-7" style={{ textWrap: "pretty" }}>
            Every application gets a real answer within a week, one way or the other. No auto-replies, no ghosting.
          </p>
          <Button variant="secondary" asChild>
            <Link href="/">&larr; Back to home</Link>
          </Button>
        </div>
      </div>
      <ConfettiEffect />
    </div>
  );
}
