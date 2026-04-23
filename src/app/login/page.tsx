import PublicNav from "@/components/public-nav";
import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <div className="tv-surface min-h-screen">
      <PublicNav />
      <div className="flex items-center justify-center px-gutter-sm py-7" style={{ minHeight: "calc(100vh - var(--tv-nav-height))" }}>
        <LoginForm />
      </div>
    </div>
  );
}
