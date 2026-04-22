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

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const navLinks = [
    { href: "/portal/tickets", label: "Tickets" },
    { href: "/portal/community", label: "Community" },
    { href: "/portal/recap", label: "Last Month's Intros & Asks" },
  ];

  const showAdminLink = isAdmin || isTeam;

  return (
    <nav className="sticky top-0 z-10 flex items-center justify-between border-b border-line-200 bg-cream-50 px-7 py-3.5">
      {/* Left: logo + links */}
      <div className="flex items-center gap-7">
        <Link
          href="/portal"
          className="font-display font-medium text-[20px] tracking-[-0.01em] text-fg1 no-underline"
        >
          Thunderview
        </Link>
        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium no-underline ${
                  active
                    ? "text-fg1 border-b-2 border-clay-500 pb-[3px]"
                    : "text-fg2 hover:text-fg1"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Right: avatar */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-clay-500 text-[13px] font-semibold text-cream-50 cursor-pointer overflow-hidden transition-colors duration-[var(--tv-dur-fast)]"
        >
          {profilePicUrl ? (
            <Image src={profilePicUrl} alt={initials} width={36} height={36} className="h-9 w-9 rounded-full object-cover" unoptimized />
          ) : (
            initials
          )}
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 z-50 mt-2 w-48 rounded-lg border border-line-200 bg-cream-50 py-1 shadow-md">
            <Link
              href="/portal/profile"
              onClick={() => setDropdownOpen(false)}
              className="block px-4 py-2 text-sm text-fg2 no-underline hover:bg-cream-100"
            >
              Update Profile
            </Link>
            {showAdminLink && (
              <Link
                href="/admin"
                onClick={() => setDropdownOpen(false)}
                className="block px-4 py-2 text-sm text-fg2 no-underline hover:bg-cream-100"
              >
                Admin
              </Link>
            )}
            <button
              onClick={handleSignOut}
              className="block w-full px-4 py-2 text-left text-sm text-fg2 cursor-pointer hover:bg-cream-100"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
