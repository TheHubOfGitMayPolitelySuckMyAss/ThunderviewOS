"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_GROUPS = [
  {
    label: "Operations",
    items: [
      { href: "/admin", label: "Dashboard", exact: true },
      { href: "/admin/dinners", label: "Dinners" },
      { href: "/admin/tickets", label: "Tickets" },
      { href: "/admin/applications", label: "Applications" },
      { href: "/admin/members", label: "Members" },
    ],
  },
  {
    label: "Communication",
    items: [
      { href: "/admin/emails", label: "Emails" },
    ],
  },
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
      <aside className="flex w-[220px] flex-col bg-bg-elevated border-r border-border">
        <nav className="flex-1 px-3 py-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="px-3 pt-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-fg3">
                {group.label}
              </div>
              {group.items.map((item) => {
                const active = (item as { exact?: boolean }).exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium no-underline mb-0.5 ${
                      active
                        ? "bg-ink-900 text-cream-50"
                        : "text-fg2 hover:bg-bg-tinted"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto bg-bg tv-page-gutter py-8">{children}</main>
      </div>
    </div>
  );
}
