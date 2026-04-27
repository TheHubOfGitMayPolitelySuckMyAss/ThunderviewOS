"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createDraft } from "./monday-before/actions";

interface Props {
  dinnerId: string;
  dinnerLabel: string;
}

export default function CreateMondayBeforeButton({ dinnerId, dinnerLabel }: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      const result = await createDraft(dinnerId);
      if (result.success && result.emailId) {
        router.push(`/admin/emails/monday-before/${result.emailId}`);
      }
    });
  }

  return (
    <Button variant="secondary" size="sm" onClick={handleClick} disabled={isPending}>
      {isPending ? "Creating\u2026" : `Create draft for ${dinnerLabel}`}
    </Button>
  );
}
