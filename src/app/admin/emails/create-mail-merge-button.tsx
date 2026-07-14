"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createMailMerge } from "./mail-merge/actions";

export default function CreateMailMergeButton() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      const result = await createMailMerge();
      if (result.success && result.mergeId) {
        router.push(`/admin/emails/mail-merge/${result.mergeId}`);
      }
    });
  }

  return (
    <Button variant="secondary" size="sm" onClick={handleClick} disabled={isPending}>
      {isPending ? "Creating…" : "New Mail Merge"}
    </Button>
  );
}
