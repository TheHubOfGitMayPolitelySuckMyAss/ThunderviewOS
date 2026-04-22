import PublicNav from "@/components/public-nav";
import { H1 } from "@/components/ui/typography";

export default function GalleryPage() {
  return (
    <div className="tv-surface min-h-screen">
      <PublicNav />
      <div className="max-w-[1040px] mx-auto px-6 md:px-12 py-24 text-center">
        <H1>Gallery</H1>
        {/* TODO(eric): content */}
      </div>
    </div>
  );
}
