import PublicNav from "@/components/public-nav";
import { H1 } from "@/components/ui/typography";

export default function FAQPage() {
  return (
    <div className="tv-surface min-h-screen">
      <PublicNav />
      <div className="tv-container-marketing tv-page-gutter py-24 text-center">
        <H1>FAQ</H1>
        {/* TODO(eric): content */}
      </div>
    </div>
  );
}
