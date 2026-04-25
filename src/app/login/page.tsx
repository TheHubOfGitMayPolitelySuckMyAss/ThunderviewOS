import PublicNav from "@/components/public-nav";
import LoginForm from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;

  return (
    <div className="tv-surface min-h-screen">
      <PublicNav />
      <div className="flex items-center justify-center px-gutter-sm py-7" style={{ minHeight: "calc(100vh - var(--tv-nav-height))" }}>
        <LoginForm redirect={redirect} />
      </div>
    </div>
  );
}
