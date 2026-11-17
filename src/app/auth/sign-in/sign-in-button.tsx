"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

// Disables itself on first press: the login token is single-use, so a
// double-click would send a second, failing sign-in attempt.
export default function SignInButton() {
  const [submitting, setSubmitting] = useState(false);
  return (
    <Button
      type="submit"
      variant="primary"
      size="lg"
      disabled={submitting}
      onClick={(e) => {
        if (submitting) {
          e.preventDefault();
          return;
        }
        // Defer the disable so the browser still submits this click.
        setTimeout(() => setSubmitting(true), 0);
      }}
    >
      {submitting ? "Signing in…" : "Sign in"}
    </Button>
  );
}
