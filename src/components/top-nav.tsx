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
    <nav className="flex items-center justify-between border-b bg-white px-6 py-3">
      {/* Left: logo + links */}
      <div className="flex items-center gap-6">
        <Link href="/portal" className="text-lg font-bold text-gray-900">
          Thunderview OS
        </Link>
        <div className="flex items-center gap-4">
          {navLinks.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium ${
                  active
                    ? "text-gray-900"
                    : "text-gray-500 hover:text-gray-700"
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
          className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-xs font-medium text-white hover:bg-gray-800 overflow-hidden"
        >
          {profilePicUrl ? (
            <Image src={profilePicUrl} alt={initials} width={32} height={32} className="h-8 w-8 rounded-full object-cover" unoptimized />
          ) : (
            initials
          )}
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 z-50 mt-2 w-48 rounded-md border bg-white py-1 shadow-lg">
            <Link
              href="/portal/profile"
              onClick={() => setDropdownOpen(false)}
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Update Profile
            </Link>
            {showAdminLink && (
              <Link
                href="/admin"
                onClick={() => setDropdownOpen(false)}
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Admin
              </Link>
            )}
            <button
              onClick={handleSignOut}
              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
