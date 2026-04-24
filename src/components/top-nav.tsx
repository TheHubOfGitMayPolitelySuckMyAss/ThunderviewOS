"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type TopNavProps = {
  initials: string;
  isAdmin: boolean;
  isTeam: boolean;
  profilePicUrl?: string | null;
};

export default function TopNav({ initials, isAdmin, isTeam, profilePicUrl }: TopNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleMouseEnter() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setDropdownOpen(true);
  }

  function handleMouseLeave() {
    closeTimer.current = setTimeout(() => setDropdownOpen(false), 200);
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const navLinks = [
    { href: "/portal/tickets", label: "Tickets" },
    { href: "/portal/community", label: "Community" },
    { href: "/portal/recap", label: "Monthly Recap" },
    ...((isAdmin || isTeam) ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <nav className="tv-nav sticky top-0 z-10 bg-bg relative justify-between">
      {/* Left: logo */}
      <Link href="/portal" className="tv-nav-logo no-underline flex-shrink-0 relative z-[1]">
        Thunderview
      </Link>

      {/* Center: links — absolutely positioned to align with viewport center */}
      <div className="hidden md:flex items-center gap-[var(--tv-nav-link-gap)] absolute inset-0 justify-center pointer-events-none">
        {navLinks.map((link) => {
          const active = link.href === "/admin"
            ? pathname.startsWith("/admin")
            : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium no-underline pointer-events-auto ${
                active
                  ? "text-fg1 border-b-2 border-accent pb-[3px]"
                  : "text-fg2 hover:text-fg1"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>

      {/* Right: avatar */}
      <div
        className="relative flex-shrink-0 z-[1]"
        ref={dropdownRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex h-[40px] w-[40px] items-center justify-center rounded-full bg-accent text-sm font-semibold text-cream-50 cursor-pointer overflow-hidden transition-colors duration-[120ms]"
        >
          {profilePicUrl ? (
            <Image src={profilePicUrl} alt={initials} width={40} height={40} className="h-[40px] w-[40px] rounded-full object-cover" unoptimized />
          ) : (
            initials
          )}
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 z-50 mt-2 w-48 rounded-lg border border-border bg-bg py-1 shadow-md">
            <Link
              href="/portal/profile"
              onClick={() => setDropdownOpen(false)}
              className="block px-4 py-2 text-sm text-fg2 no-underline hover:bg-bg-elevated"
            >
              Update Profile
            </Link>
            <button
              onClick={handleSignOut}
              className="block w-full px-4 py-2 text-left text-sm text-fg2 cursor-pointer hover:bg-bg-elevated"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
