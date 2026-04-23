import PublicNav from "@/components/public-nav";
import PageHeader from "@/components/page-header";

export default function TeamPage() {
  return (
    <div className="tv-surface tv-paper min-h-screen">
      <PublicNav />
      <div className="tv-container-marketing tv-page-gutter py-9 text-center">
        <PageHeader title="Team" />
        {/* TODO(eric): content */}
      </div>
    </div>
  );
}
