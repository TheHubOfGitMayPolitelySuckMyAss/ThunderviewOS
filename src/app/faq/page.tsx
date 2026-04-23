import PublicNav from "@/components/public-nav";
import PageHeader from "@/components/page-header";

export default function FAQPage() {
  return (
    <div className="tv-surface min-h-screen">
      <PublicNav />
      <div className="tv-container-marketing tv-page-gutter py-9 text-center">
        <PageHeader title="FAQ" />
        {/* TODO(eric): content */}
      </div>
    </div>
  );
}
