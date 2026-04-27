"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createInstance } from "./instances/[id]/actions";

interface Props {
  templateSlug: string;
  dinnerId: string;
  dinnerLabel: string;
}

export default function CreateInstanceButton({ templateSlug, dinnerId, dinnerLabel }: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      const result = await createInstance(templateSlug, dinnerId);
      if (result.success && result.instanceId) {
        router.push(`/admin/emails/instances/${result.instanceId}`);
      }
    });
  }

  return (
    <Button variant="secondary" size="sm" onClick={handleClick} disabled={isPending}>
      {isPending ? "Creating\u2026" : `Create New \u2014 ${dinnerLabel}`}
    </Button>
  );
}
