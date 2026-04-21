"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/dinners", label: "Dinners" },
  { href: "/admin/members", label: "Members" },
  { href: "/admin/applications", label: "Applications" },
  { href: "/admin/tickets", label: "Tickets" },
  { href: "/admin/emails", label: "Emails" },
];

export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col bg-gray-900 text-white">
        <nav className="flex-1 space-y-1 px-2 py-4">
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
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
