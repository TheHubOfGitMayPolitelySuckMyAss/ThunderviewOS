"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const navItems = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/dinners", label: "Dinners" },
  { href: "/admin/tickets", label: "Tickets" },
  { href: "/admin/applications", label: "Applications" },
  { href: "/admin/members", label: "Members" },
];

export default function AdminShell({
  email,
  role,
  children,
}: {
  email: string;
  role: "Admin" | "Team";
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col bg-gray-900 text-white">
        <div className="px-4 py-5">
          <h1 className="text-lg font-bold">Thunderview OS</h1>
        </div>
        <nav className="flex-1 space-y-1 px-2">
          {navItems.map((item) => {
            const active = (item as { exact?: boolean }).exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded px-3 py-2 text-sm ${
                  active
                    ? "bg-gray-700 font-medium text-white"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b bg-white px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">{email}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                role === "Admin"
                  ? "bg-purple-100 text-purple-700"
                  : "bg-blue-100 text-blue-700"
              }`}
            >
              {role}
            </span>
          </div>
          <button
            onClick={handleSignOut}
            className="rounded px-3 py-1 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            Sign out
          </button>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
