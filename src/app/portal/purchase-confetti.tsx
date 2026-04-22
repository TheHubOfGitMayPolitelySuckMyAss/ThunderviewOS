"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import ConfettiEffect from "@/app/apply/thanks/confetti";

export default function PurchaseConfetti() {
  const router = useRouter();

  useEffect(() => {
    // Clean up the query param silently after confetti fires
    router.replace("/portal", { scroll: false });
  }, [router]);

  return <ConfettiEffect />;
}
