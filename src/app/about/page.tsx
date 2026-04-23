import PublicNav from "@/components/public-nav";
import { H1 } from "@/components/ui/typography";

export default function AboutPage() {
  return (
    <div className="tv-surface min-h-screen">
      <PublicNav />
      <div className="tv-container-marketing tv-page-gutter py-9 text-center">
        <H1>About</H1>
        {/* TODO(eric): content */}
      </div>
    </div>
  );
}
