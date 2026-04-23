import PublicNav from "@/components/public-nav";
import ConfettiEffect from "./confetti";

export default function ThanksPage() {
  return (
    <div className="tv-surface min-h-screen">
      <PublicNav />
      <div className="flex items-center justify-center px-gutter-sm py-7" style={{ minHeight: "calc(100vh - var(--tv-nav-height))" }}>
        <div className="w-full max-w-[520px] bg-bg border border-border rounded-lg p-8 shadow-sm text-center">
          <h1 className="font-display font-medium text-[36px] leading-[1.1] tracking-[-0.015em] mb-4" style={{ fontVariationSettings: '"opsz" 144' }}>
            Thanks for applying!
          </h1>
          <p className="text-[15px] text-fg2 leading-[1.5] mb-6">
            We&rsquo;ll review your application and get back to you soon. If you
            have questions in the meantime, email{" "}
            <a
              href="mailto:eric@marcoullier.com"
              className="text-accent-hover underline decoration-border hover:decoration-accent"
            >
              eric@marcoullier.com
            </a>
            .
          </p>
        </div>
      </div>
      <ConfettiEffect />
    </div>
  );
}
