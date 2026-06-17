import Link from "next/link";
import PublicNav from "@/components/public-nav";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyApplicationActionToken } from "@/lib/application-action-token";
import { formatName } from "@/lib/format";
import ReviewActionCard from "./review-action-card";

export const dynamic = "force-dynamic";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg tv-paper">
      <PublicNav />
      <main className="flex items-center justify-center px-6 py-24">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}

export default async function ApplicationReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  const verified = token ? verifyApplicationActionToken(token) : null;
  if (!verified || !token) {
    return (
      <Shell>
        <div className="text-center">
          <h1 className="tv-h2 mb-4">Invalid link</h1>
          <p className="text-fg2 leading-relaxed">
            This review link is invalid or has expired. Open the application
            directly in the{" "}
            <Link href="/admin/applications" className="text-accent-hover underline">
              admin dashboard
            </Link>{" "}
            instead.
          </p>
        </div>
      </Shell>
    );
  }

  const admin = createAdminClient("read-only");
  const { data: application } = await admin
    .from("applications")
    .select(
      "id, first_name, last_name, company_name, company_website, linkedin_profile, attendee_stagetype, email, status"
    )
    .eq("id", verified.applicationId)
    .maybeSingle();

  if (!application) {
    return (
      <Shell>
        <div className="text-center">
          <h1 className="tv-h2 mb-4">Application not found</h1>
          <p className="text-fg2 leading-relaxed">
            This application no longer exists. It may have been deleted as spam.
          </p>
        </div>
      </Shell>
    );
  }

  if (application.status !== "pending") {
    return (
      <Shell>
        <div className="text-center">
          <h1 className="tv-h2 mb-4">Already handled</h1>
          <p className="text-fg2 leading-relaxed">
            {formatName(application.first_name, application.last_name)}&rsquo;s
            application is already marked{" "}
            <span className="font-semibold">{application.status}</span>. No action
            taken.
          </p>
          <p className="mt-4">
            <a
              href={`/admin/applications/${application.id}`}
              className="text-accent-hover underline"
            >
              Open in admin
            </a>
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <ReviewActionCard
        token={token}
        action={verified.action}
        applicantName={formatName(application.first_name, application.last_name)}
        companyName={application.company_name}
        email={application.email}
        companyWebsite={application.company_website}
        linkedinProfile={application.linkedin_profile}
        attendeeStagetype={application.attendee_stagetype}
        adminUrl={`/admin/applications/${application.id}`}
      />
    </Shell>
  );
}
