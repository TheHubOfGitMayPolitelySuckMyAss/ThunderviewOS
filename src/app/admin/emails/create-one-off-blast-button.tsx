"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createDraft } from "./one-off-blast/actions";

export default function CreateOneOffBlastButton() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      const result = await createDraft();
      if (result.success && result.emailId) {
        router.push(`/admin/emails/one-off-blast/${result.emailId}`);
      }
    });
  }

  return (
    <Button variant="secondary" size="sm" onClick={handleClick} disabled={isPending}>
      {isPending ? "Creating…" : "Create Bulk Email"}
    </Button>
  );
}
