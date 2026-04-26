import PublicNav from "@/components/public-nav";
import { H1 } from "@/components/ui/typography";
import FaqList from "./faq-list";

export default function FaqPage() {
  return (
    <div className="tv-surface min-h-screen">
      <PublicNav />

      <section className="tv-paper">
        <div className="max-w-[1120px] mx-auto tv-page-gutter py-section">
          <H1 className="mb-section max-w-[640px]">Frequently asked questions.</H1>
          <FaqList />
        </div>
      </section>

      <footer className="border-t border-border-subtle py-7 text-center text-[13px] text-fg3">
        Thunderview CEO Dinners
        <span className="text-fg4 mx-2">&middot;</span>
        Denver, Colorado
        <span className="text-fg4 mx-2">&middot;</span>
        team@thunderviewceodinners.com
      </footer>
    </div>
  );
}
