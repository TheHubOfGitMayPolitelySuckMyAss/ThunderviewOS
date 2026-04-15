import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function PortalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">
          Portal Coming Soon
        </h1>
        <p className="mt-2 text-gray-500">
          The attendee portal is under development.
        </p>
        <p className="mt-1 text-sm text-gray-400">
          Signed in as {user.email}
        </p>
      </div>
    </div>
  );
}
