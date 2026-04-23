import PublicNav from "@/components/public-nav";
import PageHeader from "@/components/page-header";

export default function GalleryPage() {
  return (
    <div className="tv-surface tv-paper min-h-screen">
      <PublicNav />
      <div className="tv-container-marketing tv-page-gutter py-9 text-center">
        <PageHeader title="Gallery" />
        {/* TODO(eric): content */}
      </div>
    </div>
  );
}
